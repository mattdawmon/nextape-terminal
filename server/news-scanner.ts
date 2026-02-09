import { storage } from "./storage";

const CRYPTOPANIC_API = "https://cryptopanic.com/api/free/v1/posts";
const COINGECKO_NEWS = "https://api.coingecko.com/api/v3/news";
const INGEST_INTERVAL = 5 * 60 * 1000;
let lastIngestTime = 0;

export interface NewsSignal {
  title: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
  impact: "high" | "medium" | "low";
  relatedTokens: string[];
  publishedAt: string;
  url: string;
}

interface CachedNewsState {
  signals: NewsSignal[];
  overallSentiment: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  highImpactNews: NewsSignal[];
  fetchedAt: number;
}

let cachedNews: CachedNewsState = {
  signals: [],
  overallSentiment: 50,
  bullishCount: 0,
  bearishCount: 0,
  neutralCount: 0,
  highImpactNews: [],
  fetchedAt: 0,
};

const BULLISH_KEYWORDS = [
  "surge", "soar", "rally", "bull", "breakout", "all-time high", "ath",
  "adoption", "partnership", "launch", "approval", "etf approved", "upgrade",
  "institutional", "buy", "accumulate", "moon", "pump", "listing",
  "bullish", "outperform", "growth", "milestone", "record", "positive",
  "trillion", "billion inflow", "whale buy", "massive buy", "integration",
];

const BEARISH_KEYWORDS = [
  "crash", "dump", "bear", "hack", "exploit", "rug", "scam", "fraud",
  "ban", "regulation", "sec", "lawsuit", "bankruptcy", "liquidation",
  "sell-off", "selloff", "plunge", "decline", "bearish", "warning",
  "investigation", "sanctions", "delisting", "fud", "collapse",
  "exit scam", "ponzi", "shutdown", "seized", "loss",
];

const HIGH_IMPACT_KEYWORDS = [
  "etf", "sec", "fed", "federal reserve", "regulation", "ban", "hack",
  "billion", "trillion", "institutional", "blackrock", "all-time",
  "crash", "exploit", "liquidation", "bankruptcy", "halving",
  "interest rate", "inflation", "breaking", "urgent",
];

const TOKEN_MAP: Record<string, string[]> = {
  bitcoin: ["BTC"], btc: ["BTC"],
  ethereum: ["ETH"], eth: ["ETH"],
  solana: ["SOL"], sol: ["SOL"],
  bnb: ["BNB"], binance: ["BNB"],
  tron: ["TRX"], trx: ["TRX"],
  dogecoin: ["DOGE"], doge: ["DOGE"],
  pepe: ["PEPE"],
  shiba: ["SHIB"], shib: ["SHIB"],
  xrp: ["XRP"], ripple: ["XRP"],
  cardano: ["ADA"],
  avalanche: ["AVAX"],
  chainlink: ["LINK"],
  uniswap: ["UNI"],
  jupiter: ["JUP"],
  bonk: ["BONK"],
  wif: ["WIF"],
  floki: ["FLOKI"],
  sui: ["SUI"],
  sei: ["SEI"],
  near: ["NEAR"],
  injective: ["INJ"],
  render: ["RNDR"],
  fetch: ["FET"],
  pyth: ["PYTH"],
  arbitrum: ["ARB"],
  optimism: ["OP"],
  polygon: ["MATIC"],
  aptos: ["APT"],
  celestia: ["TIA"],
};

function analyzeSentiment(title: string, body?: string): { sentiment: "bullish" | "bearish" | "neutral"; confidence: number } {
  const text = `${title} ${body || ""}`.toLowerCase();
  let bullScore = 0;
  let bearScore = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (text.includes(kw)) bullScore += (kw.length > 6 ? 2 : 1);
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (text.includes(kw)) bearScore += (kw.length > 6 ? 2 : 1);
  }

  const diff = bullScore - bearScore;
  if (diff >= 2) return { sentiment: "bullish", confidence: Math.min(90, 50 + diff * 10) };
  if (diff <= -2) return { sentiment: "bearish", confidence: Math.min(90, 50 + Math.abs(diff) * 10) };
  return { sentiment: "neutral", confidence: 40 };
}

function determineImpact(title: string): "high" | "medium" | "low" {
  const lower = title.toLowerCase();
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (lower.includes(kw)) return "high";
  }
  if (lower.includes("update") || lower.includes("report") || lower.includes("analysis")) return "medium";
  return "low";
}

function extractRelatedTokens(title: string, body?: string): string[] {
  const text = `${title} ${body || ""}`.toLowerCase();
  const found = new Set<string>();

  for (const [keyword, symbols] of Object.entries(TOKEN_MAP)) {
    if (text.includes(keyword)) {
      symbols.forEach(s => found.add(s));
    }
  }

  const symbolRegex = /\b([A-Z]{2,6})\b/g;
  const upperTitle = title;
  let match;
  while ((match = symbolRegex.exec(upperTitle)) !== null) {
    const sym = match[1];
    if (Object.values(TOKEN_MAP).some(arr => arr.includes(sym))) {
      found.add(sym);
    }
  }

  return Array.from(found);
}

async function fetchCryptoPanicNews(): Promise<NewsSignal[]> {
  try {
    const resp = await fetch(`${CRYPTOPANIC_API}/?auth_token=free&public=true&kind=news&filter=hot`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      console.log(`[NewsScanner] CryptoPanic returned ${resp.status}`);
      return [];
    }

    const data = await resp.json() as any;
    const results = data?.results || [];
    if (!Array.isArray(results)) return [];

    return results.slice(0, 30).map((item: any) => {
      const title = item.title || "";
      const { sentiment } = analyzeSentiment(title, item.body || "");
      const impact = determineImpact(title);
      const relatedTokens = extractRelatedTokens(title, item.body || "");

      return {
        title,
        source: item.source?.title || "CryptoPanic",
        sentiment,
        impact,
        relatedTokens,
        publishedAt: item.published_at || new Date().toISOString(),
        url: item.url || "",
      };
    });
  } catch (err) {
    console.log("[NewsScanner] CryptoPanic fetch failed:", (err as Error).message);
    return [];
  }
}

async function fetchCoinGeckoNews(): Promise<NewsSignal[]> {
  try {
    const resp = await fetch(COINGECKO_NEWS, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      console.log(`[NewsScanner] CoinGecko news returned ${resp.status}`);
      return [];
    }

    const data = await resp.json() as any;
    const items = data?.data || data || [];
    if (!Array.isArray(items)) return [];

    return items.slice(0, 20).map((item: any) => {
      const title = item.title || item.headline || "";
      const description = item.description || "";
      const { sentiment } = analyzeSentiment(title, description);
      const impact = determineImpact(title);
      const relatedTokens = extractRelatedTokens(title, description);

      return {
        title,
        source: item.author || "CoinGecko",
        sentiment,
        impact,
        relatedTokens,
        publishedAt: item.updated_at ? new Date(item.updated_at * 1000).toISOString() : new Date().toISOString(),
        url: item.url || "",
      };
    });
  } catch (err) {
    console.log("[NewsScanner] CoinGecko news fetch failed:", (err as Error).message);
    return [];
  }
}

async function fetchDexScreenerTrendingNews(): Promise<NewsSignal[]> {
  try {
    const resp = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return [];

    const data = await resp.json() as any[];
    if (!Array.isArray(data)) return [];

    const signals: NewsSignal[] = [];
    for (const item of data.slice(0, 15)) {
      const boosts = item.totalAmount || 0;
      if (boosts < 10) continue;

      const description = item.description || "";
      const links = item.links || [];
      const hasTwitter = links.some((l: any) => l.type === "twitter");

      const sentiment: "bullish" | "bearish" | "neutral" = boosts > 100 ? "bullish" : boosts > 30 ? "neutral" : "neutral";
      const impact: "high" | "medium" | "low" = boosts > 200 ? "high" : boosts > 50 ? "medium" : "low";

      signals.push({
        title: `${description || "Token"} trending with ${boosts} boosts on DexScreener${hasTwitter ? " (Twitter active)" : ""}`,
        source: "DexScreener",
        sentiment,
        impact,
        relatedTokens: [],
        publishedAt: new Date().toISOString(),
        url: item.url || `https://dexscreener.com/${item.chainId}/${item.tokenAddress}`,
      });
    }
    return signals;
  } catch (err) {
    return [];
  }
}

export async function ingestNewsData(): Promise<void> {
  if (Date.now() - lastIngestTime < INGEST_INTERVAL) return;
  lastIngestTime = Date.now();

  console.log("[NewsScanner] Starting news ingestion from multiple sources...");

  const [cryptoPanic, coinGecko, dexTrending] = await Promise.all([
    fetchCryptoPanicNews(),
    fetchCoinGeckoNews(),
    fetchDexScreenerTrendingNews(),
  ]);

  const allNews = [...cryptoPanic, ...coinGecko, ...dexTrending];

  if (allNews.length === 0) {
    console.log("[NewsScanner] No news found from any source");
    return;
  }

  const bullishCount = allNews.filter(n => n.sentiment === "bullish").length;
  const bearishCount = allNews.filter(n => n.sentiment === "bearish").length;
  const neutralCount = allNews.filter(n => n.sentiment === "neutral").length;
  const total = allNews.length;

  const overallSentiment = Math.round(
    ((bullishCount * 80 + neutralCount * 50 + bearishCount * 20) / total)
  );

  const highImpactNews = allNews.filter(n => n.impact === "high");

  cachedNews = {
    signals: allNews,
    overallSentiment,
    bullishCount,
    bearishCount,
    neutralCount,
    highImpactNews,
    fetchedAt: Date.now(),
  };

  let persisted = 0;
  for (const news of allNews.slice(0, 50)) {
    try {
      await storage.upsertCryptoNews({
        title: news.title.slice(0, 500),
        source: news.source,
        sentiment: news.sentiment,
        impact: news.impact,
        relatedTokens: news.relatedTokens,
        publishedAt: new Date(news.publishedAt),
        url: news.url,
      });
      persisted++;
    } catch {}
  }

  console.log(`[NewsScanner] Persisted ${persisted} news items (${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral). Overall sentiment: ${overallSentiment}`);
}

export function getNewsSignals(): CachedNewsState {
  return cachedNews;
}

export function getNewsSentimentForToken(symbol: string): { sentiment: number; hasHighImpact: boolean; newsCount: number } {
  const sym = symbol.toUpperCase();
  const relevant = cachedNews.signals.filter(n => n.relatedTokens.includes(sym));

  if (relevant.length === 0) {
    return { sentiment: cachedNews.overallSentiment, hasHighImpact: cachedNews.highImpactNews.length > 0, newsCount: 0 };
  }

  const bullish = relevant.filter(n => n.sentiment === "bullish").length;
  const bearish = relevant.filter(n => n.sentiment === "bearish").length;
  const total = relevant.length;
  const sentiment = Math.round((bullish * 85 + (total - bullish - bearish) * 50 + bearish * 15) / total);
  const hasHighImpact = relevant.some(n => n.impact === "high");

  return { sentiment, hasHighImpact, newsCount: total };
}

export function getOverallMarketNewsSentiment(): number {
  return cachedNews.overallSentiment;
}

export function startNewsIngestion(): void {
  console.log("[NewsScanner] Starting news scanning (every 5 min)");
  ingestNewsData();
  setInterval(() => ingestNewsData(), INGEST_INTERVAL);
}
