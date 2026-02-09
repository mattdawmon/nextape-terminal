const COINGECKO_IDS: Record<string, string> = {
  solana: "solana",
  ethereum: "ethereum",
  base: "ethereum",
  bsc: "binancecoin",
  tron: "tron",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "ETH",
  bsc: "BNB",
  tron: "TRX",
};

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let priceCache: PriceCache = { prices: {}, timestamp: 0 };
const CACHE_TTL = 60_000;

export async function getCryptoPrices(): Promise<Record<string, number>> {
  if (Date.now() - priceCache.timestamp < CACHE_TTL && Object.keys(priceCache.prices).length > 0) {
    return priceCache.prices;
  }

  try {
    const ids = Array.from(new Set(Object.values(COINGECKO_IDS))).join(",");
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { headers: { Accept: "application/json" } }
    );

    if (!resp.ok) {
      console.warn("[CryptoPrices] CoinGecko API error, using fallback prices");
      return getFallbackPrices();
    }

    const data = await resp.json() as Record<string, { usd: number }>;
    const prices: Record<string, number> = {};

    for (const [chain, geckoId] of Object.entries(COINGECKO_IDS)) {
      if (data[geckoId]?.usd) {
        prices[chain] = data[geckoId].usd;
      }
    }

    if (Object.keys(prices).length > 0) {
      priceCache = { prices, timestamp: Date.now() };
    }

    return Object.keys(prices).length > 0 ? prices : getFallbackPrices();
  } catch (err) {
    console.warn("[CryptoPrices] Failed to fetch prices:", err);
    return getFallbackPrices();
  }
}

function getFallbackPrices(): Record<string, number> {
  return {
    solana: 180,
    ethereum: 3200,
    base: 3200,
    bsc: 600,
    tron: 0.12,
  };
}

export async function getChainPrice(chain: string): Promise<number> {
  const prices = await getCryptoPrices();
  return prices[chain] || getFallbackPrices()[chain] || 100;
}

export function getCurrencySymbol(chain: string): string {
  return CURRENCY_SYMBOLS[chain] || "SOL";
}

export function usdToCrypto(usdAmount: number, cryptoPrice: number): number {
  return parseFloat((usdAmount / cryptoPrice).toFixed(8));
}

export const TIER_PRICES_USD: Record<string, number> = {
  basic: 29,
  pro: 79,
  whale: 199,
};

export interface TierLimits {
  maxAgents: number;
  maxDailyTrades: number;
  maxAlerts: number;
  maxLimitOrders: number;
  maxDcaConfigs: number;
  maxCopyTrades: number;
  maxSniperRules: number;
  smartMoneyAccess: boolean;
  smartMoneyFollow: boolean;
  safetyScanner: boolean;
  csvExport: boolean;
  advancedAnalytics: boolean;
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxAgents: 0, maxDailyTrades: 0,
    maxAlerts: 2, maxLimitOrders: 1, maxDcaConfigs: 0,
    maxCopyTrades: 0, maxSniperRules: 0,
    smartMoneyAccess: false, smartMoneyFollow: false,
    safetyScanner: false, csvExport: false, advancedAnalytics: false,
  },
  basic: {
    maxAgents: 1, maxDailyTrades: 10,
    maxAlerts: 5, maxLimitOrders: 3, maxDcaConfigs: 1,
    maxCopyTrades: 1, maxSniperRules: 1,
    smartMoneyAccess: true, smartMoneyFollow: false,
    safetyScanner: true, csvExport: false, advancedAnalytics: false,
  },
  pro: {
    maxAgents: 3, maxDailyTrades: 50,
    maxAlerts: 20, maxLimitOrders: 20, maxDcaConfigs: 5,
    maxCopyTrades: 5, maxSniperRules: 5,
    smartMoneyAccess: true, smartMoneyFollow: true,
    safetyScanner: true, csvExport: true, advancedAnalytics: true,
  },
  whale: {
    maxAgents: 999, maxDailyTrades: 999,
    maxAlerts: 999, maxLimitOrders: 999, maxDcaConfigs: 999,
    maxCopyTrades: 999, maxSniperRules: 999,
    smartMoneyAccess: true, smartMoneyFollow: true,
    safetyScanner: true, csvExport: true, advancedAnalytics: true,
  },
};

export const PLATFORM_PAYMENT_ADDRESSES: Record<string, string> = {
  solana: "52BVTyx5FXUwWo8M57qWmjHpPUSWYbS8J7T8h1ZWo4go",
  ethereum: "0x5A3EEc6eAD36D987B36d27F2FE2500A66589BAda",
  base: "0x5A3EEc6eAD36D987B36d27F2FE2500A66589BAda",
  bsc: "0x5A3EEc6eAD36D987B36d27F2FE2500A66589BAda",
  tron: "TCN3icG9MXk9foxCHCvTZtehR5xDAGVvAB",
};
