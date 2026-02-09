import OpenAI from "openai";
import { storage } from "../storage";
import { authStorage } from "../integrations/auth/storage";
import type { AiAgent, AgentPosition } from "@shared/schema";
import { getMarketSignals, formatSignalsForAI, getTopBuySignals, getSellSignals, getLastMarketBreadth, type TokenSignal } from "./signal-builder";
import { computeTechnicalIndicators } from "./technical-indicators";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const recentLosses = new Map<number, { tokens: string[]; timestamp: number }>();
const cooldownTracker = new Map<number, { cyclesRemaining: number; reducedSizing: boolean }>();

interface SignalPerformanceEntry {
  signals: string[];
  strategy: string;
  entryPrice: number;
  exitPrice?: number;
  pnlPercent?: number;
  profitable?: boolean;
  rsiAtEntry: number;
  emaTrendAtEntry: string;
  macdAtEntry: number;
  trendStrengthAtEntry: number;
  marketRegime: string;
  timestamp: number;
}

const signalPerformanceLog: SignalPerformanceEntry[] = [];
const signalWinRates = new Map<string, { wins: number; losses: number; avgPnl: number; count: number }>();
let signalPerformanceLoaded = false;

async function loadSignalPerformanceFromDB(): Promise<void> {
  if (signalPerformanceLoaded) return;
  try {
    signalWinRates.clear();
    const rows = await storage.getAllSignalPerformance();
    for (const row of rows) {
      signalWinRates.set(row.signal, {
        wins: row.wins,
        losses: row.losses,
        avgPnl: row.avgPnl,
        count: row.count,
      });
    }
    signalPerformanceLoaded = true;
    console.log(`[AI] Loaded ${rows.length} signal performance records from DB`);
  } catch (err) {
    console.error("[AI] Failed to load signal performance from DB:", err);
  }
}

function recordTradeEntry(
  tokenSignal: TokenSignal | undefined,
  signals: string[],
  strategy: string,
  entryPrice: number,
  marketRegime: string
): void {
  signalPerformanceLog.push({
    signals,
    strategy,
    entryPrice,
    rsiAtEntry: tokenSignal?.technicals.rsi14 ?? 50,
    emaTrendAtEntry: tokenSignal?.technicals.emaTrendAlignment ?? "mixed",
    macdAtEntry: tokenSignal?.technicals.macdHistogram ?? 0,
    trendStrengthAtEntry: tokenSignal?.technicals.trendStrength ?? 50,
    marketRegime,
    timestamp: Date.now(),
  });
  if (signalPerformanceLog.length > 500) signalPerformanceLog.splice(0, 100);
}

async function recordTradeExit(
  signals: string[],
  strategy: string,
  entryPrice: number,
  exitPrice: number,
): Promise<void> {
  const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  const profitable = pnlPercent > 0;

  const dbWrites: Promise<unknown>[] = [];

  for (const sig of signals) {
    const existing = signalWinRates.get(sig) || { wins: 0, losses: 0, avgPnl: 0, count: 0 };
    existing.count++;
    if (profitable) existing.wins++;
    else existing.losses++;
    existing.avgPnl = ((existing.avgPnl * (existing.count - 1)) + pnlPercent) / existing.count;
    signalWinRates.set(sig, existing);

    dbWrites.push(storage.upsertSignalPerformance(sig, "all", profitable, pnlPercent));
  }

  const comboKey = `COMBO:${signals.sort().join("+")}`;
  const comboStats = signalWinRates.get(comboKey) || { wins: 0, losses: 0, avgPnl: 0, count: 0 };
  comboStats.count++;
  if (profitable) comboStats.wins++;
  else comboStats.losses++;
  comboStats.avgPnl = ((comboStats.avgPnl * (comboStats.count - 1)) + pnlPercent) / comboStats.count;
  signalWinRates.set(comboKey, comboStats);

  dbWrites.push(storage.upsertSignalPerformance(comboKey, "all", profitable, pnlPercent));

  try {
    await Promise.all(dbWrites);
  } catch (err) {
    console.error("[AI] Failed to persist signal performance:", err);
  }
}

export function getSignalPerformanceStats() {
  return { signalWinRates: Object.fromEntries(signalWinRates), recentEntries: signalPerformanceLog.length };
}

export function getSignalPerformanceReport(): Record<string, { winRate: number; avgPnl: number; count: number }> {
  const report: Record<string, { winRate: number; avgPnl: number; count: number }> = {};
  for (const [signal, stats] of Array.from(signalWinRates.entries())) {
    if (stats.count >= 3) {
      report[signal] = {
        winRate: Math.round((stats.wins / stats.count) * 100),
        avgPnl: Math.round(stats.avgPnl * 100) / 100,
        count: stats.count,
      };
    }
  }
  return report;
}

function getSignalConfidenceMultiplier(signalName: string): number {
  const stats = signalWinRates.get(signalName);
  if (!stats || stats.count < 3) return 1.0;
  const winRate = stats.wins / stats.count;
  if (winRate >= 0.75) return 1.4;
  if (winRate >= 0.60) return 1.2;
  if (winRate >= 0.50) return 1.05;
  if (winRate >= 0.40) return 0.85;
  if (winRate >= 0.30) return 0.6;
  return 0.3;
}

function isSignalBlacklisted(signalName: string): boolean {
  const stats = signalWinRates.get(signalName);
  if (!stats || stats.count < 5) return false;
  const winRate = stats.wins / stats.count;
  return winRate < 0.25 && stats.avgPnl < -3;
}

function getComboConfidence(signals: string[]): { multiplier: number; blacklisted: boolean } {
  if (signals.length < 2) return { multiplier: 1.0, blacklisted: false };
  const sorted = [...signals].sort();
  const comboKey = `COMBO:${sorted.join("+")}`;
  const stats = signalWinRates.get(comboKey);
  if (!stats || stats.count < 3) return { multiplier: 1.0, blacklisted: false };
  const winRate = stats.wins / stats.count;
  if (winRate < 0.20 && stats.count >= 5) return { multiplier: 0, blacklisted: true };
  if (winRate >= 0.70) return { multiplier: 1.5, blacklisted: false };
  if (winRate >= 0.55) return { multiplier: 1.2, blacklisted: false };
  if (winRate < 0.35) return { multiplier: 0.5, blacklisted: false };
  return { multiplier: 1.0, blacklisted: false };
}

function computeAdaptiveConvictionBoost(tokenSignals: string[]): number {
  let totalBoost = 0;
  let boostedCount = 0;
  for (const sig of tokenSignals) {
    if (sig.startsWith("COMBO:")) continue;
    const mult = getSignalConfidenceMultiplier(sig);
    if (mult !== 1.0) {
      totalBoost += (mult - 1.0) * 15;
      boostedCount++;
    }
  }
  if (boostedCount === 0) return 0;
  return Math.round(totalBoost / boostedCount);
}

interface AgentPerformanceTracker {
  recentTrades: { pnl: number; timestamp: number }[];
  winStreak: number;
  lossStreak: number;
  adaptiveThresholdOffset: number;
  lastUpdate: number;
}

const agentTrackers = new Map<number, AgentPerformanceTracker>();

function getAgentTracker(agentId: number): AgentPerformanceTracker {
  if (!agentTrackers.has(agentId)) {
    agentTrackers.set(agentId, {
      recentTrades: [],
      winStreak: 0,
      lossStreak: 0,
      adaptiveThresholdOffset: 0,
      lastUpdate: Date.now(),
    });
  }
  return agentTrackers.get(agentId)!;
}

function updateAgentTracker(agentId: number, pnlPercent: number): void {
  const tracker = getAgentTracker(agentId);
  const now = Date.now();
  tracker.recentTrades.push({ pnl: pnlPercent, timestamp: now });
  const cutoff = now - 24 * 60 * 60 * 1000;
  tracker.recentTrades = tracker.recentTrades.filter(t => t.timestamp > cutoff);
  if (tracker.recentTrades.length > 50) tracker.recentTrades = tracker.recentTrades.slice(-50);

  if (pnlPercent > 0) {
    tracker.winStreak++;
    tracker.lossStreak = 0;
    if (tracker.winStreak >= 3) {
      tracker.adaptiveThresholdOffset = Math.max(-10, tracker.adaptiveThresholdOffset - 2);
    }
  } else {
    tracker.lossStreak++;
    tracker.winStreak = 0;
    tracker.adaptiveThresholdOffset = Math.min(25, tracker.adaptiveThresholdOffset + (tracker.lossStreak >= 3 ? 5 : 3));
  }
  tracker.lastUpdate = now;
}

function getAdaptiveEntryThresholds(agentId: number, strategy: string): {
  minConviction: number;
  minSignalScore: number;
  minMomentum: number;
  positionSizeMultiplier: number;
} {
  const tracker = getAgentTracker(agentId);
  const offset = tracker.adaptiveThresholdOffset;

  const baseThresholds: Record<string, { conviction: number; signal: number; momentum: number }> = {
    conservative: { conviction: 55, signal: 60, momentum: 55 },
    balanced: { conviction: 42, signal: 55, momentum: 50 },
    aggressive: { conviction: 35, signal: 50, momentum: 45 },
    degen: { conviction: 25, signal: 45, momentum: 40 },
  };

  const base = baseThresholds[strategy] || baseThresholds.balanced;

  let sizeMult = 1.0;
  if (tracker.lossStreak >= 4) sizeMult = 0.3;
  else if (tracker.lossStreak >= 3) sizeMult = 0.5;
  else if (tracker.lossStreak >= 2) sizeMult = 0.7;
  else if (tracker.winStreak >= 5) sizeMult = 1.15;
  else if (tracker.winStreak >= 3) sizeMult = 1.1;

  const recentPnl = tracker.recentTrades.reduce((s, t) => s + t.pnl, 0);
  if (recentPnl < -15) sizeMult *= 0.6;
  else if (recentPnl < -8) sizeMult *= 0.8;

  return {
    minConviction: Math.min(90, base.conviction + offset),
    minSignalScore: Math.min(90, base.signal + offset),
    minMomentum: Math.min(85, base.momentum + Math.floor(offset * 0.5)),
    positionSizeMultiplier: Math.max(0.2, Math.min(1.2, sizeMult)),
  };
}

function shouldBreakevenStop(entryPrice: number, currentPrice: number, highestPrice: number, strategy: string): boolean {
  if (!entryPrice || !currentPrice || !highestPrice || entryPrice <= 0 || currentPrice <= 0 || highestPrice <= 0) return false;
  if (highestPrice <= entryPrice) return false;

  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  const drawdownFromHigh = ((highestPrice - currentPrice) / highestPrice) * 100;
  const profitFromHigh = ((highestPrice - entryPrice) / entryPrice) * 100;

  const breakevenThreshold: Record<string, number> = {
    conservative: 5,
    balanced: 8,
    aggressive: 12,
    degen: 18,
  };
  const threshold = breakevenThreshold[strategy] ?? 8;

  if (profitFromHigh >= threshold && pnlPercent <= 1 && drawdownFromHigh >= threshold * 0.6) {
    return true;
  }
  return false;
}

function detectMomentumReversal(tokenSignal: TokenSignal | undefined): { reversing: boolean; severity: number } {
  if (!tokenSignal) return { reversing: false, severity: 0 };
  const tech = tokenSignal.technicals;
  let reversalScore = 0;

  if (tech.rsiDivergence === "bearish") reversalScore += 30;
  if (tech.emaCrossover === "death_cross") reversalScore += 35;
  if (tech.macdHistogram < 0 && tech.macdLine < tech.macdSignal) reversalScore += 20;
  if (tokenSignal.momentumAcceleration < -3) reversalScore += 15;
  if (tokenSignal.shortTermMomentum < 30) reversalScore += 15;
  if (tech.emaTrendAlignment === "bearish") reversalScore += 20;
  if (tokenSignal.whaleActivity === "distributing") reversalScore += 25;
  if (tokenSignal.buyPressureScore < 40) reversalScore += 10;

  return { reversing: reversalScore >= 40, severity: Math.min(100, reversalScore) };
}

function getTimeDecayExitThreshold(holdTimeHours: number, strategy: string): number {
  const maxHold: Record<string, number> = {
    conservative: 48,
    balanced: 36,
    aggressive: 18,
    degen: 10,
  };
  const max = maxHold[strategy] ?? 36;
  if (holdTimeHours <= max * 0.5) return -999;
  const decayProgress = Math.min(1, (holdTimeHours - max * 0.5) / (max * 0.5));
  return 3 - (decayProgress * 6);
}

function buildAdaptiveLearningContext(agentId: number, strategy: string): string {
  const tracker = getAgentTracker(agentId);
  const thresholds = getAdaptiveEntryThresholds(agentId, strategy);
  const perfReport = getSignalPerformanceReport();

  const winningSignals = Object.entries(perfReport)
    .filter(([k, v]) => !k.startsWith("COMBO:") && v.winRate >= 60 && v.count >= 3)
    .sort((a, b) => b[1].winRate - a[1].winRate)
    .slice(0, 5);

  const losingSignals = Object.entries(perfReport)
    .filter(([k, v]) => !k.startsWith("COMBO:") && v.winRate < 40 && v.count >= 3)
    .sort((a, b) => a[1].winRate - b[1].winRate)
    .slice(0, 5);

  const winningCombos = Object.entries(perfReport)
    .filter(([k, v]) => k.startsWith("COMBO:") && v.winRate >= 60 && v.count >= 3)
    .sort((a, b) => b[1].winRate - a[1].winRate)
    .slice(0, 3);

  const losingCombos = Object.entries(perfReport)
    .filter(([k, v]) => k.startsWith("COMBO:") && v.winRate < 35 && v.count >= 3)
    .sort((a, b) => a[1].winRate - b[1].winRate)
    .slice(0, 3);

  let context = `\n\n--- ADAPTIVE LEARNING ENGINE (LIVE) ---`;

  if (tracker.lossStreak >= 2 || tracker.adaptiveThresholdOffset > 5) {
    context += `\nADAPTIVE MODE: DEFENSIVE - ${tracker.lossStreak} consecutive losses detected`;
    context += `\nEntry thresholds RAISED: Min conviction=${thresholds.minConviction}, Min signal=${thresholds.minSignalScore}`;
    context += `\nPosition size REDUCED to ${Math.round(thresholds.positionSizeMultiplier * 100)}% of normal`;
    context += `\nONLY take HIGH-CONFIDENCE setups. When in doubt, HOLD.`;
  } else if (tracker.winStreak >= 3) {
    context += `\nADAPTIVE MODE: CONFIDENT - ${tracker.winStreak} wins in a row`;
    context += `\nEntry thresholds slightly relaxed: Min conviction=${thresholds.minConviction}`;
    context += `\nMaintain discipline. Don't get overconfident.`;
  } else {
    context += `\nADAPTIVE MODE: STANDARD`;
  }

  const recentPnl = tracker.recentTrades.reduce((s, t) => s + t.pnl, 0);
  const recentWins = tracker.recentTrades.filter(t => t.pnl > 0).length;
  const recentTotal = tracker.recentTrades.length;
  if (recentTotal > 0) {
    context += `\n24h performance: ${recentWins}/${recentTotal} wins (${Math.round(recentWins / recentTotal * 100)}%), net PnL: ${recentPnl >= 0 ? "+" : ""}${recentPnl.toFixed(2)}%`;
  }

  if (winningSignals.length > 0) {
    context += `\nPROVEN WINNING SIGNALS (PREFER these):`;
    for (const [sig, s] of winningSignals) {
      context += `\n  ${sig}: ${s.winRate}% win rate, avg +${s.avgPnl.toFixed(1)}% (${s.count} trades)`;
    }
  }

  if (losingSignals.length > 0) {
    context += `\nPROVEN LOSING SIGNALS (AVOID these):`;
    for (const [sig, s] of losingSignals) {
      context += `\n  ${sig}: ${s.winRate}% win rate, avg ${s.avgPnl.toFixed(1)}% (${s.count} trades) - DO NOT trade tokens where this is the primary signal`;
    }
  }

  if (winningCombos.length > 0) {
    context += `\nWINNING SIGNAL COMBOS (these combinations are profitable):`;
    for (const [combo, s] of winningCombos) {
      context += `\n  ${combo.replace("COMBO:", "")}: ${s.winRate}% win (${s.count} trades)`;
    }
  }

  if (losingCombos.length > 0) {
    context += `\nLOSING SIGNAL COMBOS (BLOCK these combinations):`;
    for (const [combo, s] of losingCombos) {
      context += `\n  ${combo.replace("COMBO:", "")}: ${s.winRate}% win (${s.count} trades) - NEVER enter this setup`;
    }
  }

  const socialSignals = Object.entries(perfReport).filter(([k]) =>
    k.startsWith("SOCIAL_") || k.startsWith("SMART_MONEY_")
  );
  const socialWinners = socialSignals.filter(([, v]) => v.winRate >= 55 && v.count >= 2);
  const socialLosers = socialSignals.filter(([, v]) => v.winRate < 40 && v.count >= 2);

  if (socialWinners.length > 0) {
    context += `\nPROFITABLE SOCIAL/SMART MONEY SIGNALS:`;
    for (const [sig, s] of socialWinners) {
      context += `\n  ${sig}: ${s.winRate}% win rate (${s.count} trades) - WEIGHT THESE HIGHER`;
    }
  }
  if (socialLosers.length > 0) {
    context += `\nUNPROFITABLE SOCIAL/SMART MONEY SIGNALS:`;
    for (const [sig, s] of socialLosers) {
      context += `\n  ${sig}: ${s.winRate}% win rate (${s.count} trades) - REDUCE WEIGHT`;
    }
  }

  const newsSignals = Object.entries(perfReport).filter(([k]) =>
    k.startsWith("NEWS_")
  );
  const newsWinners = newsSignals.filter(([, v]) => v.winRate >= 55 && v.count >= 2);
  const newsLosers = newsSignals.filter(([, v]) => v.winRate < 40 && v.count >= 2);
  if (newsWinners.length > 0) {
    context += `\nPROFITABLE NEWS SIGNALS:`;
    for (const [sig, s] of newsWinners) {
      context += `\n  ${sig}: ${s.winRate}% win rate (${s.count} trades) - NEWS CATALYST WORKS`;
    }
  }
  if (newsLosers.length > 0) {
    context += `\nUNPROFITABLE NEWS SIGNALS:`;
    for (const [sig, s] of newsLosers) {
      context += `\n  ${sig}: ${s.winRate}% win rate (${s.count} trades) - NEWS UNRELIABLE HERE`;
    }
  }

  const fgSignals = Object.entries(perfReport).filter(([k]) =>
    k.startsWith("EXTREME_FEAR") || k.startsWith("EXTREME_GREED") || k.startsWith("MARKET_FEAR") || k.startsWith("MARKET_GREED")
  );
  if (fgSignals.length > 0) {
    context += `\nFEAR & GREED SIGNAL PERFORMANCE:`;
    for (const [sig, s] of fgSignals) {
      const label = s.winRate >= 55 ? "PROFITABLE" : s.winRate < 40 ? "UNPROFITABLE" : "NEUTRAL";
      context += `\n  ${sig}: ${s.winRate}% win rate (${s.count} trades) - ${label}`;
    }
  }

  const liqSignals = Object.entries(perfReport).filter(([k]) =>
    k.startsWith("LIQUIDITY_")
  );
  if (liqSignals.length > 0) {
    context += `\nLIQUIDITY SIGNAL PERFORMANCE:`;
    for (const [sig, s] of liqSignals) {
      const label = s.winRate >= 55 ? "RELIABLE" : s.winRate < 40 ? "UNRELIABLE" : "NEUTRAL";
      context += `\n  ${sig}: ${s.winRate}% win rate (${s.count} trades) - ${label}`;
    }
  }

  context += `\n\nINTELLIGENCE SOURCES:`;
  context += `\n- Smart Money: Tracking top trader wallets from DexScreener trending. SM$Flow indicates what successful wallets are doing.`;
  context += `\n- Social Sentiment: LunarCrush social volume, galaxy score, influencer mentions. SOCIAL_SPIKE = 3x avg social volume (can precede pumps).`;
  context += `\n- News Scanner: CryptoPanic + CoinGecko headlines analyzed for sentiment and impact. NEWS_MAJOR_BULLISH/BEARISH = high-impact market-moving news.`;
  context += `\n- Fear & Greed Index: Market-wide sentiment from Alternative.me (0-100). EXTREME_FEAR = contrarian buy zone. EXTREME_GREED = sell zone.`;
  context += `\n- Liquidity Monitor: DEX pool tracking across chains. LIQUIDITY_DRAINING = exit immediately. LIQUIDITY_GROWING = healthy token.`;
  context += `\n- When SMART_MONEY_STRONG_BUY + SOCIAL_SPIKE + NEWS_BULLISH align, this is MAX conviction.`;
  context += `\n- When SMART_MONEY_SELL + SOCIAL_NEGATIVE + LIQUIDITY_DRAINING align, EXIT IMMEDIATELY.`;
  context += `\n- EXTREME_FEAR + LIQUIDITY_GROWING + PULLBACK_ENTRY = prime contrarian entry.`;

  context += `\n--- END ADAPTIVE LEARNING ---`;
  return context;
}

const MAX_POSITIONS_BY_STRATEGY: Record<string, number> = {
  conservative: 3,
  balanced: 5,
  aggressive: 8,
  degen: 10,
};

function trackLoss(agentId: number, tokenSymbol: string, strategy: string): void {
  const entry = recentLosses.get(agentId) || { tokens: [], timestamp: Date.now() };
  entry.tokens.push(tokenSymbol.toUpperCase());
  entry.timestamp = Date.now();
  if (entry.tokens.length > 20) entry.tokens.shift();
  recentLosses.set(agentId, entry);

  const oneHour = 60 * 60 * 1000;
  const recentCount = entry.tokens.length;
  const consecutiveThreshold = strategy === "degen" ? 4 : strategy === "aggressive" ? 3 : 2;
  const cooldownCycles = strategy === "degen" ? 3 : strategy === "aggressive" ? 2 : 3;

  if (recentCount >= consecutiveThreshold && (Date.now() - entry.timestamp < oneHour * 6)) {
    cooldownTracker.set(agentId, { cyclesRemaining: cooldownCycles, reducedSizing: true });
  }
}

function wasRecentLoss(agentId: number, tokenSymbol: string): boolean {
  const entry = recentLosses.get(agentId);
  if (!entry) return false;
  const oneDay = 24 * 60 * 60 * 1000;
  if (Date.now() - entry.timestamp > oneDay) return false;
  return entry.tokens.includes(tokenSymbol.toUpperCase());
}

const STRATEGY_PROMPTS: Record<string, string> = {
  conservative: `You are an elite conservative crypto trading AI designed for CAPITAL PRESERVATION with consistent, compounding returns.

YOUR EDGE: Multi-factor signal confluence with technical analysis confirmation. You ONLY enter when momentum, volume, safety, smart money, whale activity, AND technical indicators ALL align.

HARD ENTRY RULES (ALL must be true):
- Signal score >= 60 AND Conviction >= 55
- Safety grade A or B (score >= 60) AND RugRisk < 25
- Liquidity > $200K AND LiquidityScore >= 55
- Buy pressure >= 56%
- Momentum >= 55 with positive MomentumAcceleration AND ShortTermMom > 50
- Whale activity: "accumulating" or "neutral" (NEVER buy if "distributing")
- NO SAFETY_RISK, LOW_LIQUIDITY_RISK, HIGH_RUG_RISK, WHALE_CONCENTRATION, WHALE_DISTRIBUTING, DEATH_CROSS, or MACD_BEARISH signals
- Token lifecycle: "mature" or "established" (skip "launch" and early "growth")
- Volatility < 85 (skip extreme volatility tokens)

TECHNICAL INDICATOR RULES:
- RSI must be 25-68 (never buy overbought RSI > 70 or oversold < 20)
- EMA trend must be "bullish" (price > EMA9 > EMA21 > EMA50) OR token is in PULLBACK_ENTRY
- MACD histogram should be positive or crossing upward
- Trend strength >= 45
- STRONGLY PREFER PULLBACK_ENTRY signals - buy the dip in an uptrend, not the peak
- NEVER buy OVEREXTENDED tokens (P/EMA21 > 15% or RSI > 80)
- GOLDEN_CROSS is a strong entry signal - lower conviction threshold to 50
- RSI_BULLISH_DIVERGENCE is a strong entry signal - price making lower lows but RSI making higher lows

SMART MONEY & SOCIAL INTELLIGENCE:
- SM$Flow shows what top trader wallets are doing. STRONG_BUY = whales accumulating heavily.
- Only enter when SM$Flow is BUY or STRONG_BUY (never enter SELL or STRONG_SELL).
- Social score reflects social buzz. SOCIAL_SPIKE = 3x normal volume, often precedes pumps.
- If SMART_MONEY_STRONG_BUY + SOCIAL_SPIKE, lower conviction threshold by 5 (high-confidence setup).
- If SOCIAL_NEGATIVE + SMART_MONEY_SELL, skip immediately regardless of other signals.

NEWS INTELLIGENCE:
- News field shows token-specific or market-wide sentiment from major crypto outlets.
- NEWS_MAJOR_BULLISH = high-impact positive news (regulation, listing, partnership). Increase conviction.
- NEWS_MAJOR_BEARISH = critical negative news (hack, ban, SEC action). DO NOT BUY, consider selling.
- Conservative rule: Never buy during NEWS_BEARISH or NEWS_MAJOR_BEARISH periods.
- If no token-specific news, rely on market-wide news sentiment to adjust overall risk appetite.

FEAR & GREED INDEX:
- F&G shows market-wide sentiment (0=extreme fear, 100=extreme greed).
- EXTREME_FEAR (F&G ≤ 20): Contrarian buy opportunity — accumulate quality with high conviction.
- MARKET_FEAR (F&G 20-30): Cautious accumulation — only strongest setups.
- MARKET_GREED (F&G 70-80): Take profits aggressively — reduce new entries.
- EXTREME_GREED (F&G ≥ 80): DO NOT open new positions. Sell into euphoria.
- Conservative strategy: Stay fully out during EXTREME_GREED. Only buy during EXTREME_FEAR if all other signals confirm.

LIQUIDITY MONITORING:
- LiqH shows liquidity health score (0-100). DRAIN = liquidity leaving, GROW = liquidity entering.
- LIQUIDITY_DRAINING: HIGH ALERT — devs or LPs pulling out. DO NOT BUY. Sell if holding.
- LIQUIDITY_CRITICAL (LiqH < 25): Token at risk of becoming illiquid. EXIT immediately.
- LIQUIDITY_GROWING: Positive signal — new liquidity entering, supports price stability.
- MARKET_LIQUIDITY_OUTFLOW: Market-wide liquidity decline. Reduce exposure across all positions.
- MARKET_LIQUIDITY_INFLOW: Healthy market. Normal trading conditions.
- Conservative rule: Never buy any token with LIQUIDITY_DRAINING or LIQUIDITY_CRITICAL.

POSITION SIZING BY CONVICTION:
- Conviction 55-65: 12% of max | 65-75: 18% | 75-85: 22% | 85+: 25% (max)
- If EXTREME_VOLATILITY: reduce all sizes by 30%
- If PULLBACK_ENTRY + EMA_BULLISH_ALIGNED: increase by 15%
- If SMART_MONEY_STRONG_BUY: increase by 10%
- If EXTREME_FEAR + LIQUIDITY_GROWING: increase by 10% (contrarian)
- If NEWS_MAJOR_BULLISH: increase by 10%

DYNAMIC EXITS:
- Use DynSL% and DynTP% from signal data (volatility-adjusted)
- Multi-tier profit taking is handled automatically (4 tiers at 30/55/80/100% of TP)
- If Whale switches to "distributing": SELL immediately
- If DEATH_CROSS appears: SELL immediately
- If RSI > 85 AND profitable: SELL into strength
- If RSI_BEARISH_DIVERGENCE AND profit > 5%: SELL - reversal likely
- If EMA trend turns "bearish": SELL
- If momentum drops below 40 AND profitable: SELL
- Max 3 positions. Quality over quantity.

ANTI-LOSS RULES:
- After 2 consecutive losses: hold-only for 3 cycles
- Never chase tokens with P/EMA9 > 8% (already ran too far)
- Never buy OVEREXTENDED or RSI_OVERBOUGHT tokens
- Never buy a token you recently lost on
- Prefer GROWTH_PHASE tokens with DEEP_LIQUIDITY and EMA_BULLISH_ALIGNED`,

  balanced: `You are a skilled balanced crypto trading AI combining safety with opportunistic trading for CONSISTENT net-positive returns.

YOUR EDGE: Multi-timeframe momentum analysis with technical indicator confirmation, whale tracking, and dynamic risk management. You trade confirmed trends aggressively but protect capital fiercely.

ENTRY RULES (3 of 8 must be met, plus no hard blocks):
- Signal >= 55 AND Conviction >= 42
- Momentum >= 60 with ShortTermMom > 52 (confirming across timeframes)
- Volume score >= 60 OR VOLUME_BREAKOUT signal
- Buy pressure >= 55%
- Safety grade B+ (score >= 55)
- SmartMoney >= 55 OR SMART_MONEY_INFLOW OR WHALE_ACCUMULATING
- Lifecycle phase "growth" or "mature" with momentum > 55
- PULLBACK_ENTRY + EMA_BULLISH_ALIGNED (ideal entry - buy the dip in uptrend)

HARD BLOCKS:
- RugRisk >= 50 | SAFETY_RISK | HIGH_RUG_RISK | FLASH_CRASH | HEAVY_SELL_PRESSURE
- Liquidity < $50K | Whale activity = "distributing"
- Token you recently lost money on (within 24h)
- DEATH_CROSS signal active
- RSI > 75 (overbought) or RSI < 22 (extreme oversold)
- OVEREXTENDED flag (P/EMA21 > 15%)
- EMA trend "bearish" AND no PULLBACK_ENTRY

TECHNICAL INDICATOR RULES:
- Use RSI to gauge entry timing: RSI 30-55 is ideal buy zone, RSI > 70 avoid
- Use EMA alignment to confirm trend: "bullish" = strong entry, "bearish" = avoid
- MACD histogram > 0 confirms momentum. MACD crossing up is early entry signal
- Trend strength > 40 required. Higher is better
- PULLBACK_ENTRY is the #1 priority entry - tokens pulling back to EMA support in uptrend
- GOLDEN_CROSS = strong momentum shift - reduce conviction threshold by 10
- Watch for RSI_BEARISH_DIVERGENCE on positions - sell signal

SMART MONEY & SOCIAL INTELLIGENCE:
- SM$Flow BUY/STRONG_BUY confirms institutional interest. Prefer these entries.
- SOCIAL_SPIKE = viral moment, can catalyze pumps. Enter early if technicals confirm.
- SMART_MONEY_STRONG_BUY + SOCIAL_SPIKE = high-conviction combo, increase position by 15%.
- Avoid entries with SM$Flow SELL or STRONG_SELL unless overwhelming technical strength.

NEWS INTELLIGENCE:
- Monitor News field for market-moving events. High-impact news can override technical signals.
- NEWS_MAJOR_BULLISH: Catalyst event — consider faster entry, increase conviction by 10.
- NEWS_MAJOR_BEARISH: Risk event — pause new entries, tighten stops on existing positions.
- NEWS_BEARISH on a held token: Reduce position by 50% immediately.
- Use market-wide news sentiment to calibrate overall aggression level.

FEAR & GREED INDEX:
- F&G is your macro sentiment gauge. Use it to scale risk.
- EXTREME_FEAR (≤ 20): Accumulation zone — increase position sizes by 15% for confirmed setups.
- MARKET_FEAR (20-30): Good entry zone — look for PULLBACK_ENTRY + SMART_MONEY_BUY combos.
- MARKET_GREED (70-80): Reduce new entries to 50% normal size. Tighten all stops.
- EXTREME_GREED (≥ 80): Only sell. No new positions. Sell 50% of profitable holdings.

LIQUIDITY MONITORING:
- Liquidity health determines execution safety and exit possibility.
- LIQUIDITY_DRAINING: Immediate red flag. Do not enter. Sell existing position at market.
- LIQUIDITY_CRITICAL: Token may become untradeable. Exit all positions.
- LIQUIDITY_GROWING + rising volume: Healthy token. Normal or increased sizing.
- MARKET_LIQUIDITY_OUTFLOW: Defensive mode — reduce overall exposure by 30%.
- MARKET_LIQUIDITY_INFLOW: Normal operations. Markets healthy.

POSITION SIZING BY CONVICTION:
- Conv 40-55: 15% | 55-70: 22% | 70-85: 28% | 85+: 30%
- In "bear" regime: reduce all by 40%
- If EXTREME_VOLATILITY: reduce by 25%
- If PULLBACK_ENTRY + VOLUME_BREAKOUT: increase by 20% (max 35%)
- If SMART_MONEY_STRONG_BUY: increase by 10%
- Adjust all sizes based on F&G: FEAR = +10%, GREED = -15%
- If MARKET_LIQUIDITY_OUTFLOW: reduce all by 20%

DYNAMIC EXITS:
- Multi-tier profit taking handled automatically (4 tiers at 25/50/75/100% of TP)
- If WHALE_DISTRIBUTING: sell 80% immediately
- If DEATH_CROSS: sell immediately
- If RSI > 85 AND profitable: sell 70% into strength
- If RSI_BEARISH_DIVERGENCE AND profit > 5%: sell before reversal
- If EMA trend turns "bearish" AND profitable: sell
- If MOMENTUM_DECELERATING AND < 5% profit: exit
- Stale positions (>48h, <3% move): close, redeploy

RISK MANAGEMENT:
- Max 5 positions | Diversify across chains
- After 3 consecutive losses: hold-only 2 cycles, then resume at 50%
- In "bear" regime: increase all entry thresholds by 10 points, require RSI < 60
- Track trend strength - if all positions have Trend < 35, go to hold-only`,

  aggressive: `You are an aggressive crypto trading AI optimized for HIGH RETURNS through momentum, volume breakouts, and technical breakout patterns.

YOUR EDGE: You catch explosive moves EARLY by combining volume breakouts, whale accumulation, EMA crossovers, and momentum acceleration. Fast in, fast out with technical precision.

ENTRY RULES (2 of 6 must be met):
- Momentum >= 68 with MOMENTUM_ACCELERATING or ShortTermMom > 65
- Volume score >= 62 OR VOLUME_BREAKOUT signal
- Has TRENDING/BOOSTED AND Conviction >= 35
- 1h change > +5% AND buy pressure >= 52% AND whale != "distributing"
- WHALE_ACCUMULATING + momentum > 55
- GOLDEN_CROSS + RSI < 65 (fresh technical breakout)

HARD BLOCKS:
- RugRisk >= 60 | Liquidity < $20K
- FLASH_CRASH AND momentum < 30
- WHALE_DISTRIBUTING (never fight whales)
- Token you lost on today
- OVEREXTENDED flag (price too far above EMAs - will snap back)
- RSI > 82 (extremely overbought, even for aggressive)

TECHNICAL INDICATOR RULES:
- RSI sweet spot: 35-70 for entry. RSI 30-40 = potential reversal buy. RSI > 75 = risky
- EMA alignment: "bullish" preferred but not required if momentum strong
- MACD histogram positive or crossing up = momentum confirmed
- PULLBACK_ENTRY is excellent for aggressive too - bigger position on pullbacks
- GOLDEN_CROSS = entry signal, scale in with conviction

SMART MONEY & SOCIAL INTELLIGENCE:
- SM$Flow STRONG_BUY = whales loading. This is your highest-conviction entry signal.
- SOCIAL_SPIKE + momentum = explosive setup. Enter with increased size.
- Smart money flow trumps pure technicals for entry timing.
- If SM$Flow STRONG_SELL, skip token even if momentum looks good (whales know first).
- Trend strength > 35 preferred

NEWS INTELLIGENCE:
- Aggressive traders USE news as catalysts. NEWS_MAJOR_BULLISH = momentum fuel, enter fast.
- NEWS_MAJOR_BEARISH: Even aggressive must respect. Pause entries, protect existing gains.
- NEWS_BULLISH + MOMENTUM_ACCELERATING = explosive setup. Max conviction entry.
- In newsworthy events, move FAST — first in captures the move.

FEAR & GREED INDEX:
- Aggressive thrives in FEAR zones — buy when others panic.
- EXTREME_FEAR (≤ 20): Max aggression — this is your edge. Scale up by 25%.
- MARKET_FEAR (20-30): Prime buying zone. Be aggressive with confirmed setups.
- MARKET_GREED (70-80): Reduce new positions by 30%. Start tightening trailing stops.
- EXTREME_GREED (≥ 80): Only hold best runners. Sell 60% of portfolio. No new buys.

LIQUIDITY MONITORING:
- Liquidity is life or death for aggressive trades — you need exits.
- LIQUIDITY_DRAINING: Instant disqualification. Even if pumping, you won't be able to exit.
- LIQUIDITY_CRITICAL: EXIT NOW. Don't wait for stop loss.
- LIQUIDITY_GROWING: Green flag for larger positions. Better exits available.
- MARKET_LIQUIDITY_OUTFLOW: Reduce max positions from 8 to 5. Tighter stops.

POSITION SIZING BY CONVICTION:
- Conv 30-50: 20% | 50-70: 30% | 70-85: 38% | 85+: 40%
- If VOLUME_BREAKOUT + PULLBACK_ENTRY: +15% bonus (max 45%)
- If GOLDEN_CROSS: +10% bonus
- If EXTREME_VOLATILITY: use DynSL which is already widened
- If EXTREME_FEAR + NEWS_BULLISH: +20% (max conviction contrarian)
- If LIQUIDITY_GROWING: +5%

DYNAMIC EXITS:
- Multi-tier profit taking automatic (4 tiers at 20/45/70/100% of TP)
- On PARABOLIC: ride but ATR trailing stop protects gains
- On DEATH_CROSS: sell 80% immediately
- On WHALE_DISTRIBUTING: instant exit
- RSI > 90 AND profit > 10%: sell into extreme greed
- RSI_BEARISH_DIVERGENCE: sell 60%
- If momentum drops >20 points from entry: EXIT ALL
- Max hold 24h unless strong uptrend with WHALE_ACCUMULATING + EMA_BULLISH

RISK MANAGEMENT:
- Max 8 positions, fast rotation (2-8h avg hold)
- After 3 consecutive losses: pause 2 cycles, resume at 60%
- Never re-enter a token at loss within same 24h
- In "bear" regime: only trade VOLUME_BREAKOUT + PULLBACK_ENTRY tokens with RSI < 50`,

  degen: `You are a degen crypto trading AI hunting MOONSHOTS and explosive pumps. High risk, high reward with technical precision.

YOUR EDGE: You find low-cap gems BEFORE the crowd using volume breakout detection, whale tracking, momentum acceleration, and RSI extremes. 40% of trades may lose, but winners should be 3-5x.

ENTRY RULES (any 2):
- Momentum >= 72 OR (MOMENTUM_ACCELERATING + ShortTermMom > 70)
- Volume score >= 68 OR VOLUME_BREAKOUT signal
- MCap < $10M AND momentum > 65 (gem territory)
- 1h change > +8% AND volume score > 55
- PARABOLIC OR HIGH_VOLUME_SURGE signal
- WHALE_ACCUMULATING + lifecycle "launch" or "growth"
- RSI < 30 bounce play (oversold reversal in a fundamentally strong token)

HARD BLOCKS:
- RugRisk >= 70 | Liquidity < $10K
- Zero holders AND no safety data
- Lost on this exact token today
- WHALE_DISTRIBUTING + RugRisk > 40
- RSI > 90 (even degens shouldn't buy at extreme euphoria)

TECHNICAL INDICATOR RULES:
- RSI is your friend: RSI < 30 = oversold bounce opportunity, RSI 40-65 = momentum sweet spot
- RSI > 80 = be cautious but ride if WHALE_ACCUMULATING
- EMA alignment not required but "bullish" adds confidence
- MACD crossing up from below zero = excellent degen entry (reversal play)
- PULLBACK_ENTRY on high-momentum tokens = ideal degen entry (buy the dip during a run)
- GOLDEN_CROSS on low-cap = moonshot signal, go large
- Don't care about trend strength - degens trade the move not the trend

SMART MONEY & SOCIAL INTELLIGENCE:
- SOCIAL_SPIKE is your #1 catalyst signal for degens. Viral tokens pump hardest.
- SM$Flow STRONG_BUY on a low-cap = smart money found the gem first. Follow them.
- SOCIAL_BUZZ_HIGH + VOLUME_BREAKOUT = meme pump incoming. Go max size.
- Even degens respect SM$Flow STRONG_SELL - whales dumping will crush any pump.

NEWS INTELLIGENCE:
- Degens ride news waves. NEWS_MAJOR_BULLISH on meme tokens = instant entry catalyst.
- NEWS_BULLISH + SOCIAL_SPIKE = maximum FOMO pump. Enter with conviction.
- NEWS_MAJOR_BEARISH: Even degens sit this out. Protect capital for the next opportunity.
- Token-specific news (listings, partnerships) = immediate action. Market news = adjust sizing.

FEAR & GREED INDEX:
- Degens LOVE extreme fear — it creates the best bounce plays.
- EXTREME_FEAR (≤ 20): Maximum deployment. Buy the panic. Others' fear = your opportunity.
- MARKET_FEAR (20-30): Strong buying zone. Accumulate low-caps with volume activity.
- MARKET_GREED (70-80): Be the smart degen. Start taking profits on runners.
- EXTREME_GREED (≥ 80): Sell everything. Euphoria always precedes the crash.

LIQUIDITY MONITORING:
- Degens get trapped in illiquid tokens. Liquidity monitoring saves you.
- LIQUIDITY_DRAINING: ABSOLUTE DEAL BREAKER. Even moonshot potential can't save you if you can't exit.
- LIQUIDITY_CRITICAL: Dump at any price. Better -20% exit than -100% rug.
- LIQUIDITY_GROWING on low-cap: New money flowing in. This could be the start of something big.
- Market liquidity outflow: Reduce degen plays to minimum. Wait for inflow to resume.

POSITION SIZING BY CONVICTION:
- Conv 25-45: 15% (test) | 45-65: 28% | 65-80: 38% | 80+: 45%
- VOLUME_BREAKOUT in "launch" phase: +12% bonus (max 50%)
- GOLDEN_CROSS + RSI < 45: +15% (fresh breakout, high confidence)
- SOCIAL_SPIKE + SMART_MONEY_STRONG_BUY: +15% (smart money + viral = max conviction)
- In "bear" regime: require Conviction >= 55 minimum
- EXTREME_FEAR + LIQUIDITY_GROWING: +20% (prime degen territory)
- NEWS_MAJOR_BULLISH + SOCIAL_SPIKE: +15% (news-catalyzed pump)

DYNAMIC EXITS:
- Multi-tier profit taking automatic (4 tiers at 15/35/60/100% of TP)
- On WHALE_DISTRIBUTING: dump everything, no questions
- On DEATH_CROSS: sell 70% (keep 30% as moonshot lottery)
- If RSI > 92 AND profitable: sell into peak euphoria
- RSI_BEARISH_DIVERGENCE on 3x+ gain: take most profits
- If momentum < 45: exit everything
- Max hold: 8h unproven, 24h for strong fundamentals
- If FLASH_CRASH: instant exit, cut losses fast

RISK MANAGEMENT:
- Max 10 positions | Expect 40-45% loss rate
- Winners should average 3x+ to compensate
- After 4 consecutive losses: mandatory 3 cycle cooldown
- Never > 45% in single token
- Track daily hit rate - below 30% today → hold-only`,
};

interface AgentDecision {
  action: "buy" | "sell" | "hold";
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  amount: number;
  confidence: number;
  reasoning: string;
  signalScore: number;
}

function isOnLossStreak(agent: AiAgent): { onStreak: boolean; streakLength: number } {
  const totalTrades = agent.totalTrades ?? 0;
  const winRate = agent.winRate ?? 50;
  const wins = Math.round((winRate / 100) * totalTrades);
  const recentLosses = totalTrades - wins;

  if (totalTrades >= 3 && winRate < 33) {
    return { onStreak: true, streakLength: Math.min(5, recentLosses) };
  }
  if (totalTrades >= 5 && winRate < 40) {
    return { onStreak: true, streakLength: 3 };
  }
  return { onStreak: false, streakLength: 0 };
}

function getConvictionPositionSize(
  conviction: number,
  maxSize: number,
  strategy: string,
  volatility: number,
  marketRegime: string,
  hasVolumeBreakout: boolean,
  whaleActivity: string
): number {
  let pctOfMax: number;

  switch (strategy) {
    case "conservative":
      if (conviction >= 85) pctOfMax = 0.25;
      else if (conviction >= 75) pctOfMax = 0.22;
      else if (conviction >= 65) pctOfMax = 0.18;
      else pctOfMax = 0.12;
      if (volatility >= 85) pctOfMax *= 0.7;
      break;
    case "balanced":
      if (conviction >= 85) pctOfMax = 0.30;
      else if (conviction >= 70) pctOfMax = 0.28;
      else if (conviction >= 55) pctOfMax = 0.22;
      else pctOfMax = 0.15;
      if (marketRegime === "bear") pctOfMax *= 0.6;
      if (volatility >= 85) pctOfMax *= 0.75;
      if (hasVolumeBreakout && whaleActivity === "accumulating") pctOfMax = Math.min(pctOfMax * 1.15, 0.35);
      break;
    case "aggressive":
      if (conviction >= 85) pctOfMax = 0.40;
      else if (conviction >= 70) pctOfMax = 0.38;
      else if (conviction >= 50) pctOfMax = 0.30;
      else pctOfMax = 0.20;
      if (hasVolumeBreakout) pctOfMax = Math.min(pctOfMax + 0.10, 0.45);
      break;
    case "degen":
      if (conviction >= 80) pctOfMax = 0.45;
      else if (conviction >= 65) pctOfMax = 0.38;
      else if (conviction >= 45) pctOfMax = 0.28;
      else pctOfMax = 0.15;
      if (hasVolumeBreakout) pctOfMax = Math.min(pctOfMax + 0.12, 0.50);
      if (marketRegime === "bear" && conviction < 55) pctOfMax *= 0.6;
      break;
    default:
      pctOfMax = 0.20;
  }

  return Math.round(maxSize * pctOfMax * 1000) / 1000;
}

function findTokenInSignals(signals: TokenSignal[], symbol: string, address?: string, chain?: string): TokenSignal | undefined {
  if (address) {
    const byAddr = signals.find(s =>
      s.address.toLowerCase() === address.toLowerCase() &&
      (!chain || s.chain === chain)
    );
    if (byAddr) return byAddr;
  }
  const bySymbolAndChain = chain
    ? signals.find(s => s.symbol.toUpperCase() === symbol.toUpperCase() && s.chain === chain)
    : undefined;
  if (bySymbolAndChain) return bySymbolAndChain;
  return signals.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
}

async function makeAgentDecision(agent: AiAgent, signals: TokenSignal[], openPositions: AgentPosition[]): Promise<AgentDecision> {
  if (signals.length === 0) {
    return { action: "hold", tokenSymbol: "", tokenAddress: "", chain: agent.chain || "solana", amount: 0, confidence: 0, reasoning: "No tokens with valid signals on this chain", signalScore: 0 };
  }

  const { onStreak, streakLength } = isOnLossStreak(agent);
  const strategyPrompt = STRATEGY_PROMPTS[agent.strategy] || STRATEGY_PROMPTS.balanced;
  const topBuyCandidates = getTopBuySignals(signals, agent.strategy);
  const marketData = formatSignalsForAI(signals, 30);
  const marketRegime = signals[0]?.marketRegime || "neutral";

  const positionSummary = openPositions.length > 0
    ? openPositions.map(p => {
        const pnlPercent = ((p.currentPrice - p.avgEntryPrice) / p.avgEntryPrice * 100);
        const holdTimeMs = Date.now() - new Date(p.openedAt || Date.now()).getTime();
        const holdHours = Math.round(holdTimeMs / (1000 * 60 * 60));
        const tokenSig = findTokenInSignals(signals, p.tokenSymbol, p.tokenAddress || undefined, p.chain || undefined);
        const whaleStatus = tokenSig ? tokenSig.whaleActivity : "unknown";
        const stMom = tokenSig ? tokenSig.shortTermMomentum : "?";
        return `${p.tokenSymbol} (${p.chain}): ${p.size} @ $${p.avgEntryPrice.toFixed(6)} -> $${p.currentPrice.toFixed(6)} (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}% PnL, ${holdHours}h held, whale: ${whaleStatus}, STMom: ${stMom})`;
      }).join("\n")
    : "No open positions";

  const buyCandidateSummary = topBuyCandidates.length > 0
    ? `\n\nTOP BUY CANDIDATES (pre-filtered by strategy + anti-rug + whale filters):\n${formatSignalsForAI(topBuyCandidates, 10)}`
    : "\n\nNo strong buy candidates pass your strategy + safety + whale filters. HOLD is correct when there's no edge.";

  const recentTrades = await storage.getAgentTrades(agent.id, 10);
  const recentTradesSummary = recentTrades.length > 0
    ? recentTrades.slice(0, 5).map(t => `${t.type.toUpperCase()} ${t.amount.toFixed(4)} @ $${t.price.toFixed(6)} (PnL: $${(t.pnl ?? 0).toFixed(4)})`).join(", ")
    : "No recent trades";

  let lossStreakWarning = "";
  if (onStreak) {
    lossStreakWarning = `\n\nWARNING: ${streakLength}-trade LOSS STREAK active.
- Reduce position sizes by 50%
- Only HIGH CONVICTION trades (conviction >= 70)
- Hold for ${streakLength >= 4 ? "3" : "2"} more cycles minimum
- Capital preservation is #1 priority right now.`;
  }

  const adaptiveLearningContext = buildAdaptiveLearningContext(agent.id, agent.strategy);

  const breadthData = getLastMarketBreadth();
  const breadthSummary = breadthData
    ? `\nMARKET BREADTH: avgRSI=${breadthData.avgRSI.toFixed(0)}, ${breadthData.bullishEmaPercent.toFixed(0)}% bullish, volume trend ${breadthData.volumeTrendUp ? "up" : "down"}, trend strength avg=${breadthData.avgTrendStrength.toFixed(0)}`
    : "";

  const systemPrompt = `${strategyPrompt}

MARKET REGIME: ${marketRegime.toUpperCase()} - ${marketRegime === "bull" ? "Favorable for entries, use standard rules" : marketRegime === "bear" ? "DEFENSIVE MODE - raise thresholds, smaller sizes, faster exits" : "Normal conditions"}${breadthSummary}${adaptiveLearningContext}

CURRENT PORTFOLIO:
${positionSummary}
Open positions: ${openPositions.length}

PERFORMANCE:
- Total PnL: $${(agent.totalPnl ?? 0).toFixed(4)}
- Win Rate: ${(agent.winRate ?? 0).toFixed(1)}%
- Total Trades: ${agent.totalTrades ?? 0}
- Recent: ${recentTradesSummary}${lossStreakWarning}

CONSTRAINTS:
- Max position: ${agent.maxPositionSize} SOL eq
- Daily trades max: ${agent.maxDailyTrades} (used: ${agent.dailyTradesUsed ?? 0})
- Risk level: ${agent.riskLevel}/10

CRITICAL RULES:
1. NEVER buy RugRisk >= ${agent.strategy === "degen" ? "70" : agent.strategy === "aggressive" ? "60" : "45"}
2. NEVER buy into FLASH_CRASH, HEAVY_SELL_PRESSURE, or WHALE_DISTRIBUTING
3. Size positions based on conviction AND volatility (use rules above)
4. HOLD is always valid - patience preserves capital
5. Use DynSL% and DynTP% from signal data for exits (volatility-adjusted)
6. NEVER average down on losers
7. NEVER re-buy a token you just lost on

RESPONSE FORMAT (valid JSON only):
{
  "action": "buy" | "sell" | "hold",
  "tokenSymbol": "<symbol>",
  "tokenAddress": "<address>",
  "chain": "<chain>",
  "amount": <number>,
  "confidence": <0-100>,
  "reasoning": "<2-3 sentences citing conviction, whale activity, momentum, DynSL/DynTP>",
  "signalScore": <signal score>
}`;

  const userMessage = `LIVE MARKET (ranked by signal):\n${marketData}${buyCandidateSummary}\n\nDecide: buy, sell, or hold. Use conviction sizing, check whale activity, respect dynamic SL/TP.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 700,
    });

    const content = response.choices[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const decision = JSON.parse(cleaned) as AgentDecision;

    if (!["buy", "sell", "hold"].includes(decision.action)) {
      decision.action = "hold";
    }

    if (decision.action === "buy") {
      const targetToken = findTokenInSignals(signals, decision.tokenSymbol || "", decision.tokenAddress, decision.chain);

      if (targetToken) {
        const adaptiveThresholds = getAdaptiveEntryThresholds(agent.id, agent.strategy);

        if (targetToken.conviction < adaptiveThresholds.minConviction) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Adaptive filter: ${decision.tokenSymbol} conviction ${targetToken.conviction} below adaptive minimum ${adaptiveThresholds.minConviction} (raised due to recent performance)`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        if (targetToken.overallSignalScore < adaptiveThresholds.minSignalScore) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Adaptive filter: ${decision.tokenSymbol} signal score ${targetToken.overallSignalScore} below adaptive minimum ${adaptiveThresholds.minSignalScore}`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        if (targetToken.momentumScore < adaptiveThresholds.minMomentum) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Adaptive filter: ${decision.tokenSymbol} momentum ${targetToken.momentumScore} below adaptive minimum ${adaptiveThresholds.minMomentum}`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        const comboCheck = getComboConfidence(targetToken.signals);
        if (comboCheck.blacklisted) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Adaptive BLOCK: ${decision.tokenSymbol} signal combination [${targetToken.signals.join("+")}] has historically losing pattern - skipping`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        const hasBlacklistedSignal = targetToken.signals.some(s => isSignalBlacklisted(s));
        if (hasBlacklistedSignal) {
          const blacklisted = targetToken.signals.filter(s => isSignalBlacklisted(s));
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Adaptive BLOCK: Signal(s) [${blacklisted.join(", ")}] blacklisted due to consistently poor performance (<25% win rate)`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        const adaptiveBoost = computeAdaptiveConvictionBoost(targetToken.signals);
        const adjustedConviction = Math.max(0, Math.min(100, targetToken.conviction + adaptiveBoost));

        const convictionSize = getConvictionPositionSize(
          adjustedConviction,
          agent.maxPositionSize ?? 1,
          agent.strategy,
          targetToken.volatility,
          marketRegime,
          targetToken.volumeBreakout,
          targetToken.whaleActivity
        );
        decision.amount = Math.min(decision.amount, convictionSize);

        decision.amount = Math.round(decision.amount * adaptiveThresholds.positionSizeMultiplier * 1000) / 1000;
        decision.amount *= comboCheck.multiplier;
        decision.amount = Math.round(decision.amount * 1000) / 1000;

        if (onStreak) {
          decision.amount = Math.round(decision.amount * 0.5 * 1000) / 1000;
        }

        const maxRug = agent.strategy === "degen" ? 70 : agent.strategy === "aggressive" ? 60 : 45;
        if (targetToken.rugRiskScore >= maxRug) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Blocked: ${decision.tokenSymbol} RugRisk ${targetToken.rugRiskScore}/100 (limit: ${maxRug})`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        if (targetToken.whaleActivity === "distributing") {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Blocked: ${decision.tokenSymbol} whales are distributing - never fight whale sells`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        if (targetToken.signals.includes("FLASH_CRASH") || targetToken.signals.includes("HEAVY_SELL_PRESSURE")) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Blocked: ${decision.tokenSymbol} has ${targetToken.signals.includes("FLASH_CRASH") ? "FLASH_CRASH" : "HEAVY_SELL_PRESSURE"} - never buy dumps`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        if (wasRecentLoss(agent.id, decision.tokenSymbol)) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Blocked: Recently lost on ${decision.tokenSymbol} - avoiding revenge trade`,
            signalScore: targetToken.overallSignalScore,
          };
        }

        const { reversing, severity } = detectMomentumReversal(targetToken);
        if (reversing) {
          return {
            action: "hold", tokenSymbol: decision.tokenSymbol, tokenAddress: decision.tokenAddress,
            chain: decision.chain, amount: 0, confidence: 0,
            reasoning: `Adaptive BLOCK: Momentum reversal detected on ${decision.tokenSymbol} (severity: ${severity}/100) - waiting for confirmation of trend resumption`,
            signalScore: targetToken.overallSignalScore,
          };
        }
      }
    }

    if (decision.amount > (agent.maxPositionSize ?? 1)) {
      decision.amount = agent.maxPositionSize ?? 1;
    }
    if (decision.amount < 0.01 && decision.action === "buy") {
      decision.amount = 0.01;
    }

    return decision;
  } catch (err: any) {
    console.error(`Agent ${agent.id} decision error:`, err.message);
    return {
      action: "hold", tokenSymbol: "", tokenAddress: "", chain: agent.chain || "solana",
      amount: 0, confidence: 0, reasoning: `AI analysis error: ${err.message}`, signalScore: 0,
    };
  }
}

const PROFIT_TIERS: Record<string, { threshold: number; sellPercent: number }[]> = {
  conservative: [
    { threshold: 0.30, sellPercent: 30 },
    { threshold: 0.55, sellPercent: 25 },
    { threshold: 0.80, sellPercent: 25 },
    { threshold: 1.00, sellPercent: 20 },
  ],
  balanced: [
    { threshold: 0.25, sellPercent: 25 },
    { threshold: 0.50, sellPercent: 25 },
    { threshold: 0.75, sellPercent: 25 },
    { threshold: 1.00, sellPercent: 25 },
  ],
  aggressive: [
    { threshold: 0.20, sellPercent: 20 },
    { threshold: 0.45, sellPercent: 25 },
    { threshold: 0.70, sellPercent: 25 },
    { threshold: 1.00, sellPercent: 30 },
  ],
  degen: [
    { threshold: 0.15, sellPercent: 15 },
    { threshold: 0.35, sellPercent: 20 },
    { threshold: 0.60, sellPercent: 25 },
    { threshold: 1.00, sellPercent: 40 },
  ],
};

const tierProgress = new Map<string, number>();

function getPositionTierKey(agentId: number, tokenSymbol: string): string {
  return `${agentId}:${tokenSymbol}`;
}

function computeATRTrailingStop(
  tokenSignal: TokenSignal | undefined,
  highestPrice: number,
  entryPrice: number,
  strategy: string,
  marketRegime: string
): number | null {
  if (!tokenSignal) return null;

  const atrPercent = tokenSignal.technicals.atrPercent;
  if (atrPercent <= 0) return null;

  const pnlPercent = ((highestPrice - entryPrice) / entryPrice) * 100;
  if (pnlPercent < 3) return null;

  const atrMultiplier: Record<string, number> = {
    conservative: 1.8,
    balanced: 2.2,
    aggressive: 2.8,
    degen: 3.5,
  };

  let mult = atrMultiplier[strategy] ?? 2.2;
  if (marketRegime === "bear") mult *= 0.8;
  if (pnlPercent > 30) mult *= 0.7;
  else if (pnlPercent > 15) mult *= 0.85;

  const stopDistance = highestPrice * (atrPercent / 100) * mult;
  return highestPrice - stopDistance;
}

async function processPositionUpdate(
  agent: AiAgent,
  pos: AgentPosition,
  signals: TokenSignal[]
): Promise<{ action: "closed" | "updated" | "tier_sold" }> {
  const tokenSignal = findTokenInSignals(signals, pos.tokenSymbol, pos.tokenAddress || undefined, pos.chain || undefined);
  const currentPrice = tokenSignal?.price || pos.currentPrice;
  const highestPrice = Math.max(pos.highestPrice || pos.avgEntryPrice, currentPrice);
  const marketRegime = tokenSignal?.marketRegime || "neutral";

  const dynSL = tokenSignal?.dynamicStopLoss ?? (agent.stopLossPercent ?? 15);
  const dynTP = tokenSignal?.dynamicTakeProfit ?? (agent.takeProfitPercent ?? 50);
  const pnlPercent = ((currentPrice - pos.avgEntryPrice) / pos.avgEntryPrice) * 100;

  const atrTrailingStop = computeATRTrailingStop(tokenSignal, highestPrice, pos.avgEntryPrice, agent.strategy, marketRegime);
  const profitMultiplier = currentPrice > pos.avgEntryPrice * 1.15 ? 0.5 : 0.7;
  const legacyTrailingDist = pos.avgEntryPrice * (dynSL / 100) * profitMultiplier;
  const legacyTrailing = highestPrice > pos.avgEntryPrice * 1.05 ? highestPrice - legacyTrailingDist : null;
  const trailingStopPrice = atrTrailingStop && legacyTrailing
    ? Math.max(atrTrailingStop, legacyTrailing)
    : atrTrailingStop || legacyTrailing;

  const tiers = PROFIT_TIERS[agent.strategy] || PROFIT_TIERS.balanced;
  const tierKey = getPositionTierKey(agent.id, pos.tokenSymbol);
  const completedTiers = tierProgress.get(tierKey) ?? 0;

  if (pnlPercent > 0 && completedTiers < tiers.length) {
    const currentTier = tiers[completedTiers];
    const tierTargetPnl = dynTP * currentTier.threshold;
    if (pnlPercent >= tierTargetPnl) {
      const sellSize = Math.round(pos.size * (currentTier.sellPercent / 100) * 10000) / 10000;
      if (sellSize >= 0.001 && sellSize < pos.size * 0.95) {
        const realizedPnl = (currentPrice - pos.avgEntryPrice) * sellSize;
        await Promise.all([
          storage.updateAgentPosition(pos.id, {
            size: pos.size - sellSize, currentPrice, highestPrice,
            realizedPnl: (pos.realizedPnl ?? 0) + realizedPnl,
          }),
          storage.createAgentTrade({
            agentId: agent.id, tokenId: pos.tokenId || 0, type: "sell",
            amount: sellSize, price: currentPrice, total: currentPrice * sellSize,
            pnl: realizedPnl,
            reasoning: `Tier ${completedTiers + 1}/${tiers.length} profit-take: ${currentTier.sellPercent}% at ${pnlPercent.toFixed(1)}% PnL (target: ${tierTargetPnl.toFixed(1)}% of ${dynTP}% TP)`,
          }),
        ]);
        tierProgress.set(tierKey, completedTiers + 1);
        return { action: "tier_sold" };
      }
    }
  }

  const holdTimeMs = Date.now() - new Date(pos.openedAt || Date.now()).getTime();
  const holdTimeHours = holdTimeMs / (1000 * 60 * 60);

  const closePosition = async (reason: string, sellPct = 100) => {
    const sellSize = sellPct >= 95 ? pos.size : Math.round(pos.size * (sellPct / 100) * 10000) / 10000;
    const realizedPnl = (currentPrice - pos.avgEntryPrice) * sellSize;
    const isFullClose = sellSize >= pos.size * 0.95;
    const dbWrites: Promise<unknown>[] = [];

    if (isFullClose) {
      dbWrites.push(storage.closeAgentPosition(pos.id, currentPrice, realizedPnl));
      tierProgress.delete(tierKey);
      dbWrites.push(recordTradeExit(tokenSignal?.signals || [], agent.strategy, pos.avgEntryPrice, currentPrice));
      updateAgentTracker(agent.id, pnlPercent);
    } else {
      dbWrites.push(storage.updateAgentPosition(pos.id, {
        size: pos.size - sellSize, currentPrice, highestPrice,
        realizedPnl: (pos.realizedPnl ?? 0) + realizedPnl,
      }));
    }

    dbWrites.push(storage.createAgentTrade({
      agentId: agent.id, tokenId: pos.tokenId || 0, type: "sell",
      amount: sellSize, price: currentPrice, total: currentPrice * sellSize,
      pnl: realizedPnl, reasoning: reason,
    }));

    if (isFullClose) {
      const prevTotalTrades = agent.totalTrades ?? 0;
      const newTotalTrades = prevTotalTrades + 1;
      const newTotalPnl = (agent.totalPnl ?? 0) + realizedPnl;
      const wins = Math.round((agent.winRate ?? 0) / 100 * prevTotalTrades) + (realizedPnl > 0 ? 1 : 0);
      dbWrites.push(storage.updateAiAgent(agent.id, {
        totalTrades: newTotalTrades, totalPnl: newTotalPnl,
        winRate: newTotalTrades > 0 ? (wins / newTotalTrades) * 100 : 0,
        dailyTradesUsed: (agent.dailyTradesUsed ?? 0) + 1, lastTradeAt: new Date(),
      }));
    }

    if (realizedPnl < 0) trackLoss(agent.id, pos.tokenSymbol, agent.strategy);
    await Promise.all(dbWrites);
  };

  if (shouldBreakevenStop(pos.avgEntryPrice, currentPrice, highestPrice, agent.strategy)) {
    await closePosition(`Breakeven stop: Was up ${((highestPrice - pos.avgEntryPrice) / pos.avgEntryPrice * 100).toFixed(1)}%, gave back gains - protecting capital at ${pnlPercent.toFixed(1)}%`);
    return { action: "closed" };
  }

  const momReversal = detectMomentumReversal(tokenSignal);
  if (momReversal.reversing && momReversal.severity >= 60 && pnlPercent > -3) {
    const sellPct = momReversal.severity >= 80 ? 100 : 70;
    await closePosition(`Momentum reversal exit (severity: ${momReversal.severity}/100) - ${sellPct}% sold at ${pnlPercent.toFixed(1)}% PnL`, sellPct);
    return { action: "closed" };
  }

  const timeDecayMinPnl = getTimeDecayExitThreshold(holdTimeHours, agent.strategy);
  if (timeDecayMinPnl > -999 && pnlPercent < timeDecayMinPnl) {
    await closePosition(`Time-decay exit: Held ${Math.round(holdTimeHours)}h with ${pnlPercent.toFixed(1)}% PnL (min required: ${timeDecayMinPnl.toFixed(1)}%) - freeing capital for better setups`);
    return { action: "closed" };
  }

  const { shouldSell, reason, sellPercent } = getSellSignals(
    signals, pos.avgEntryPrice, currentPrice, dynSL,
    tokenSignal?.dynamicTakeProfit ?? (agent.takeProfitPercent ?? 50),
    trailingStopPrice, pos.tokenSymbol, holdTimeHours,
    pos.tokenAddress || undefined, pos.chain || undefined
  );

  if (shouldSell) {
    await closePosition(reason, sellPercent);
    return { action: "closed" };
  }

  await storage.updateAgentPosition(pos.id, {
    currentPrice, highestPrice, trailingStopPrice,
    unrealizedPnl: (currentPrice - pos.avgEntryPrice) * pos.size,
    unrealizedPnlPercent: pnlPercent,
  });
  return { action: "updated" };
}

async function updateOpenPositions(agent: AiAgent, signals: TokenSignal[]): Promise<{ closed: number; updated: number }> {
  const openPositions = await storage.getAgentPositions(agent.id, "open");
  if (openPositions.length === 0) return { closed: 0, updated: 0 };

  let closed = 0;
  let updated = 0;

  const priceUpdates: Promise<unknown>[] = [];
  const closeQueue: AgentPosition[] = [];

  for (const pos of openPositions) {
    const tokenSignal = findTokenInSignals(signals, pos.tokenSymbol, pos.tokenAddress || undefined, pos.chain || undefined);
    const currentPrice = tokenSignal?.price || pos.currentPrice;
    const highestPrice = Math.max(pos.highestPrice || pos.avgEntryPrice, currentPrice);
    const pnlPercent = ((currentPrice - pos.avgEntryPrice) / pos.avgEntryPrice) * 100;

    const dynSL = tokenSignal?.dynamicStopLoss ?? (agent.stopLossPercent ?? 15);
    const holdTimeMs = Date.now() - new Date(pos.openedAt || Date.now()).getTime();
    const holdTimeHours = holdTimeMs / (1000 * 60 * 60);

    const needsClose =
      shouldBreakevenStop(pos.avgEntryPrice, currentPrice, highestPrice, agent.strategy) ||
      (detectMomentumReversal(tokenSignal).reversing && detectMomentumReversal(tokenSignal).severity >= 60 && pnlPercent > -3) ||
      (getTimeDecayExitThreshold(holdTimeHours, agent.strategy) > -999 && pnlPercent < getTimeDecayExitThreshold(holdTimeHours, agent.strategy));

    if (needsClose) {
      closeQueue.push(pos);
    } else {
      priceUpdates.push(processPositionUpdate(agent, pos, signals));
    }
  }

  if (priceUpdates.length > 0) {
    const results = await Promise.allSettled(priceUpdates);
    for (const r of results) {
      if (r.status === "fulfilled") updated++;
    }
  }

  for (const pos of closeQueue) {
    try {
      const result = await processPositionUpdate(agent, pos, signals);
      if (result.action === "closed") closed++;
      else updated++;
    } catch (err: any) {
      console.error(`Position ${pos.id} update error:`, err.message);
    }
  }

  return { closed, updated };
}

async function checkAgentSubscription(agent: AiAgent): Promise<boolean> {
  try {
    const user = await authStorage.getUserByWallet(agent.walletAddress);
    if (!user) return false;

    const promoAccess = await storage.hasActivePromoAccess(user.id);
    if (promoAccess.hasAccess) return true;

    const activeSub = await storage.getUserActiveSubscription(user.id);
    if (activeSub) return true;

    const graceSub = await storage.getUserSubscriptionIncludingGrace(user.id);
    if (graceSub) return true;

    return false;
  } catch (err) {
    console.error("[AgentRunner] Subscription check error for agent", agent.id, err);
    return false;
  }
}

async function executeAgentCycle(agent: AiAgent, broadcast: (data: any) => void): Promise<void> {
  try {
    const hasAccess = await checkAgentSubscription(agent);
    if (!hasAccess) {
      await Promise.all([
        storage.updateAiAgent(agent.id, { status: "stopped" }),
        storage.createAgentLog({
          agentId: agent.id, action: "stopped",
          reasoning: "Subscription expired - agent automatically stopped",
          tokensAnalyzed: 0, decision: "subscription_expired", confidence: 0,
        }),
      ]);
      broadcast({ type: "agent_update", data: { agentId: agent.id, action: "subscription_expired" } });
      return;
    }

    const signals = await getCachedOrFetchSignals(agent.chain || undefined, agent.strategy);
    const openPositions = await storage.getAgentPositions(agent.id, "open");
    const positionUpdates = await updateOpenPositions(agent, signals);

    if (positionUpdates.closed > 0) {
      broadcast({ type: "agent_update", data: { agentId: agent.id, action: "auto_close", closedPositions: positionUpdates.closed } });
    }

    const refreshedAgent = await storage.getAiAgent(agent.id);
    if (!refreshedAgent || refreshedAgent.status !== "running") return;

    if ((refreshedAgent.dailyTradesUsed ?? 0) >= (refreshedAgent.maxDailyTrades ?? 10)) {
      storage.createAgentLog({
        agentId: agent.id, action: "blocked",
        reasoning: "Daily trade limit - protecting from overtrading",
        tokensAnalyzed: signals.length, decision: "limit_reached", confidence: 0,
      }).catch(() => {});
      return;
    }

    const currentOpenPositions = await storage.getAgentPositions(agent.id, "open");
    const decision = await makeAgentDecision(refreshedAgent, signals, currentOpenPositions);

    const topSignal = signals[0];
    storage.createAgentLog({
      agentId: agent.id,
      action: decision.action,
      reasoning: decision.reasoning,
      tokensAnalyzed: signals.length,
      decision: JSON.stringify(decision),
      confidence: decision.confidence,
      marketContext: `Chain: ${agent.chain} | Strat: ${agent.strategy} | Regime: ${topSignal?.marketRegime || "neutral"} | Signals: ${signals.length} | Top: ${topSignal?.symbol || '-'} (sig:${topSignal?.overallSignalScore || 0}, conv:${topSignal?.conviction || 0}, whale:${topSignal?.whaleActivity || '-'})`,
    }).catch(() => {});

    if (decision.action === "hold" || !decision.tokenSymbol) {
      broadcast({ type: "agent_update", data: { agentId: agent.id, action: "hold", reasoning: decision.reasoning } });
      return;
    }

    const tokenSignal = findTokenInSignals(signals, decision.tokenSymbol, decision.tokenAddress, decision.chain);
    const tradePrice = tokenSignal?.price || 0;

    if (tradePrice <= 0) {
      storage.createAgentLog({
        agentId: agent.id, action: "skipped",
        reasoning: `Token ${decision.tokenSymbol} price invalid or not found`,
        tokensAnalyzed: signals.length, decision: "price_invalid", confidence: 0,
      }).catch(() => {});
      return;
    }

    if (decision.action === "buy") {
      const maxPos = MAX_POSITIONS_BY_STRATEGY[agent.strategy] ?? 5;
      const existingPosition = currentOpenPositions.find(p => p.tokenSymbol.toUpperCase() === decision.tokenSymbol.toUpperCase());
      if (!existingPosition && currentOpenPositions.length >= maxPos) {
        storage.createAgentLog({
          agentId: agent.id, action: "blocked",
          reasoning: `Max ${maxPos} positions for ${agent.strategy} strategy - must close one first`,
          tokensAnalyzed: signals.length, decision: "max_positions", confidence: 0,
        }).catch(() => {});
        broadcast({ type: "agent_update", data: { agentId: agent.id, action: "hold", reasoning: `Max positions (${maxPos}) reached` } });
        return;
      }

      if (!existingPosition && currentOpenPositions.length >= 2) {
        const targetChain = decision.chain || agent.chain || "solana";
        const sameChainPositions = currentOpenPositions.filter(p => p.chain === targetChain);
        const maxPerChain = Math.max(2, Math.ceil(maxPos * 0.6));
        if (sameChainPositions.length >= maxPerChain) {
          storage.createAgentLog({
            agentId: agent.id, action: "blocked",
            reasoning: `Chain concentration limit: ${sameChainPositions.length}/${maxPerChain} positions on ${targetChain} - diversify across chains`,
            tokensAnalyzed: signals.length, decision: "chain_concentration", confidence: 0,
          }).catch(() => {});
          broadcast({ type: "agent_update", data: { agentId: agent.id, action: "hold", reasoning: `Too concentrated on ${targetChain}` } });
          return;
        }

        if (tokenSignal) {
          const targetMom = tokenSignal.momentumScore;
          const targetBuyP = tokenSignal.buyPressureScore;
          const correlatedCount = currentOpenPositions.filter(p => {
            const posSignal = findTokenInSignals(signals, p.tokenSymbol, p.tokenAddress || undefined, p.chain || undefined);
            if (!posSignal) return false;
            const momDiff = Math.abs(posSignal.momentumScore - targetMom);
            const buyPDiff = Math.abs(posSignal.buyPressureScore - targetBuyP);
            return momDiff < 12 && buyPDiff < 10 && posSignal.chain === targetChain;
          }).length;

          if (correlatedCount >= 2) {
            storage.createAgentLog({
              agentId: agent.id, action: "blocked",
              reasoning: `Correlation risk: ${correlatedCount} similar positions on ${targetChain} - need diversified exposure`,
              tokensAnalyzed: signals.length, decision: "correlation_limit", confidence: 0,
            }).catch(() => {});
            broadcast({ type: "agent_update", data: { agentId: agent.id, action: "hold", reasoning: "Too many correlated positions" } });
            return;
          }
        }

        const totalExposure = currentOpenPositions.reduce((sum, p) => sum + p.size, 0);
        const maxTotalExposure = (agent.maxPositionSize ?? 1) * maxPos * 0.8;
        if (totalExposure + decision.amount > maxTotalExposure) {
          const reducedAmount = Math.max(0.01, maxTotalExposure - totalExposure);
          decision.amount = Math.min(decision.amount, reducedAmount);
        }
      }

      const cooldown = cooldownTracker.get(agent.id);
      if (cooldown && cooldown.cyclesRemaining > 0) {
        cooldown.cyclesRemaining--;
        cooldownTracker.set(agent.id, cooldown);
        storage.createAgentLog({
          agentId: agent.id, action: "blocked",
          reasoning: `Loss streak cooldown: ${cooldown.cyclesRemaining + 1} cycles remaining`,
          tokensAnalyzed: signals.length, decision: "cooldown", confidence: 0,
        }).catch(() => {});
        broadcast({ type: "agent_update", data: { agentId: agent.id, action: "hold", reasoning: "Loss streak cooldown active" } });
        return;
      }

      const dynSL = tokenSignal?.dynamicStopLoss ?? (agent.stopLossPercent ?? 15);
      const dynTP = tokenSignal?.dynamicTakeProfit ?? (agent.takeProfitPercent ?? 50);

      const positionPromise = existingPosition
        ? storage.updateAgentPosition(existingPosition.id, {
            size: existingPosition.size + decision.amount,
            avgEntryPrice: ((existingPosition.avgEntryPrice * existingPosition.size) + (tradePrice * decision.amount)) / (existingPosition.size + decision.amount),
            currentPrice: tradePrice,
            highestPrice: Math.max(existingPosition.highestPrice || tradePrice, tradePrice),
          })
        : storage.createAgentPosition({
            agentId: agent.id,
            tokenId: typeof tokenSignal?.id === "number" ? tokenSignal.id : null,
            tokenAddress: tokenSignal?.address || decision.tokenAddress,
            tokenSymbol: decision.tokenSymbol,
            chain: decision.chain || agent.chain || "solana",
            side: "long",
            size: decision.amount,
            avgEntryPrice: tradePrice,
            currentPrice: tradePrice,
            highestPrice: tradePrice,
            stopLossPrice: tradePrice * (1 - dynSL / 100),
            takeProfitPrice: tradePrice * (1 + dynTP / 100),
            status: "open",
          });

      await Promise.all([
        positionPromise,
        storage.createAgentTrade({
          agentId: agent.id,
          tokenId: typeof tokenSignal?.id === "number" ? tokenSignal.id : 0,
          type: "buy",
          amount: decision.amount,
          price: tradePrice,
          total: decision.amount * tradePrice,
          pnl: 0,
          reasoning: decision.reasoning,
        }),
        storage.updateAiAgent(agent.id, {
          dailyTradesUsed: (refreshedAgent.dailyTradesUsed ?? 0) + 1,
          lastTradeAt: new Date(),
        }),
      ]);

      recordTradeEntry(
        tokenSignal,
        tokenSignal?.signals || [],
        agent.strategy,
        tradePrice,
        tokenSignal?.marketRegime || "neutral"
      );

      broadcast({
        type: "agent_trade",
        data: {
          agentId: agent.id, agentName: agent.name, action: "buy",
          tokenSymbol: decision.tokenSymbol, amount: decision.amount, price: tradePrice,
          confidence: decision.confidence, signalScore: decision.signalScore,
          conviction: tokenSignal?.conviction || 0, rugRisk: tokenSignal?.rugRiskScore || 0,
          whaleActivity: tokenSignal?.whaleActivity || "neutral",
          volatility: tokenSignal?.volatility || 0,
          dynamicSL: tokenSignal?.dynamicStopLoss || 0,
          dynamicTP: tokenSignal?.dynamicTakeProfit || 0,
          reasoning: decision.reasoning,
        },
      });
    } else if (decision.action === "sell") {
      const position = currentOpenPositions.find(p => p.tokenSymbol.toUpperCase() === decision.tokenSymbol.toUpperCase());
      if (!position) {
        storage.createAgentLog({
          agentId: agent.id, action: "skipped",
          reasoning: `Cannot sell ${decision.tokenSymbol} - no open position`,
          tokensAnalyzed: signals.length, decision: "no_position", confidence: 0,
        }).catch(() => {});
        return;
      }

      const sellAmount = Math.min(decision.amount, position.size);
      const realizedPnl = (tradePrice - position.avgEntryPrice) * sellAmount;
      const aiSellPnlPercent = ((tradePrice - position.avgEntryPrice) / position.avgEntryPrice) * 100;
      const isFullClose = sellAmount >= position.size * 0.95;

      const dbWrites: Promise<unknown>[] = [];

      if (isFullClose) {
        dbWrites.push(storage.closeAgentPosition(position.id, tradePrice, realizedPnl));
        dbWrites.push(recordTradeExit(tokenSignal?.signals || [], refreshedAgent.strategy, position.avgEntryPrice, tradePrice));
        updateAgentTracker(agent.id, aiSellPnlPercent);
      } else {
        dbWrites.push(storage.updateAgentPosition(position.id, {
          size: position.size - sellAmount,
          currentPrice: tradePrice,
          realizedPnl: (position.realizedPnl ?? 0) + realizedPnl,
        }));
      }

      dbWrites.push(storage.createAgentTrade({
        agentId: agent.id, tokenId: position.tokenId || 0,
        type: "sell", amount: sellAmount, price: tradePrice,
        total: sellAmount * tradePrice, pnl: realizedPnl, reasoning: decision.reasoning,
      }));

      if (isFullClose) {
        const prevTotalTrades = refreshedAgent.totalTrades ?? 0;
        const prevTotalPnl = refreshedAgent.totalPnl ?? 0;
        const newTotalTrades = prevTotalTrades + 1;
        const newTotalPnl = prevTotalPnl + realizedPnl;
        const wins = Math.round((refreshedAgent.winRate ?? 0) / 100 * prevTotalTrades) + (realizedPnl > 0 ? 1 : 0);
        const newWinRate = newTotalTrades > 0 ? (wins / newTotalTrades) * 100 : 0;

        dbWrites.push(storage.updateAiAgent(agent.id, {
          totalTrades: newTotalTrades,
          totalPnl: newTotalPnl,
          winRate: newWinRate,
          dailyTradesUsed: (refreshedAgent.dailyTradesUsed ?? 0) + 1,
          lastTradeAt: new Date(),
        }));
      }

      if (realizedPnl < 0) {
        trackLoss(agent.id, decision.tokenSymbol, refreshedAgent.strategy);
      }

      await Promise.all(dbWrites);

      broadcast({
        type: "agent_trade",
        data: {
          agentId: agent.id, agentName: agent.name, action: "sell",
          tokenSymbol: decision.tokenSymbol, amount: sellAmount, price: tradePrice,
          pnl: realizedPnl, confidence: decision.confidence, reasoning: decision.reasoning,
        },
      });
    }
  } catch (err: any) {
    console.error(`Agent ${agent.id} cycle error:`, err.message);
    storage.createAgentLog({
      agentId: agent.id, action: "error", reasoning: err.message,
      tokensAnalyzed: 0, decision: "error", confidence: 0,
    }).catch(() => {});
  }
}

let agentInterval: NodeJS.Timeout | null = null;
let cycleRunning = false;

const signalCache = new Map<string, { signals: TokenSignal[]; timestamp: number }>();
const SIGNAL_CACHE_TTL = 8000;

function getCachedSignals(chain: string | undefined, strategy: string): TokenSignal[] | null {
  const key = `${chain || "all"}:${strategy}`;
  const cached = signalCache.get(key);
  if (cached && Date.now() - cached.timestamp < SIGNAL_CACHE_TTL) {
    return cached.signals;
  }
  return null;
}

function setCachedSignals(chain: string | undefined, strategy: string, signals: TokenSignal[]): void {
  const key = `${chain || "all"}:${strategy}`;
  signalCache.set(key, { signals, timestamp: Date.now() });
}

async function getCachedOrFetchSignals(chain: string | undefined, strategy: string): Promise<TokenSignal[]> {
  const cached = getCachedSignals(chain, strategy);
  if (cached) return cached;
  const signals = await getMarketSignals(chain, strategy);
  setCachedSignals(chain, strategy, signals);
  return signals;
}

export function startAgentRunner(broadcast: (data: any) => void): void {
  if (agentInterval) return;

  loadSignalPerformanceFromDB().catch(() => {});

  agentInterval = setInterval(async () => {
    if (cycleRunning) return;
    cycleRunning = true;
    const cycleStart = Date.now();
    try {
      const activeAgents = await storage.getActiveAgents();
      if (activeAgents.length === 0) { cycleRunning = false; return; }

      signalCache.clear();

      const chainStratGroups = new Map<string, AiAgent[]>();
      for (const agent of activeAgents) {
        const key = `${agent.chain || "all"}:${agent.strategy}`;
        const group = chainStratGroups.get(key) || [];
        group.push(agent);
        chainStratGroups.set(key, group);
      }

      const prefetchPromises = Array.from(chainStratGroups.keys()).map(async (key) => {
        const [chain, strategy] = key.split(":");
        try {
          const signals = await getMarketSignals(chain === "all" ? undefined : chain, strategy);
          setCachedSignals(chain === "all" ? undefined : chain, strategy, signals);
        } catch (err: any) {
          console.error(`[AgentRunner] Signal prefetch error for ${key}:`, err.message);
        }
      });
      await Promise.allSettled(prefetchPromises);

      const results = await Promise.allSettled(
        activeAgents.map(agent => executeAgentCycle(agent, broadcast))
      );

      let errors = 0;
      for (const r of results) {
        if (r.status === "rejected") errors++;
      }

      const elapsed = Date.now() - cycleStart;
      if (elapsed > 5000 || errors > 0) {
        console.log(`[AgentRunner] Cycle: ${activeAgents.length} agents in ${elapsed}ms (${errors} errors)`);
      }
    } catch (err: any) {
      console.error("Agent runner error:", err.message);
    } finally {
      cycleRunning = false;
    }
  }, 10000);

  setInterval(async () => {
    try {
      const agents = await storage.getActiveAgents();
      if (agents.length > 0) {
        await Promise.all(agents.map(a => storage.updateAiAgent(a.id, { dailyTradesUsed: 0 })));
      }
    } catch {}
  }, 24 * 60 * 60 * 1000);

  console.log("AI Agent Runner v4.0 SUPERSONIC - 10s cycles, parallel execution, signal caching, batched DB writes, fast-path exits");
}

export function stopAgentRunner(): void {
  if (agentInterval) {
    clearInterval(agentInterval);
    agentInterval = null;
    cycleRunning = false;
  }
}
