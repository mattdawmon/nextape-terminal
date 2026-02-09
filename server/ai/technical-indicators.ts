interface PriceBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface TechnicalIndicators {
  rsi14: number;
  ema9: number;
  ema21: number;
  ema50: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  atr14: number;
  atrPercent: number;
  emaTrendAlignment: "bullish" | "bearish" | "mixed";
  emaCrossover: "golden_cross" | "death_cross" | "none";
  rsiDivergence: "bullish" | "bearish" | "none";
  priceVsEma9: number;
  priceVsEma21: number;
  priceVsEma50: number;
  isOverextended: boolean;
  isPullback: boolean;
  trendStrength: number;
  volumeTrend: "increasing" | "decreasing" | "stable";
}

const DEFAULT_INDICATORS: TechnicalIndicators = {
  rsi14: 50,
  ema9: 0,
  ema21: 0,
  ema50: 0,
  macdLine: 0,
  macdSignal: 0,
  macdHistogram: 0,
  atr14: 0,
  atrPercent: 0,
  emaTrendAlignment: "mixed",
  emaCrossover: "none",
  rsiDivergence: "none",
  priceVsEma9: 0,
  priceVsEma21: 0,
  priceVsEma50: 0,
  isOverextended: false,
  isPullback: false,
  trendStrength: 50,
  volumeTrend: "stable",
};

const indicatorCache = new Map<string, { data: TechnicalIndicators; fetchedAt: number }>();
const INDICATOR_CACHE_TTL = 45_000;

const persistentPriceHistory = new Map<string, { bars: PriceBar[]; lastUpdate: number }>();
const PRICE_HISTORY_MAX_BARS = 200;

export function updatePriceHistory(tokenKey: string, price: number, volume: number, high?: number, low?: number): void {
  const entry = persistentPriceHistory.get(tokenKey) || { bars: [], lastUpdate: 0 };
  const now = Date.now();
  const minuteTs = Math.floor(now / 60000) * 60000;

  const lastBar = entry.bars[entry.bars.length - 1];
  if (lastBar && Math.floor(lastBar.t / 60000) * 60000 === minuteTs) {
    lastBar.c = price;
    lastBar.h = Math.max(lastBar.h, high ?? price);
    lastBar.l = Math.min(lastBar.l, low ?? price);
    lastBar.v += volume;
  } else {
    entry.bars.push({
      t: minuteTs,
      o: price,
      h: high ?? price,
      l: low ?? price,
      c: price,
      v: volume,
    });
  }

  if (entry.bars.length > PRICE_HISTORY_MAX_BARS) {
    entry.bars = entry.bars.slice(-PRICE_HISTORY_MAX_BARS);
  }
  entry.lastUpdate = now;
  persistentPriceHistory.set(tokenKey, entry);
}

export function ingestOHLCV(tokenKey: string, candles: PriceBar[]): void {
  if (!candles.length) return;
  const entry = persistentPriceHistory.get(tokenKey) || { bars: [], lastUpdate: 0 };

  const existingTs = new Set(entry.bars.map(b => Math.floor(b.t / 60000)));
  for (const c of candles) {
    const minTs = Math.floor(c.t / 60000);
    if (!existingTs.has(minTs)) {
      entry.bars.push(c);
      existingTs.add(minTs);
    }
  }

  entry.bars.sort((a, b) => a.t - b.t);
  if (entry.bars.length > PRICE_HISTORY_MAX_BARS) {
    entry.bars = entry.bars.slice(-PRICE_HISTORY_MAX_BARS);
  }
  entry.lastUpdate = Date.now();
  persistentPriceHistory.set(tokenKey, entry);
}

function calcEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcATR(bars: PriceBar[], period = 14): number {
  if (bars.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

function detectRSIDivergence(prices: number[], rsiValues: number[]): "bullish" | "bearish" | "none" {
  if (prices.length < 20 || rsiValues.length < 20) return "none";

  const recentPrices = prices.slice(-10);
  const olderPrices = prices.slice(-20, -10);
  const recentRSI = rsiValues.slice(-10);
  const olderRSI = rsiValues.slice(-20, -10);

  const recentPriceLow = Math.min(...recentPrices);
  const olderPriceLow = Math.min(...olderPrices);
  const recentRSILow = Math.min(...recentRSI);
  const olderRSILow = Math.min(...olderRSI);

  if (recentPriceLow < olderPriceLow && recentRSILow > olderRSILow) {
    return "bullish";
  }

  const recentPriceHigh = Math.max(...recentPrices);
  const olderPriceHigh = Math.max(...olderPrices);
  const recentRSIHigh = Math.max(...recentRSI);
  const olderRSIHigh = Math.max(...olderRSI);

  if (recentPriceHigh > olderPriceHigh && recentRSIHigh < olderRSIHigh) {
    return "bearish";
  }

  return "none";
}

function detectVolumeTrend(volumes: number[]): "increasing" | "decreasing" | "stable" {
  if (volumes.length < 6) return "stable";
  const recent5 = volumes.slice(-5);
  const older5 = volumes.slice(-10, -5);
  if (older5.length < 3) return "stable";

  const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
  const olderAvg = older5.reduce((a, b) => a + b, 0) / older5.length;

  if (olderAvg === 0) return "stable";
  const change = (recentAvg - olderAvg) / olderAvg;

  if (change > 0.3) return "increasing";
  if (change < -0.3) return "decreasing";
  return "stable";
}

export function computeTechnicalIndicators(tokenKey: string, currentPrice: number): TechnicalIndicators {
  const cached = indicatorCache.get(tokenKey);
  if (cached && Date.now() - cached.fetchedAt < INDICATOR_CACHE_TTL) {
    return cached.data;
  }

  const history = persistentPriceHistory.get(tokenKey);
  if (!history || history.bars.length < 10) {
    return { ...DEFAULT_INDICATORS };
  }

  const bars = history.bars;
  const closes = bars.map(b => b.c);
  if (closes[closes.length - 1] !== currentPrice) {
    closes.push(currentPrice);
  }
  const volumes = bars.map(b => b.v);

  const rsi14 = calcRSI(closes, 14);
  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema50Arr = calcEMA(closes, Math.min(50, closes.length));

  const ema9 = ema9Arr[ema9Arr.length - 1] || currentPrice;
  const ema21 = ema21Arr[ema21Arr.length - 1] || currentPrice;
  const ema50 = ema50Arr[ema50Arr.length - 1] || currentPrice;

  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLineArr: number[] = [];
  const minLen = Math.min(ema12.length, ema26.length);
  for (let i = 0; i < minLen; i++) {
    macdLineArr.push(ema12[ema12.length - minLen + i] - ema26[ema26.length - minLen + i]);
  }
  const macdSignalArr = calcEMA(macdLineArr, 9);
  const macdLine = macdLineArr[macdLineArr.length - 1] || 0;
  const macdSignal = macdSignalArr[macdSignalArr.length - 1] || 0;
  const macdHistogram = macdLine - macdSignal;

  const atr14 = calcATR(bars, 14);
  const atrPercent = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0;

  let emaTrendAlignment: "bullish" | "bearish" | "mixed" = "mixed";
  if (currentPrice > ema9 && ema9 > ema21 && ema21 > ema50) {
    emaTrendAlignment = "bullish";
  } else if (currentPrice < ema9 && ema9 < ema21 && ema21 < ema50) {
    emaTrendAlignment = "bearish";
  }

  let emaCrossover: "golden_cross" | "death_cross" | "none" = "none";
  if (ema9Arr.length >= 3 && ema21Arr.length >= 3) {
    const prevEma9 = ema9Arr[ema9Arr.length - 3];
    const prevEma21 = ema21Arr[ema21Arr.length - 3];
    if (prevEma9 <= prevEma21 && ema9 > ema21) emaCrossover = "golden_cross";
    else if (prevEma9 >= prevEma21 && ema9 < ema21) emaCrossover = "death_cross";
  }

  let rsiDivergence: "bullish" | "bearish" | "none" = "none";
  if (closes.length >= 20) {
    const rsiValues: number[] = [];
    for (let i = 15; i <= closes.length; i++) {
      rsiValues.push(calcRSI(closes.slice(0, i), 14));
    }
    rsiDivergence = detectRSIDivergence(closes, rsiValues);
  }

  const priceVsEma9 = ema9 > 0 ? ((currentPrice - ema9) / ema9) * 100 : 0;
  const priceVsEma21 = ema21 > 0 ? ((currentPrice - ema21) / ema21) * 100 : 0;
  const priceVsEma50 = ema50 > 0 ? ((currentPrice - ema50) / ema50) * 100 : 0;

  const isOverextended = priceVsEma21 > 15 || rsi14 > 80 || (priceVsEma9 > 8 && rsi14 > 70);

  const isPullback =
    emaTrendAlignment === "bullish" &&
    rsi14 < 45 &&
    rsi14 > 25 &&
    priceVsEma21 > -5 &&
    priceVsEma21 < 3 &&
    currentPrice > ema50;

  let trendStrength = 50;
  if (emaTrendAlignment === "bullish") trendStrength += 15;
  else if (emaTrendAlignment === "bearish") trendStrength -= 15;
  if (macdHistogram > 0) trendStrength += Math.min(10, macdHistogram * 100);
  else trendStrength += Math.max(-10, macdHistogram * 100);
  if (rsi14 > 55) trendStrength += Math.min(10, (rsi14 - 55) / 2);
  else if (rsi14 < 45) trendStrength -= Math.min(10, (45 - rsi14) / 2);
  if (emaCrossover === "golden_cross") trendStrength += 8;
  else if (emaCrossover === "death_cross") trendStrength -= 8;
  trendStrength = Math.max(0, Math.min(100, trendStrength));

  const volumeTrend = detectVolumeTrend(volumes);

  const indicators: TechnicalIndicators = {
    rsi14: Math.round(rsi14 * 10) / 10,
    ema9,
    ema21,
    ema50,
    macdLine: Math.round(macdLine * 1e8) / 1e8,
    macdSignal: Math.round(macdSignal * 1e8) / 1e8,
    macdHistogram: Math.round(macdHistogram * 1e8) / 1e8,
    atr14,
    atrPercent: Math.round(atrPercent * 100) / 100,
    emaTrendAlignment,
    emaCrossover,
    rsiDivergence,
    priceVsEma9: Math.round(priceVsEma9 * 100) / 100,
    priceVsEma21: Math.round(priceVsEma21 * 100) / 100,
    priceVsEma50: Math.round(priceVsEma50 * 100) / 100,
    isOverextended,
    isPullback,
    trendStrength: Math.round(trendStrength),
    volumeTrend,
  };

  indicatorCache.set(tokenKey, { data: indicators, fetchedAt: Date.now() });
  return indicators;
}

export function getHistorySize(tokenKey: string): number {
  return persistentPriceHistory.get(tokenKey)?.bars.length ?? 0;
}

export function clearIndicatorCache(): void {
  indicatorCache.clear();
}
