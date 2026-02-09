import { storage } from "./storage";
import { type InsertToken, type InsertPriceHistory, type InsertSmartWallet, type InsertSafetyReport } from "@shared/schema";

const SEED_TOKENS: InsertToken[] = [
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    name: "Bonk", symbol: "BONK", price: 0.0000234,
    priceChange1h: 2.34, priceChange24h: 15.67, volume24h: 45_600_000,
    marketCap: 1_520_000_000, liquidity: 12_400_000, holders: 654_231,
    txns24h: 125_432, buys24h: 78_234, sells24h: 47_198,
    topHolderPercent: 18.5, isVerified: true, isTrending: true, isNew: false, chain: "solana",
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "Jupiter", symbol: "JUP", price: 1.24,
    priceChange1h: -0.87, priceChange24h: 5.32, volume24h: 89_200_000,
    marketCap: 1_680_000_000, liquidity: 34_500_000, holders: 423_567,
    txns24h: 89_345, buys24h: 52_123, sells24h: 37_222,
    topHolderPercent: 22.1, isVerified: true, isTrending: true, isNew: false, chain: "solana",
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin", symbol: "USDC", price: 1.0001,
    priceChange1h: 0.01, priceChange24h: 0.02, volume24h: 234_500_000,
    marketCap: 33_200_000_000, liquidity: 890_000_000, holders: 2_345_678,
    txns24h: 456_789, buys24h: 234_567, sells24h: 222_222,
    topHolderPercent: 45.2, isVerified: true, isTrending: false, isNew: false, chain: "solana",
  },
  {
    address: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p91oHNd",
    name: "Wen Token", symbol: "WEN", price: 0.000089,
    priceChange1h: 8.45, priceChange24h: 42.31, volume24h: 12_300_000,
    marketCap: 78_900_000, liquidity: 3_400_000, holders: 89_345,
    txns24h: 34_567, buys24h: 22_345, sells24h: 12_222,
    topHolderPercent: 28.7, isVerified: false, isTrending: true, isNew: false, chain: "solana",
  },
  {
    address: "RNDRzEMKWReM2NfJpSY5tfQkri1oeV9pwLoGqYF2sJe",
    name: "Render Token", symbol: "RNDR", price: 7.82,
    priceChange1h: -1.23, priceChange24h: -3.45, volume24h: 67_800_000,
    marketCap: 2_940_000_000, liquidity: 45_600_000, holders: 234_567,
    txns24h: 56_789, buys24h: 23_456, sells24h: 33_333,
    topHolderPercent: 31.2, isVerified: true, isTrending: false, isNew: false, chain: "solana",
  },
  {
    address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    name: "Marinade Staked SOL", symbol: "mSOL", price: 178.45,
    priceChange1h: 0.45, priceChange24h: 2.12, volume24h: 23_400_000,
    marketCap: 780_000_000, liquidity: 156_000_000, holders: 67_890,
    txns24h: 12_345, buys24h: 7_890, sells24h: 4_455,
    topHolderPercent: 35.6, isVerified: true, isTrending: false, isNew: false, chain: "solana",
  },
  {
    address: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
    name: "Cat in a Dogs World", symbol: "MEW", price: 0.00456,
    priceChange1h: 12.34, priceChange24h: 67.89, volume24h: 34_500_000,
    marketCap: 456_000_000, liquidity: 8_900_000, holders: 123_456,
    txns24h: 78_901, buys24h: 56_789, sells24h: 22_112,
    topHolderPercent: 15.3, isVerified: false, isTrending: true, isNew: true, chain: "solana",
  },
  {
    address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    name: "Popcat", symbol: "POPCAT", price: 0.89,
    priceChange1h: 5.67, priceChange24h: 23.45, volume24h: 56_700_000,
    marketCap: 890_000_000, liquidity: 12_300_000, holders: 198_765,
    txns24h: 45_678, buys24h: 29_876, sells24h: 15_802,
    topHolderPercent: 19.8, isVerified: true, isTrending: true, isNew: false, chain: "solana",
  },
  {
    address: "DtR9D2mtRcAeJBW7ixSNsT5sZEM9z8MqAadBJE1fNe6P",
    name: "Phantom Airdrop", symbol: "PHNTM", price: 0.000023,
    priceChange1h: -5.67, priceChange24h: -12.34, volume24h: 890_000,
    marketCap: 2_300_000, liquidity: 120_000, holders: 3_456,
    txns24h: 1_234, buys24h: 456, sells24h: 778,
    topHolderPercent: 67.8, isVerified: false, isTrending: false, isNew: true, chain: "solana",
  },
  {
    address: "A3eME5CetyZPBoWbRUwY3tSe25S6tb18ba9ZPbWk9eFJ",
    name: "Pyth Network", symbol: "PYTH", price: 0.42,
    priceChange1h: 1.23, priceChange24h: 8.76, volume24h: 78_900_000,
    marketCap: 2_100_000_000, liquidity: 56_700_000, holders: 345_678,
    txns24h: 67_890, buys24h: 39_876, sells24h: 28_014,
    topHolderPercent: 25.4, isVerified: true, isTrending: false, isNew: false, chain: "solana",
  },
  {
    address: "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y",
    name: "Shadow Token", symbol: "SHDW", price: 0.78,
    priceChange1h: -2.34, priceChange24h: -8.91, volume24h: 5_600_000,
    marketCap: 67_800_000, liquidity: 4_500_000, holders: 23_456,
    txns24h: 5_678, buys24h: 2_345, sells24h: 3_333,
    topHolderPercent: 38.9, isVerified: true, isTrending: false, isNew: false, chain: "solana",
  },
  {
    address: "NeonTjSjsuo3rexg9o6vHuMXw62f9V7zvmu8M8Zut44",
    name: "NeonSOL", symbol: "NEON", price: 0.000567,
    priceChange1h: 34.56, priceChange24h: 156.78, volume24h: 2_300_000,
    marketCap: 5_600_000, liquidity: 340_000, holders: 5_678,
    txns24h: 8_901, buys24h: 7_890, sells24h: 1_011,
    topHolderPercent: 42.1, isVerified: false, isTrending: true, isNew: true, chain: "solana",
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    name: "Wrapped Ether", symbol: "WETH", price: 3245.67,
    priceChange1h: 0.45, priceChange24h: 2.34, volume24h: 2_340_000_000,
    marketCap: 389_000_000_000, liquidity: 12_000_000_000, holders: 8_900_000,
    txns24h: 3_456_789, buys24h: 1_890_000, sells24h: 1_566_789,
    topHolderPercent: 8.5, isVerified: true, isTrending: false, isNew: false, chain: "ethereum",
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    name: "Tether USD", symbol: "USDT", price: 1.0001,
    priceChange1h: 0.01, priceChange24h: -0.02, volume24h: 45_000_000_000,
    marketCap: 120_000_000_000, liquidity: 8_900_000_000, holders: 5_600_000,
    txns24h: 5_678_901, buys24h: 2_890_000, sells24h: 2_788_901,
    topHolderPercent: 12.3, isVerified: true, isTrending: false, isNew: false, chain: "ethereum",
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    name: "Dai Stablecoin", symbol: "DAI", price: 0.9999,
    priceChange1h: 0.00, priceChange24h: 0.01, volume24h: 234_000_000,
    marketCap: 5_300_000_000, liquidity: 2_100_000_000, holders: 890_000,
    txns24h: 234_567, buys24h: 123_456, sells24h: 111_111,
    topHolderPercent: 18.9, isVerified: true, isTrending: false, isNew: false, chain: "ethereum",
  },
  {
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    name: "Chainlink", symbol: "LINK", price: 18.45,
    priceChange1h: 1.23, priceChange24h: 5.67, volume24h: 890_000_000,
    marketCap: 11_200_000_000, liquidity: 1_230_000_000, holders: 734_000,
    txns24h: 345_678, buys24h: 189_000, sells24h: 156_678,
    topHolderPercent: 22.1, isVerified: true, isTrending: true, isNew: false, chain: "ethereum",
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    name: "Uniswap", symbol: "UNI", price: 12.34,
    priceChange1h: -0.56, priceChange24h: 3.21, volume24h: 567_000_000,
    marketCap: 7_400_000_000, liquidity: 890_000_000, holders: 456_000,
    txns24h: 234_567, buys24h: 134_000, sells24h: 100_567,
    topHolderPercent: 25.6, isVerified: true, isTrending: false, isNew: false, chain: "ethereum",
  },
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USD Coin (Base)", symbol: "USDC", price: 1.0000,
    priceChange1h: 0.00, priceChange24h: 0.01, volume24h: 890_000_000,
    marketCap: 33_000_000_000, liquidity: 4_500_000_000, holders: 1_200_000,
    txns24h: 1_234_567, buys24h: 678_901, sells24h: 555_666,
    topHolderPercent: 15.4, isVerified: true, isTrending: false, isNew: false, chain: "base",
  },
  {
    address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    name: "Brett", symbol: "BRETT", price: 0.0234,
    priceChange1h: 8.90, priceChange24h: 45.67, volume24h: 78_000_000,
    marketCap: 2_340_000_000, liquidity: 45_000_000, holders: 234_000,
    txns24h: 123_456, buys24h: 89_000, sells24h: 34_456,
    topHolderPercent: 18.9, isVerified: true, isTrending: true, isNew: false, chain: "base",
  },
  {
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    name: "Degen", symbol: "DEGEN", price: 0.0089,
    priceChange1h: 3.45, priceChange24h: 12.34, volume24h: 34_000_000,
    marketCap: 123_000_000, liquidity: 12_000_000, holders: 189_000,
    txns24h: 78_901, buys24h: 56_789, sells24h: 22_112,
    topHolderPercent: 21.3, isVerified: false, isTrending: true, isNew: false, chain: "base",
  },
  {
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    name: "Wrapped BNB", symbol: "WBNB", price: 612.45,
    priceChange1h: 0.32, priceChange24h: 2.87, volume24h: 890_000_000,
    marketCap: 94_500_000_000, liquidity: 2_340_000_000, holders: 4_567_890,
    txns24h: 1_234_567, buys24h: 678_901, sells24h: 555_666,
    topHolderPercent: 12.3, isVerified: true, isTrending: false, isNew: false, chain: "bsc",
  },
  {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    name: "PancakeSwap", symbol: "CAKE", price: 2.87,
    priceChange1h: -0.45, priceChange24h: 4.56, volume24h: 78_900_000,
    marketCap: 890_000_000, liquidity: 123_000_000, holders: 1_234_567,
    txns24h: 234_567, buys24h: 145_678, sells24h: 88_889,
    topHolderPercent: 18.7, isVerified: true, isTrending: true, isNew: false, chain: "bsc",
  },
  {
    address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    name: "Binance-Peg ETH", symbol: "ETH", price: 3245.67,
    priceChange1h: 0.12, priceChange24h: 1.89, volume24h: 456_000_000,
    marketCap: 389_000_000_000, liquidity: 5_670_000_000, holders: 2_345_678,
    txns24h: 567_890, buys24h: 345_678, sells24h: 222_212,
    topHolderPercent: 25.4, isVerified: true, isTrending: false, isNew: false, chain: "bsc",
  },
  {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    name: "BSC USDC", symbol: "USDC", price: 1.0002,
    priceChange1h: 0.01, priceChange24h: -0.01, volume24h: 345_000_000,
    marketCap: 12_000_000_000, liquidity: 890_000_000, holders: 890_123,
    txns24h: 123_456, buys24h: 67_890, sells24h: 55_566,
    topHolderPercent: 35.6, isVerified: true, isTrending: false, isNew: false, chain: "bsc",
  },
  {
    address: "0x76A797A59Ba2C17726896976B7B3747BfD1d220f",
    name: "Baby Doge", symbol: "BABYDOGE", price: 0.0000000023,
    priceChange1h: 5.67, priceChange24h: 34.56, volume24h: 23_400_000,
    marketCap: 345_000_000, liquidity: 12_300_000, holders: 1_890_000,
    txns24h: 89_012, buys24h: 56_789, sells24h: 32_223,
    topHolderPercent: 22.1, isVerified: false, isTrending: true, isNew: false, chain: "bsc",
  },
  {
    address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
    name: "Venus", symbol: "XVS", price: 9.34,
    priceChange1h: -1.23, priceChange24h: -5.67, volume24h: 12_300_000,
    marketCap: 156_000_000, liquidity: 34_500_000, holders: 123_456,
    txns24h: 23_456, buys24h: 12_345, sells24h: 11_111,
    topHolderPercent: 28.9, isVerified: true, isTrending: false, isNew: false, chain: "bsc",
  },
  {
    address: "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR",
    name: "Wrapped TRX", symbol: "WTRX", price: 0.1234,
    priceChange1h: 0.89, priceChange24h: 3.45, volume24h: 567_000_000,
    marketCap: 10_800_000_000, liquidity: 1_230_000_000, holders: 8_900_000,
    txns24h: 2_345_678, buys24h: 1_234_567, sells24h: 1_111_111,
    topHolderPercent: 15.6, isVerified: true, isTrending: false, isNew: false, chain: "tron",
  },
  {
    address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    name: "Tether (TRC20)", symbol: "USDT", price: 1.0001,
    priceChange1h: 0.0, priceChange24h: 0.01, volume24h: 1_200_000_000,
    marketCap: 62_000_000_000, liquidity: 12_300_000_000, holders: 12_345_678,
    txns24h: 5_678_901, buys24h: 3_456_789, sells24h: 2_222_112,
    topHolderPercent: 8.9, isVerified: true, isTrending: false, isNew: false, chain: "tron",
  },
  {
    address: "TKkeiboTkxXKJpbmVFbv4a8ov5rAfRDMf9",
    name: "SunSwap", symbol: "SUN", price: 0.0234,
    priceChange1h: 2.34, priceChange24h: 12.56, volume24h: 45_600_000,
    marketCap: 456_000_000, liquidity: 78_900_000, holders: 345_678,
    txns24h: 89_012, buys24h: 56_789, sells24h: 32_223,
    topHolderPercent: 32.1, isVerified: true, isTrending: true, isNew: false, chain: "tron",
  },
  {
    address: "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
    name: "WINkLink", symbol: "WIN", price: 0.000123,
    priceChange1h: -3.45, priceChange24h: -8.90, volume24h: 12_300_000,
    marketCap: 123_000_000, liquidity: 23_400_000, holders: 567_890,
    txns24h: 34_567, buys24h: 18_765, sells24h: 15_802,
    topHolderPercent: 25.4, isVerified: true, isTrending: false, isNew: false, chain: "tron",
  },
  {
    address: "TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4",
    name: "BitTorrent", symbol: "BTT", price: 0.00000089,
    priceChange1h: 8.90, priceChange24h: 45.67, volume24h: 34_500_000,
    marketCap: 890_000_000, liquidity: 12_300_000, holders: 2_345_678,
    txns24h: 56_789, buys24h: 34_567, sells24h: 22_222,
    topHolderPercent: 18.9, isVerified: true, isTrending: true, isNew: false, chain: "tron",
  },
  {
    address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9",
    name: "JustStable", symbol: "USDJ", price: 0.98,
    priceChange1h: -0.12, priceChange24h: -0.34, volume24h: 5_600_000,
    marketCap: 234_000_000, liquidity: 45_600_000, holders: 89_012,
    txns24h: 12_345, buys24h: 6_789, sells24h: 5_556,
    topHolderPercent: 42.3, isVerified: true, isTrending: false, isNew: false, chain: "tron",
  },
];

const SMART_WALLETS: InsertSmartWallet[] = [
  { address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", label: "Whale Alpha", chain: "solana", pnl7d: 234_500, pnl30d: 1_890_000, winRate: 78.5, totalTrades: 1234, avgTradeSize: 45_000, followers: 8_923, isWhale: true },
  { address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", label: "DeFi Degen", chain: "solana", pnl7d: 89_200, pnl30d: 456_000, winRate: 72.3, totalTrades: 3456, avgTradeSize: 12_000, followers: 5_432, isWhale: false },
  { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", label: "Smart Money #1", chain: "solana", pnl7d: 567_800, pnl30d: 3_200_000, winRate: 82.1, totalTrades: 890, avgTradeSize: 120_000, followers: 15_678, isWhale: true },
  { address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", label: "Sniper Bot X", chain: "solana", pnl7d: -23_400, pnl30d: 678_000, winRate: 65.8, totalTrades: 5678, avgTradeSize: 5_000, followers: 3_210, isWhale: false },
  { address: "HN7cABqLq46Es1jh92dQQisAi5YqhB3GbRNb6fEX7BaL", label: "Insider Trader", chain: "solana", pnl7d: 1_230_000, pnl30d: 8_900_000, winRate: 91.2, totalTrades: 234, avgTradeSize: 500_000, followers: 23_456, isWhale: true },
  { address: "3Kz1nG7rB4xJPBZZjHnCp2HXKB6FVUDhQkjY5JCqC5o", label: "MEV Hunter", chain: "solana", pnl7d: 456_000, pnl30d: 2_100_000, winRate: 88.4, totalTrades: 12345, avgTradeSize: 8_000, followers: 12_345, isWhale: true },
  { address: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crLFEkFd8k", label: "Pump Master", chain: "solana", pnl7d: 178_900, pnl30d: 890_000, winRate: 69.5, totalTrades: 4567, avgTradeSize: 15_000, followers: 7_890, isWhale: false },
  { address: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T", label: "KOL Wallet", chain: "solana", pnl7d: 345_600, pnl30d: 1_560_000, winRate: 74.8, totalTrades: 2345, avgTradeSize: 25_000, followers: 34_567, isWhale: true },
];

function generatePriceHistory(basePrice: number, tokenId: number, points: number = 168): InsertPriceHistory[] {
  const history: InsertPriceHistory[] = [];
  let price = basePrice * (0.7 + Math.random() * 0.3);

  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.45) * 0.08;
    price = price * (1 + change);
    if (price <= 0) price = basePrice * 0.01;
    history.push({ tokenId, price, volume: Math.random() * basePrice * 100000 });
  }
  return history;
}

export async function seedDatabase() {
  const count = await storage.getTokenCount();
  if (count > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with token data...");

  const createdTokens: { id: number; price: number }[] = [];

  for (const tokenData of SEED_TOKENS) {
    const token = await storage.createToken(tokenData);
    createdTokens.push({ id: token.id, price: token.price });

    const now = Date.now();
    const points = 168;
    const intervalMs = (7 * 24 * 60 * 60 * 1000) / points;
    const priceHistoryEntries = generatePriceHistory(token.price, token.id, points);
    for (let i = 0; i < priceHistoryEntries.length; i++) {
      const timestamp = new Date(now - (points - i) * intervalMs);
      await storage.addPriceHistoryWithTimestamp(priceHistoryEntries[i], timestamp);
    }

    const tradeCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < tradeCount; i++) {
      const isBuy = Math.random() > 0.4;
      const amount = Math.random() * 10;
      await storage.createTrade({
        tokenId: token.id,
        type: isBuy ? "buy" : "sell",
        amount,
        price: token.price,
        total: amount * token.price,
        wallet: `${Math.random().toString(36).slice(2, 6)}...${Math.random().toString(36).slice(2, 6)}`,
      });
    }

    const isGoodToken = tokenData.isVerified || false;
    const safetyScore = isGoodToken ? 60 + Math.random() * 35 : 10 + Math.random() * 50;
    await storage.createSafetyReport({
      tokenId: token.id,
      overallScore: safetyScore,
      honeypotRisk: isGoodToken ? Math.random() * 15 : 20 + Math.random() * 60,
      lpLocked: isGoodToken ? Math.random() > 0.2 : Math.random() > 0.7,
      lpLockDays: isGoodToken ? 90 + Math.floor(Math.random() * 275) : Math.floor(Math.random() * 30),
      contractVerified: isGoodToken ? true : Math.random() > 0.5,
      mintAuthority: isGoodToken ? false : Math.random() > 0.6,
      freezeAuthority: isGoodToken ? false : Math.random() > 0.7,
      topHolderConcentration: tokenData.topHolderPercent || 20,
      top10HolderPercent: (tokenData.topHolderPercent || 20) + Math.random() * 15,
      devHolding: isGoodToken ? Math.random() * 3 : 5 + Math.random() * 20,
      socialScore: isGoodToken ? 50 + Math.random() * 45 : Math.random() * 40,
    });
  }

  for (const walletData of SMART_WALLETS) {
    const wallet = await storage.createSmartWallet(walletData);

    const holdingCount = 2 + Math.floor(Math.random() * 4);
    const usedTokens = new Set<number>();
    for (let i = 0; i < holdingCount && i < createdTokens.length; i++) {
      let tokenIdx = Math.floor(Math.random() * createdTokens.length);
      while (usedTokens.has(tokenIdx)) tokenIdx = (tokenIdx + 1) % createdTokens.length;
      usedTokens.add(tokenIdx);

      const t = createdTokens[tokenIdx];
      const amount = (1 + Math.random() * 100) * (walletData.isWhale ? 100 : 1);
      const avgCost = t.price * (0.6 + Math.random() * 0.6);
      const currentValue = amount * t.price;
      const unrealizedPnl = currentValue - amount * avgCost;

      await storage.createWalletHolding({
        walletId: wallet.id,
        tokenId: t.id,
        amount,
        avgCost,
        currentValue,
        unrealizedPnl,
      });
    }

    const tradeCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < tradeCount; i++) {
      const t = createdTokens[Math.floor(Math.random() * createdTokens.length)];
      const isBuy = Math.random() > 0.4;
      const amount = (1 + Math.random() * 50) * (walletData.isWhale ? 50 : 1);
      await storage.createWalletTrade({
        walletId: wallet.id,
        tokenId: t.id,
        type: isBuy ? "buy" : "sell",
        amount,
        price: t.price,
        total: amount * t.price,
      });
    }
  }

  const positionTokens = createdTokens.slice(0, 6);
  for (const t of positionTokens) {
    const size = 0.5 + Math.random() * 20;
    const avgEntry = t.price * (0.5 + Math.random() * 0.8);
    const currentPrice = t.price;
    const pnlPercent = ((currentPrice - avgEntry) / avgEntry) * 100;
    const unrealizedPnl = (currentPrice - avgEntry) * size;

    await storage.createPosition({
      tokenId: t.id,
      size,
      avgEntry,
      currentPrice,
      unrealizedPnl,
      unrealizedPnlPercent: pnlPercent,
      realizedPnl: (Math.random() - 0.3) * 500,
      chain: "solana",
    });
  }

  console.log(`Seeded ${SEED_TOKENS.length} tokens, ${SMART_WALLETS.length} wallets, safety reports, and positions`);
}
