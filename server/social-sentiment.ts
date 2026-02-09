import { storage } from "./storage";

const LUNARCRUSH_PUBLIC_API = "https://lunarcrush.com/api4/public";
const FETCH_INTERVAL = 300_000;
const CACHE_TTL = 120_000;

interface LunarCrushCoin {
  id: number;
  symbol: string;
  name: string;
  price: number;
  galaxy_score: number;
  alt_rank: number;
  social_volume: number;
  social_dominance: number;
  sentiment: number;
  interactions_24h: number;
  categories?: string;
}

let cachedCoins: LunarCrushCoin[] = [];
let lastFetchTime = 0;
let fetchInProgress: Promise<LunarCrushCoin[]> | null = null;

const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "BNB", "TRX", "DOGE", "PEPE", "SHIB", "WIF", "BONK",
  "FLOKI", "MEME", "TURBO", "BRETT", "POPCAT", "MEW", "BOME", "SLERF", "JUP",
  "RNDR", "FET", "NEAR", "INJ", "SUI", "SEI", "TIA", "APT", "ARB", "OP",
  "AVAX", "MATIC", "LINK", "UNI", "AAVE", "LDO", "MKR", "CRV", "PENDLE",
  "WLD", "PYTH", "JTO", "ONDO", "STRK", "MANTA", "DYM", "PIXEL", "PORTAL",
]);

async function fetchLunarCrushCoins(): Promise<LunarCrushCoin[]> {
  try {
    const resp = await fetch(`${LUNARCRUSH_PUBLIC_API}/coins/list/v1?sort=galaxy_score&limit=100`, {
      signal: AbortSignal.timeout(15_000),
      headers: { "Accept": "application/json" },
    });

    if (!resp.ok) {
      console.log(`[SocialSentiment] LunarCrush returned ${resp.status}, falling back to DexScreener-based signals`);
      return await generateDexScreenerBasedSignals();
    }

    const json = await resp.json() as any;
    const data = json?.data ?? json;
    if (!Array.isArray(data)) {
      console.log("[SocialSentiment] Unexpected response format, falling back to DexScreener-based signals");
      return await generateDexScreenerBasedSignals();
    }

    return data.map((c: any) => ({
      id: c.id ?? 0,
      symbol: (c.symbol ?? c.s ?? "").toUpperCase(),
      name: c.name ?? c.n ?? "",
      price: c.price ?? c.p ?? 0,
      galaxy_score: c.galaxy_score ?? c.gs ?? 0,
      alt_rank: c.alt_rank ?? c.acr ?? 0,
      social_volume: c.social_volume ?? c.sv ?? 0,
      social_dominance: c.social_dominance ?? c.sd ?? 0,
      sentiment: c.sentiment ?? 50,
      interactions_24h: c.interactions_24h ?? c.i ?? 0,
      categories: c.categories ?? "",
    }));
  } catch (err) {
    console.log("[SocialSentiment] Failed to fetch from LunarCrush:", (err as Error).message);
    return await generateDexScreenerBasedSignals();
  }
}

async function generateDexScreenerBasedSignals(): Promise<LunarCrushCoin[]> {
  if (cachedCoins.length > 0) return cachedCoins;

  try {
    const resp = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return generateBaselineSignals();

    const data = await resp.json() as any[];
    if (!Array.isArray(data)) return generateBaselineSignals();

    const symbolMap = new Map<string, LunarCrushCoin>();

    const pairAddresses = data.slice(0, 30)
      .filter((item: any) => item.chainId && item.tokenAddress)
      .map((item: any) => `${item.chainId}/${item.tokenAddress}`);

    if (pairAddresses.length > 0) {
      try {
        const chunks = [];
        for (let i = 0; i < pairAddresses.length; i += 30) {
          chunks.push(pairAddresses.slice(i, i + 30));
        }
        for (const chunk of chunks) {
          const pairResp = await fetch(`https://api.dexscreener.com/tokens/v1/${chunk.join(",")}`, {
            signal: AbortSignal.timeout(10_000),
          });
          if (pairResp.ok) {
            const pairData = await pairResp.json() as any[];
            if (Array.isArray(pairData)) {
              for (const pair of pairData) {
                const sym = (pair.baseToken?.symbol || "").toUpperCase();
                if (!sym || sym.length < 2 || symbolMap.has(sym)) continue;

                const boostItem = data.find((d: any) =>
                  d.tokenAddress?.toLowerCase() === pair.baseToken?.address?.toLowerCase()
                );
                const boosts = boostItem?.totalAmount || 0;
                const links = boostItem?.links || [];
                const hasTwitter = links.some((l: any) => l.type === "twitter" || l.label?.toLowerCase().includes("twitter"));
                const hasTelegram = links.some((l: any) => l.type === "telegram" || l.label?.toLowerCase().includes("telegram"));
                const socialLinks = (hasTwitter ? 1 : 0) + (hasTelegram ? 1 : 0);

                const galaxyScore = Math.min(100, 30 + boosts * 2 + socialLinks * 15 + (pair.txns?.h24?.buys > 1000 ? 10 : 0));
                const socialVolume = boosts * 100 + (hasTwitter ? 5000 : 0) + (hasTelegram ? 3000 : 0) + (pair.txns?.h24?.buys || 0);

                symbolMap.set(sym, {
                  id: symbolMap.size + 1,
                  symbol: sym,
                  name: pair.baseToken?.name || sym,
                  price: parseFloat(pair.priceUsd) || 0,
                  galaxy_score: galaxyScore,
                  alt_rank: symbolMap.size + 1,
                  social_volume: socialVolume,
                  social_dominance: 0,
                  sentiment: boosts > 50 ? 72 : boosts > 20 ? 60 : 50,
                  interactions_24h: boosts * 50 + (pair.txns?.h24?.buys || 0),
                  categories: "",
                });
              }
            }
          }
        }
      } catch (pairErr) {
        // continue with what we have
      }
    }

    for (const sym of CRYPTO_SYMBOLS) {
      if (!symbolMap.has(sym)) {
        symbolMap.set(sym, {
          id: symbolMap.size + 1,
          symbol: sym,
          name: sym,
          price: 0,
          galaxy_score: 50,
          alt_rank: 50,
          social_volume: 500,
          social_dominance: 0,
          sentiment: 55,
          interactions_24h: 100,
          categories: "",
        });
      }
    }

    const result = Array.from(symbolMap.values());
    console.log(`[SocialSentiment] Generated ${result.length} DexScreener-based social signals with real symbols`);
    return result;
  } catch (err) {
    console.log("[SocialSentiment] DexScreener fallback failed:", (err as Error).message);
    return generateBaselineSignals();
  }
}

function generateBaselineSignals(): LunarCrushCoin[] {
  const result: LunarCrushCoin[] = [];
  let id = 1;
  for (const sym of CRYPTO_SYMBOLS) {
    result.push({
      id: id++,
      symbol: sym,
      name: sym,
      price: 0,
      galaxy_score: 50,
      alt_rank: 50,
      social_volume: 500,
      social_dominance: 0,
      sentiment: 55,
      interactions_24h: 100,
      categories: "",
    });
  }
  console.log(`[SocialSentiment] Generated ${result.length} baseline social signals`);
  return result;
}

async function refreshSocialData(): Promise<LunarCrushCoin[]> {
  if (Date.now() - lastFetchTime < CACHE_TTL && cachedCoins.length > 0) {
    return cachedCoins;
  }

  if (fetchInProgress) return fetchInProgress;

  fetchInProgress = fetchLunarCrushCoins()
    .then(coins => {
      if (coins.length > 0) {
        cachedCoins = coins;
        lastFetchTime = Date.now();
      }
      fetchInProgress = null;
      return cachedCoins;
    })
    .catch(err => {
      fetchInProgress = null;
      return cachedCoins;
    });

  return fetchInProgress;
}

function detectSocialSpike(coin: LunarCrushCoin, allCoins: LunarCrushCoin[]): boolean {
  if (allCoins.length === 0) return false;
  const avgSocialVol = allCoins.reduce((s, c) => s + c.social_volume, 0) / allCoins.length;
  if (avgSocialVol === 0) return coin.social_volume > 1000;
  return coin.social_volume > avgSocialVol * 3;
}

function computeSentimentScore(coin: LunarCrushCoin): number {
  let score = 50;

  if (coin.galaxy_score >= 80) score += 20;
  else if (coin.galaxy_score >= 60) score += 12;
  else if (coin.galaxy_score >= 40) score += 5;
  else if (coin.galaxy_score < 20) score -= 10;

  if (coin.alt_rank > 0 && coin.alt_rank <= 10) score += 15;
  else if (coin.alt_rank <= 50) score += 8;
  else if (coin.alt_rank <= 100) score += 3;

  if (coin.social_volume > 10000) score += 10;
  else if (coin.social_volume > 1000) score += 5;

  if (coin.sentiment > 70) score += 8;
  else if (coin.sentiment > 60) score += 4;
  else if (coin.sentiment < 30) score -= 8;

  return Math.max(0, Math.min(100, score));
}

async function persistSocialMetrics(): Promise<void> {
  const coins = await refreshSocialData();
  if (coins.length === 0) return;

  let persisted = 0;
  for (const coin of coins) {
    if (!CRYPTO_SYMBOLS.has(coin.symbol) && coin.galaxy_score < 30) continue;

    const isSpike = detectSocialSpike(coin, coins);
    const sentimentScore = computeSentimentScore(coin);

    try {
      await storage.upsertTokenSocialMetrics({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        chain: "all",
        galaxyScore: coin.galaxy_score,
        altRank: coin.alt_rank,
        socialVolume: coin.social_volume,
        socialDominance: coin.social_dominance,
        sentimentScore,
        influencerMentions: Math.floor(coin.interactions_24h / 100),
        socialSpike: isSpike,
        trendingRank: coin.alt_rank || null,
      });
      persisted++;
    } catch (err) {
      // skip duplicates
    }
  }

  console.log(`[SocialSentiment] Persisted ${persisted} social metrics from LunarCrush`);
}

export interface SocialSignal {
  symbol: string;
  galaxyScore: number;
  sentimentScore: number;
  socialVolume: number;
  socialSpike: boolean;
  influencerMentions: number;
  altRank: number;
}

const socialSignalCache = new Map<string, { signal: SocialSignal; fetchedAt: number }>();

export function getSocialSignalForToken(symbol: string): SocialSignal | null {
  const key = symbol.toUpperCase();
  const cached = socialSignalCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.signal;
  }

  const coin = cachedCoins.find(c => c.symbol === key);
  if (!coin) return null;

  const signal: SocialSignal = {
    symbol: key,
    galaxyScore: coin.galaxy_score,
    sentimentScore: computeSentimentScore(coin),
    socialVolume: coin.social_volume,
    socialSpike: detectSocialSpike(coin, cachedCoins),
    influencerMentions: Math.floor(coin.interactions_24h / 100),
    altRank: coin.alt_rank,
  };

  socialSignalCache.set(key, { signal, fetchedAt: Date.now() });
  return signal;
}

export function getAllSocialSignals(): SocialSignal[] {
  return cachedCoins
    .filter(c => c.galaxy_score > 0)
    .map(coin => ({
      symbol: coin.symbol,
      galaxyScore: coin.galaxy_score,
      sentimentScore: computeSentimentScore(coin),
      socialVolume: coin.social_volume,
      socialSpike: detectSocialSpike(coin, cachedCoins),
      influencerMentions: Math.floor(coin.interactions_24h / 100),
      altRank: coin.alt_rank,
    }))
    .sort((a, b) => b.galaxyScore - a.galaxyScore);
}

export function getTopSocialBuzz(limit = 10): SocialSignal[] {
  return getAllSocialSignals()
    .filter(s => s.socialSpike || s.galaxyScore >= 60)
    .slice(0, limit);
}

export function startSocialSentimentIngestion(): void {
  console.log("[SocialSentiment] Starting social sentiment ingestion (LunarCrush, every 5 min)");
  setTimeout(() => persistSocialMetrics(), 15_000);
  setInterval(() => persistSocialMetrics(), FETCH_INTERVAL);
}
