import { storage } from "./storage";

const ALTERNATIVE_ME_API = "https://api.alternative.me/fng/?limit=7&format=json";
const COINGLASS_FNG = "https://api.coinglass.com/api/index/fear-greed-history?limit=7";
const INGEST_INTERVAL = 10 * 60 * 1000;
let lastIngestTime = 0;

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: number;
  previousValues: { value: number; classification: string; date: string }[];
  trend: "improving" | "worsening" | "stable";
  extremeFear: boolean;
  extremeGreed: boolean;
}

let cachedFGI: FearGreedData = {
  value: 50,
  classification: "Neutral",
  timestamp: 0,
  previousValues: [],
  trend: "stable",
  extremeFear: false,
  extremeGreed: false,
};

function classifyFGI(value: number): string {
  if (value <= 10) return "Extreme Fear";
  if (value <= 25) return "Fear";
  if (value <= 45) return "Neutral-Fear";
  if (value <= 55) return "Neutral";
  if (value <= 75) return "Greed";
  if (value <= 90) return "Extreme Greed";
  return "Max Greed";
}

function determineTrend(values: number[]): "improving" | "worsening" | "stable" {
  if (values.length < 3) return "stable";
  const recent = values.slice(0, 3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const latest = values[0];
  if (latest > avg + 5) return "improving";
  if (latest < avg - 5) return "worsening";
  return "stable";
}

async function fetchAlternativeMeFGI(): Promise<FearGreedData | null> {
  try {
    const resp = await fetch(ALTERNATIVE_ME_API, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      console.log(`[FearGreed] Alternative.me returned ${resp.status}`);
      return null;
    }

    const json = await resp.json() as any;
    const data = json?.data;
    if (!Array.isArray(data) || data.length === 0) return null;

    const current = data[0];
    const value = parseInt(current.value) || 50;
    const classification = current.value_classification || classifyFGI(value);

    const previousValues = data.slice(1).map((d: any) => ({
      value: parseInt(d.value) || 50,
      classification: d.value_classification || classifyFGI(parseInt(d.value) || 50),
      date: new Date(parseInt(d.timestamp) * 1000).toISOString().split("T")[0],
    }));

    const allValues = data.map((d: any) => parseInt(d.value) || 50);
    const trend = determineTrend(allValues);

    return {
      value,
      classification,
      timestamp: parseInt(current.timestamp) * 1000 || Date.now(),
      previousValues,
      trend,
      extremeFear: value <= 20,
      extremeGreed: value >= 80,
    };
  } catch (err) {
    console.log("[FearGreed] Alternative.me fetch failed:", (err as Error).message);
    return null;
  }
}

async function computeFallbackFGI(): Promise<FearGreedData> {
  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true", {
      signal: AbortSignal.timeout(8_000),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      const btcChange = data?.bitcoin?.usd_24h_change || 0;

      let fgiValue = 50;
      if (btcChange > 8) fgiValue = 85;
      else if (btcChange > 5) fgiValue = 75;
      else if (btcChange > 2) fgiValue = 65;
      else if (btcChange > 0) fgiValue = 55;
      else if (btcChange > -2) fgiValue = 45;
      else if (btcChange > -5) fgiValue = 35;
      else if (btcChange > -8) fgiValue = 25;
      else fgiValue = 15;

      return {
        value: fgiValue,
        classification: classifyFGI(fgiValue),
        timestamp: Date.now(),
        previousValues: [],
        trend: "stable",
        extremeFear: fgiValue <= 20,
        extremeGreed: fgiValue >= 80,
      };
    }
  } catch {}

  return cachedFGI;
}

export async function ingestFearGreedData(): Promise<void> {
  if (Date.now() - lastIngestTime < INGEST_INTERVAL) return;
  lastIngestTime = Date.now();

  console.log("[FearGreed] Fetching Fear & Greed Index...");

  let fgi = await fetchAlternativeMeFGI();
  if (!fgi) {
    console.log("[FearGreed] Primary source failed, using fallback...");
    fgi = await computeFallbackFGI();
  }

  cachedFGI = fgi;

  try {
    await storage.upsertFearGreedIndex({
      value: fgi.value,
      classification: fgi.classification,
      trend: fgi.trend,
      previousDay: fgi.previousValues[0]?.value ?? null,
      previousWeek: fgi.previousValues[5]?.value ?? null,
    });
  } catch (err) {
    console.log("[FearGreed] Failed to persist:", (err as Error).message);
  }

  console.log(`[FearGreed] Current: ${fgi.value} (${fgi.classification}), Trend: ${fgi.trend}, Extreme Fear: ${fgi.extremeFear}, Extreme Greed: ${fgi.extremeGreed}`);
}

export function getFearGreedIndex(): FearGreedData {
  return cachedFGI;
}

export function getFearGreedSignal(): {
  value: number;
  classification: string;
  trend: string;
  tradingBias: "buy" | "sell" | "hold";
  confidence: number;
} {
  const fgi = cachedFGI;

  let tradingBias: "buy" | "sell" | "hold" = "hold";
  let confidence = 50;

  if (fgi.extremeFear) {
    tradingBias = "buy";
    confidence = 75;
  } else if (fgi.value <= 30) {
    tradingBias = "buy";
    confidence = 65;
  } else if (fgi.extremeGreed) {
    tradingBias = "sell";
    confidence = 70;
  } else if (fgi.value >= 75) {
    tradingBias = "sell";
    confidence = 60;
  }

  if (fgi.trend === "improving" && tradingBias === "buy") confidence += 5;
  if (fgi.trend === "worsening" && tradingBias === "sell") confidence += 5;

  return {
    value: fgi.value,
    classification: fgi.classification,
    trend: fgi.trend,
    tradingBias,
    confidence,
  };
}

export function startFearGreedIngestion(): void {
  console.log("[FearGreed] Starting Fear & Greed Index tracking (every 10 min)");
  ingestFearGreedData();
  setInterval(() => ingestFearGreedData(), INGEST_INTERVAL);
}
