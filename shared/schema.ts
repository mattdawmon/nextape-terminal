import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";
export * from "./models/auth";

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  image: text("image"),
  price: real("price").notNull().default(0),
  priceChange1h: real("price_change_1h").default(0),
  priceChange24h: real("price_change_24h").default(0),
  volume24h: real("volume_24h").default(0),
  marketCap: real("market_cap").default(0),
  liquidity: real("liquidity").default(0),
  holders: integer("holders").default(0),
  txns24h: integer("txns_24h").default(0),
  buys24h: integer("buys_24h").default(0),
  sells24h: integer("sells_24h").default(0),
  topHolderPercent: real("top_holder_percent").default(0),
  isVerified: boolean("is_verified").default(false),
  isTrending: boolean("is_trending").default(false),
  isNew: boolean("is_new").default(false),
  chain: text("chain").default("solana"),
  launchpad: text("launchpad"),
  bondingCurveProgress: real("bonding_curve_progress"),
  graduated: boolean("graduated"),
  devWalletPercent: real("dev_wallet_percent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  price: real("price").notNull(),
  total: real("total").notNull(),
  wallet: varchar("wallet", { length: 12 }),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  price: real("price").notNull(),
  volume: real("volume").default(0),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const smartWallets = pgTable("smart_wallets", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 64 }).notNull().unique(),
  label: text("label").notNull(),
  chain: text("chain").default("solana"),
  pnl7d: real("pnl_7d").default(0),
  pnl30d: real("pnl_30d").default(0),
  winRate: real("win_rate").default(0),
  totalTrades: integer("total_trades").default(0),
  avgTradeSize: real("avg_trade_size").default(0),
  followers: integer("followers").default(0),
  isWhale: boolean("is_whale").default(false),
  lastActive: timestamp("last_active").defaultNow(),
});

export const walletHoldings = pgTable("wallet_holdings", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  tokenId: integer("token_id").notNull(),
  amount: real("amount").notNull(),
  avgCost: real("avg_cost").notNull(),
  currentValue: real("current_value").default(0),
  unrealizedPnl: real("unrealized_pnl").default(0),
});

export const walletTrades = pgTable("wallet_trades", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  tokenId: integer("token_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  price: real("price").notNull(),
  total: real("total").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const copyTradeConfigs = pgTable("copy_trade_configs", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  enabled: boolean("enabled").default(true),
  multiplier: real("multiplier").default(1),
  takeProfit: real("take_profit").default(200),
  stopLoss: real("stop_loss").default(50),
  maxPosition: real("max_position").default(10),
  chain: text("chain").default("solana"),
});

export const sniperRules = pgTable("sniper_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true),
  chain: text("chain").default("solana"),
  minLiquidity: real("min_liquidity").default(1000),
  maxMcap: real("max_mcap").default(1000000),
  minHolders: integer("min_holders").default(10),
  maxDevHolding: real("max_dev_holding").default(10),
  autoBuyAmount: real("auto_buy_amount").default(0.5),
  slippage: real("slippage").default(15),
  antiMev: boolean("anti_mev").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  size: real("size").notNull(),
  avgEntry: real("avg_entry").notNull(),
  currentPrice: real("current_price").notNull(),
  unrealizedPnl: real("unrealized_pnl").default(0),
  unrealizedPnlPercent: real("unrealized_pnl_percent").default(0),
  realizedPnl: real("realized_pnl").default(0),
  chain: text("chain").default("solana"),
  openedAt: timestamp("opened_at").defaultNow(),
});

export const safetyReports = pgTable("safety_reports", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  overallScore: real("overall_score").default(50),
  honeypotRisk: real("honeypot_risk").default(0),
  lpLocked: boolean("lp_locked").default(false),
  lpLockDays: integer("lp_lock_days").default(0),
  contractVerified: boolean("contract_verified").default(false),
  mintAuthority: boolean("mint_authority").default(false),
  freezeAuthority: boolean("freeze_authority").default(false),
  topHolderConcentration: real("top_holder_concentration").default(0),
  top10HolderPercent: real("top10_holder_percent").default(0),
  devHolding: real("dev_holding").default(0),
  socialScore: real("social_score").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});


export const insertTokenSchema = createInsertSchema(tokens).omit({
  id: true,
  createdAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  addedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  timestamp: true,
}).extend({
  total: z.number().optional(),
  wallet: z.string().optional().nullable(),
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  timestamp: true,
});

export const insertSmartWalletSchema = createInsertSchema(smartWallets).omit({
  id: true,
  lastActive: true,
});

export const insertWalletHoldingSchema = createInsertSchema(walletHoldings).omit({
  id: true,
});

export const insertWalletTradeSchema = createInsertSchema(walletTrades).omit({
  id: true,
  timestamp: true,
});

export const insertCopyTradeConfigSchema = createInsertSchema(copyTradeConfigs).omit({
  id: true,
});

export const insertSniperRuleSchema = createInsertSchema(sniperRules).omit({
  id: true,
  createdAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
});

export const insertSafetyReportSchema = createInsertSchema(safetyReports).omit({
  id: true,
  updatedAt: true,
});

export const aiAgents = pgTable("ai_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  walletAddress: varchar("wallet_address", { length: 64 }).notNull(),
  chain: text("chain").default("solana"),
  strategy: text("strategy").notNull().default("balanced"),
  status: text("status").notNull().default("stopped"),
  maxPositionSize: real("max_position_size").default(1),
  stopLossPercent: real("stop_loss_percent").default(15),
  takeProfitPercent: real("take_profit_percent").default(50),
  maxDailyTrades: integer("max_daily_trades").default(10),
  riskLevel: real("risk_level").default(5),
  totalPnl: real("total_pnl").default(0),
  totalTrades: integer("total_trades").default(0),
  winRate: real("win_rate").default(0),
  dailyTradesUsed: integer("daily_trades_used").default(0),
  lastTradeAt: timestamp("last_trade_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentTrades = pgTable("agent_trades", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  tokenId: integer("token_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  price: real("price").notNull(),
  total: real("total").notNull(),
  pnl: real("pnl").default(0),
  reasoning: text("reasoning"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const agentLogs = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  action: text("action").notNull(),
  reasoning: text("reasoning"),
  tokensAnalyzed: integer("tokens_analyzed").default(0),
  decision: text("decision"),
  confidence: real("confidence").default(0),
  marketContext: text("market_context"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentPositions = pgTable("agent_positions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  tokenId: integer("token_id"),
  tokenAddress: varchar("token_address", { length: 128 }),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").default("solana"),
  side: text("side").notNull().default("long"),
  size: real("size").notNull(),
  avgEntryPrice: real("avg_entry_price").notNull(),
  currentPrice: real("current_price").notNull(),
  highestPrice: real("highest_price"),
  trailingStopPrice: real("trailing_stop_price"),
  stopLossPrice: real("stop_loss_price"),
  takeProfitPrice: real("take_profit_price"),
  unrealizedPnl: real("unrealized_pnl").default(0),
  unrealizedPnlPercent: real("unrealized_pnl_percent").default(0),
  realizedPnl: real("realized_pnl").default(0),
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  type: text("type").notNull(),
  targetPrice: real("target_price"),
  percentChange: real("percent_change"),
  chain: text("chain").default("solana"),
  enabled: boolean("enabled").default(true),
  triggered: boolean("triggered").default(false),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const limitOrders = pgTable("limit_orders", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  type: text("type").notNull(),
  orderType: text("order_type").notNull(),
  amount: real("amount").notNull(),
  triggerPrice: real("trigger_price").notNull(),
  slippage: real("slippage").default(1),
  status: text("status").notNull().default("pending"),
  chain: text("chain").default("solana"),
  filledAt: timestamp("filled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dcaConfigs = pgTable("dca_configs", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  amount: real("amount").notNull(),
  frequency: text("frequency").notNull(),
  totalInvested: real("total_invested").default(0),
  totalBought: real("total_bought").default(0),
  executionCount: integer("execution_count").default(0),
  maxExecutions: integer("max_executions").default(0),
  enabled: boolean("enabled").default(true),
  chain: text("chain").default("solana"),
  lastExecutedAt: timestamp("last_executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  ownerWallet: varchar("owner_wallet", { length: 64 }).notNull(),
  referredWallets: text("referred_wallets").array().default([]),
  totalEarnings: real("total_earnings").default(0),
  tier: text("tier").default("bronze"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true,
  totalPnl: true,
  totalTrades: true,
  winRate: true,
  dailyTradesUsed: true,
  lastTradeAt: true,
  createdAt: true,
});

export const insertAgentTradeSchema = createInsertSchema(agentTrades).omit({
  id: true,
  timestamp: true,
});

export const insertAgentLogSchema = createInsertSchema(agentLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAgentPositionSchema = createInsertSchema(agentPositions).omit({
  id: true,
  unrealizedPnl: true,
  unrealizedPnlPercent: true,
  realizedPnl: true,
  closedAt: true,
  openedAt: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  triggered: true,
  triggeredAt: true,
  createdAt: true,
});

export const insertLimitOrderSchema = createInsertSchema(limitOrders).omit({
  id: true,
  status: true,
  filledAt: true,
  createdAt: true,
});

export const insertDcaConfigSchema = createInsertSchema(dcaConfigs).omit({
  id: true,
  totalInvested: true,
  totalBought: true,
  executionCount: true,
  lastExecutedAt: true,
  createdAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  referredWallets: true,
  totalEarnings: true,
  tier: true,
  createdAt: true,
});

export const generatedWallets = pgTable("generated_wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  chain: text("chain").notNull(),
  address: varchar("address", { length: 128 }).notNull(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  balance: real("balance").notNull().default(0),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGeneratedWalletSchema = createInsertSchema(generatedWallets).omit({
  id: true,
  createdAt: true,
});

export type Token = typeof tokens.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type PriceHistoryEntry = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type SmartWallet = typeof smartWallets.$inferSelect;
export type InsertSmartWallet = z.infer<typeof insertSmartWalletSchema>;
export type WalletHolding = typeof walletHoldings.$inferSelect;
export type InsertWalletHolding = z.infer<typeof insertWalletHoldingSchema>;
export type WalletTrade = typeof walletTrades.$inferSelect;
export type InsertWalletTrade = z.infer<typeof insertWalletTradeSchema>;
export type CopyTradeConfig = typeof copyTradeConfigs.$inferSelect;
export type InsertCopyTradeConfig = z.infer<typeof insertCopyTradeConfigSchema>;
export type SniperRule = typeof sniperRules.$inferSelect;
export type InsertSniperRule = z.infer<typeof insertSniperRuleSchema>;
export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type SafetyReport = typeof safetyReports.$inferSelect;
export type InsertSafetyReport = z.infer<typeof insertSafetyReportSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AgentTrade = typeof agentTrades.$inferSelect;
export type InsertAgentTrade = z.infer<typeof insertAgentTradeSchema>;
export type AgentLog = typeof agentLogs.$inferSelect;
export type InsertAgentLog = z.infer<typeof insertAgentLogSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type LimitOrder = typeof limitOrders.$inferSelect;
export type InsertLimitOrder = z.infer<typeof insertLimitOrderSchema>;
export type DcaConfig = typeof dcaConfigs.$inferSelect;
export type InsertDcaConfig = z.infer<typeof insertDcaConfigSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type GeneratedWallet = typeof generatedWallets.$inferSelect;
export type InsertGeneratedWallet = z.infer<typeof insertGeneratedWalletSchema>;
export type AgentPosition = typeof agentPositions.$inferSelect;
export type InsertAgentPosition = z.infer<typeof insertAgentPositionSchema>;

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  tier: text("tier").notNull().default("basic"),
  status: text("status").notNull().default("active"),
  chain: text("chain").default("solana"),
  amountPaid: real("amount_paid").default(0),
  currency: text("currency").default("SOL"),
  paymentTxHash: varchar("payment_tx_hash", { length: 128 }),
  startedAt: timestamp("started_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  gracePeriodEndsAt: timestamp("grace_period_ends_at"),
  renewalFailures: integer("renewal_failures").default(0),
  lastFailureReason: text("last_failure_reason"),
  autoRenew: boolean("auto_renew").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  tier: text("tier").notNull(),
  chain: text("chain").notNull().default("solana"),
  paymentAddress: varchar("payment_address", { length: 128 }).notNull(),
  amountRequiredUsd: real("amount_required_usd").notNull(),
  amountRequiredCrypto: real("amount_required_crypto").notNull(),
  currency: text("currency").notNull().default("SOL"),
  amountReceived: real("amount_received").default(0),
  txHash: varchar("tx_hash", { length: 128 }),
  status: text("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  amountReceived: true,
  confirmedAt: true,
  createdAt: true,
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  tier: text("tier").notNull().default("pro"),
  maxUses: integer("max_uses").default(1),
  currentUses: integer("current_uses").default(0),
  isActive: boolean("is_active").default(true),
  trialDays: integer("trial_days").default(7),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promoRedemptions = pgTable("promo_redemptions", {
  id: serial("id").primaryKey(),
  promoCodeId: integer("promo_code_id").notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  currentUses: true,
  createdAt: true,
});

export const insertPromoRedemptionSchema = createInsertSchema(promoRedemptions).omit({
  id: true,
  redeemedAt: true,
});

export const signalPerformance = pgTable("signal_performance", {
  id: serial("id").primaryKey(),
  signal: text("signal").notNull(),
  strategy: text("strategy").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalPnl: real("total_pnl").notNull().default(0),
  count: integer("count").notNull().default(0),
  avgPnl: real("avg_pnl").notNull().default(0),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
});

export const insertSignalPerformanceSchema = createInsertSchema(signalPerformance).omit({
  id: true,
  lastUpdatedAt: true,
});

export type SignalPerformance = typeof signalPerformance.$inferSelect;
export type InsertSignalPerformance = z.infer<typeof insertSignalPerformanceSchema>;

export const tokenSocialMetrics = pgTable("token_social_metrics", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name"),
  chain: text("chain").default("all"),
  galaxyScore: real("galaxy_score").default(0),
  altRank: integer("alt_rank").default(0),
  socialVolume: integer("social_volume").default(0),
  socialDominance: real("social_dominance").default(0),
  sentimentScore: real("sentiment_score").default(50),
  influencerMentions: integer("influencer_mentions").default(0),
  socialSpike: boolean("social_spike").default(false),
  trendingRank: integer("trending_rank"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTokenSocialMetricsSchema = createInsertSchema(tokenSocialMetrics).omit({
  id: true,
  updatedAt: true,
});

export type TokenSocialMetrics = typeof tokenSocialMetrics.$inferSelect;
export type InsertTokenSocialMetrics = z.infer<typeof insertTokenSocialMetricsSchema>;

export const smartMoneySignals = pgTable("smart_money_signals", {
  id: serial("id").primaryKey(),
  tokenAddress: varchar("token_address", { length: 128 }).notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").notNull().default("solana"),
  topTraderBuys: integer("top_trader_buys").default(0),
  topTraderSells: integer("top_trader_sells").default(0),
  netFlow: real("net_flow").default(0),
  whaleAccumulationScore: real("whale_accumulation_score").default(50),
  topWalletCount: integer("top_wallet_count").default(0),
  avgWalletWinRate: real("avg_wallet_win_rate").default(0),
  avgWalletPnl: real("avg_wallet_pnl").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmartMoneySignalSchema = createInsertSchema(smartMoneySignals).omit({
  id: true,
  updatedAt: true,
});

export type SmartMoneySignal = typeof smartMoneySignals.$inferSelect;
export type InsertSmartMoneySignal = z.infer<typeof insertSmartMoneySignalSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoRedemption = typeof promoRedemptions.$inferSelect;
export type InsertPromoRedemption = z.infer<typeof insertPromoRedemptionSchema>;

export const cryptoNews = pgTable("crypto_news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sentiment: text("sentiment").notNull().default("neutral"),
  impact: text("impact").notNull().default("low"),
  relatedTokens: text("related_tokens").array().default([]),
  publishedAt: timestamp("published_at").defaultNow(),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCryptoNewsSchema = createInsertSchema(cryptoNews).omit({
  id: true,
  createdAt: true,
});
export type CryptoNews = typeof cryptoNews.$inferSelect;
export type InsertCryptoNews = z.infer<typeof insertCryptoNewsSchema>;

export const fearGreedIndex = pgTable("fear_greed_index", {
  id: serial("id").primaryKey(),
  value: integer("value").notNull().default(50),
  classification: text("classification").notNull().default("Neutral"),
  trend: text("trend").default("stable"),
  previousDay: integer("previous_day"),
  previousWeek: integer("previous_week"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFearGreedIndexSchema = createInsertSchema(fearGreedIndex).omit({
  id: true,
  updatedAt: true,
});
export type FearGreedIndexRecord = typeof fearGreedIndex.$inferSelect;
export type InsertFearGreedIndex = z.infer<typeof insertFearGreedIndexSchema>;

export const liquidityEvents = pgTable("liquidity_events", {
  id: serial("id").primaryKey(),
  tokenAddress: varchar("token_address", { length: 128 }).notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").notNull().default("solana"),
  pairAddress: varchar("pair_address", { length: 128 }),
  eventType: text("event_type").notNull(),
  liquidityUsd: real("liquidity_usd").default(0),
  liquidityChange: real("liquidity_change").default(0),
  volumeUsd: real("volume_usd").default(0),
  priceImpact: real("price_impact").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLiquidityEventSchema = createInsertSchema(liquidityEvents).omit({
  id: true,
  createdAt: true,
});
export type LiquidityEventRecord = typeof liquidityEvents.$inferSelect;
export type InsertLiquidityEvent = z.infer<typeof insertLiquidityEventSchema>;

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});
