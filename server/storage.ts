import {
  type Token, type InsertToken,
  type WatchlistItem, type InsertWatchlist,
  type Trade, type InsertTrade,
  type PriceHistoryEntry, type InsertPriceHistory,
  type SmartWallet, type InsertSmartWallet,
  type WalletHolding, type InsertWalletHolding,
  type WalletTrade, type InsertWalletTrade,
  type CopyTradeConfig, type InsertCopyTradeConfig,
  type SniperRule, type InsertSniperRule,
  type Position, type InsertPosition,
  type SafetyReport, type InsertSafetyReport,
  type AiAgent, type InsertAiAgent,
  type AgentTrade, type InsertAgentTrade,
  type AgentLog, type InsertAgentLog,
  type AgentPosition, type InsertAgentPosition,
  type PriceAlert, type InsertPriceAlert,
  type LimitOrder, type InsertLimitOrder,
  type DcaConfig, type InsertDcaConfig,
  type Referral, type InsertReferral,
  type GeneratedWallet, type InsertGeneratedWallet,
  type Subscription, type InsertSubscription,
  type SubscriptionPayment, type InsertSubscriptionPayment,
  type PromoCode, type InsertPromoCode,
  type PromoRedemption, type InsertPromoRedemption,
  type SignalPerformance, type InsertSignalPerformance,
  type TokenSocialMetrics, type InsertTokenSocialMetrics,
  type SmartMoneySignal, type InsertSmartMoneySignal,
  type CryptoNews, type InsertCryptoNews,
  type FearGreedIndexRecord, type InsertFearGreedIndex,
  type LiquidityEventRecord, type InsertLiquidityEvent,
  tokens, watchlist, trades, priceHistory,
  smartWallets, walletHoldings, walletTrades,
  copyTradeConfigs, sniperRules, positions, safetyReports,
  aiAgents, agentTrades, agentLogs, agentPositions,
  priceAlerts, limitOrders, dcaConfigs, referrals,
  generatedWallets, subscriptions, subscriptionPayments,
  promoCodes, promoRedemptions, signalPerformance,
  tokenSocialMetrics, smartMoneySignals,
  cryptoNews, fearGreedIndex, liquidityEvents,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, gte, lte, ilike } from "drizzle-orm";

export interface IStorage {
  getTokens(): Promise<Token[]>;
  getToken(id: number): Promise<Token | undefined>;
  getTokenByAddress(address: string): Promise<Token | undefined>;
  createToken(token: InsertToken): Promise<Token>;
  updateTokenPrice(id: number, price: number, change1h: number, change24h: number): Promise<void>;
  updateToken(id: number, updates: Partial<{ price: number; priceChange1h: number | null; priceChange24h: number | null; volume24h: number | null; liquidity: number | null; marketCap: number | null; image: string | null }>): Promise<void>;
  getWatchlist(): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlist): Promise<WatchlistItem>;
  removeFromWatchlist(tokenId: number): Promise<void>;
  getTrades(limit?: number): Promise<Trade[]>;
  getTradesByToken(tokenId: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getPriceHistory(tokenId: number, hoursBack?: number): Promise<PriceHistoryEntry[]>;
  addPriceHistory(entry: InsertPriceHistory): Promise<PriceHistoryEntry>;
  addPriceHistoryWithTimestamp(entry: InsertPriceHistory, timestamp: Date): Promise<PriceHistoryEntry>;
  getTokenCount(): Promise<number>;
  getSmartWallets(): Promise<SmartWallet[]>;
  getSmartWallet(id: number): Promise<SmartWallet | undefined>;
  createSmartWallet(wallet: InsertSmartWallet): Promise<SmartWallet>;
  updateSmartWallet(id: number, updates: Partial<InsertSmartWallet>): Promise<SmartWallet | undefined>;
  getWalletHoldings(walletId: number): Promise<WalletHolding[]>;
  createWalletHolding(holding: InsertWalletHolding): Promise<WalletHolding>;
  getWalletTrades(walletId: number, limit?: number): Promise<WalletTrade[]>;
  createWalletTrade(trade: InsertWalletTrade): Promise<WalletTrade>;
  getCopyTradeConfigs(): Promise<CopyTradeConfig[]>;
  createCopyTradeConfig(config: InsertCopyTradeConfig): Promise<CopyTradeConfig>;
  updateCopyTradeConfig(id: number, updates: Partial<InsertCopyTradeConfig>): Promise<CopyTradeConfig>;
  deleteCopyTradeConfig(id: number): Promise<void>;
  getSniperRules(): Promise<SniperRule[]>;
  createSniperRule(rule: InsertSniperRule): Promise<SniperRule>;
  updateSniperRule(id: number, updates: Partial<InsertSniperRule>): Promise<SniperRule>;
  deleteSniperRule(id: number): Promise<void>;
  getPositions(): Promise<Position[]>;
  createPosition(position: InsertPosition): Promise<Position>;
  upsertPositionFromTrade(tokenId: number, tradeType: string, tradeAmount: number, tradePrice: number, chain: string): Promise<Position>;
  getSafetyReport(tokenId: number): Promise<SafetyReport | undefined>;
  getSafetyReports(): Promise<SafetyReport[]>;
  createSafetyReport(report: InsertSafetyReport): Promise<SafetyReport>;
  getAiAgents(): Promise<AiAgent[]>;
  getAiAgent(id: number): Promise<AiAgent | undefined>;
  getActiveAgents(): Promise<AiAgent[]>;
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: number, updates: Partial<AiAgent>): Promise<AiAgent>;
  deleteAiAgent(id: number): Promise<void>;
  getAgentTrades(agentId: number, limit?: number): Promise<AgentTrade[]>;
  createAgentTrade(trade: InsertAgentTrade): Promise<AgentTrade>;
  getAgentLogs(agentId: number, limit?: number): Promise<AgentLog[]>;
  createAgentLog(log: InsertAgentLog): Promise<AgentLog>;
  getAgentPositions(agentId: number, status?: string): Promise<AgentPosition[]>;
  getAgentPosition(id: number): Promise<AgentPosition | undefined>;
  createAgentPosition(position: InsertAgentPosition): Promise<AgentPosition>;
  updateAgentPosition(id: number, updates: Partial<AgentPosition>): Promise<AgentPosition>;
  closeAgentPosition(id: number, exitPrice: number, realizedPnl: number): Promise<AgentPosition>;
  getOpenPositionByToken(agentId: number, tokenSymbol: string): Promise<AgentPosition | undefined>;
  getAllOpenPositions(): Promise<AgentPosition[]>;
  getPriceAlerts(): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: number, updates: Partial<PriceAlert>): Promise<PriceAlert>;
  deletePriceAlert(id: number): Promise<void>;
  getLimitOrders(): Promise<LimitOrder[]>;
  createLimitOrder(order: InsertLimitOrder): Promise<LimitOrder>;
  updateLimitOrder(id: number, updates: Partial<LimitOrder>): Promise<LimitOrder>;
  deleteLimitOrder(id: number): Promise<void>;
  getDcaConfigs(): Promise<DcaConfig[]>;
  createDcaConfig(config: InsertDcaConfig): Promise<DcaConfig>;
  updateDcaConfig(id: number, updates: Partial<DcaConfig>): Promise<DcaConfig>;
  deleteDcaConfig(id: number): Promise<void>;
  getReferral(code: string): Promise<Referral | undefined>;
  getReferralByWallet(wallet: string): Promise<Referral | undefined>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  updateReferral(id: number, updates: Partial<Referral>): Promise<Referral>;
  getGeneratedWallets(userId: string): Promise<GeneratedWallet[]>;
  getGeneratedWallet(userId: string, chain: string): Promise<GeneratedWallet | undefined>;
  createGeneratedWallet(wallet: InsertGeneratedWallet): Promise<GeneratedWallet>;
  updateGeneratedWalletBalance(id: number, balance: number): Promise<GeneratedWallet>;
  getUserActiveSubscription(userId: string): Promise<Subscription | undefined>;
  getUserSubscriptionIncludingGrace(userId: string): Promise<Subscription | undefined>;
  getExpiringSubscriptions(): Promise<Subscription[]>;
  getGracePeriodExpiredSubscriptions(): Promise<Subscription[]>;
  getExpiredPendingPayments(): Promise<SubscriptionPayment[]>;
  getUserSubscriptions(userId: string): Promise<Subscription[]>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription>;
  createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment>;
  getSubscriptionPayment(id: number): Promise<SubscriptionPayment | undefined>;
  getPendingPaymentsByUser(userId: string): Promise<SubscriptionPayment[]>;
  getUserPaymentHistory(userId: string): Promise<SubscriptionPayment[]>;
  updateSubscriptionPayment(id: number, updates: Partial<SubscriptionPayment>): Promise<SubscriptionPayment>;
  createPromoCode(promo: InsertPromoCode): Promise<PromoCode>;
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  getPromoCodeById(id: number): Promise<PromoCode | undefined>;
  getAllPromoCodes(): Promise<PromoCode[]>;
  updatePromoCode(id: number, updates: Partial<PromoCode>): Promise<PromoCode>;
  redeemPromoCode(promoCodeId: number, userId: string): Promise<PromoRedemption>;
  getUserPromoRedemption(userId: string): Promise<(PromoRedemption & { promoCode?: PromoCode }) | undefined>;
  hasActivePromoAccess(userId: string): Promise<{ hasAccess: boolean; tier: string; promoCode?: string; expiresAt?: Date }>;
  getAllSignalPerformance(): Promise<SignalPerformance[]>;
  getSignalPerformanceByStrategy(strategy: string): Promise<SignalPerformance[]>;
  upsertSignalPerformance(signal: string, strategy: string, won: boolean, pnlPercent: number): Promise<SignalPerformance>;

  getTokenSocialMetrics(): Promise<TokenSocialMetrics[]>;
  getTokenSocialMetricsBySymbol(symbol: string): Promise<TokenSocialMetrics | undefined>;
  upsertTokenSocialMetrics(data: InsertTokenSocialMetrics): Promise<TokenSocialMetrics>;
  getSmartMoneySignals(): Promise<SmartMoneySignal[]>;
  getSmartMoneySignalByToken(address: string, chain: string): Promise<SmartMoneySignal | undefined>;
  upsertSmartMoneySignal(data: InsertSmartMoneySignal): Promise<SmartMoneySignal>;

  getCryptoNews(limit?: number): Promise<CryptoNews[]>;
  upsertCryptoNews(data: InsertCryptoNews): Promise<CryptoNews>;

  getFearGreedLatest(): Promise<FearGreedIndexRecord | undefined>;
  upsertFearGreedIndex(data: InsertFearGreedIndex): Promise<FearGreedIndexRecord>;

  getLiquidityEvents(limit?: number): Promise<LiquidityEventRecord[]>;
  upsertLiquidityEvent(data: InsertLiquidityEvent): Promise<LiquidityEventRecord>;
}

export class DatabaseStorage implements IStorage {
  async getTokens(): Promise<Token[]> {
    return db.select().from(tokens).orderBy(desc(tokens.volume24h));
  }

  async getToken(id: number): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.id, id));
    return token;
  }

  async getTokenByAddress(address: string): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.address, address));
    return token;
  }

  async createToken(token: InsertToken): Promise<Token> {
    const [created] = await db.insert(tokens).values(token).returning();
    return created;
  }

  async updateTokenPrice(id: number, price: number, change1h: number, change24h: number): Promise<void> {
    await db.update(tokens).set({
      price,
      priceChange1h: change1h,
      priceChange24h: change24h,
    }).where(eq(tokens.id, id));
  }

  async updateToken(id: number, updates: Partial<{ price: number; priceChange1h: number | null; priceChange24h: number | null; volume24h: number | null; liquidity: number | null; marketCap: number | null; image: string | null }>): Promise<void> {
    const setObj: any = {};
    if (updates.price !== undefined) setObj.price = updates.price;
    if (updates.priceChange1h !== undefined) setObj.priceChange1h = updates.priceChange1h;
    if (updates.priceChange24h !== undefined) setObj.priceChange24h = updates.priceChange24h;
    if (updates.volume24h !== undefined) setObj.volume24h = updates.volume24h;
    if (updates.liquidity !== undefined) setObj.liquidity = updates.liquidity;
    if (updates.marketCap !== undefined) setObj.marketCap = updates.marketCap;
    if (updates.image !== undefined) setObj.image = updates.image;
    if (Object.keys(setObj).length > 0) {
      await db.update(tokens).set(setObj).where(eq(tokens.id, id));
    }
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return db.select().from(watchlist).orderBy(desc(watchlist.addedAt));
  }

  async addToWatchlist(item: InsertWatchlist): Promise<WatchlistItem> {
    const [created] = await db.insert(watchlist).values(item).returning();
    return created;
  }

  async removeFromWatchlist(tokenId: number): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.tokenId, tokenId));
  }

  async getTrades(limit = 50): Promise<Trade[]> {
    return db.select().from(trades).orderBy(desc(trades.timestamp)).limit(limit);
  }

  async getTradesByToken(tokenId: number): Promise<Trade[]> {
    return db.select().from(trades).where(eq(trades.tokenId, tokenId)).orderBy(desc(trades.timestamp)).limit(100);
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const total = trade.amount * trade.price;
    const wallet = trade.wallet || `${Math.random().toString(36).slice(2, 6)}...${Math.random().toString(36).slice(2, 6)}`;
    const [created] = await db.insert(trades).values({ ...trade, total, wallet }).returning();
    return created;
  }

  async getPriceHistory(tokenId: number, hoursBack: number = 168): Promise<PriceHistoryEntry[]> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return db.select().from(priceHistory)
      .where(and(
        eq(priceHistory.tokenId, tokenId),
        sql`${priceHistory.timestamp} >= ${cutoff}`
      ))
      .orderBy(priceHistory.timestamp);
  }

  async addPriceHistory(entry: InsertPriceHistory): Promise<PriceHistoryEntry> {
    const [created] = await db.insert(priceHistory).values(entry).returning();
    return created;
  }

  async addPriceHistoryWithTimestamp(entry: InsertPriceHistory, timestamp: Date): Promise<PriceHistoryEntry> {
    const [created] = await db.insert(priceHistory).values(entry).returning();
    await db.update(priceHistory).set({ timestamp }).where(eq(priceHistory.id, created.id));
    return { ...created, timestamp };
  }

  async getTokenCount(): Promise<number> {
    const result = await db.select().from(tokens);
    return result.length;
  }

  async getSmartWallets(): Promise<SmartWallet[]> {
    return db.select().from(smartWallets).orderBy(desc(smartWallets.pnl7d));
  }

  async getSmartWallet(id: number): Promise<SmartWallet | undefined> {
    const [wallet] = await db.select().from(smartWallets).where(eq(smartWallets.id, id));
    return wallet;
  }

  async createSmartWallet(wallet: InsertSmartWallet): Promise<SmartWallet> {
    const [created] = await db.insert(smartWallets).values(wallet).returning();
    return created;
  }

  async updateSmartWallet(id: number, updates: Partial<InsertSmartWallet>): Promise<SmartWallet | undefined> {
    const [updated] = await db.update(smartWallets).set(updates).where(eq(smartWallets.id, id)).returning();
    return updated;
  }

  async getWalletHoldings(walletId: number): Promise<WalletHolding[]> {
    return db.select().from(walletHoldings).where(eq(walletHoldings.walletId, walletId));
  }

  async createWalletHolding(holding: InsertWalletHolding): Promise<WalletHolding> {
    const [created] = await db.insert(walletHoldings).values(holding).returning();
    return created;
  }

  async getWalletTrades(walletId: number, limit = 20): Promise<WalletTrade[]> {
    return db.select().from(walletTrades)
      .where(eq(walletTrades.walletId, walletId))
      .orderBy(desc(walletTrades.timestamp))
      .limit(limit);
  }

  async createWalletTrade(trade: InsertWalletTrade): Promise<WalletTrade> {
    const [created] = await db.insert(walletTrades).values(trade).returning();
    return created;
  }

  async getCopyTradeConfigs(): Promise<CopyTradeConfig[]> {
    return db.select().from(copyTradeConfigs);
  }

  async createCopyTradeConfig(config: InsertCopyTradeConfig): Promise<CopyTradeConfig> {
    const [created] = await db.insert(copyTradeConfigs).values(config).returning();
    return created;
  }

  async updateCopyTradeConfig(id: number, updates: Partial<InsertCopyTradeConfig>): Promise<CopyTradeConfig> {
    const [updated] = await db.update(copyTradeConfigs).set(updates).where(eq(copyTradeConfigs.id, id)).returning();
    return updated;
  }

  async deleteCopyTradeConfig(id: number): Promise<void> {
    await db.delete(copyTradeConfigs).where(eq(copyTradeConfigs.id, id));
  }

  async getSniperRules(): Promise<SniperRule[]> {
    return db.select().from(sniperRules).orderBy(desc(sniperRules.createdAt));
  }

  async createSniperRule(rule: InsertSniperRule): Promise<SniperRule> {
    const [created] = await db.insert(sniperRules).values(rule).returning();
    return created;
  }

  async updateSniperRule(id: number, updates: Partial<InsertSniperRule>): Promise<SniperRule> {
    const [updated] = await db.update(sniperRules).set(updates).where(eq(sniperRules.id, id)).returning();
    return updated;
  }

  async deleteSniperRule(id: number): Promise<void> {
    await db.delete(sniperRules).where(eq(sniperRules.id, id));
  }

  async getPositions(): Promise<Position[]> {
    return db.select().from(positions).orderBy(desc(positions.openedAt));
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const [created] = await db.insert(positions).values(position).returning();
    return created;
  }

  async upsertPositionFromTrade(tokenId: number, tradeType: string, tradeAmount: number, tradePrice: number, chain: string): Promise<Position> {
    const [existing] = await db.select().from(positions).where(eq(positions.tokenId, tokenId));

    if (tradeType === "buy") {
      if (existing) {
        const newSize = existing.size + tradeAmount;
        const newAvgEntry = ((existing.avgEntry * existing.size) + (tradePrice * tradeAmount)) / newSize;
        const unrealizedPnl = (tradePrice - newAvgEntry) * newSize;
        const unrealizedPnlPercent = newAvgEntry > 0 ? ((tradePrice - newAvgEntry) / newAvgEntry) * 100 : 0;
        const [updated] = await db.update(positions)
          .set({ size: newSize, avgEntry: newAvgEntry, currentPrice: tradePrice, unrealizedPnl, unrealizedPnlPercent })
          .where(eq(positions.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(positions).values({
          tokenId, size: tradeAmount, avgEntry: tradePrice, currentPrice: tradePrice,
          unrealizedPnl: 0, unrealizedPnlPercent: 0, realizedPnl: 0, chain,
        }).returning();
        return created;
      }
    } else {
      if (existing) {
        const sellAmount = Math.min(tradeAmount, existing.size);
        const realizedPnl = (existing.realizedPnl ?? 0) + (tradePrice - existing.avgEntry) * sellAmount;
        const newSize = Math.max(0, existing.size - sellAmount);
        const unrealizedPnl = newSize > 0.0001 ? (tradePrice - existing.avgEntry) * newSize : 0;
        const unrealizedPnlPercent = newSize > 0.0001 && existing.avgEntry > 0 ? ((tradePrice - existing.avgEntry) / existing.avgEntry) * 100 : 0;
        const [updated] = await db.update(positions)
          .set({ size: newSize, currentPrice: tradePrice, realizedPnl, unrealizedPnl, unrealizedPnlPercent })
          .where(eq(positions.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(positions).values({
          tokenId, size: 0, avgEntry: tradePrice, currentPrice: tradePrice,
          unrealizedPnl: 0, unrealizedPnlPercent: 0, realizedPnl: 0, chain,
        }).returning();
        return created;
      }
    }
  }

  async getSafetyReport(tokenId: number): Promise<SafetyReport | undefined> {
    const [report] = await db.select().from(safetyReports).where(eq(safetyReports.tokenId, tokenId));
    return report;
  }

  async getSafetyReports(): Promise<SafetyReport[]> {
    return db.select().from(safetyReports);
  }

  async createSafetyReport(report: InsertSafetyReport): Promise<SafetyReport> {
    const [created] = await db.insert(safetyReports).values(report).returning();
    return created;
  }

  async getAiAgents(): Promise<AiAgent[]> {
    return db.select().from(aiAgents).orderBy(desc(aiAgents.createdAt));
  }

  async getAiAgent(id: number): Promise<AiAgent | undefined> {
    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    return agent;
  }

  async getActiveAgents(): Promise<AiAgent[]> {
    return db.select().from(aiAgents).where(eq(aiAgents.status, "running"));
  }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const [created] = await db.insert(aiAgents).values(agent).returning();
    return created;
  }

  async updateAiAgent(id: number, updates: Partial<AiAgent>): Promise<AiAgent> {
    const [updated] = await db.update(aiAgents).set(updates).where(eq(aiAgents.id, id)).returning();
    return updated;
  }

  async deleteAiAgent(id: number): Promise<void> {
    await db.delete(agentPositions).where(eq(agentPositions.agentId, id));
    await db.delete(agentLogs).where(eq(agentLogs.agentId, id));
    await db.delete(agentTrades).where(eq(agentTrades.agentId, id));
    await db.delete(aiAgents).where(eq(aiAgents.id, id));
  }

  async getAgentTrades(agentId: number, limit = 50): Promise<AgentTrade[]> {
    return db.select().from(agentTrades)
      .where(eq(agentTrades.agentId, agentId))
      .orderBy(desc(agentTrades.timestamp))
      .limit(limit);
  }

  async createAgentTrade(trade: InsertAgentTrade): Promise<AgentTrade> {
    const [created] = await db.insert(agentTrades).values(trade).returning();
    return created;
  }

  async getAgentLogs(agentId: number, limit = 50): Promise<AgentLog[]> {
    return db.select().from(agentLogs)
      .where(eq(agentLogs.agentId, agentId))
      .orderBy(desc(agentLogs.createdAt))
      .limit(limit);
  }

  async createAgentLog(log: InsertAgentLog): Promise<AgentLog> {
    const [created] = await db.insert(agentLogs).values(log).returning();
    return created;
  }

  async getAgentPositions(agentId: number, status?: string): Promise<AgentPosition[]> {
    if (status) {
      return db.select().from(agentPositions)
        .where(and(eq(agentPositions.agentId, agentId), eq(agentPositions.status, status)))
        .orderBy(desc(agentPositions.openedAt));
    }
    return db.select().from(agentPositions)
      .where(eq(agentPositions.agentId, agentId))
      .orderBy(desc(agentPositions.openedAt));
  }

  async getAgentPosition(id: number): Promise<AgentPosition | undefined> {
    const [pos] = await db.select().from(agentPositions).where(eq(agentPositions.id, id));
    return pos;
  }

  async createAgentPosition(position: InsertAgentPosition): Promise<AgentPosition> {
    const [created] = await db.insert(agentPositions).values(position).returning();
    return created;
  }

  async updateAgentPosition(id: number, updates: Partial<AgentPosition>): Promise<AgentPosition> {
    const [updated] = await db.update(agentPositions).set(updates).where(eq(agentPositions.id, id)).returning();
    return updated;
  }

  async closeAgentPosition(id: number, exitPrice: number, realizedPnl: number): Promise<AgentPosition> {
    const [closed] = await db.update(agentPositions).set({
      status: "closed",
      currentPrice: exitPrice,
      realizedPnl,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      closedAt: new Date(),
    }).where(eq(agentPositions.id, id)).returning();
    return closed;
  }

  async getOpenPositionByToken(agentId: number, tokenSymbol: string): Promise<AgentPosition | undefined> {
    const [pos] = await db.select().from(agentPositions)
      .where(and(
        eq(agentPositions.agentId, agentId),
        eq(agentPositions.tokenSymbol, tokenSymbol),
        eq(agentPositions.status, "open")
      ));
    return pos;
  }

  async getAllOpenPositions(): Promise<AgentPosition[]> {
    return db.select().from(agentPositions)
      .where(eq(agentPositions.status, "open"))
      .orderBy(desc(agentPositions.openedAt));
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts).orderBy(desc(priceAlerts.createdAt));
  }

  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const [created] = await db.insert(priceAlerts).values(alert).returning();
    return created;
  }

  async updatePriceAlert(id: number, updates: Partial<PriceAlert>): Promise<PriceAlert> {
    const [updated] = await db.update(priceAlerts).set(updates).where(eq(priceAlerts.id, id)).returning();
    return updated;
  }

  async deletePriceAlert(id: number): Promise<void> {
    await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
  }

  async getLimitOrders(): Promise<LimitOrder[]> {
    return db.select().from(limitOrders).orderBy(desc(limitOrders.createdAt));
  }

  async createLimitOrder(order: InsertLimitOrder): Promise<LimitOrder> {
    const [created] = await db.insert(limitOrders).values(order).returning();
    return created;
  }

  async updateLimitOrder(id: number, updates: Partial<LimitOrder>): Promise<LimitOrder> {
    const [updated] = await db.update(limitOrders).set(updates).where(eq(limitOrders.id, id)).returning();
    return updated;
  }

  async deleteLimitOrder(id: number): Promise<void> {
    await db.delete(limitOrders).where(eq(limitOrders.id, id));
  }

  async getDcaConfigs(): Promise<DcaConfig[]> {
    return db.select().from(dcaConfigs).orderBy(desc(dcaConfigs.createdAt));
  }

  async createDcaConfig(config: InsertDcaConfig): Promise<DcaConfig> {
    const [created] = await db.insert(dcaConfigs).values(config).returning();
    return created;
  }

  async updateDcaConfig(id: number, updates: Partial<DcaConfig>): Promise<DcaConfig> {
    const [updated] = await db.update(dcaConfigs).set(updates).where(eq(dcaConfigs.id, id)).returning();
    return updated;
  }

  async deleteDcaConfig(id: number): Promise<void> {
    await db.delete(dcaConfigs).where(eq(dcaConfigs.id, id));
  }

  async getReferral(code: string): Promise<Referral | undefined> {
    const [ref] = await db.select().from(referrals).where(eq(referrals.code, code));
    return ref;
  }

  async getReferralByWallet(wallet: string): Promise<Referral | undefined> {
    const [ref] = await db.select().from(referrals).where(eq(referrals.ownerWallet, wallet));
    return ref;
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [created] = await db.insert(referrals).values(referral).returning();
    return created;
  }

  async updateReferral(id: number, updates: Partial<Referral>): Promise<Referral> {
    const [updated] = await db.update(referrals).set(updates).where(eq(referrals.id, id)).returning();
    return updated;
  }

  async getGeneratedWallets(userId: string): Promise<GeneratedWallet[]> {
    return db.select().from(generatedWallets).where(eq(generatedWallets.userId, userId));
  }

  async getGeneratedWallet(userId: string, chain: string): Promise<GeneratedWallet | undefined> {
    const [wallet] = await db.select().from(generatedWallets)
      .where(and(eq(generatedWallets.userId, userId), eq(generatedWallets.chain, chain)));
    return wallet;
  }

  async createGeneratedWallet(wallet: InsertGeneratedWallet): Promise<GeneratedWallet> {
    const [created] = await db.insert(generatedWallets).values(wallet).returning();
    return created;
  }

  async updateGeneratedWalletBalance(id: number, balance: number): Promise<GeneratedWallet> {
    const [updated] = await db.update(generatedWallets).set({ balance }).where(eq(generatedWallets.id, id)).returning();
    return updated;
  }

  async deleteGeneratedWallet(id: number): Promise<void> {
    await db.delete(generatedWallets).where(eq(generatedWallets.id, id));
  }

  async getUserActiveSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gte(subscriptions.expiresAt, new Date()),
      ))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async getUserSubscriptionIncludingGrace(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.userId, userId),
        or(
          and(eq(subscriptions.status, "active"), gte(subscriptions.expiresAt, new Date())),
          and(eq(subscriptions.status, "grace_period"), gte(subscriptions.gracePeriodEndsAt, new Date())),
        ),
      ))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async getExpiringSubscriptions(): Promise<Subscription[]> {
    return db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.status, "active"),
        lte(subscriptions.expiresAt, new Date()),
      ));
  }

  async getGracePeriodExpiredSubscriptions(): Promise<Subscription[]> {
    return db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.status, "grace_period"),
        lte(subscriptions.gracePeriodEndsAt, new Date()),
      ));
  }

  async getExpiredPendingPayments(): Promise<SubscriptionPayment[]> {
    return db.select().from(subscriptionPayments)
      .where(and(
        eq(subscriptionPayments.status, "pending"),
        lte(subscriptionPayments.expiresAt, new Date()),
      ));
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return db.select().from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(sub).returning();
    return created;
  }

  async updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription> {
    const [updated] = await db.update(subscriptions).set(updates).where(eq(subscriptions.id, id)).returning();
    return updated;
  }

  async createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment> {
    const [created] = await db.insert(subscriptionPayments).values(payment).returning();
    return created;
  }

  async getSubscriptionPayment(id: number): Promise<SubscriptionPayment | undefined> {
    const [payment] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, id));
    return payment;
  }

  async getPendingPaymentsByUser(userId: string): Promise<SubscriptionPayment[]> {
    return db.select().from(subscriptionPayments)
      .where(and(
        eq(subscriptionPayments.userId, userId),
        eq(subscriptionPayments.status, "pending"),
      ))
      .orderBy(desc(subscriptionPayments.createdAt));
  }

  async getUserPaymentHistory(userId: string): Promise<SubscriptionPayment[]> {
    return db.select().from(subscriptionPayments)
      .where(eq(subscriptionPayments.userId, userId))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(20);
  }

  async updateSubscriptionPayment(id: number, updates: Partial<SubscriptionPayment>): Promise<SubscriptionPayment> {
    const [updated] = await db.update(subscriptionPayments).set(updates).where(eq(subscriptionPayments.id, id)).returning();
    return updated;
  }

  async createPromoCode(promo: InsertPromoCode): Promise<PromoCode> {
    const [created] = await db.insert(promoCodes).values(promo).returning();
    return created;
  }

  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    const normalized = code.toUpperCase().trim();
    // Use raw SQL UPPER comparison to guarantee case-insensitive match
    const [promo] = await db.select().from(promoCodes).where(sql`UPPER(${promoCodes.code}) = ${normalized}`);
    if (!promo) {
      // Fallback: list all codes for debugging
      const allCodes = await db.select({ code: promoCodes.code }).from(promoCodes);
      console.log(`[Promo] Code "${normalized}" not found. Available codes: ${allCodes.map(c => c.code).join(', ')}`);
    }
    return promo;
  }

  async getPromoCodeById(id: number): Promise<PromoCode | undefined> {
    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.id, id));
    return promo;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  }

  async updatePromoCode(id: number, updates: Partial<PromoCode>): Promise<PromoCode> {
    const [updated] = await db.update(promoCodes).set(updates).where(eq(promoCodes.id, id)).returning();
    return updated;
  }

  async redeemPromoCode(promoCodeId: number, userId: string): Promise<PromoRedemption> {
    const existing = await db.select().from(promoRedemptions)
      .where(eq(promoRedemptions.userId, userId)).limit(1);
    if (existing.length > 0) {
      throw new Error("You have already redeemed a promo code");
    }
    const result = await db.update(promoCodes)
      .set({ currentUses: sql`${promoCodes.currentUses} + 1` })
      .where(and(
        eq(promoCodes.id, promoCodeId),
        sql`(${promoCodes.maxUses} IS NULL OR ${promoCodes.currentUses} < ${promoCodes.maxUses})`
      ))
      .returning();
    if (result.length === 0) {
      throw new Error("Promo code has reached its maximum number of uses");
    }
    const [redemption] = await db.insert(promoRedemptions).values({ promoCodeId, userId }).returning();
    return redemption;
  }

  async getUserPromoRedemption(userId: string): Promise<(PromoRedemption & { promoCode?: PromoCode }) | undefined> {
    const [redemption] = await db.select().from(promoRedemptions)
      .where(eq(promoRedemptions.userId, userId))
      .orderBy(desc(promoRedemptions.redeemedAt))
      .limit(1);
    if (!redemption) return undefined;
    const promo = await this.getPromoCodeById(redemption.promoCodeId);
    return { ...redemption, promoCode: promo };
  }

  async hasActivePromoAccess(userId: string): Promise<{ hasAccess: boolean; tier: string; promoCode?: string; expiresAt?: Date }> {
    const redemption = await this.getUserPromoRedemption(userId);
    if (!redemption || !redemption.promoCode) return { hasAccess: false, tier: "" };
    const promo = redemption.promoCode;
    if (!promo.isActive) return { hasAccess: false, tier: "" };
    if (promo.expiresAt && promo.expiresAt < new Date()) return { hasAccess: false, tier: "" };

    const trialDays = promo.trialDays ?? 7;
    if (trialDays > 0 && redemption.redeemedAt) {
      const trialEnd = new Date(redemption.redeemedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
      if (new Date() > trialEnd) {
        return { hasAccess: false, tier: "", expiresAt: trialEnd };
      }
      return { hasAccess: true, tier: promo.tier, promoCode: promo.code, expiresAt: trialEnd };
    }

    return { hasAccess: true, tier: promo.tier, promoCode: promo.code };
  }

  async getAllSignalPerformance(): Promise<SignalPerformance[]> {
    return db.select().from(signalPerformance).orderBy(desc(signalPerformance.count));
  }

  async getSignalPerformanceByStrategy(strategy: string): Promise<SignalPerformance[]> {
    return db.select().from(signalPerformance)
      .where(eq(signalPerformance.strategy, strategy))
      .orderBy(desc(signalPerformance.count));
  }

  async upsertSignalPerformance(signal: string, strategy: string, won: boolean, pnlPercent: number): Promise<SignalPerformance> {
    const [existing] = await db.select().from(signalPerformance)
      .where(and(
        eq(signalPerformance.signal, signal),
        eq(signalPerformance.strategy, strategy)
      )).limit(1);

    if (existing) {
      const newCount = existing.count + 1;
      const newWins = existing.wins + (won ? 1 : 0);
      const newLosses = existing.losses + (won ? 0 : 1);
      const newTotalPnl = existing.totalPnl + pnlPercent;
      const newAvgPnl = newTotalPnl / newCount;
      const [updated] = await db.update(signalPerformance)
        .set({
          wins: newWins,
          losses: newLosses,
          totalPnl: newTotalPnl,
          count: newCount,
          avgPnl: Math.round(newAvgPnl * 100) / 100,
          lastUpdatedAt: new Date(),
        })
        .where(eq(signalPerformance.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(signalPerformance).values({
      signal,
      strategy,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      totalPnl: pnlPercent,
      count: 1,
      avgPnl: Math.round(pnlPercent * 100) / 100,
    }).returning();
    return created;
  }

  async getTokenSocialMetrics(): Promise<TokenSocialMetrics[]> {
    return db.select().from(tokenSocialMetrics).orderBy(desc(tokenSocialMetrics.galaxyScore));
  }

  async getTokenSocialMetricsBySymbol(symbol: string): Promise<TokenSocialMetrics | undefined> {
    const [result] = await db.select().from(tokenSocialMetrics)
      .where(eq(tokenSocialMetrics.symbol, symbol.toUpperCase()));
    return result;
  }

  async upsertTokenSocialMetrics(data: InsertTokenSocialMetrics): Promise<TokenSocialMetrics> {
    const existing = await this.getTokenSocialMetricsBySymbol(data.symbol);
    if (existing) {
      const [updated] = await db.update(tokenSocialMetrics)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tokenSocialMetrics.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tokenSocialMetrics)
      .values({ ...data, symbol: data.symbol.toUpperCase() })
      .returning();
    return created;
  }

  async getSmartMoneySignals(): Promise<SmartMoneySignal[]> {
    return db.select().from(smartMoneySignals).orderBy(desc(smartMoneySignals.whaleAccumulationScore));
  }

  async getSmartMoneySignalByToken(address: string, chain: string): Promise<SmartMoneySignal | undefined> {
    const [result] = await db.select().from(smartMoneySignals)
      .where(and(
        eq(smartMoneySignals.tokenAddress, address.toLowerCase()),
        eq(smartMoneySignals.chain, chain)
      ));
    return result;
  }

  async upsertSmartMoneySignal(data: InsertSmartMoneySignal): Promise<SmartMoneySignal> {
    const existing = await this.getSmartMoneySignalByToken(data.tokenAddress, data.chain ?? "solana");
    if (existing) {
      const [updated] = await db.update(smartMoneySignals)
        .set({ ...data, tokenAddress: data.tokenAddress.toLowerCase(), updatedAt: new Date() })
        .where(eq(smartMoneySignals.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(smartMoneySignals)
      .values({ ...data, tokenAddress: data.tokenAddress.toLowerCase() })
      .returning();
    return created;
  }

  async getCryptoNews(limit = 50): Promise<CryptoNews[]> {
    return db.select().from(cryptoNews).orderBy(desc(cryptoNews.publishedAt)).limit(limit);
  }

  async upsertCryptoNews(data: InsertCryptoNews): Promise<CryptoNews> {
    const existing = await db.select().from(cryptoNews)
      .where(eq(cryptoNews.title, data.title)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(cryptoNews)
        .set({ ...data })
        .where(eq(cryptoNews.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cryptoNews).values(data).returning();
    return created;
  }

  async getFearGreedLatest(): Promise<FearGreedIndexRecord | undefined> {
    const [result] = await db.select().from(fearGreedIndex).orderBy(desc(fearGreedIndex.updatedAt)).limit(1);
    return result;
  }

  async upsertFearGreedIndex(data: InsertFearGreedIndex): Promise<FearGreedIndexRecord> {
    const existing = await this.getFearGreedLatest();
    if (existing) {
      const [updated] = await db.update(fearGreedIndex)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(fearGreedIndex.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(fearGreedIndex).values(data).returning();
    return created;
  }

  async getLiquidityEvents(limit = 50): Promise<LiquidityEventRecord[]> {
    return db.select().from(liquidityEvents).orderBy(desc(liquidityEvents.createdAt)).limit(limit);
  }

  async upsertLiquidityEvent(data: InsertLiquidityEvent): Promise<LiquidityEventRecord> {
    const [created] = await db.insert(liquidityEvents).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
