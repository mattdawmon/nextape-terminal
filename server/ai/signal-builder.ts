import { getLiveMemeTokens, type LiveMemeToken } from "../live-memes";
import { storage } from "../storage";
import type { Token, SafetyReport } from "@shared/schema";
import { computeTechnicalIndicators, updatePriceHistory, type TechnicalIndicators } from "./technical-indicators";
import { getSmartMoneySignalForToken, type SmartMoneyTokenSignal } from "../smart-money";
import { getSocialSignalForToken, type SocialSignal } from "../social-sentiment";
import { getNewsSentimentForToken, getOverallMarketNewsSentiment } from "../news-scanner";
import { getFearGreedSignal } from "../fear-greed";
import { getLiquiditySignalForToken, getMarketLiquidityFlow, computeLiquidityHealthScore } from "../liquidity-tracker";

export interface TokenSignal {
  id: string | number;
  address: string;
  symbol: string;
  name: string;
  chain: string;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  buys24h: number;
  sells24h: number;
  safetyScore: number;
  isTrending: boolean;
  isBoosted: boolean;
  age: string;
  ageHours: number;
  momentumScore: number;
  volumeScore: number;
  buyPressureScore: number;
  liquidityScore: number;
  safetyGrade: string;
  overallSignalScore: number;
  signals: string[];
  smartMoneyScore: number;
  rugRiskScore: number;
  momentumAcceleration: number;
  volumeToLiqRatio: number;
  holderConcentrationRisk: number;
  marketRegime: "bull" | "bear" | "neutral";
  conviction: number;
  volatility: number;
  lifecyclePhase: "launch" | "growth" | "mature" | "established";
  shortTermMomentum: number;
  volumeBreakout: boolean;
  whaleActivity: "accumulating" | "distributing" | "neutral";
  dynamicStopLoss: number;
  dynamicTakeProfit: number;
  technicals: TechnicalIndicators;
  socialSentimentScore: number;
  socialSpike: boolean;
  smartMoneyFlow: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  newsSentiment: "bullish" | "bearish" | "neutral";
  newsImpact: "high" | "medium" | "low";
  newsScore: number;
  fearGreedValue: number;
  fearGreedBias: "buy" | "sell" | "hold";
  fearGreedClassification: string;
  liquidityHealth: number;
  liquidityFlow: "inflow" | "outflow" | "neutral";
  liquidityDraining: boolean;
  liquidityGrowing: boolean;
}

interface PriceEntry {
  prices: number[];
  timestamps: number[];
  volumes: number[];
}

const priceHistory = new Map<string, PriceEntry>();
const PRICE_HISTORY_MAX = 60;

function makeTokenKey(address: string, chain: string): string {
  return `${chain}:${address.toLowerCase()}`;
}

function trackPrice(tokenKey: string, price: number, volume?: number): void {
  const entry = priceHistory.get(tokenKey) || { prices: [], timestamps: [], volumes: [] };
  entry.prices.push(price);
  entry.timestamps.push(Date.now());
  entry.volumes.push(volume ?? 0);
  if (entry.prices.length > PRICE_HISTORY_MAX) {
    entry.prices.shift();
    entry.timestamps.shift();
    entry.volumes.shift();
  }
  priceHistory.set(tokenKey, entry);
}

function computeVolatility(tokenKey: string, currentPrice: number): number {
  const entry = priceHistory.get(tokenKey);
  if (!entry || entry.prices.length < 4) return 50;

  const recent = entry.prices.slice(-10);
  if (recent.length < 4) return 50;

  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1] > 0) {
      returns.push(Math.abs(((recent[i] - recent[i - 1]) / recent[i - 1]) * 100));
    }
  }
  if (returns.length === 0) return 50;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > 20) return 100;
  if (stdDev > 12) return 85;
  if (stdDev > 7) return 70;
  if (stdDev > 4) return 55;
  if (stdDev > 2) return 40;
  if (stdDev > 1) return 25;
  return 10;
}

function computeDynamicStopLoss(volatility: number, strategy: string): number {
  const baseStop: Record<string, number> = {
    conservative: 8,
    balanced: 12,
    aggressive: 18,
    degen: 25,
  };
  const base = baseStop[strategy] ?? 12;

  if (volatility >= 85) return base * 1.6;
  if (volatility >= 70) return base * 1.35;
  if (volatility >= 55) return base * 1.15;
  if (volatility >= 40) return base * 1.0;
  return base * 0.85;
}

function computeDynamicTakeProfit(volatility: number, marketRegime: string, strategy: string): number {
  const baseTP: Record<string, number> = {
    conservative: 18,
    balanced: 30,
    aggressive: 50,
    degen: 80,
  };
  const base = baseTP[strategy] ?? 30;

  let multiplier = 1.0;
  if (volatility >= 85) multiplier *= 1.5;
  else if (volatility >= 70) multiplier *= 1.3;
  else if (volatility >= 55) multiplier *= 1.1;
  else multiplier *= 0.9;

  if (marketRegime === "bull") multiplier *= 1.3;
  else if (marketRegime === "bear") multiplier *= 0.7;

  return Math.round(base * multiplier);
}

function getMomentumAcceleration(tokenKey: string, currentChange1h: number): number {
  const entry = priceHistory.get(tokenKey);
  if (!entry || entry.prices.length < 3) return 0;

  const recent = entry.prices.slice(-5);
  if (recent.length < 3) return 0;

  const changes: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1] > 0) {
      changes.push(((recent[i] - recent[i - 1]) / recent[i - 1]) * 100);
    }
  }
  if (changes.length < 2) return 0;

  const avgRecentChange = changes.slice(-2).reduce((a, b) => a + b, 0) / changes.slice(-2).length;
  const avgOlderChange = changes.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, changes.slice(0, -2).length);

  return avgRecentChange - avgOlderChange;
}

function getShortTermMomentum(tokenKey: string): number {
  const entry = priceHistory.get(tokenKey);
  if (!entry || entry.prices.length < 3) return 50;

  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const recentPrices: number[] = [];
  for (let i = entry.prices.length - 1; i >= 0; i--) {
    if (entry.timestamps[i] >= fiveMinAgo) {
      recentPrices.unshift(entry.prices[i]);
    } else break;
  }

  if (recentPrices.length < 2) {
    const last3 = entry.prices.slice(-3);
    if (last3.length < 2) return 50;
    const change = ((last3[last3.length - 1] - last3[0]) / last3[0]) * 100;
    return Math.max(0, Math.min(100, 50 + change * 3));
  }

  const change = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
  return Math.max(0, Math.min(100, 50 + change * 3));
}

function detectVolumeBreakout(tokenKey: string, currentVolume: number): boolean {
  const entry = priceHistory.get(tokenKey);
  if (!entry || entry.volumes.length < 5) return false;

  const recentVols = entry.volumes.slice(-10).filter(v => v > 0);
  if (recentVols.length < 3) return false;

  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  return currentVolume > avgVol * 2.5;
}

function detectWhaleActivity(buys: number, sells: number, volume: number, liquidity: number, change1h: number): "accumulating" | "distributing" | "neutral" {
  const buyRatio = (buys + sells) > 0 ? buys / (buys + sells) : 0.5;
  const volToLiq = liquidity > 0 ? volume / liquidity : 0;

  if (buyRatio > 0.65 && volToLiq > 1.5 && change1h > 3) return "accumulating";
  if (buyRatio < 0.38 && volToLiq > 1.0 && change1h < -3) return "distributing";
  if (buyRatio > 0.60 && volToLiq > 2.0) return "accumulating";
  if (buyRatio < 0.40 && volToLiq > 1.5) return "distributing";
  return "neutral";
}

function getLifecyclePhase(ageHours: number, holders: number, liquidity: number): "launch" | "growth" | "mature" | "established" {
  if (ageHours < 2) return "launch";
  if (ageHours < 24 && holders < 5000) return "growth";
  if (ageHours < 168 && holders < 50000) return "mature";
  return "established";
}

function computeMomentumScore(change1h: number, change24h: number, acceleration: number, shortTermMom: number): number {
  let score = 50;

  if (change1h > 30) score += 25;
  else if (change1h > 15) score += 20;
  else if (change1h > 8) score += 15;
  else if (change1h > 3) score += 10;
  else if (change1h > 0) score += 5;
  else if (change1h > -3) score -= 3;
  else if (change1h > -8) score -= 10;
  else if (change1h > -15) score -= 20;
  else score -= 30;

  if (change24h > 100) score += 12;
  else if (change24h > 50) score += 10;
  else if (change24h > 20) score += 7;
  else if (change24h > 5) score += 4;
  else if (change24h > 0) score += 2;
  else if (change24h > -10) score -= 5;
  else if (change24h > -25) score -= 12;
  else score -= 18;

  if (acceleration > 2) score += 8;
  else if (acceleration > 0.5) score += 4;
  else if (acceleration < -2) score -= 8;
  else if (acceleration < -0.5) score -= 4;

  if (shortTermMom > 70) score += 8;
  else if (shortTermMom > 60) score += 4;
  else if (shortTermMom < 30) score -= 8;
  else if (shortTermMom < 40) score -= 4;

  if (change1h > 5 && change24h > 10 && acceleration > 0 && shortTermMom > 55) score += 5;

  return Math.max(0, Math.min(100, score));
}

function computeVolumeScore(volume: number, marketCap: number): number {
  if (marketCap <= 0 || volume <= 0) return 15;
  const ratio = volume / marketCap;
  if (ratio > 2) return 98;
  if (ratio > 1) return 92;
  if (ratio > 0.5) return 85;
  if (ratio > 0.3) return 78;
  if (ratio > 0.15) return 70;
  if (ratio > 0.08) return 60;
  if (ratio > 0.04) return 50;
  if (ratio > 0.02) return 40;
  if (ratio > 0.01) return 30;
  return 15;
}

function computeBuyPressure(buys: number, sells: number): number {
  const total = buys + sells;
  if (total === 0) return 50;
  return Math.round((buys / total) * 100);
}

function computeLiquidityScore(liquidity: number): number {
  if (liquidity >= 10_000_000) return 95;
  if (liquidity >= 5_000_000) return 88;
  if (liquidity >= 2_000_000) return 80;
  if (liquidity >= 1_000_000) return 72;
  if (liquidity >= 500_000) return 62;
  if (liquidity >= 200_000) return 52;
  if (liquidity >= 100_000) return 42;
  if (liquidity >= 50_000) return 32;
  if (liquidity >= 20_000) return 22;
  return 10;
}

function computeRugRiskScore(
  liquidity: number,
  holders: number,
  marketCap: number,
  topHolderPercent: number | null,
  devWalletPercent: number | null,
  safetyScore: number,
  ageHours: number
): number {
  let risk = 0;

  if (liquidity < 10_000) risk += 30;
  else if (liquidity < 50_000) risk += 20;
  else if (liquidity < 100_000) risk += 10;

  if (holders < 100) risk += 25;
  else if (holders < 500) risk += 15;
  else if (holders < 1000) risk += 8;

  const liqToMcap = marketCap > 0 ? liquidity / marketCap : 0;
  if (liqToMcap < 0.01) risk += 20;
  else if (liqToMcap < 0.03) risk += 12;
  else if (liqToMcap < 0.05) risk += 6;

  if (topHolderPercent && topHolderPercent > 50) risk += 25;
  else if (topHolderPercent && topHolderPercent > 30) risk += 15;
  else if (topHolderPercent && topHolderPercent > 20) risk += 8;

  if (devWalletPercent && devWalletPercent > 15) risk += 20;
  else if (devWalletPercent && devWalletPercent > 8) risk += 12;
  else if (devWalletPercent && devWalletPercent > 5) risk += 6;

  if (safetyScore < 20) risk += 15;
  else if (safetyScore < 40) risk += 8;

  if (ageHours < 1) risk += 15;
  else if (ageHours < 6) risk += 8;
  else if (ageHours < 24) risk += 3;

  return Math.min(100, risk);
}

function computeSmartMoneyScore(
  isTrending: boolean,
  isBoosted: boolean,
  volume24h: number,
  buys24h: number,
  sells24h: number,
  liquidity: number,
  holders: number,
  whaleActivity: string,
  smSignal?: SmartMoneyTokenSignal | null
): number {
  let score = 30;

  if (isTrending) score += 12;
  if (isBoosted) score += 8;

  const buyRatio = (buys24h + sells24h) > 0 ? buys24h / (buys24h + sells24h) : 0.5;
  if (buyRatio > 0.65) score += 15;
  else if (buyRatio > 0.55) score += 8;

  if (volume24h > 5_000_000) score += 12;
  else if (volume24h > 1_000_000) score += 8;
  else if (volume24h > 500_000) score += 4;

  if (holders > 10000) score += 8;
  else if (holders > 5000) score += 4;

  if (liquidity > 1_000_000) score += 5;

  if (whaleActivity === "accumulating") score += 15;
  else if (whaleActivity === "distributing") score -= 12;

  if (smSignal) {
    if (smSignal.whaleAccumulationScore >= 75) score += 15;
    else if (smSignal.whaleAccumulationScore >= 60) score += 8;
    else if (smSignal.whaleAccumulationScore < 35) score -= 8;

    if (smSignal.avgWalletWinRate >= 70) score += 10;
    else if (smSignal.avgWalletWinRate >= 60) score += 5;

    if (smSignal.netFlow > 100_000) score += 8;
    else if (smSignal.netFlow > 10_000) score += 4;
    else if (smSignal.netFlow < -50_000) score -= 8;

    if (smSignal.topWalletCount >= 3) score += 4;
  }

  return Math.max(0, Math.min(100, score));
}

function computeSocialSentimentBoost(socialSignal: SocialSignal | null): { score: number; isSpike: boolean } {
  if (!socialSignal) return { score: 50, isSpike: false };

  let score = 50;

  if (socialSignal.galaxyScore >= 80) score += 18;
  else if (socialSignal.galaxyScore >= 60) score += 10;
  else if (socialSignal.galaxyScore >= 40) score += 5;
  else if (socialSignal.galaxyScore < 20) score -= 8;

  if (socialSignal.sentimentScore >= 80) score += 10;
  else if (socialSignal.sentimentScore >= 65) score += 5;
  else if (socialSignal.sentimentScore < 30) score -= 8;

  if (socialSignal.socialSpike) score += 10;

  if (socialSignal.influencerMentions >= 50) score += 8;
  else if (socialSignal.influencerMentions >= 10) score += 4;

  if (socialSignal.altRank > 0 && socialSignal.altRank <= 20) score += 8;
  else if (socialSignal.altRank <= 50) score += 4;

  return { score: Math.max(0, Math.min(100, score)), isSpike: socialSignal.socialSpike };
}

function classifySmartMoneyFlow(smSignal?: SmartMoneyTokenSignal | null): "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" {
  if (!smSignal) return "neutral";
  const acc = smSignal.whaleAccumulationScore;
  if (acc >= 80 && smSignal.netFlow > 50_000) return "strong_buy";
  if (acc >= 65) return "buy";
  if (acc <= 25 && smSignal.netFlow < -10_000) return "strong_sell";
  if (acc <= 40) return "sell";
  return "neutral";
}

export interface MarketBreadth {
  regime: "bull" | "bear" | "neutral";
  breadthScore: number;
  avgRSI: number;
  avgTrendStrength: number;
  bullishEmaPercent: number;
  bearishEmaPercent: number;
  volumeTrendUp: number;
  avgBuyPressure: number;
  positivePercent: number;
}

function detectMarketRegime(signals: TokenSignal[]): "bull" | "bear" | "neutral" {
  return computeMarketBreadth(signals).regime;
}

function computeMarketBreadth(signals: TokenSignal[]): MarketBreadth {
  const defaultBreadth: MarketBreadth = {
    regime: "neutral", breadthScore: 50, avgRSI: 50, avgTrendStrength: 50,
    bullishEmaPercent: 33, bearishEmaPercent: 33, volumeTrendUp: 50, avgBuyPressure: 50, positivePercent: 50,
  };
  if (signals.length < 5) return defaultBreadth;

  const sample = signals.slice(0, Math.min(50, signals.length));
  const n = sample.length;

  const avgMomentum = sample.reduce((s, t) => s + t.momentumScore, 0) / n;
  const avgBuyPressure = sample.reduce((s, t) => s + t.buyPressureScore, 0) / n;
  const positiveCount = sample.filter(t => t.priceChange1h > 0).length;
  const positivePercent = (positiveCount / n) * 100;

  const avgRSI = sample.reduce((s, t) => s + t.technicals.rsi14, 0) / n;
  const avgTrendStrength = sample.reduce((s, t) => s + t.technicals.trendStrength, 0) / n;

  const bullishEma = sample.filter(t => t.technicals.emaTrendAlignment === "bullish").length;
  const bearishEma = sample.filter(t => t.technicals.emaTrendAlignment === "bearish").length;
  const bullishEmaPercent = (bullishEma / n) * 100;
  const bearishEmaPercent = (bearishEma / n) * 100;
  const volumeUp = sample.filter(t => t.technicals.volumeTrend === "increasing").length;
  const volumeTrendUp = (volumeUp / n) * 100;

  let breadthScore = 50;
  if (avgMomentum > 60) breadthScore += 8;
  else if (avgMomentum < 40) breadthScore -= 8;
  if (avgBuyPressure > 55) breadthScore += 6;
  else if (avgBuyPressure < 45) breadthScore -= 6;
  if (positivePercent > 60) breadthScore += 8;
  else if (positivePercent < 40) breadthScore -= 8;
  if (avgRSI > 55) breadthScore += 5;
  else if (avgRSI < 40) breadthScore -= 5;
  if (avgTrendStrength > 60) breadthScore += 7;
  else if (avgTrendStrength < 40) breadthScore -= 7;
  if (bullishEmaPercent > 50) breadthScore += 8;
  else if (bearishEmaPercent > 50) breadthScore -= 8;
  if (volumeTrendUp > 50) breadthScore += 4;
  else if (volumeTrendUp < 30) breadthScore -= 4;

  breadthScore = Math.max(0, Math.min(100, breadthScore));

  let regime: "bull" | "bear" | "neutral" = "neutral";
  if (breadthScore >= 68) regime = "bull";
  else if (breadthScore <= 32) regime = "bear";

  return {
    regime, breadthScore, avgRSI, avgTrendStrength,
    bullishEmaPercent: Math.round(bullishEmaPercent),
    bearishEmaPercent: Math.round(bearishEmaPercent),
    volumeTrendUp: Math.round(volumeTrendUp),
    avgBuyPressure: Math.round(avgBuyPressure),
    positivePercent: Math.round(positivePercent),
  };
}

export function getAdaptiveWeights(regime: "bull" | "bear" | "neutral"): {
  momentum: number; volume: number; buyPressure: number; liquidity: number;
  safety: number; smartMoney: number; antiRug: number; stMom: number; trend: number; social: number;
} {
  switch (regime) {
    case "bull":
      return {
        momentum: 0.17, volume: 0.12, buyPressure: 0.10, liquidity: 0.05,
        safety: 0.05, smartMoney: 0.12, antiRug: 0.04, stMom: 0.05, trend: 0.12, social: 0.10,
      };
    case "bear":
      return {
        momentum: 0.11, volume: 0.09, buyPressure: 0.12, liquidity: 0.10,
        safety: 0.11, smartMoney: 0.10, antiRug: 0.09, stMom: 0.04, trend: 0.09, social: 0.07,
      };
    default:
      return {
        momentum: 0.16, volume: 0.11, buyPressure: 0.11, liquidity: 0.07,
        safety: 0.07, smartMoney: 0.11, antiRug: 0.05, stMom: 0.04, trend: 0.11, social: 0.09,
      };
  }
}

function computeConviction(signal: TokenSignal): number {
  let score = 0;

  if (signal.momentumScore >= 70) score += 15;
  else if (signal.momentumScore >= 60) score += 9;
  else if (signal.momentumScore >= 50) score += 4;

  if (signal.volumeScore >= 70) score += 13;
  else if (signal.volumeScore >= 55) score += 7;

  if (signal.buyPressureScore >= 65) score += 11;
  else if (signal.buyPressureScore >= 55) score += 5;

  if (signal.liquidityScore >= 60) score += 8;
  else if (signal.liquidityScore >= 40) score += 4;

  if (signal.safetyScore >= 70) score += 6;
  else if (signal.safetyScore >= 50) score += 3;

  if (signal.rugRiskScore > 50) score -= 16;
  else if (signal.rugRiskScore > 30) score -= 8;

  if (signal.smartMoneyScore >= 70) score += 11;
  else if (signal.smartMoneyScore >= 50) score += 5;

  if (signal.momentumAcceleration > 1) score += 6;
  else if (signal.momentumAcceleration < -1) score -= 6;

  if (signal.shortTermMomentum > 65) score += 4;
  else if (signal.shortTermMomentum < 35) score -= 4;

  if (signal.volumeBreakout) score += 6;

  if (signal.whaleActivity === "accumulating") score += 8;
  else if (signal.whaleActivity === "distributing") score -= 10;

  if (signal.lifecyclePhase === "growth" && signal.momentumScore >= 60) score += 4;
  if (signal.lifecyclePhase === "launch" && signal.volatility > 75) score -= 4;

  const tech = signal.technicals;
  if (tech.emaTrendAlignment === "bullish") score += 10;
  else if (tech.emaTrendAlignment === "bearish") score -= 8;

  if (tech.emaCrossover === "golden_cross") score += 7;
  else if (tech.emaCrossover === "death_cross") score -= 7;

  if (tech.rsi14 >= 30 && tech.rsi14 <= 65) score += 5;
  else if (tech.rsi14 > 80) score -= 6;
  else if (tech.rsi14 < 20) score -= 3;

  if (tech.macdHistogram > 0 && tech.macdLine > 0) score += 5;
  else if (tech.macdHistogram < 0 && tech.macdLine < 0) score -= 5;

  if (tech.isPullback) score += 8;
  if (tech.isOverextended) score -= 10;

  if (tech.rsiDivergence === "bullish") score += 6;
  else if (tech.rsiDivergence === "bearish") score -= 6;

  if (tech.volumeTrend === "increasing" && signal.momentumScore >= 55) score += 3;
  else if (tech.volumeTrend === "decreasing" && signal.momentumScore < 50) score -= 3;

  if (signal.socialSentimentScore >= 75) score += 8;
  else if (signal.socialSentimentScore >= 60) score += 4;
  else if (signal.socialSentimentScore < 25) score -= 4;

  if (signal.socialSpike && signal.momentumScore >= 55) score += 6;

  if (signal.smartMoneyFlow === "strong_buy") score += 10;
  else if (signal.smartMoneyFlow === "buy") score += 5;
  else if (signal.smartMoneyFlow === "sell") score -= 5;
  else if (signal.smartMoneyFlow === "strong_sell") score -= 10;

  if (signal.newsSentiment === "bullish") score += (signal.newsImpact === "high" ? 8 : 4);
  else if (signal.newsSentiment === "bearish") score -= (signal.newsImpact === "high" ? 10 : 5);

  if (signal.fearGreedValue <= 20) score += 6;
  else if (signal.fearGreedValue <= 30) score += 3;
  else if (signal.fearGreedValue >= 80) score -= 6;
  else if (signal.fearGreedValue >= 70) score -= 3;

  if (signal.liquidityDraining) score -= 12;
  if (signal.liquidityGrowing) score += 5;
  if (signal.liquidityHealth > 75) score += 4;
  else if (signal.liquidityHealth < 30) score -= 8;
  if (signal.liquidityFlow === "outflow") score -= 4;
  else if (signal.liquidityFlow === "inflow") score += 3;

  return Math.max(0, Math.min(100, score));
}

function getSafetyGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function computeTokenAge(createdAt: string | null | undefined): { label: string; hours: number } {
  if (!createdAt) return { label: "unknown", hours: 999 };
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  let label: string;
  if (hours < 1) label = `${Math.round(hours * 60)}m`;
  else if (hours < 24) label = `${Math.round(hours)}h`;
  else if (hours < 168) label = `${Math.round(hours / 24)}d`;
  else label = `${Math.round(hours / 168)}w`;
  return { label, hours };
}

function generateSignals(token: TokenSignal): string[] {
  const signals: string[] = [];

  if (token.momentumScore >= 85) signals.push("STRONG_UPTREND");
  else if (token.momentumScore >= 70) signals.push("UPTREND");
  else if (token.momentumScore >= 55) signals.push("MILD_UPTREND");
  else if (token.momentumScore <= 20) signals.push("STRONG_DOWNTREND");
  else if (token.momentumScore <= 35) signals.push("DOWNTREND");

  if (token.volumeScore >= 85) signals.push("HIGH_VOLUME_SURGE");
  else if (token.volumeScore >= 70) signals.push("ABOVE_AVG_VOLUME");
  else if (token.volumeScore <= 25) signals.push("LOW_VOLUME");

  if (token.buyPressureScore >= 70) signals.push("STRONG_BUY_PRESSURE");
  else if (token.buyPressureScore >= 60) signals.push("BUY_PRESSURE");
  else if (token.buyPressureScore <= 25) signals.push("HEAVY_SELL_PRESSURE");
  else if (token.buyPressureScore <= 35) signals.push("SELL_PRESSURE");

  if (token.liquidityScore >= 75) signals.push("DEEP_LIQUIDITY");
  else if (token.liquidityScore <= 20) signals.push("LOW_LIQUIDITY_RISK");

  if (token.isTrending) signals.push("TRENDING");
  if (token.isBoosted) signals.push("BOOSTED");

  if (token.safetyScore >= 80) signals.push("HIGH_SAFETY");
  else if (token.safetyScore <= 25) signals.push("SAFETY_RISK");

  if (token.priceChange1h < -20) signals.push("FLASH_CRASH");
  else if (token.priceChange1h < -10) signals.push("SHARP_DROP");
  if (token.priceChange1h > 40) signals.push("PARABOLIC");
  else if (token.priceChange1h > 20) signals.push("BREAKOUT");

  if (token.rugRiskScore >= 60) signals.push("HIGH_RUG_RISK");
  else if (token.rugRiskScore >= 40) signals.push("MODERATE_RUG_RISK");

  if (token.smartMoneyScore >= 70) signals.push("SMART_MONEY_INFLOW");
  else if (token.smartMoneyScore >= 55) signals.push("SMART_MONEY_INTEREST");

  if (token.momentumAcceleration > 2) signals.push("MOMENTUM_ACCELERATING");
  else if (token.momentumAcceleration < -2) signals.push("MOMENTUM_DECELERATING");

  if (token.holderConcentrationRisk > 60) signals.push("WHALE_CONCENTRATION");

  if (token.volumeToLiqRatio > 5) signals.push("VOLUME_EXCEEDS_LIQUIDITY");

  if (token.conviction >= 80) signals.push("HIGH_CONVICTION");
  else if (token.conviction >= 60) signals.push("MODERATE_CONVICTION");

  if (token.volumeBreakout) signals.push("VOLUME_BREAKOUT");

  if (token.whaleActivity === "accumulating") signals.push("WHALE_ACCUMULATING");
  else if (token.whaleActivity === "distributing") signals.push("WHALE_DISTRIBUTING");

  if (token.shortTermMomentum >= 75) signals.push("SHORT_TERM_BULLISH");
  else if (token.shortTermMomentum <= 25) signals.push("SHORT_TERM_BEARISH");

  if (token.volatility >= 85) signals.push("EXTREME_VOLATILITY");
  else if (token.volatility >= 70) signals.push("HIGH_VOLATILITY");

  if (token.lifecyclePhase === "launch") signals.push("NEW_LAUNCH");
  else if (token.lifecyclePhase === "growth") signals.push("GROWTH_PHASE");

  const tech = token.technicals;
  if (tech.emaTrendAlignment === "bullish") signals.push("EMA_BULLISH_ALIGNED");
  else if (tech.emaTrendAlignment === "bearish") signals.push("EMA_BEARISH_ALIGNED");

  if (tech.emaCrossover === "golden_cross") signals.push("GOLDEN_CROSS");
  else if (tech.emaCrossover === "death_cross") signals.push("DEATH_CROSS");

  if (tech.rsi14 > 80) signals.push("RSI_OVERBOUGHT");
  else if (tech.rsi14 > 70) signals.push("RSI_HIGH");
  else if (tech.rsi14 < 20) signals.push("RSI_OVERSOLD");
  else if (tech.rsi14 < 30) signals.push("RSI_LOW");

  if (tech.rsiDivergence === "bullish") signals.push("RSI_BULLISH_DIVERGENCE");
  else if (tech.rsiDivergence === "bearish") signals.push("RSI_BEARISH_DIVERGENCE");

  if (tech.isOverextended) signals.push("OVEREXTENDED");
  if (tech.isPullback) signals.push("PULLBACK_ENTRY");

  if (tech.macdHistogram > 0 && tech.macdLine > 0) signals.push("MACD_BULLISH");
  else if (tech.macdHistogram < 0 && tech.macdLine < 0) signals.push("MACD_BEARISH");

  if (tech.trendStrength >= 75) signals.push("STRONG_TREND");
  else if (tech.trendStrength <= 25) signals.push("WEAK_TREND");

  if (token.socialSentimentScore >= 80) signals.push("SOCIAL_BUZZ_HIGH");
  else if (token.socialSentimentScore >= 65) signals.push("SOCIAL_POSITIVE");
  else if (token.socialSentimentScore <= 25) signals.push("SOCIAL_NEGATIVE");

  if (token.socialSpike) signals.push("SOCIAL_SPIKE");

  if (token.smartMoneyFlow === "strong_buy") signals.push("SMART_MONEY_STRONG_BUY");
  else if (token.smartMoneyFlow === "buy") signals.push("SMART_MONEY_BUY");
  else if (token.smartMoneyFlow === "sell") signals.push("SMART_MONEY_SELL");
  else if (token.smartMoneyFlow === "strong_sell") signals.push("SMART_MONEY_STRONG_SELL");

  if (token.newsSentiment === "bullish") signals.push(token.newsImpact === "high" ? "NEWS_MAJOR_BULLISH" : "NEWS_BULLISH");
  else if (token.newsSentiment === "bearish") signals.push(token.newsImpact === "high" ? "NEWS_MAJOR_BEARISH" : "NEWS_BEARISH");

  if (token.fearGreedValue <= 20) signals.push("EXTREME_FEAR");
  else if (token.fearGreedValue <= 30) signals.push("MARKET_FEAR");
  else if (token.fearGreedValue >= 80) signals.push("EXTREME_GREED");
  else if (token.fearGreedValue >= 70) signals.push("MARKET_GREED");

  if (token.liquidityDraining) signals.push("LIQUIDITY_DRAINING");
  if (token.liquidityGrowing) signals.push("LIQUIDITY_GROWING");
  if (token.liquidityHealth < 25) signals.push("LIQUIDITY_CRITICAL");
  if (token.liquidityFlow === "outflow") signals.push("MARKET_LIQUIDITY_OUTFLOW");
  else if (token.liquidityFlow === "inflow") signals.push("MARKET_LIQUIDITY_INFLOW");

  return signals;
}

function mergeAndScoreToken(
  liveToken: LiveMemeToken | null,
  dbToken: Token | null,
  safetyReport: SafetyReport | null,
  marketRegime: string,
  strategy: string
): TokenSignal | null {
  const source = liveToken || dbToken;
  if (!source) return null;

  const price = liveToken?.price ?? dbToken?.price ?? 0;
  const change1h = liveToken?.priceChange1h ?? dbToken?.priceChange1h ?? 0;
  const change24h = liveToken?.priceChange24h ?? dbToken?.priceChange24h ?? 0;
  const volume = liveToken?.volume24h ?? dbToken?.volume24h ?? 0;
  const mcap = liveToken?.marketCap ?? dbToken?.marketCap ?? 0;
  const liq = liveToken?.liquidity ?? dbToken?.liquidity ?? 0;
  const holders = liveToken?.holders ?? dbToken?.holders ?? 0;
  const buys = liveToken?.buys24h ?? dbToken?.buys24h ?? 0;
  const sells = liveToken?.sells24h ?? dbToken?.sells24h ?? 0;
  const safety = safetyReport?.overallScore ?? 50;
  const topHolderPct = dbToken?.topHolderPercent ?? null;
  const devWalletPct = liveToken?.devWalletPercent ?? dbToken?.devWalletPercent ?? null;
  const symbol = liveToken?.symbol ?? dbToken?.symbol ?? "";
  const address = liveToken?.address ?? dbToken?.address ?? "";
  const chain = liveToken?.chain ?? dbToken?.chain ?? "solana";

  const tokenKey = makeTokenKey(address, chain);
  trackPrice(tokenKey, price, volume);
  updatePriceHistory(tokenKey, price, volume);
  const acceleration = getMomentumAcceleration(tokenKey, change1h);
  const shortTermMom = getShortTermMomentum(tokenKey);
  const volatilityScore = computeVolatility(tokenKey, price);
  const volBreakout = detectVolumeBreakout(tokenKey, volume);
  const whaleAct = detectWhaleActivity(buys, sells, volume, liq, change1h);
  const technicals = computeTechnicalIndicators(tokenKey, price);

  const { label: ageLabel, hours: ageHours } = computeTokenAge(
    (liveToken as any)?.createdAt || (dbToken as any)?.createdAt || null
  );
  const lifecycle = getLifecyclePhase(ageHours, holders, liq);

  const momentumScore = computeMomentumScore(change1h, change24h, acceleration, shortTermMom);
  const volumeScore = computeVolumeScore(volume, mcap);
  const buyPressureScore = computeBuyPressure(buys, sells);
  const liquidityScore = computeLiquidityScore(liq);

  const isTrending = liveToken ? (liveToken.boosts ?? 0) > 0 : dbToken?.isTrending || false;
  const isBoosted = (liveToken?.boosts ?? 0) > 50;

  const rugRiskScore = computeRugRiskScore(liq, holders, mcap, topHolderPct, devWalletPct, safety, ageHours);
  const smSignal = getSmartMoneySignalForToken(address, chain);
  const socialSignal = getSocialSignalForToken(symbol);
  const smartMoneyScore = computeSmartMoneyScore(isTrending, isBoosted, volume, buys, sells, liq, holders, whaleAct, smSignal);
  const { score: socialSentimentScore, isSpike: socialSpike } = computeSocialSentimentBoost(socialSignal);
  const smFlow = classifySmartMoneyFlow(smSignal);
  const volumeToLiqRatio = liq > 0 ? volume / liq : 0;
  const holderConcentrationRisk = topHolderPct ? Math.min(100, topHolderPct * 1.5) : 30;

  const newsSignal = getNewsSentimentForToken(symbol);
  const marketNewsSentiment = getOverallMarketNewsSentiment();
  const fearGreedData = getFearGreedSignal();
  const liqSignal = getLiquiditySignalForToken(address, chain);
  const marketLiqFlow = getMarketLiquidityFlow();
  const liqHealthScore = computeLiquidityHealthScore(liqSignal);

  const newsSentiment: "bullish" | "bearish" | "neutral" = newsSignal
    ? (newsSignal.overallSentiment > 0.3 ? "bullish" : newsSignal.overallSentiment < -0.3 ? "bearish" : "neutral")
    : (marketNewsSentiment.overallSentiment > 0.3 ? "bullish" : marketNewsSentiment.overallSentiment < -0.3 ? "bearish" : "neutral");
  const newsImpact: "high" | "medium" | "low" = newsSignal?.highImpactCount
    ? (newsSignal.highImpactCount >= 3 ? "high" : newsSignal.highImpactCount >= 1 ? "medium" : "low")
    : "low";
  const newsScore = newsSignal
    ? Math.round(50 + newsSignal.overallSentiment * 50)
    : Math.round(50 + marketNewsSentiment.overallSentiment * 30);

  const fearGreedValue = fearGreedData?.value ?? 50;
  const fearGreedBias: "buy" | "sell" | "hold" = fearGreedData?.tradingBias?.bias ?? "hold";
  const fearGreedClassification = fearGreedData?.classification ?? "Neutral";

  const liquidityHealth = liqHealthScore;
  const liquidityFlow: "inflow" | "outflow" | "neutral" = marketLiqFlow;
  const liquidityDraining = liqSignal?.isLiquidityDraining ?? false;
  const liquidityGrowing = liqSignal?.isLiquidityGrowing ?? false;

  const dynSL = computeDynamicStopLoss(volatilityScore, strategy);
  const dynTP = computeDynamicTakeProfit(volatilityScore, marketRegime, strategy);

  const techBonus =
    (technicals.emaTrendAlignment === "bullish" ? 4 : technicals.emaTrendAlignment === "bearish" ? -4 : 0) +
    (technicals.isPullback ? 5 : 0) +
    (technicals.isOverextended ? -6 : 0) +
    (technicals.emaCrossover === "golden_cross" ? 4 : technicals.emaCrossover === "death_cross" ? -4 : 0) +
    (technicals.rsiDivergence === "bullish" ? 3 : technicals.rsiDivergence === "bearish" ? -3 : 0) +
    (technicals.macdHistogram > 0 ? 2 : technicals.macdHistogram < 0 ? -2 : 0) +
    (technicals.volumeTrend === "increasing" ? 2 : technicals.volumeTrend === "decreasing" ? -1 : 0);

  const socialBonus = socialSentimentScore > 70 ? 4 : socialSentimentScore > 60 ? 2 : socialSentimentScore < 30 ? -2 : 0;
  const smFlowBonus = smFlow === "strong_buy" ? 5 : smFlow === "buy" ? 3 : smFlow === "sell" ? -2 : smFlow === "strong_sell" ? -5 : 0;

  const newsBonus = newsSentiment === "bullish" ? (newsImpact === "high" ? 6 : 3) :
    newsSentiment === "bearish" ? (newsImpact === "high" ? -6 : -3) : 0;
  const fearGreedBonus = fearGreedBias === "buy" ? (fearGreedValue <= 20 ? 5 : 3) :
    fearGreedBias === "sell" ? (fearGreedValue >= 80 ? -5 : -3) : 0;
  const liqBonus = liquidityGrowing ? 3 : liquidityDraining ? -5 : 0;
  const liqHealthBonus = liquidityHealth > 80 ? 3 : liquidityHealth < 30 ? -4 : 0;

  const overallSignalScore = Math.round(
    momentumScore * 0.14 +
    volumeScore * 0.10 +
    buyPressureScore * 0.09 +
    liquidityScore * 0.06 +
    safety * 0.05 +
    smartMoneyScore * 0.10 +
    Math.max(0, 100 - rugRiskScore) * 0.04 +
    shortTermMom * 0.03 +
    technicals.trendStrength * 0.09 +
    socialSentimentScore * 0.07 +
    newsScore * 0.08 +
    liquidityHealth * 0.07 +
    (100 - Math.abs(fearGreedValue - 50) * 2) * 0.04 +
    (technicals.rsi14 > 30 && technicals.rsi14 < 70 ? 5 : 0) +
    (volBreakout ? 5 : 0) +
    (whaleAct === "accumulating" ? 3 : whaleAct === "distributing" ? -3 : 0) +
    (socialSpike ? 4 : 0) +
    socialBonus +
    smFlowBonus +
    techBonus +
    newsBonus +
    fearGreedBonus +
    liqBonus +
    liqHealthBonus
  );

  const signal: TokenSignal = {
    id: liveToken?.id ?? dbToken?.id ?? 0,
    address,
    symbol,
    name: liveToken?.name ?? dbToken?.name ?? "",
    chain,
    price,
    priceChange1h: change1h,
    priceChange24h: change24h,
    volume24h: volume,
    marketCap: mcap,
    liquidity: liq,
    holders,
    buys24h: buys,
    sells24h: sells,
    safetyScore: safety,
    isTrending,
    isBoosted,
    age: ageLabel,
    ageHours,
    momentumScore,
    volumeScore,
    buyPressureScore,
    liquidityScore,
    safetyGrade: getSafetyGrade(safety),
    overallSignalScore: Math.max(0, Math.min(100, overallSignalScore)),
    signals: [],
    smartMoneyScore,
    rugRiskScore,
    momentumAcceleration: acceleration,
    volumeToLiqRatio: Math.round(volumeToLiqRatio * 100) / 100,
    holderConcentrationRisk,
    marketRegime: marketRegime as "bull" | "bear" | "neutral",
    conviction: 0,
    volatility: volatilityScore,
    lifecyclePhase: lifecycle,
    shortTermMomentum: shortTermMom,
    volumeBreakout: volBreakout,
    whaleActivity: whaleAct,
    dynamicStopLoss: Math.round(dynSL * 10) / 10,
    dynamicTakeProfit: dynTP,
    technicals,
    socialSentimentScore,
    socialSpike,
    smartMoneyFlow: smFlow,
    newsSentiment,
    newsImpact,
    newsScore,
    fearGreedValue,
    fearGreedBias,
    fearGreedClassification,
    liquidityHealth,
    liquidityFlow,
    liquidityDraining,
    liquidityGrowing,
  };

  signal.conviction = computeConviction(signal);
  signal.signals = generateSignals(signal);
  return signal;
}

let lastComputedBreadth: MarketBreadth | null = null;

export function getLastMarketBreadth(): MarketBreadth | null {
  return lastComputedBreadth;
}

export async function getMarketSignals(chain?: string, strategy?: string): Promise<TokenSignal[]> {
  const [liveTokens, dbTokens, safetyReports] = await Promise.all([
    getLiveMemeTokens().catch(() => [] as LiveMemeToken[]),
    storage.getTokens(),
    storage.getSafetyReports(),
  ]);

  const safetyMap = new Map(safetyReports.map(r => [r.tokenId, r]));
  const signals: TokenSignal[] = [];
  const seenKeys = new Set<string>();
  const strat = strategy ?? "balanced";

  for (const lt of liveTokens) {
    if (chain && chain !== "all" && lt.chain !== chain) continue;
    const key = makeTokenKey(lt.address, lt.chain);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const signal = mergeAndScoreToken(lt, null, null, "neutral", strat);
    if (signal && signal.price > 0) {
      signals.push(signal);
    }
  }

  for (const dt of dbTokens) {
    const dtAddr = dt.address ?? "";
    const dtChain = dt.chain ?? "solana";
    const key = makeTokenKey(dtAddr, dtChain);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    if (chain && chain !== "all" && dtChain !== chain) continue;

    const safety = safetyMap.get(dt.id) || null;
    const signal = mergeAndScoreToken(null, dt, safety, "neutral", strat);
    if (signal && signal.price > 0) {
      signals.push(signal);
    }
  }

  const breadth = computeMarketBreadth(signals);
  const regime = breadth.regime;
  const weights = getAdaptiveWeights(regime);

  for (const s of signals) {
    s.marketRegime = regime;
    s.dynamicStopLoss = Math.round(computeDynamicStopLoss(s.volatility, strat) * 10) / 10;
    s.dynamicTakeProfit = computeDynamicTakeProfit(s.volatility, regime, strat);

    const techBonus =
      (s.technicals.emaTrendAlignment === "bullish" ? 4 : s.technicals.emaTrendAlignment === "bearish" ? -4 : 0) +
      (s.technicals.isPullback ? 5 : 0) +
      (s.technicals.isOverextended ? -6 : 0) +
      (s.technicals.emaCrossover === "golden_cross" ? 4 : s.technicals.emaCrossover === "death_cross" ? -4 : 0) +
      (s.technicals.rsiDivergence === "bullish" ? 3 : s.technicals.rsiDivergence === "bearish" ? -3 : 0) +
      (s.technicals.macdHistogram > 0 ? 2 : s.technicals.macdHistogram < 0 ? -2 : 0) +
      (s.technicals.volumeTrend === "increasing" ? 2 : s.technicals.volumeTrend === "decreasing" ? -1 : 0);

    s.overallSignalScore = Math.max(0, Math.min(100, Math.round(
      s.momentumScore * weights.momentum +
      s.volumeScore * weights.volume +
      s.buyPressureScore * weights.buyPressure +
      s.liquidityScore * weights.liquidity +
      s.safetyScore * weights.safety +
      s.smartMoneyScore * weights.smartMoney +
      Math.max(0, 100 - s.rugRiskScore) * weights.antiRug +
      s.shortTermMomentum * weights.stMom +
      s.socialSentimentScore * weights.social +
      s.technicals.trendStrength * weights.trend +
      (s.technicals.rsi14 > 30 && s.technicals.rsi14 < 70 ? 5 : 0) +
      (s.volumeBreakout ? 5 : 0) +
      (s.whaleActivity === "accumulating" ? 3 : s.whaleActivity === "distributing" ? -3 : 0) +
      techBonus
    )));

    s.conviction = computeConviction(s);
    s.signals = generateSignals(s);
  }

  signals.sort((a, b) => b.overallSignalScore - a.overallSignalScore);

  lastComputedBreadth = breadth;
  return signals;
}

export function formatSignalsForAI(signals: TokenSignal[], limit = 30): string {
  const top = signals.slice(0, limit);
  const lines = top.map((s, i) => {
    const signalTags = s.signals.length > 0 ? ` [${s.signals.join(", ")}]` : "";
    const t = s.technicals;
    const techStr = ` | RSI: ${t.rsi14} | EMA: ${t.emaTrendAlignment} | MACD: ${t.macdHistogram > 0 ? "+" : ""}${(t.macdHistogram * 1e6).toFixed(1)} | ATR%: ${t.atrPercent}% | Trend: ${t.trendStrength} | P/E9: ${t.priceVsEma9 >= 0 ? "+" : ""}${t.priceVsEma9}% | P/E21: ${t.priceVsEma21 >= 0 ? "+" : ""}${t.priceVsEma21}%${t.isPullback ? " | PULLBACK" : ""}${t.isOverextended ? " | OVEREXTD" : ""}${t.emaCrossover !== "none" ? ` | ${t.emaCrossover.toUpperCase()}` : ""}${t.rsiDivergence !== "none" ? ` | RSI_DIV:${t.rsiDivergence}` : ""}`;
    const socialStr = s.socialSentimentScore !== 50 || s.socialSpike ? ` | Social: ${s.socialSentimentScore}${s.socialSpike ? " SPIKE" : ""}` : "";
    const smFlowStr = s.smartMoneyFlow !== "neutral" ? ` | SM$Flow: ${s.smartMoneyFlow.toUpperCase()}` : "";
    const newsStr = s.newsSentiment !== "neutral" ? ` | News: ${s.newsSentiment.toUpperCase()}(${s.newsImpact})` : "";
    const fgStr = ` | F&G: ${s.fearGreedValue}(${s.fearGreedClassification})`;
    const liqHealthStr = ` | LiqH: ${s.liquidityHealth}${s.liquidityDraining ? " DRAIN" : ""}${s.liquidityGrowing ? " GROW" : ""}`;
    return `#${i + 1} ${s.symbol} (${s.chain}) $${s.price < 0.001 ? s.price.toExponential(2) : s.price.toFixed(4)} | Sig: ${s.overallSignalScore} | Conv: ${s.conviction} | Mom: ${s.momentumScore} | STMom: ${s.shortTermMomentum} | Vol: ${s.volumeScore} | BuyP: ${s.buyPressureScore}% | Liq: $${(s.liquidity / 1e6).toFixed(2)}M | Safety: ${s.safetyGrade}(${s.safetyScore}) | Rug: ${s.rugRiskScore} | Smart$: ${s.smartMoneyScore}${smFlowStr} | Whale: ${s.whaleActivity}${socialStr}${newsStr}${fgStr}${liqHealthStr} | 1h: ${s.priceChange1h >= 0 ? "+" : ""}${s.priceChange1h.toFixed(1)}% | 24h: ${s.priceChange24h >= 0 ? "+" : ""}${s.priceChange24h.toFixed(1)}% | MCap: $${(s.marketCap / 1e6).toFixed(1)}M | Holders: ${s.holders} | Age: ${s.age} | Phase: ${s.lifecyclePhase} | Vola: ${s.volatility} | V/L: ${s.volumeToLiqRatio.toFixed(1)}x | VolBrk: ${s.volumeBreakout ? "YES" : "no"} | DynSL: ${s.dynamicStopLoss}% | DynTP: ${s.dynamicTakeProfit}%${techStr}${signalTags}`;
  });

  return lines.join("\n");
}

export function getTopBuySignals(signals: TokenSignal[], strategy: string): TokenSignal[] {
  const hardFiltered = signals.filter(s =>
    s.liquidity >= 10_000 &&
    s.price > 0 &&
    s.rugRiskScore < 70 &&
    s.whaleActivity !== "distributing" &&
    !s.technicals.isOverextended &&
    s.technicals.rsi14 < 82 &&
    s.technicals.emaTrendAlignment !== "bearish" &&
    s.smartMoneyFlow !== "strong_sell"
  );

  switch (strategy) {
    case "conservative":
      return hardFiltered.filter(s =>
        s.safetyScore >= 65 &&
        s.liquidityScore >= 55 &&
        s.momentumScore >= 55 &&
        s.buyPressureScore >= 55 &&
        s.rugRiskScore < 30 &&
        s.conviction >= 50 &&
        s.ageHours >= 12 &&
        s.volatility < 85 &&
        s.lifecyclePhase !== "launch" &&
        s.technicals.rsi14 >= 25 && s.technicals.rsi14 <= 68 &&
        s.technicals.trendStrength >= 45 &&
        (s.technicals.emaTrendAlignment === "bullish" || s.technicals.isPullback) &&
        !s.signals.includes("SAFETY_RISK") &&
        !s.signals.includes("LOW_LIQUIDITY_RISK") &&
        !s.signals.includes("HIGH_RUG_RISK") &&
        !s.signals.includes("WHALE_CONCENTRATION") &&
        !s.signals.includes("WHALE_DISTRIBUTING") &&
        !s.signals.includes("DEATH_CROSS") &&
        !s.signals.includes("MACD_BEARISH") &&
        s.smartMoneyFlow !== "sell" &&
        s.smartMoneyFlow !== "strong_sell"
      ).slice(0, 5);

    case "balanced":
      return hardFiltered.filter(s =>
        s.safetyScore >= 45 &&
        s.liquidityScore >= 40 &&
        s.momentumScore >= 58 &&
        s.buyPressureScore >= 52 &&
        s.overallSignalScore >= 55 &&
        s.rugRiskScore < 45 &&
        s.conviction >= 40 &&
        s.technicals.rsi14 >= 22 && s.technicals.rsi14 <= 75 &&
        s.technicals.trendStrength >= 40 &&
        !s.signals.includes("HIGH_RUG_RISK") &&
        !s.signals.includes("WHALE_DISTRIBUTING") &&
        !s.signals.includes("DEATH_CROSS")
      ).slice(0, 8);

    case "aggressive":
      return hardFiltered.filter(s =>
        s.momentumScore >= 65 &&
        s.volumeScore >= 55 &&
        s.overallSignalScore >= 58 &&
        s.liquidityScore >= 25 &&
        s.rugRiskScore < 55 &&
        s.conviction >= 35 &&
        s.technicals.rsi14 <= 78 &&
        s.technicals.trendStrength >= 35
      ).slice(0, 12);

    case "degen":
      return hardFiltered.filter(s =>
        s.momentumScore >= 70 &&
        s.overallSignalScore >= 50 &&
        s.conviction >= 25 &&
        s.rugRiskScore < 65 &&
        s.technicals.rsi14 <= 85
      ).slice(0, 15);

    default:
      return hardFiltered.filter(s => s.overallSignalScore >= 55 && s.conviction >= 35).slice(0, 10);
  }
}

export function getSellSignals(
  signals: TokenSignal[],
  entryPrice: number,
  currentPrice: number,
  stopLossPercent: number,
  takeProfitPercent: number,
  trailingStopPrice: number | null,
  tokenSymbol?: string,
  holdTimeHours?: number,
  tokenAddress?: string,
  tokenChain?: string
): { shouldSell: boolean; reason: string; urgency: "low" | "medium" | "high"; sellPercent: number } {
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

  if (pnlPercent <= -stopLossPercent) {
    return { shouldSell: true, reason: `Stop loss triggered at ${pnlPercent.toFixed(1)}% loss`, urgency: "high", sellPercent: 100 };
  }

  if (trailingStopPrice && currentPrice <= trailingStopPrice) {
    return { shouldSell: true, reason: `Trailing stop triggered at $${currentPrice.toFixed(6)}`, urgency: "high", sellPercent: 100 };
  }

  let tokenSignal: TokenSignal | undefined;
  if (tokenAddress && tokenChain) {
    tokenSignal = signals.find(s => s.address.toLowerCase() === tokenAddress.toLowerCase() && s.chain === tokenChain);
  }
  if (!tokenSignal && tokenSymbol) {
    tokenSignal = signals.find(s => s.symbol.toUpperCase() === tokenSymbol.toUpperCase());
  }

  if (tokenSignal) {
    if (tokenSignal.signals.includes("FLASH_CRASH")) {
      return { shouldSell: true, reason: "Flash crash detected - emergency exit", urgency: "high", sellPercent: 100 };
    }

    if (tokenSignal.whaleActivity === "distributing" && pnlPercent > -3) {
      return { shouldSell: true, reason: `Whale distributing detected - exiting before dump (PnL: ${pnlPercent.toFixed(1)}%)`, urgency: "high", sellPercent: 100 };
    }

    if (tokenSignal.rugRiskScore >= 65 && pnlPercent > -5) {
      return { shouldSell: true, reason: `High rug risk detected (${tokenSignal.rugRiskScore}/100) - exiting to protect capital`, urgency: "high", sellPercent: 100 };
    }

    if (tokenSignal.buyPressureScore <= 25 && pnlPercent > -3) {
      return { shouldSell: true, reason: `Heavy sell pressure (buy ratio ${tokenSignal.buyPressureScore}%) - exiting before dump`, urgency: "high", sellPercent: 100 };
    }

    const dynTP = tokenSignal.dynamicTakeProfit;
    if (pnlPercent >= dynTP * 0.4 && pnlPercent < dynTP) {
      return { shouldSell: true, reason: `Partial profit at ${pnlPercent.toFixed(1)}% (target: ${dynTP}%) - securing gains on 40%`, urgency: "medium", sellPercent: 40 };
    }

    if (pnlPercent >= dynTP) {
      return { shouldSell: true, reason: `Dynamic take profit hit at ${pnlPercent.toFixed(1)}% (target: ${dynTP}%)`, urgency: "medium", sellPercent: 100 };
    }

    if (tokenSignal.momentumScore <= 25 && pnlPercent > 0) {
      return { shouldSell: true, reason: `Momentum collapsed (${tokenSignal.momentumScore}/100) - locking in ${pnlPercent.toFixed(1)}% profit`, urgency: "medium", sellPercent: 100 };
    }

    if (tokenSignal.buyPressureScore <= 35 && pnlPercent > -3) {
      return { shouldSell: true, reason: `Sell pressure rising (buy ratio ${tokenSignal.buyPressureScore}%) - exiting position`, urgency: "medium", sellPercent: 80 };
    }

    if (tokenSignal.momentumAcceleration < -3 && tokenSignal.momentumScore < 40) {
      return { shouldSell: true, reason: `Momentum decelerating rapidly (${tokenSignal.momentumAcceleration.toFixed(1)}) with weak trend`, urgency: "medium", sellPercent: 100 };
    }

    if (tokenSignal.shortTermMomentum < 20 && pnlPercent > 3) {
      return { shouldSell: true, reason: `Short-term momentum bearish (${tokenSignal.shortTermMomentum}) - taking profits at ${pnlPercent.toFixed(1)}%`, urgency: "medium", sellPercent: 60 };
    }

    if (tokenSignal.signals.includes("HEAVY_SELL_PRESSURE") && pnlPercent < 5) {
      return { shouldSell: true, reason: "Heavy sell pressure detected - protecting position", urgency: "medium", sellPercent: 100 };
    }

    const tech = tokenSignal.technicals;
    if (tech.emaCrossover === "death_cross" && pnlPercent > -3) {
      return { shouldSell: true, reason: `Death cross detected (EMA9 crossed below EMA21) - exiting at ${pnlPercent.toFixed(1)}% PnL`, urgency: "high", sellPercent: 100 };
    }

    if (tech.rsi14 > 85 && pnlPercent > 10) {
      return { shouldSell: true, reason: `RSI extremely overbought (${tech.rsi14}) with ${pnlPercent.toFixed(1)}% profit - selling into strength`, urgency: "medium", sellPercent: 70 };
    }

    if (tech.rsiDivergence === "bearish" && pnlPercent > 5) {
      return { shouldSell: true, reason: `Bearish RSI divergence with ${pnlPercent.toFixed(1)}% profit - selling before reversal`, urgency: "medium", sellPercent: 60 };
    }

    if (tech.emaTrendAlignment === "bearish" && pnlPercent > 0) {
      return { shouldSell: true, reason: `EMA trend turned bearish - locking in ${pnlPercent.toFixed(1)}% profit`, urgency: "medium", sellPercent: 100 };
    }

    if (tech.macdHistogram < 0 && tech.macdLine < 0 && pnlPercent > 3) {
      return { shouldSell: true, reason: `MACD fully bearish - taking ${pnlPercent.toFixed(1)}% profit before further decline`, urgency: "medium", sellPercent: 80 };
    }

    if (tech.isOverextended && pnlPercent > 15) {
      return { shouldSell: true, reason: `Token overextended (P/EMA21: ${tech.priceVsEma21}%, RSI: ${tech.rsi14}) - securing ${pnlPercent.toFixed(1)}% profit`, urgency: "medium", sellPercent: 50 };
    }
  }

  if (holdTimeHours) {
    if (holdTimeHours > 72 && pnlPercent < 5 && pnlPercent > -5) {
      return { shouldSell: true, reason: `Position stale (${Math.round(holdTimeHours)}h) with minimal P&L (${pnlPercent.toFixed(1)}%) - freeing capital`, urgency: "low", sellPercent: 100 };
    }
    if (holdTimeHours > 24 && pnlPercent < 2 && pnlPercent > -2) {
      return { shouldSell: true, reason: `Position flat for ${Math.round(holdTimeHours)}h (${pnlPercent.toFixed(1)}%) - redeploying capital to better opportunities`, urgency: "low", sellPercent: 50 };
    }
  }

  return { shouldSell: false, reason: "", urgency: "low", sellPercent: 0 };
}
