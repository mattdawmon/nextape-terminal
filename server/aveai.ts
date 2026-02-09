const AVEAI_BASE = "https://prod.ave-api.com/v2";

const API_KEY = process.env.AVEAI_API_KEY || "";

export function hasApiKey(): boolean {
  return !!API_KEY;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Accept": "application/json" };
  if (API_KEY) h["X-API-KEY"] = API_KEY;
  return h;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, headers: { ...getHeaders(), ...(options.headers || {}) } });
    if (!res.ok) {
      console.warn(`[AveAI] HTTP ${res.status} for ${url}`);
      if (res.status === 403) return { _error: "AVEAI_KEY_MISSING" };
      return null;
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError") console.warn(`[AveAI] Timeout for ${url}`);
    else console.warn(`[AveAI] Fetch error for ${url}:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, { data: any; fetchedAt: number }>();
const CACHE_TTL = 60_000;
const RANK_CACHE_TTL = 120_000;
const KLINE_CACHE_TTL = 30_000;
const RISK_CACHE_TTL = 300_000;

function getCached(key: string, ttl: number): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.fetchedAt < ttl) return entry.data;
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, fetchedAt: Date.now() });
  if (cache.size > 500) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
    for (let i = 0; i < 100; i++) cache.delete(oldest[i][0]);
  }
}

export interface AveToken {
  token: string;
  chain: string;
  name: string;
  symbol: string;
  decimal: number;
  total: string;
  current_price_usd: string;
  current_price_eth: string;
  price_change_1d: string;
  price_change_24h: string;
  market_cap: string;
  fdv: string;
  tvl: string;
  main_pair_tvl: string;
  tx_volume_u_24h: string;
  tx_count_24h: number;
  tx_amount_24h: string;
  holders: number;
  logo_url: string;
  risk_score: string;
  risk_level: number;
  launch_at: number;
  created_at: number;
  updated_at: number;
  main_pair: string;
  lock_amount: string;
  burn_amount: string;
  locked_percent: string;
  is_mintable: string;
  has_mint_method: boolean;
  is_lp_not_locked: boolean;
  has_not_renounced: boolean;
  has_not_audited: boolean;
  has_not_open_source: boolean;
  is_in_blacklist: boolean;
  is_honeypot: boolean;
  ave_risk_level: number;
  appendix: string;
  token_price_change_5m?: string;
  token_price_change_1h?: string;
  token_price_change_4h?: string;
  token_price_change_24h?: string;
  token_tx_volume_usd_5m?: string;
  token_tx_volume_usd_1h?: string;
  token_tx_volume_usd_4h?: string;
  token_tx_volume_usd_24h?: string;
  token_buy_volume_u_5m?: string;
  token_sell_volume_u_5m?: string;
}

export interface AveRankTopic {
  id: string;
  name_en: string;
  name_zh: string;
}

export interface AveKline {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

export async function searchTokens(keyword: string, chain?: string, limit = 100, orderby?: string): Promise<{ tokens: AveToken[]; error?: string }> {
  if (!keyword) return { tokens: [] };
  const cacheKey = `search:${keyword}:${chain || ""}:${limit}:${orderby || ""}`;
  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached) return { tokens: cached };

  const params = new URLSearchParams({ keyword, limit: String(Math.min(limit, 300)) });
  if (chain) params.set("chain", chain);
  if (orderby) params.set("orderby", orderby);

  const resp = await fetchWithTimeout(`${AVEAI_BASE}/tokens?${params}`);
  if (resp?._error) return { tokens: [], error: resp._error };
  if (!resp || resp.status !== 1) return { tokens: [] };

  const data = resp.data || [];
  setCache(cacheKey, data);
  return { tokens: data };
}

export async function getRankTopics(): Promise<{ topics: AveRankTopic[]; error?: string }> {
  const cacheKey = "rank:topics";
  const cached = getCached(cacheKey, RANK_CACHE_TTL);
  if (cached) return { topics: cached };

  const resp = await fetchWithTimeout(`${AVEAI_BASE}/ranks/topics`);
  if (resp?._error) return { topics: [], error: resp._error };
  if (!resp || resp.status !== 1) return { topics: [] };

  const data = resp.data || [];
  setCache(cacheKey, data);
  return { topics: data };
}

export async function getRankTokens(topic: string, limit = 200): Promise<{ tokens: AveToken[]; error?: string }> {
  const cacheKey = `rank:${topic}:${limit}`;
  const cached = getCached(cacheKey, RANK_CACHE_TTL);
  if (cached) return { tokens: cached };

  const params = new URLSearchParams({ topic, limit: String(Math.min(limit, 300)) });
  const resp = await fetchWithTimeout(`${AVEAI_BASE}/ranks?${params}`);
  if (resp?._error) return { tokens: [], error: resp._error };
  if (!resp || resp.status !== 1) return { tokens: [] };

  const data = resp.data || [];
  setCache(cacheKey, data);
  return { tokens: data };
}

export async function getTokenPrices(tokenIds: string[]): Promise<Record<string, any>> {
  if (!tokenIds.length) return {};
  const ids = tokenIds.slice(0, 200);
  const cacheKey = `prices:${ids.sort().join(",")}`;
  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached) return cached;

  const resp = await fetchWithTimeout(`${AVEAI_BASE}/tokens/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token_ids: ids }),
  });
  if (!resp || resp.status !== 1) return {};

  const data = resp.data || {};
  setCache(cacheKey, data);
  return data;
}

export async function getKlineByToken(
  tokenAddress: string,
  chain: string,
  interval = "1h",
  size = 100,
  priceType = "u"
): Promise<AveKline[]> {
  const cacheKey = `kline:token:${chain}:${tokenAddress}:${interval}:${size}:${priceType}`;
  const cached = getCached(cacheKey, KLINE_CACHE_TTL);
  if (cached) return cached;

  const params = new URLSearchParams({ chain, interval, size: String(size), price_type: priceType });
  const resp = await fetchWithTimeout(`${AVEAI_BASE}/klines/token/${tokenAddress}?${params}`);
  if (!resp || resp.status !== 1) return [];

  const data = resp.data || [];
  setCache(cacheKey, data);
  return data;
}

export async function getKlineByPair(
  pairId: string,
  interval = "1h",
  size = 100,
  priceType = "u"
): Promise<AveKline[]> {
  const cacheKey = `kline:pair:${pairId}:${interval}:${size}:${priceType}`;
  const cached = getCached(cacheKey, KLINE_CACHE_TTL);
  if (cached) return cached;

  const params = new URLSearchParams({ interval, size: String(size), price_type: priceType });
  const resp = await fetchWithTimeout(`${AVEAI_BASE}/klines/pair/${pairId}?${params}`);
  if (!resp || resp.status !== 1) return [];

  const data = resp.data || [];
  setCache(cacheKey, data);
  return data;
}

export async function getContractRisk(chain: string, tokenAddress: string): Promise<any> {
  const cacheKey = `risk:${chain}:${tokenAddress}`.toLowerCase();
  const cached = getCached(cacheKey, RISK_CACHE_TTL);
  if (cached) return cached;

  const resp = await fetchWithTimeout(`${AVEAI_BASE}/contract/risk/${chain}/${tokenAddress}`);
  if (!resp || resp.status !== 1) return null;

  const data = resp.data || null;
  if (data) setCache(cacheKey, data);
  return data;
}

const AVE_CHAIN_MAP: Record<string, string> = {
  solana: "solana",
  ethereum: "eth",
  eth: "eth",
  base: "base",
  bnb: "bsc",
  bsc: "bsc",
  tron: "tron",
  arbitrum: "arbitrum",
  polygon: "polygon",
  avalanche: "avalanche",
  optimism: "optimism",
};

export function normalizeChain(chain: string): string {
  return AVE_CHAIN_MAP[chain.toLowerCase()] || chain.toLowerCase();
}

export function parseAppendix(appendix: string): Record<string, string> {
  try {
    return JSON.parse(appendix);
  } catch {
    return {};
  }
}
