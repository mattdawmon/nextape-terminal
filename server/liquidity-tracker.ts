import { storage } from "./storage";

const DEXSCREENER_API = "https://api.dexscreener.com";
const INGEST_INTERVAL = 3 * 60 * 1000;
let lastIngestTime = 0;

export interface LiquidityEvent {
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  pairAddress: string;
  eventType: "large_add" | "large_remove" | "volume_spike" | "new_pool" | "liquidity_migration";
  liquidityUsd: number;
  liquidityChange: number;
  volumeUsd: number;
  priceImpact: number;
  timestamp: number;
}

export interface LiquiditySnapshot {
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  currentLiquidity: number;
  previousLiquidity: number;
  liquidityChange24h: number;
  liquidityChangePercent: number;
  volume24h: number;
  volumeToLiqRatio: number;
  lpConcentration: number;
  isLiquidityDraining: boolean;
  isLiquidityGrowing: boolean;
  hasAbnormalActivity: boolean;
}

interface LiquidityCache {
  snapshots: Map<string, LiquiditySnapshot>;
  events: LiquidityEvent[];
  totalLiquidityTracked: number;
  avgLiquidityChange: number;
  liquidityFlowDirection: "inflow" | "outflow" | "neutral";
  fetchedAt: number;
}

let cache: LiquidityCache = {
  snapshots: new Map(),
  events: [],
  totalLiquidityTracked: 0,
  avgLiquidityChange: 0,
  liquidityFlowDirection: "neutral",
  fetchedAt: 0,
};

const previousLiquidityMap = new Map<string, { liquidity: number; volume: number; timestamp: number }>();

async function fetchTopPairsByChain(chain: string): Promise<any[]> {
  try {
    const resp = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as any[];
    if (!Array.isArray(data)) return [];

    const chainTokens = data
      .filter((d: any) => !chain || d.chainId === chain)
      .slice(0, 15)
      .filter((d: any) => d.tokenAddress && d.chainId);

    if (chainTokens.length === 0) return [];

    const addresses = chainTokens.map((t: any) => `${t.chainId}/${t.tokenAddress}`);
    const pairResp = await fetch(`${DEXSCREENER_API}/tokens/v1/${addresses.join(",")}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!pairResp.ok) return [];
    const pairs = await pairResp.json() as any[];
    return Array.isArray(pairs) ? pairs : [];
  } catch {
    return [];
  }
}

function detectLiquidityEvents(pair: any, prevData: { liquidity: number; volume: number } | undefined): LiquidityEvent[] {
  const events: LiquidityEvent[] = [];
  const liq = pair.liquidity?.usd || 0;
  const vol = pair.volume?.h24 || 0;
  const chain = pair.chainId || "unknown";
  const symbol = pair.baseToken?.symbol || "UNKNOWN";
  const address = pair.baseToken?.address || "";
  const pairAddr = pair.pairAddress || "";

  if (prevData) {
    const liqChange = liq - prevData.liquidity;
    const changePercent = prevData.liquidity > 0 ? (liqChange / prevData.liquidity) * 100 : 0;

    if (liqChange > 50_000 && changePercent > 20) {
      events.push({
        tokenAddress: address,
        tokenSymbol: symbol,
        chain,
        pairAddress: pairAddr,
        eventType: "large_add",
        liquidityUsd: liq,
        liquidityChange: liqChange,
        volumeUsd: vol,
        priceImpact: Math.min(100, changePercent),
        timestamp: Date.now(),
      });
    }

    if (liqChange < -30_000 && changePercent < -15) {
      events.push({
        tokenAddress: address,
        tokenSymbol: symbol,
        chain,
        pairAddress: pairAddr,
        eventType: "large_remove",
        liquidityUsd: liq,
        liquidityChange: liqChange,
        volumeUsd: vol,
        priceImpact: Math.abs(changePercent),
        timestamp: Date.now(),
      });
    }

    const prevVolRatio = prevData.liquidity > 0 ? prevData.volume / prevData.liquidity : 0;
    const currVolRatio = liq > 0 ? vol / liq : 0;
    if (currVolRatio > prevVolRatio * 3 && currVolRatio > 2) {
      events.push({
        tokenAddress: address,
        tokenSymbol: symbol,
        chain,
        pairAddress: pairAddr,
        eventType: "volume_spike",
        liquidityUsd: liq,
        liquidityChange: 0,
        volumeUsd: vol,
        priceImpact: currVolRatio * 10,
        timestamp: Date.now(),
      });
    }
  } else if (liq > 100_000) {
    events.push({
      tokenAddress: address,
      tokenSymbol: symbol,
      chain,
      pairAddress: pairAddr,
      eventType: "new_pool",
      liquidityUsd: liq,
      liquidityChange: liq,
      volumeUsd: vol,
      priceImpact: 0,
      timestamp: Date.now(),
    });
  }

  return events;
}

export async function ingestLiquidityData(): Promise<void> {
  if (Date.now() - lastIngestTime < INGEST_INTERVAL) return;
  lastIngestTime = Date.now();

  console.log("[LiquidityTracker] Starting liquidity scan across chains...");

  const pairs = await fetchTopPairsByChain("");
  if (pairs.length === 0) {
    console.log("[LiquidityTracker] No pairs found, skipping");
    return;
  }

  const allEvents: LiquidityEvent[] = [];
  const snapshots = new Map<string, LiquiditySnapshot>();

  let totalLiqTracked = 0;
  let totalLiqChange = 0;
  let tokenCount = 0;

  const seenTokens = new Set<string>();

  for (const pair of pairs.slice(0, 50)) {
    const address = pair.baseToken?.address || "";
    const symbol = pair.baseToken?.symbol || "";
    const chain = pair.chainId || "";
    if (!address || !symbol) continue;

    const key = `${chain}:${address.toLowerCase()}`;
    if (seenTokens.has(key)) continue;
    seenTokens.add(key);

    const liq = pair.liquidity?.usd || 0;
    const vol = pair.volume?.h24 || 0;
    const prevData = previousLiquidityMap.get(key);

    const events = detectLiquidityEvents(pair, prevData);
    allEvents.push(...events);

    const prevLiq = prevData?.liquidity || liq;
    const liqChange = liq - prevLiq;
    const changePercent = prevLiq > 0 ? (liqChange / prevLiq) * 100 : 0;
    const volToLiq = liq > 0 ? vol / liq : 0;

    const snapshot: LiquiditySnapshot = {
      tokenAddress: address,
      tokenSymbol: symbol,
      chain,
      currentLiquidity: liq,
      previousLiquidity: prevLiq,
      liquidityChange24h: liqChange,
      liquidityChangePercent: Math.round(changePercent * 100) / 100,
      volume24h: vol,
      volumeToLiqRatio: Math.round(volToLiq * 100) / 100,
      lpConcentration: 0,
      isLiquidityDraining: changePercent < -10,
      isLiquidityGrowing: changePercent > 10,
      hasAbnormalActivity: volToLiq > 5 || Math.abs(changePercent) > 30,
    };

    snapshots.set(key, snapshot);
    totalLiqTracked += liq;
    totalLiqChange += liqChange;
    tokenCount++;

    previousLiquidityMap.set(key, { liquidity: liq, volume: vol, timestamp: Date.now() });
  }

  const avgChange = tokenCount > 0 ? totalLiqChange / tokenCount : 0;
  let flowDirection: "inflow" | "outflow" | "neutral" = "neutral";
  if (avgChange > 5000) flowDirection = "inflow";
  else if (avgChange < -5000) flowDirection = "outflow";

  cache = {
    snapshots,
    events: allEvents.slice(0, 100),
    totalLiquidityTracked: totalLiqTracked,
    avgLiquidityChange: avgChange,
    liquidityFlowDirection: flowDirection,
    fetchedAt: Date.now(),
  };

  let persisted = 0;
  for (const event of allEvents.slice(0, 30)) {
    try {
      await storage.upsertLiquidityEvent({
        tokenAddress: event.tokenAddress,
        tokenSymbol: event.tokenSymbol,
        chain: event.chain,
        pairAddress: event.pairAddress,
        eventType: event.eventType,
        liquidityUsd: event.liquidityUsd,
        liquidityChange: event.liquidityChange,
        volumeUsd: event.volumeUsd,
        priceImpact: event.priceImpact,
      });
      persisted++;
    } catch {}
  }

  console.log(`[LiquidityTracker] Tracked ${tokenCount} tokens, ${allEvents.length} events (${persisted} persisted). Flow: ${flowDirection}, Avg change: $${Math.round(avgChange)}`);
}

export function getLiquiditySignalForToken(address: string, chain: string): LiquiditySnapshot | null {
  const key = `${chain}:${address.toLowerCase()}`;
  return cache.snapshots.get(key) || null;
}

export function getLiquidityEvents(): LiquidityEvent[] {
  return cache.events;
}

export function getMarketLiquidityFlow(): {
  direction: "inflow" | "outflow" | "neutral";
  totalTracked: number;
  avgChange: number;
  drainingTokens: number;
  growingTokens: number;
  abnormalCount: number;
} {
  let draining = 0;
  let growing = 0;
  let abnormal = 0;

  for (const [_, snap] of cache.snapshots) {
    if (snap.isLiquidityDraining) draining++;
    if (snap.isLiquidityGrowing) growing++;
    if (snap.hasAbnormalActivity) abnormal++;
  }

  return {
    direction: cache.liquidityFlowDirection,
    totalTracked: cache.totalLiquidityTracked,
    avgChange: cache.avgLiquidityChange,
    drainingTokens: draining,
    growingTokens: growing,
    abnormalCount: abnormal,
  };
}

export function computeLiquidityHealthScore(address: string, chain: string): number {
  const snap = getLiquiditySignalForToken(address, chain);
  if (!snap) return 50;

  let score = 50;

  if (snap.currentLiquidity > 500_000) score += 15;
  else if (snap.currentLiquidity > 100_000) score += 10;
  else if (snap.currentLiquidity > 50_000) score += 5;
  else if (snap.currentLiquidity < 10_000) score -= 15;

  if (snap.isLiquidityGrowing) score += 12;
  if (snap.isLiquidityDraining) score -= 15;

  if (snap.volumeToLiqRatio > 10) score -= 10;
  else if (snap.volumeToLiqRatio > 5) score -= 5;
  else if (snap.volumeToLiqRatio > 1) score += 5;

  if (snap.hasAbnormalActivity) score -= 8;

  if (snap.liquidityChangePercent > 50) score += 8;
  else if (snap.liquidityChangePercent < -30) score -= 12;

  return Math.max(0, Math.min(100, score));
}

export function startLiquidityTracking(): void {
  console.log("[LiquidityTracker] Starting on-chain liquidity tracking (every 3 min)");
  ingestLiquidityData();
  setInterval(() => ingestLiquidityData(), INGEST_INTERVAL);
}
