const DEXSCREENER_API = "https://api.dexscreener.com";

const CHAIN_MAP: Record<string, string> = {
  solana: "solana",
  ethereum: "ethereum",
  base: "base",
  bsc: "bsc",
  tron: "tron",
};

const DEX_TO_LAUNCHPAD: Record<string, string> = {
  pumpswap: "pumpfun",
  "pump.fun": "pumpfun",
  raydium: "raydium",
  orca: "orca",
  jupiter: "jupiter",
  meteora: "meteora",
  uniswap: "uniswap",
  "uniswap_v2": "uniswap",
  "uniswap_v3": "uniswap",
  pancakeswap: "pancakeswap",
  "pancakeswap_v2": "pancakeswap",
  "pancakeswap_v3": "pancakeswap",
  fourmeme: "fourmeme",
  "four.meme": "fourmeme",
  moonshot: "moonshot",
  sunswap: "sunswap",
  "sunswap_v2": "sunswap",
  "sun.io": "sunswap",
  aerodrome: "aerodrome",
  baseswap: "baseswap",
  sushiswap: "sushiswap",
  balancer: "balancer",
  camelot: "camelot",
  launchlab: "launchlab",
};

export interface LiveMemeToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  priceChange1h: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  liquidity: number | null;
  holders: number | null;
  txns24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  chain: string;
  launchpad: string;
  bondingCurveProgress: number;
  graduated: boolean;
  devWalletPercent: number | null;
  createdAt: string | null;
  pairAddress: string | null;
  dexUrl: string | null;
  boosts: number | null;
}

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  txns?: { h24?: { buys: number; sells: number }; h1?: { buys: number; sells: number } };
  volume?: { h24?: number; h6?: number; h1?: number };
  priceChange?: { h1?: number; h24?: number; m5?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
  boosts?: { active?: number };
}

interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
}

let cachedTokens: LiveMemeToken[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 30_000;
let fetchInProgress: Promise<LiveMemeToken[]> | null = null;

function mapPairToToken(pair: DexPair, imageUrl?: string | null): LiveMemeToken {
  const chainId = pair.chainId;
  const chain = Object.entries(CHAIN_MAP).find(([, v]) => v === chainId)?.[0] || chainId;
  const dexId = (pair.dexId || "").toLowerCase();
  const launchpad = DEX_TO_LAUNCHPAD[dexId] || dexId;

  const graduated = true;
  const bondingCurveProgress = 100;

  return {
    id: `live-${pair.pairAddress}`,
    address: pair.baseToken.address,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    image: imageUrl || pair.info?.imageUrl || null,
    price: parseFloat(pair.priceUsd || "0"),
    priceChange1h: pair.priceChange?.h1 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,
    volume24h: pair.volume?.h24 ?? null,
    marketCap: pair.marketCap ?? pair.fdv ?? null,
    liquidity: pair.liquidity?.usd ?? null,
    holders: null,
    txns24h: pair.txns?.h24 ? (pair.txns.h24.buys + pair.txns.h24.sells) : null,
    buys24h: pair.txns?.h24?.buys ?? null,
    sells24h: pair.txns?.h24?.sells ?? null,
    chain,
    launchpad,
    bondingCurveProgress,
    graduated,
    devWalletPercent: null,
    createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    pairAddress: pair.pairAddress,
    dexUrl: pair.url || null,
    boosts: pair.boosts?.active ?? null,
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTokenProfiles(): Promise<TokenProfile[]> {
  const data = await fetchWithTimeout(`${DEXSCREENER_API}/token-profiles/latest/v1`);
  return Array.isArray(data) ? data : [];
}

async function fetchBoostedTokens(): Promise<TokenProfile[]> {
  const data = await fetchWithTimeout(`${DEXSCREENER_API}/token-boosts/latest/v1`);
  return Array.isArray(data) ? data : [];
}

async function fetchPairsForTokens(addresses: string[]): Promise<DexPair[]> {
  if (addresses.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    batches.push(addresses.slice(i, i + 30));
  }

  const results: DexPair[] = [];
  for (const batch of batches) {
    const data = await fetchWithTimeout(`${DEXSCREENER_API}/latest/dex/tokens/${batch.join(",")}`);
    if (data?.pairs && Array.isArray(data.pairs)) {
      results.push(...data.pairs);
    }
    if (batches.length > 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

async function fetchLatestPairsBySearch(): Promise<DexPair[]> {
  const queries = ["pump", "meme", "pepe", "doge", "cat", "ai"];
  const allPairs: DexPair[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const data = await fetchWithTimeout(`${DEXSCREENER_API}/latest/dex/search?q=${q}`);
    if (data?.pairs && Array.isArray(data.pairs)) {
      for (const pair of data.pairs) {
        const key = pair.pairAddress;
        if (!seen.has(key)) {
          seen.add(key);
          allPairs.push(pair);
        }
      }
    }
    await new Promise(r => setTimeout(r, 150));
  }
  return allPairs;
}

async function fetchAllLiveTokens(): Promise<LiveMemeToken[]> {
  const [profiles, boosted, searchPairs] = await Promise.all([
    fetchTokenProfiles(),
    fetchBoostedTokens(),
    fetchLatestPairsBySearch(),
  ]);

  const profileMap = new Map<string, TokenProfile>();
  for (const p of [...profiles, ...boosted]) {
    profileMap.set(p.tokenAddress.toLowerCase(), p);
  }

  const addrSet = new Set<string>();
  profiles.forEach(p => addrSet.add(p.tokenAddress));
  boosted.forEach(p => addrSet.add(p.tokenAddress));
  const profileAddresses = Array.from(addrSet);

  const profilePairs = await fetchPairsForTokens(profileAddresses);

  const allPairs: DexPair[] = [];
  const seenPairs = new Set<string>();

  for (const pair of [...profilePairs, ...searchPairs]) {
    const key = pair.pairAddress;
    if (!seenPairs.has(key)) {
      seenPairs.add(key);
      allPairs.push(pair);
    }
  }

  const supportedChains = new Set(Object.values(CHAIN_MAP));
  const filteredPairs = allPairs.filter(p => supportedChains.has(p.chainId));

  const bestPairPerToken = new Map<string, DexPair>();
  for (const pair of filteredPairs) {
    const key = `${pair.chainId}-${pair.baseToken.address.toLowerCase()}`;
    const existing = bestPairPerToken.get(key);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      bestPairPerToken.set(key, pair);
    }
  }

  const tokens: LiveMemeToken[] = [];
  const pairValues = Array.from(bestPairPerToken.values());
  for (const pair of pairValues) {
    const profile = profileMap.get(pair.baseToken.address.toLowerCase());
    let iconUrl: string | null = null;
    if (profile?.icon) {
      iconUrl = profile.icon.startsWith("http") ? profile.icon
        : `https://cdn.dexscreener.com/cms/images/${profile.icon}?width=64&height=64&fit=crop&quality=95&format=auto`;
    }
    tokens.push(mapPairToToken(pair, iconUrl));
  }

  return tokens;
}

export async function getLiveMemeTokens(): Promise<LiveMemeToken[]> {
  const now = Date.now();
  if (cachedTokens.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedTokens;
  }

  if (fetchInProgress) {
    return fetchInProgress;
  }

  fetchInProgress = fetchAllLiveTokens()
    .then(tokens => {
      cachedTokens = tokens;
      lastFetchTime = Date.now();
      fetchInProgress = null;
      console.log(`[LiveMemes] Fetched ${tokens.length} live tokens from DexScreener`);
      return tokens;
    })
    .catch(err => {
      fetchInProgress = null;
      console.error("[LiveMemes] Error fetching live tokens:", err);
      return cachedTokens;
    });

  return fetchInProgress;
}

const GECKO_CHAIN_MAP: Record<string, string> = {
  solana: "solana",
  ethereum: "eth",
  base: "base",
  bsc: "bsc",
  tron: "tron",
};

const GECKO_TIMEFRAME_MAP: Record<string, { timeframe: string; aggregate: number; limit: number }> = {
  "1H": { timeframe: "minute", aggregate: 1, limit: 60 },
  "4H": { timeframe: "minute", aggregate: 5, limit: 48 },
  "1D": { timeframe: "hour", aggregate: 1, limit: 24 },
  "1W": { timeframe: "hour", aggregate: 4, limit: 42 },
};

export function getLiveTokenById(id: string): LiveMemeToken | null {
  return cachedTokens.find(t => t.id === id) || null;
}

export interface OHLCVCandle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

const ohlcvCache = new Map<string, { data: OHLCVCandle[]; fetchedAt: number }>();
const OHLCV_CACHE_TTL = 60_000;

export async function fetchLiveOHLCV(
  chain: string,
  pairAddress: string,
  timeframe: string
): Promise<OHLCVCandle[]> {
  const network = GECKO_CHAIN_MAP[chain];
  if (!network) return [];

  const config = GECKO_TIMEFRAME_MAP[timeframe] || GECKO_TIMEFRAME_MAP["1D"];
  const cacheKey = `${chain}:${pairAddress}:${timeframe}`;
  const cached = ohlcvCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < OHLCV_CACHE_TTL && cached.data.length > 0) {
    return cached.data;
  }

  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pairAddress}/ohlcv/${config.timeframe}?aggregate=${config.aggregate}&limit=${config.limit}&currency=usd`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      return cached?.data || [];
    }

    const data = await resp.json();
    const ohlcvList = data?.data?.attributes?.ohlcv_list;
    if (!Array.isArray(ohlcvList) || ohlcvList.length === 0) {
      return cached?.data || [];
    }

    const result: OHLCVCandle[] = ohlcvList.map((candle: number[]) => ({
      t: candle[0],
      o: candle[1],
      h: candle[2],
      l: candle[3],
      c: candle[4],
      v: candle[5] || 0,
    })).sort((a: OHLCVCandle, b: OHLCVCandle) => a.t - b.t);

    ohlcvCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.error(`[LiveMemes] GeckoTerminal OHLCV fetch failed for ${chain}/${pairAddress}:`, err);
    return cached?.data || [];
  }
}

export async function preWarmOHLCV(): Promise<void> {
  const tokens = cachedTokens.slice(0, 5);
  for (const token of tokens) {
    if (token.pairAddress && token.chain) {
      fetchLiveOHLCV(token.chain, token.pairAddress, "1D").catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

export function filterAndSortMemes(
  tokens: LiveMemeToken[],
  filters: { chain?: string; launchpad?: string; graduated?: string; sortBy?: string }
): LiveMemeToken[] {
  let result = [...tokens];

  if (filters.chain && filters.chain !== "all") {
    result = result.filter(t => t.chain === filters.chain);
  }
  if (filters.launchpad && filters.launchpad !== "all") {
    result = result.filter(t => t.launchpad === filters.launchpad);
  }
  if (filters.graduated === "true") {
    result = result.filter(t => t.graduated === true);
  } else if (filters.graduated === "false") {
    result = result.filter(t => t.graduated === false);
  }

  if (filters.sortBy === "newest") {
    result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } else if (filters.sortBy === "mcap") {
    result.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  } else if (filters.sortBy === "curve") {
    result.sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress);
  } else {
    result.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  }

  return result;
}
