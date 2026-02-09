import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { insertWatchlistSchema, insertTradeSchema, insertCopyTradeConfigSchema, insertSniperRuleSchema, insertAiAgentSchema, insertPriceAlertSchema, insertLimitOrderSchema, insertDcaConfigSchema, insertReferralSchema } from "@shared/schema";
import { seedDatabase } from "./seed";
// Agent runner disabled - only real on-chain trades
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./integrations/auth";
import { getLiveMemeTokens, filterAndSortMemes, getLiveTokenById, fetchLiveOHLCV, preWarmOHLCV, type OHLCVCandle } from "./live-memes";
import { Keypair } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { executeSolanaSwap, executeEvmSwap } from "./onchain-swap";
import { getTokenSecurity, isSupportedChain, type TokenSecurityResult } from "./goplus";
import { getSolanaTokenHolders, formatSolanaHolders, formatSolanaInsiders } from "./solana-holders";
import { getSignalPerformanceReport } from "./ai/agent-runner";
import { getNewsSignals, getOverallMarketNewsSentiment } from "./news-scanner";
import { getFearGreedSignal } from "./fear-greed";
import { getMarketLiquidityFlow } from "./liquidity-tracker";

const DEXSCREENER_API = "https://api.dexscreener.com";
const JUPITER_API = "https://lite-api.jup.ag/swap/v1";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  seedDatabase().catch((err) => console.error("Seeding error:", err));

  getLiveMemeTokens().then(() => {
    preWarmOHLCV().catch(() => {});
  }).catch(() => {});

  app.get("/api/tokens", async (req, res) => {
    try {
      let tokens = await storage.getTokens();
      const { chain, minMcap, maxMcap, minVolume, maxVolume, minHolders, minLiquidity } = req.query;
      if (chain && chain !== "all") tokens = tokens.filter(t => t.chain === chain);
      if (minMcap) tokens = tokens.filter(t => (t.marketCap ?? 0) >= Number(minMcap));
      if (maxMcap) tokens = tokens.filter(t => (t.marketCap ?? 0) <= Number(maxMcap));
      if (minVolume) tokens = tokens.filter(t => (t.volume24h ?? 0) >= Number(minVolume));
      if (maxVolume) tokens = tokens.filter(t => (t.volume24h ?? 0) <= Number(maxVolume));
      if (minHolders) tokens = tokens.filter(t => (t.holders ?? 0) >= Number(minHolders));
      if (minLiquidity) tokens = tokens.filter(t => (t.liquidity ?? 0) >= Number(minLiquidity));
      res.json(tokens);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  app.get("/api/tokens/memes", async (req, res) => {
    try {
      const { chain, launchpad, graduated, sortBy } = req.query;
      const liveTokens = await getLiveMemeTokens();
      const filtered = filterAndSortMemes(liveTokens, {
        chain: chain as string,
        launchpad: launchpad as string,
        graduated: graduated as string,
        sortBy: sortBy as string,
      });
      res.json(filtered);
    } catch (err) {
      console.error("Meme tokens fetch error:", err);
      res.status(500).json({ message: "Failed to fetch meme tokens" });
    }
  });

  app.get("/api/tokens/:id", async (req, res) => {
    try {
      const token = await storage.getToken(parseInt(req.params.id as string));
      if (!token) return res.status(404).json({ message: "Token not found" });
      res.json(token);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch token" });
    }
  });

  const holdersCache = new Map<string, { data: any; timestamp: number }>();
  const insidersCache = new Map<string, { data: any; timestamp: number }>();
  const HOLDER_CACHE_TTL = 60_000;

  function generateSolanaAddress(): string {
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const len = 32 + Math.floor(Math.random() * 12);
    let addr = "";
    for (let i = 0; i < len; i++) addr += chars[Math.floor(Math.random() * chars.length)];
    return addr;
  }

  function generateEvmAddress(): string {
    let addr = "0x";
    const hex = "0123456789abcdef";
    for (let i = 0; i < 40; i++) addr += hex[Math.floor(Math.random() * 16)];
    return addr;
  }

  function generateAddress(chain: string): string {
    return chain === "solana" ? generateSolanaAddress() : generateEvmAddress();
  }

  function randomTimestampWithinDays(days: number): string {
    const now = Date.now();
    return new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString();
  }

  interface ResolvedToken {
    chain: string;
    price: number;
    marketCap: number;
    topHolderPercent: number;
    holders: number;
    contractAddress: string | null;
  }

  async function resolveTokenData(tokenId: string): Promise<ResolvedToken | null> {
    if (tokenId.startsWith("live-")) {
      let liveToken = getLiveTokenById(tokenId);
      if (!liveToken) {
        await getLiveMemeTokens();
        liveToken = getLiveTokenById(tokenId);
      }
      if (!liveToken) return null;

      let price = liveToken.price;
      let marketCap = liveToken.marketCap ?? 0;
      let topHolderPercent = 0;
      let holders = liveToken.holders ?? 500;

      if (liveToken.pairAddress) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const resp = await fetch(`${DEXSCREENER_API}/latest/dex/pairs/${liveToken.chain}/${liveToken.pairAddress}`, { signal: controller.signal });
          clearTimeout(timer);
          if (resp.ok) {
            const data = await resp.json();
            if (data?.pair) {
              price = parseFloat(data.pair.priceUsd || "0") || price;
              marketCap = data.pair.marketCap ?? data.pair.fdv ?? marketCap;
            }
          }
        } catch {}
      }

      if (marketCap > 0) {
        topHolderPercent = marketCap > 1_000_000 ? 15 + Math.random() * 20 : 25 + Math.random() * 30;
      } else {
        topHolderPercent = 30 + Math.random() * 25;
      }

      return { chain: liveToken.chain, price, marketCap, topHolderPercent, holders, contractAddress: liveToken.address };
    }

    const numId = parseInt(tokenId);
    if (isNaN(numId)) return null;
    const token = await storage.getToken(numId);
    if (!token) return null;
    return {
      chain: token.chain ?? "solana",
      price: token.price,
      marketCap: token.marketCap ?? 0,
      topHolderPercent: token.topHolderPercent ?? 25,
      holders: token.holders ?? 500,
      contractAddress: token.address ?? null,
    };
  }

  app.get("/api/tokens/:id/holders", async (req, res) => {
    try {
      const tokenId = req.params.id;
      const cached = holdersCache.get(tokenId);
      if (cached && Date.now() - cached.timestamp < HOLDER_CACHE_TTL) {
        return res.json(cached.data);
      }

      const tokenData = await resolveTokenData(tokenId);
      if (!tokenData) return res.status(404).json({ message: "Token not found" });

      const { chain, marketCap, contractAddress } = tokenData;

      if (contractAddress && isSupportedChain(chain)) {
        try {
          const security = await getTokenSecurity(chain, contractAddress);
          if (security && security.topHolders.length > 0) {
            const holdersList = security.topHolders.slice(0, 10).map((h, i) => {
              const rank = i + 1;
              let type: "dev" | "insider" | "whale" | "holder" = "holder";
              let label: string | undefined;

              if (h.address.toLowerCase() === security.creatorAddress.toLowerCase()) {
                type = "dev";
                label = "Deployer";
              } else if (h.tag) {
                label = h.tag;
                type = h.isContract ? "insider" : "whale";
              } else if (h.percent > 5) {
                type = "whale";
                label = `Whale #${rank}`;
              } else if (rank <= 5) {
                type = "insider";
              }

              return {
                rank,
                address: h.address,
                percentage: Math.round(h.percent * 100) / 100,
                value: Math.round((h.percent / 100) * marketCap * 100) / 100,
                type,
                label: label || (h.isContract ? "Contract" : undefined),
                lastActivity: null,
                isLocked: h.isLocked,
                source: "goplus" as const,
              };
            });

            const top10Percent = holdersList.reduce((sum, h) => sum + h.percentage, 0);
            const whaleCount = holdersList.filter(h => h.type === "whale" || h.type === "dev").length;
            const insiderCount = holdersList.filter(h => h.type === "insider").length;

            const result = {
              holders: holdersList,
              totalHolders: security.holderCount || tokenData.holders,
              whaleCount,
              insiderCount,
              top10Percent: Math.round(top10Percent * 100) / 100,
              top20Percent: Math.round(Math.min(top10Percent * 1.4, 95) * 100) / 100,
              source: "goplus",
              creatorAddress: security.creatorAddress,
              creatorPercent: security.creatorPercent,
            };

            holdersCache.set(tokenId, { data: result, timestamp: Date.now() });
            return res.json(result);
          }
        } catch (err) {
          console.log(`[Holders] GoPlus fallback for ${tokenId}:`, (err as Error).message);
        }
      }

      if (chain === "solana" && contractAddress) {
        try {
          const solanaData = await getSolanaTokenHolders(contractAddress);
          if (solanaData && solanaData.holders.length > 0) {
            const formatted = formatSolanaHolders(solanaData, marketCap, chain);
            const result = {
              ...formatted,
              totalHolders: tokenData.holders || formatted.holders.length,
            };
            holdersCache.set(tokenId, { data: result, timestamp: Date.now() });
            return res.json(result);
          }
        } catch (err) {
          console.log(`[Holders] Solana RPC fallback for ${tokenId}:`, (err as Error).message);
        }
      }

      res.status(404).json({ message: "Holder data not available for this token. Real on-chain data requires a supported chain (EVM via GoPlus, Solana via RPC).", source: "none" });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch holder data" });
    }
  });

  app.get("/api/tokens/:id/insiders", async (req, res) => {
    try {
      const tokenId = req.params.id;
      const cached = insidersCache.get(tokenId);
      if (cached && Date.now() - cached.timestamp < HOLDER_CACHE_TTL) {
        return res.json(cached.data);
      }

      const tokenData = await resolveTokenData(tokenId);
      if (!tokenData) return res.status(404).json({ message: "Token not found" });

      const { chain, price, marketCap, contractAddress } = tokenData;

      if (contractAddress && isSupportedChain(chain)) {
        try {
          const security = await getTokenSecurity(chain, contractAddress);
          if (security) {
            const insiders: any[] = [];

            if (security.creatorAddress) {
              insiders.push({
                address: security.creatorAddress,
                type: "dev",
                percentage: Math.round(security.creatorPercent * 100) / 100,
                value: Math.round((security.creatorPercent / 100) * marketCap * 100) / 100,
                buyPrice: null,
                currentPnl: null,
                lastTx: null,
                txCount: null,
                source: "goplus",
              });
            }

            const contractHolders = security.topHolders.filter(h => h.isContract && h.address.toLowerCase() !== security.creatorAddress.toLowerCase());
            contractHolders.slice(0, 4).forEach(h => {
              insiders.push({
                address: h.address,
                type: h.isLocked ? "locked_contract" : "contract_holder",
                percentage: Math.round(h.percent * 100) / 100,
                value: Math.round((h.percent / 100) * marketCap * 100) / 100,
                buyPrice: null,
                currentPnl: null,
                lastTx: null,
                txCount: null,
                tag: h.tag || null,
                source: "goplus",
              });
            });

            const whaleHolders = security.topHolders.filter(h => !h.isContract && h.percent > 2 && h.address.toLowerCase() !== security.creatorAddress.toLowerCase());
            whaleHolders.slice(0, 4).forEach(h => {
              insiders.push({
                address: h.address,
                type: "early_buyer",
                percentage: Math.round(h.percent * 100) / 100,
                value: Math.round((h.percent / 100) * marketCap * 100) / 100,
                buyPrice: null,
                currentPnl: null,
                lastTx: null,
                txCount: null,
                source: "goplus",
              });
            });

            const devEntry = insiders[0] || { address: security.creatorAddress, percentage: security.creatorPercent, lastTx: null };
            const result = {
              insiders,
              devWallet: {
                address: devEntry.address,
                percentage: devEntry.percentage,
                lastActivity: null,
              },
              earlyBuyerCount: whaleHolders.length,
              smartMoneyCount: contractHolders.length,
              source: "goplus",
              contractInfo: {
                isOpenSource: security.isOpenSource,
                isMintable: security.isMintable,
                hasHiddenOwner: security.hasHiddenOwner,
                buyTax: security.buyTax,
                sellTax: security.sellTax,
              },
            };

            insidersCache.set(tokenId, { data: result, timestamp: Date.now() });
            return res.json(result);
          }
        } catch (err) {
          console.log(`[Insiders] GoPlus fallback for ${tokenId}:`, (err as Error).message);
        }
      }

      if (chain === "solana" && contractAddress) {
        try {
          const solanaData = await getSolanaTokenHolders(contractAddress);
          if (solanaData && solanaData.holders.length > 0) {
            const result = formatSolanaInsiders(solanaData, price, marketCap);
            insidersCache.set(tokenId, { data: result, timestamp: Date.now() });
            return res.json(result);
          }
        } catch (err) {
          console.log(`[Insiders] Solana RPC fallback for ${tokenId}:`, (err as Error).message);
        }
      }

      return res.status(404).json({ message: "Insider data not available for this token. Real on-chain data requires a supported chain (EVM via GoPlus, Solana via RPC).", source: "none" });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch insider data" });
    }
  });

  app.get("/api/tokens/:id/price-history/:timeframe", async (req, res) => {
    try {
      const tokenId = req.params.id;
      const timeframe = req.params.timeframe;

      if (tokenId.startsWith("live-")) {
        let liveToken = getLiveTokenById(tokenId);
        if (!liveToken) {
          await getLiveMemeTokens();
          liveToken = getLiveTokenById(tokenId);
        }
        if (!liveToken || !liveToken.pairAddress) {
          return res.json([]);
        }
        const ohlcv = await fetchLiveOHLCV(liveToken.chain, liveToken.pairAddress, timeframe);
        return res.json(ohlcv.map((entry, i) => ({
          id: i,
          tokenId: 0,
          price: entry.c,
          volume: entry.v,
          timestamp: new Date(entry.t * 1000).toISOString(),
        })));
      }

      let hoursBack = 24;
      switch (timeframe) {
        case "1H": hoursBack = 1; break;
        case "4H": hoursBack = 4; break;
        case "1D": hoursBack = 24; break;
        case "1W": hoursBack = 168; break;
      }
      const history = await storage.getPriceHistory(parseInt(tokenId), hoursBack);
      res.json(history);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  app.get("/api/tokens/:id/ohlcv/:timeframe", async (req, res) => {
    try {
      const tokenId = req.params.id;
      const timeframe = req.params.timeframe;

      if (tokenId.startsWith("live-")) {
        let liveToken = getLiveTokenById(tokenId);
        if (!liveToken) {
          await getLiveMemeTokens();
          liveToken = getLiveTokenById(tokenId);
        }
        if (!liveToken || !liveToken.pairAddress) {
          return res.json([]);
        }
        const ohlcv = await fetchLiveOHLCV(liveToken.chain, liveToken.pairAddress, timeframe);
        return res.json(ohlcv);
      }

      let hoursBack = 24;
      switch (timeframe) {
        case "1H": hoursBack = 1; break;
        case "4H": hoursBack = 4; break;
        case "1D": hoursBack = 24; break;
        case "1W": hoursBack = 168; break;
      }
      const history = await storage.getPriceHistory(parseInt(tokenId), hoursBack);

      const interval = timeframe === "1H" ? 60_000 : timeframe === "4H" ? 5 * 60_000 : 15 * 60_000;
      const buckets = new Map<number, OHLCVCandle>();
      for (const entry of history) {
        const ts = new Date(entry.timestamp!).getTime();
        const key = Math.floor(ts / interval) * interval;
        const existing = buckets.get(key);
        if (existing) {
          existing.h = Math.max(existing.h, entry.price);
          existing.l = Math.min(existing.l, entry.price);
          existing.c = entry.price;
          existing.v += entry.volume ?? 0;
        } else {
          buckets.set(key, { t: Math.floor(key / 1000), o: entry.price, h: entry.price, l: entry.price, c: entry.price, v: entry.volume ?? 0 });
        }
      }

      const candles = Array.from(buckets.values()).sort((a, b) => a.t - b.t);
      for (const c of candles) {
        if (c.h === c.l) {
          const wick = c.c * 0.003;
          c.h += wick;
          c.l -= wick;
        }
      }
      res.json(candles);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch OHLCV data" });
    }
  });

  app.get("/api/watchlist", isAuthenticated, async (_req, res) => {
    try {
      const items = await storage.getWatchlist();
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertWatchlistSchema.parse(req.body);
      const item = await storage.addToWatchlist(parsed);
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/watchlist/:tokenId", isAuthenticated, async (req, res) => {
    try {
      await storage.removeFromWatchlist(parseInt(req.params.tokenId as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  app.get("/api/trades", async (_req, res) => {
    try {
      const tradeList = await storage.getTrades(100);
      res.json(tradeList);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  app.get("/api/tokens/:id/trades", async (req, res) => {
    try {
      const tokenId = req.params.id;

      if (tokenId.startsWith("live-")) {
        return res.json([]);
      }

      const tokenTrades = await storage.getTradesByToken(parseInt(tokenId));
      res.json(tokenTrades);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch token trades" });
    }
  });

  app.post("/api/trades", isAuthenticated, async (_req, res) => {
    return res.status(400).json({ message: "Direct trade recording disabled. Use instant trading with a funded wallet for real on-chain swaps." });
  });

  app.get("/api/smart-wallets", async (_req, res) => {
    try {
      const wallets = await storage.getSmartWallets();
      res.json(wallets);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch smart wallets" });
    }
  });

  app.get("/api/smart-wallets/:id", async (req, res) => {
    try {
      const wallet = await storage.getSmartWallet(parseInt(req.params.id as string));
      if (!wallet) return res.status(404).json({ message: "Wallet not found" });
      res.json(wallet);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  app.get("/api/smart-wallets/:id/holdings", async (req, res) => {
    try {
      const holdings = await storage.getWalletHoldings(parseInt(req.params.id as string));
      res.json(holdings);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch holdings" });
    }
  });

  app.get("/api/smart-wallets/:id/trades", async (req, res) => {
    try {
      const walletTrades = await storage.getWalletTrades(parseInt(req.params.id as string));
      res.json(walletTrades);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wallet trades" });
    }
  });

  app.get("/api/copy-trades", isAuthenticated, async (_req, res) => {
    try {
      const configs = await storage.getCopyTradeConfigs();
      res.json(configs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch copy trade configs" });
    }
  });

  app.post("/api/copy-trades", isAuthenticated, requireFeature("maxCopyTrades", "Copy Trading"), async (req, res) => {
    try {
      const { limits, tier } = (req as any).tierInfo;
      const existing = await storage.getCopyTradeConfigs();
      if (existing.length >= limits.maxCopyTrades) {
        return res.status(403).json({ message: `Your ${tier} plan allows ${limits.maxCopyTrades} copy trade config(s). Upgrade for more.`, code: "LIMIT_REACHED" });
      }
      const parsed = insertCopyTradeConfigSchema.parse(req.body);
      const config = await storage.createCopyTradeConfig(parsed);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.patch("/api/copy-trades/:id", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.updateCopyTradeConfig(parseInt(req.params.id as string), req.body);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/copy-trades/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCopyTradeConfig(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete config" });
    }
  });

  app.get("/api/sniper-rules", isAuthenticated, async (_req, res) => {
    try {
      const rules = await storage.getSniperRules();
      res.json(rules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sniper rules" });
    }
  });

  app.post("/api/sniper-rules", isAuthenticated, requireFeature("maxSniperRules", "Sniper Mode"), async (req, res) => {
    try {
      const { limits, tier } = (req as any).tierInfo;
      const existing = await storage.getSniperRules();
      if (existing.length >= limits.maxSniperRules) {
        return res.status(403).json({ message: `Your ${tier} plan allows ${limits.maxSniperRules} sniper rule(s). Upgrade for more.`, code: "LIMIT_REACHED" });
      }
      const parsed = insertSniperRuleSchema.parse(req.body);
      const rule = await storage.createSniperRule(parsed);
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.patch("/api/sniper-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const rule = await storage.updateSniperRule(parseInt(req.params.id as string), req.body);
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/sniper-rules/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteSniperRule(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete rule" });
    }
  });

  app.get("/api/positions", isAuthenticated, async (_req, res) => {
    try {
      const positionList = await storage.getPositions();
      res.json(positionList);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.get("/api/safety/:tokenId", async (req, res) => {
    try {
      const report = await storage.getSafetyReport(parseInt(req.params.tokenId as string));
      if (!report) return res.status(404).json({ message: "No safety report found" });
      res.json(report);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch safety report" });
    }
  });

  app.get("/api/safety", async (_req, res) => {
    try {
      const reports = await storage.getSafetyReports();
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch safety reports" });
    }
  });

  app.get("/api/safety/scan/:chain/:address", isAuthenticated, requireFeature("safetyScanner", "Safety Scanner"), async (req, res) => {
    try {
      const { chain, address } = req.params;
      if (!isSupportedChain(chain)) {
        return res.status(400).json({ message: `Chain "${chain}" is not supported for security scanning. Supported: ethereum, bsc, base, arbitrum, polygon, avalanche, optimism` });
      }

      const security = await getTokenSecurity(chain, address);
      if (!security) {
        return res.status(404).json({ message: "Could not retrieve security data for this token" });
      }

      const report = {
        tokenId: null,
        overallScore: security.overallScore,
        honeypotRisk: security.honeypotRisk,
        lpLocked: security.lpLocked,
        lpLockDays: security.lpLockDays,
        contractVerified: security.isOpenSource,
        mintAuthority: security.isMintable,
        freezeAuthority: security.transferPausable,
        topHolderConcentration: security.topHolders.length > 0 ? security.topHolders[0].percent : 0,
        top10HolderPercent: security.topHolders.reduce((sum, h) => sum + h.percent, 0),
        devHolding: security.creatorPercent,
        socialScore: security.isOpenSource ? 60 : 20,
        buyTax: security.buyTax,
        sellTax: security.sellTax,
        isHoneypot: security.isHoneypot,
        hasHiddenOwner: security.hasHiddenOwner,
        canTakeBackOwnership: security.canTakeBackOwnership,
        isAntiWhale: security.isAntiWhale,
        isBlacklisted: security.isBlacklisted,
        holderCount: security.holderCount,
        lpLockPercent: security.lpLockPercent,
        totalLiquidity: security.totalLiquidity,
        topHolders: security.topHolders,
        lpHolders: security.lpHolders,
        dexInfo: security.dexInfo,
        creatorAddress: security.creatorAddress,
        creatorPercent: security.creatorPercent,
        source: "goplus",
      };

      res.json(report);
    } catch (err) {
      console.error("[Safety Scan] Error:", err);
      res.status(500).json({ message: "Failed to scan token security" });
    }
  });

  app.get("/api/safety/scan-token/:tokenId", isAuthenticated, requireFeature("safetyScanner", "Safety Scanner"), async (req, res) => {
    try {
      const tokenId = req.params.tokenId;
      const tokenData = await resolveTokenData(tokenId);
      if (!tokenData) return res.status(404).json({ message: "Token not found" });

      const { chain, contractAddress, marketCap } = tokenData;

      if (!contractAddress || !isSupportedChain(chain)) {
        return res.json({
          overallScore: null,
          source: "unsupported",
          message: chain === "solana" || chain === "tron" ? `${chain} scanning coming soon` : "No contract address available",
        });
      }

      const security = await getTokenSecurity(chain, contractAddress);
      if (!security) {
        return res.json({ overallScore: null, source: "unavailable", message: "Could not retrieve security data" });
      }

      res.json({
        overallScore: security.overallScore,
        honeypotRisk: security.honeypotRisk,
        lpLocked: security.lpLocked,
        lpLockDays: security.lpLockDays,
        contractVerified: security.isOpenSource,
        mintAuthority: security.isMintable,
        freezeAuthority: security.transferPausable,
        topHolderConcentration: security.topHolders.length > 0 ? security.topHolders[0].percent : 0,
        top10HolderPercent: security.topHolders.reduce((sum, h) => sum + h.percent, 0),
        devHolding: security.creatorPercent,
        socialScore: security.isOpenSource ? 60 : 20,
        buyTax: security.buyTax,
        sellTax: security.sellTax,
        isHoneypot: security.isHoneypot,
        hasHiddenOwner: security.hasHiddenOwner,
        holderCount: security.holderCount,
        totalLiquidity: security.totalLiquidity,
        topHolders: security.topHolders.slice(0, 5),
        dexInfo: security.dexInfo,
        creatorAddress: security.creatorAddress,
        creatorPercent: security.creatorPercent,
        source: "goplus",
      });
    } catch (err) {
      console.error("[Safety ScanToken] Error:", err);
      res.status(500).json({ message: "Failed to scan token" });
    }
  });

  app.get("/api/dex/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json({ pairs: [] });
      const resp = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(String(q))}`);
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "DexScreener search failed" });
    }
  });

  app.get("/api/dex/tokens/:address", async (req, res) => {
    try {
      const resp = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${req.params.address}`);
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "DexScreener token fetch failed" });
    }
  });

  app.get("/api/dex/pairs/:chain/:pairAddress", async (req, res) => {
    try {
      const chainMap: Record<string, string> = {
        solana: "solana",
        ethereum: "ethereum",
        base: "base",
        bsc: "bsc",
        tron: "tron",
      };
      const chain = chainMap[req.params.chain] || req.params.chain;
      const resp = await fetch(`${DEXSCREENER_API}/latest/dex/pairs/${chain}/${req.params.pairAddress}`);
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "DexScreener pair fetch failed" });
    }
  });

  app.get("/api/dex/trending", async (_req, res) => {
    try {
      const resp = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`);
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "DexScreener trending fetch failed" });
    }
  });

  app.get("/api/jupiter/quote", async (req, res) => {
    try {
      const { inputMint, outputMint, amount, slippageBps } = req.query;
      if (!inputMint || !outputMint || !amount) {
        return res.status(400).json({ message: "Missing required params: inputMint, outputMint, amount" });
      }
      const params = new URLSearchParams({
        inputMint: String(inputMint),
        outputMint: String(outputMint),
        amount: String(amount),
        slippageBps: String(slippageBps || "50"),
      });
      const resp = await fetch(`${JUPITER_API}/quote?${params}`);
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Jupiter quote failed" });
    }
  });

  app.post("/api/jupiter/swap", async (req, res) => {
    try {
      const resp = await fetch(`${JUPITER_API}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Jupiter swap failed" });
    }
  });

  app.get("/api/jupiter/tokens", async (_req, res) => {
    try {
      const resp = await fetch("https://token.jup.ag/strict");
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Jupiter token list failed" });
    }
  });

  // EVM DEX Router addresses per chain
  const EVM_DEX_CONFIG: Record<string, { rpc: string; router: string; weth: string; chainId: number; explorer: string; name: string }> = {
    ethereum: {
      rpc: "https://eth.llamarpc.com",
      router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      chainId: 1,
      explorer: "https://etherscan.io",
      name: "Uniswap V2",
    },
    base: {
      rpc: "https://mainnet.base.org",
      router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // Uniswap V2 on Base
      weth: "0x4200000000000000000000000000000000000006",
      chainId: 8453,
      explorer: "https://basescan.org",
      name: "Uniswap V2",
    },
    bsc: {
      rpc: "https://bsc-dataseed.binance.org",
      router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
      weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      chainId: 56,
      explorer: "https://bscscan.com",
      name: "PancakeSwap V2",
    },
  };

  // Uniswap V2 Router ABI (swapExactETHForTokens / swapExactTokensForETH)
  const SWAP_ETH_FOR_TOKENS_SELECTOR = "0x7ff36ab5"; // swapExactETHForTokens(uint256,address[],address,uint256)
  const SWAP_TOKENS_FOR_ETH_SELECTOR = "0x18cbafe5"; // swapExactTokensForETH(uint256,uint256,address[],address,uint256)
  const ERC20_APPROVE_SELECTOR = "0x095ea7b3"; // approve(address,uint256)

  function padAddress(addr: string): string {
    return "0x" + addr.replace("0x", "").toLowerCase().padStart(64, "0");
  }

  function padUint256(value: bigint): string {
    return "0x" + value.toString(16).padStart(64, "0");
  }

  function encodeSwapETHForTokens(amountOutMin: bigint, path: string[], to: string, deadline: bigint): string {
    // ABI encode: swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)
    const encoded = [
      SWAP_ETH_FOR_TOKENS_SELECTOR,
      padUint256(amountOutMin).slice(2),        // amountOutMin
      padUint256(BigInt(128)).slice(2),          // offset to path array
      padAddress(to).slice(2),                    // to
      padUint256(deadline).slice(2),              // deadline
      padUint256(BigInt(path.length)).slice(2),   // path length
      ...path.map(p => padAddress(p).slice(2)),   // path addresses
    ].join("");
    return "0x" + encoded.slice(2);
  }

  function encodeSwapTokensForETH(amountIn: bigint, amountOutMin: bigint, path: string[], to: string, deadline: bigint): string {
    const encoded = [
      SWAP_TOKENS_FOR_ETH_SELECTOR,
      padUint256(amountIn).slice(2),
      padUint256(amountOutMin).slice(2),
      padUint256(BigInt(160)).slice(2),           // offset to path array
      padAddress(to).slice(2),
      padUint256(deadline).slice(2),
      padUint256(BigInt(path.length)).slice(2),
      ...path.map(p => padAddress(p).slice(2)),
    ].join("");
    return "0x" + encoded.slice(2);
  }

  function encodeApprove(spender: string, amount: bigint): string {
    return ERC20_APPROVE_SELECTOR + padAddress(spender).slice(2) + padUint256(amount).slice(2);
  }

  const ERC20_DECIMALS_SELECTOR = "0x313ce567";

  async function fetchTokenDecimals(tokenAddress: string, rpcUrl: string): Promise<number> {
    try {
      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: tokenAddress, data: ERC20_DECIMALS_SELECTOR }, "latest"],
          id: 1,
        }),
      });
      const data = await resp.json();
      if (data.result && data.result !== "0x") {
        return Number(BigInt(data.result));
      }
    } catch {}
    return 18;
  }

  // GET /api/evm/quote - Get EVM DEX swap quote
  app.get("/api/evm/quote", async (req, res) => {
    try {
      const { chain, tokenAddress, amount, side } = req.query;
      if (!chain || !tokenAddress || !amount) {
        return res.status(400).json({ message: "Missing params: chain, tokenAddress, amount" });
      }

      const config = EVM_DEX_CONFIG[String(chain)];
      if (!config) {
        return res.status(400).json({ message: `Unsupported chain: ${chain}. Supported: ethereum, base, bsc` });
      }

      const tokenDecimals = await fetchTokenDecimals(String(tokenAddress), config.rpc);
      const isBuy = String(side) !== "sell";
      const inputDecimals = isBuy ? 18 : tokenDecimals;
      const amountWei = BigInt(Math.round(parseFloat(String(amount)) * Math.pow(10, inputDecimals)));
      const path = isBuy
        ? [config.weth, String(tokenAddress)]
        : [String(tokenAddress), config.weth];

      // Call getAmountsOut on the router to estimate output
      const getAmountsOutSelector = "0xd06ca61f";
      const calldata = [
        getAmountsOutSelector,
        padUint256(amountWei).slice(2),
        padUint256(BigInt(64)).slice(2),      // offset to path
        padUint256(BigInt(path.length)).slice(2),
        ...path.map(p => padAddress(p).slice(2)),
      ].join("");

      const rpcBody = {
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: config.router, data: "0x" + calldata.slice(2) }, "latest"],
        id: 1,
      };

      const rpcResp = await fetch(config.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBody),
      });
      const rpcData = await rpcResp.json();

      let estimatedOutput = "0";
      if (rpcData.result && rpcData.result !== "0x") {
        // The result is ABI-encoded uint256[] - last 32 bytes is the output amount
        const hex = rpcData.result.slice(2);
        const outputHex = hex.slice(-64);
        estimatedOutput = BigInt("0x" + outputHex).toString();
      }

      const outputDecimals = isBuy ? tokenDecimals : 18;
      res.json({
        chain: String(chain),
        dex: config.name,
        inputAmount: amountWei.toString(),
        estimatedOutput,
        path,
        router: config.router,
        chainId: config.chainId,
        explorer: config.explorer,
        tokenDecimals,
        outputDecimals,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "EVM quote failed" });
    }
  });

  // POST /api/evm/swap - Build EVM swap transaction data
  app.post("/api/evm/swap", async (req, res) => {
    try {
      const { chain, tokenAddress, amount, side, userAddress, slippageBps } = req.body;
      if (!chain || !tokenAddress || !amount || !userAddress) {
        return res.status(400).json({ message: "Missing params: chain, tokenAddress, amount, userAddress" });
      }

      const config = EVM_DEX_CONFIG[String(chain)];
      if (!config) {
        return res.status(400).json({ message: `Unsupported chain: ${chain}` });
      }

      const slippage = parseInt(slippageBps || "100") / 10000; // default 1%
      const tokenDecimals = await fetchTokenDecimals(String(tokenAddress), config.rpc);
      const isBuy = String(side) !== "sell";
      const inputDecimals = isBuy ? 18 : tokenDecimals;
      const amountWei = BigInt(Math.round(parseFloat(String(amount)) * Math.pow(10, inputDecimals)));
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min

      const path = isBuy
        ? [config.weth, String(tokenAddress)]
        : [String(tokenAddress), config.weth];

      // Get quote first for amountOutMin
      const getAmountsOutSelector = "0xd06ca61f";
      const quoteCalldata = [
        getAmountsOutSelector,
        padUint256(amountWei).slice(2),
        padUint256(BigInt(64)).slice(2),
        padUint256(BigInt(path.length)).slice(2),
        ...path.map(p => padAddress(p).slice(2)),
      ].join("");

      const rpcResp = await fetch(config.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: config.router, data: "0x" + quoteCalldata.slice(2) }, "latest"],
          id: 1,
        }),
      });
      const rpcData = await rpcResp.json();

      let estimatedOutput = BigInt(0);
      if (rpcData.result && rpcData.result !== "0x") {
        const hex = rpcData.result.slice(2);
        estimatedOutput = BigInt("0x" + hex.slice(-64));
      }

      const amountOutMin = estimatedOutput - (estimatedOutput * BigInt(Math.floor(slippage * 10000))) / BigInt(10000);

      let txData: string;
      let txValue: string;
      let txTo: string;
      const transactions: Array<{ to: string; data: string; value: string }> = [];

      if (isBuy) {
        // Buy: swapExactETHForTokens - send ETH, receive tokens
        txData = encodeSwapETHForTokens(amountOutMin, path, String(userAddress), deadline);
        txTo = config.router;
        txValue = "0x" + amountWei.toString(16);
        transactions.push({ to: txTo, data: txData, value: txValue });
      } else {
        // Sell: need to approve token first, then swapExactTokensForETH
        const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveData = encodeApprove(config.router, maxApproval);
        transactions.push({
          to: String(tokenAddress),
          data: approveData,
          value: "0x0",
        });

        txData = encodeSwapTokensForETH(amountWei, amountOutMin, path, String(userAddress), deadline);
        transactions.push({
          to: config.router,
          data: txData,
          value: "0x0",
        });
      }

      const outputDecimals = isBuy ? tokenDecimals : 18;
      res.json({
        transactions,
        chain: String(chain),
        chainId: config.chainId,
        dex: config.name,
        estimatedOutput: estimatedOutput.toString(),
        amountOutMin: amountOutMin.toString(),
        explorer: config.explorer,
        tokenDecimals,
        outputDecimals,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "EVM swap build failed" });
    }
  });

  // ── Subscription & Payment Routes ──

  app.get("/api/subscriptions/me", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const promoAccess = await storage.hasActivePromoAccess(userId);
      const activeSub = await storage.getUserActiveSubscription(userId);
      const graceSub = !activeSub ? await storage.getUserSubscriptionIncludingGrace(userId) : null;
      const sub = activeSub || graceSub;
      const allAgents = await storage.getAiAgents();
      const userAgents = allAgents.filter((a: any) => a.userId === userId);
      const { TIER_LIMITS } = await import("./crypto-prices");
      const effectiveTier = promoAccess.hasAccess ? promoAccess.tier : sub?.tier || "free";
      const limits = TIER_LIMITS[effectiveTier] || TIER_LIMITS["free"];
      const agentCount = userAgents.length;
      const isGracePeriod = !activeSub && !!graceSub;
      const pendingPayments = await storage.getPendingPaymentsByUser(userId);

      res.json({
        subscription: sub || null,
        tier: effectiveTier,
        limits,
        agentCount,
        active: !!activeSub || promoAccess.hasAccess,
        inGracePeriod: isGracePeriod,
        gracePeriodEndsAt: graceSub?.gracePeriodEndsAt || null,
        renewalFailures: sub?.renewalFailures ?? 0,
        lastFailureReason: sub?.lastFailureReason || null,
        pendingPaymentCount: pendingPayments.length,
        promoAccess: promoAccess.hasAccess
          ? { tier: promoAccess.tier, code: promoAccess.promoCode, expiresAt: promoAccess.expiresAt || null }
          : promoAccess.expiresAt
            ? { tier: "", code: "", expired: true, expiresAt: promoAccess.expiresAt }
            : null,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.get("/api/subscriptions/prices", async (_req, res) => {
    try {
      const { getCryptoPrices, TIER_PRICES_USD, TIER_LIMITS, getCurrencySymbol, usdToCrypto } = await import("./crypto-prices");
      const prices = await getCryptoPrices();
      const tiers = Object.entries(TIER_PRICES_USD).map(([tier, usdPrice]) => {
        const chains = Object.entries(prices).map(([chain, cryptoPrice]) => ({
          chain,
          currency: getCurrencySymbol(chain),
          cryptoPrice,
          amount: usdToCrypto(usdPrice, cryptoPrice),
        }));
        return {
          tier,
          usdPrice,
          limits: TIER_LIMITS[tier],
          chains,
        };
      });
      res.json({ tiers, updatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch prices" });
    }
  });

  app.post("/api/subscriptions/create-payment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const createPaymentSchema = z.object({
        tier: z.enum(["basic", "pro", "whale"]),
        chain: z.enum(["solana", "ethereum", "base", "bsc", "tron"]),
      });
      const parsed = createPaymentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid tier or chain", errors: parsed.error.flatten() });
      const { tier, chain } = parsed.data;

      const { getChainPrice, getCurrencySymbol, usdToCrypto, TIER_PRICES_USD, PLATFORM_PAYMENT_ADDRESSES } = await import("./crypto-prices");
      const usdPrice = TIER_PRICES_USD[tier];
      if (!usdPrice) return res.status(400).json({ message: "Invalid tier" });

      const cryptoPrice = await getChainPrice(chain);
      const amountRequired = usdToCrypto(usdPrice, cryptoPrice);
      const currency = getCurrencySymbol(chain);
      const paymentAddress = PLATFORM_PAYMENT_ADDRESSES[chain];
      if (!paymentAddress) return res.status(400).json({ message: "Unsupported chain" });

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const payment = await storage.createSubscriptionPayment({
        userId,
        tier,
        chain,
        paymentAddress,
        amountRequiredUsd: usdPrice,
        amountRequiredCrypto: amountRequired,
        currency,
        txHash: null,
        status: "pending",
        expiresAt,
      });

      res.json({
        paymentId: payment.id,
        paymentAddress,
        amountRequired,
        currency,
        chain,
        usdPrice,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create payment" });
    }
  });

  app.post("/api/subscriptions/verify-payment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const verifySchema = z.object({
        paymentId: z.number().int().positive(),
        txHash: z.string().min(10).max(200),
      });
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid paymentId or txHash", errors: parsed.error.flatten() });
      const { paymentId, txHash } = parsed.data;

      const payment = await storage.getSubscriptionPayment(paymentId);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      if (payment.userId !== userId) return res.status(403).json({ message: "Unauthorized" });
      if (payment.status === "confirmed") return res.status(400).json({ message: "Payment already confirmed" });
      if (payment.expiresAt && new Date(payment.expiresAt) < new Date()) return res.status(400).json({ message: "Payment expired. Please create a new payment." });

      await storage.updateSubscriptionPayment(payment.id, {
        txHash,
        status: "confirmed",
        amountReceived: payment.amountRequiredCrypto,
        confirmedAt: new Date(),
      });

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const existing = await storage.getUserActiveSubscription(userId);
      if (existing) {
        const newExpiry = new Date(Math.max(existing.expiresAt.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);
        await storage.updateSubscription(existing.id, {
          tier: payment.tier,
          expiresAt: newExpiry,
          paymentTxHash: txHash,
          amountPaid: payment.amountRequiredCrypto,
          currency: payment.currency,
          chain: payment.chain,
        });
      } else {
        await storage.createSubscription({
          userId,
          tier: payment.tier,
          status: "active",
          chain: payment.chain,
          amountPaid: payment.amountRequiredCrypto,
          currency: payment.currency,
          paymentTxHash: txHash,
          startedAt: new Date(),
          expiresAt,
        });
      }

      const sub = await storage.getUserActiveSubscription(userId);
      res.json({ success: true, subscription: sub });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to verify payment" });
    }
  });

  app.get("/api/subscriptions/payments", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const payments = await storage.getUserPaymentHistory(userId);
      res.json(payments);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/subscriptions/retry-payment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const retrySchema = z.object({
        paymentId: z.number().int().positive(),
        txHash: z.string().min(10).max(200),
      });
      const parsed = retrySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid paymentId or txHash", errors: parsed.error.flatten() });
      const { paymentId, txHash } = parsed.data;

      const payment = await storage.getSubscriptionPayment(paymentId);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      if (payment.userId !== userId) return res.status(403).json({ message: "Unauthorized" });
      if (payment.status === "confirmed") return res.status(400).json({ message: "Payment already confirmed" });
      if ((payment.retryCount ?? 0) >= 5) return res.status(400).json({ message: "Maximum retry attempts reached. Please create a new payment." });

      const newExpiry = new Date(Date.now() + 30 * 60 * 1000);

      await storage.updateSubscriptionPayment(payment.id, {
        txHash,
        status: "pending",
        failureReason: null,
        retryCount: (payment.retryCount ?? 0) + 1,
        expiresAt: newExpiry,
      });

      await storage.updateSubscriptionPayment(payment.id, {
        txHash,
        status: "confirmed",
        amountReceived: payment.amountRequiredCrypto,
        confirmedAt: new Date(),
        retryCount: (payment.retryCount ?? 0) + 1,
      });

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const existing = await storage.getUserActiveSubscription(userId);
      const existingGrace = await storage.getUserSubscriptionIncludingGrace(userId);
      const sub = existing || existingGrace;

      if (sub) {
        const newExpiry = new Date(Math.max(sub.expiresAt.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);
        await storage.updateSubscription(sub.id, {
          tier: payment.tier,
          status: "active",
          expiresAt: newExpiry,
          paymentTxHash: txHash,
          amountPaid: payment.amountRequiredCrypto,
          currency: payment.currency,
          chain: payment.chain,
          renewalFailures: 0,
          lastFailureReason: null,
          gracePeriodEndsAt: null,
        });
      } else {
        await storage.createSubscription({
          userId,
          tier: payment.tier,
          status: "active",
          chain: payment.chain,
          amountPaid: payment.amountRequiredCrypto,
          currency: payment.currency,
          paymentTxHash: txHash,
          startedAt: new Date(),
          expiresAt,
        });
      }

      const activeSub = await storage.getUserActiveSubscription(userId);
      res.json({ success: true, subscription: activeSub });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to retry payment" });
    }
  });

  app.post("/api/subscriptions/mark-failed", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const failSchema = z.object({
        paymentId: z.number().int().positive(),
        reason: z.string().max(500).optional(),
      });
      const parsed = failSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request" });
      const { paymentId, reason } = parsed.data;

      const payment = await storage.getSubscriptionPayment(paymentId);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      if (payment.userId !== userId) return res.status(403).json({ message: "Unauthorized" });
      if (payment.status === "confirmed") return res.status(400).json({ message: "Cannot fail a confirmed payment" });

      await storage.updateSubscriptionPayment(payment.id, {
        status: "failed",
        failureReason: reason || "Payment failed or was not sent",
      });

      const sub = await storage.getUserSubscriptionIncludingGrace(userId);
      if (sub) {
        await storage.updateSubscription(sub.id, {
          renewalFailures: (sub.renewalFailures ?? 0) + 1,
          lastFailureReason: reason || "Payment failed",
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to mark payment" });
    }
  });

  app.get("/api/subscriptions/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const subscriptions = await storage.getUserSubscriptions(userId);
      const payments = await storage.getUserPaymentHistory(userId);
      res.json({ subscriptions, payments });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // ── Promo Code Routes ──

  app.post("/api/promo-codes", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().min(3).max(32),
        tier: z.enum(["basic", "pro", "whale"]).default("pro"),
        maxUses: z.literal(1).default(1),
        expiresAt: z.string().datetime().optional(),
      });
      const parsed = schema.parse(req.body);
      const existing = await storage.getPromoCode(parsed.code.toUpperCase());
      if (existing) return res.status(409).json({ message: "Promo code already exists" });

      const promo = await storage.createPromoCode({
        code: parsed.code.toUpperCase(),
        tier: parsed.tier,
        maxUses: parsed.maxUses,
        isActive: true,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
      });
      res.json(promo);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create promo code" });
    }
  });

  app.get("/api/promo-codes", isAuthenticated, async (_req, res) => {
    try {
      const codes = await storage.getAllPromoCodes();
      res.json(codes);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  app.post("/api/promo-codes/redeem", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { code } = req.body || {};
      if (!code || typeof code !== "string" || code.trim().length < 3 || code.trim().length > 32) {
        return res.status(400).json({ message: "Please enter a valid promo code (3-32 characters)" });
      }

      // Aggressively normalize: uppercase, strip all whitespace, replace fancy dashes with regular hyphen
      const normalizedCode = code
        .trim()
        .toUpperCase()
        .replace(/[\s\u00A0\u200B\u200C\u200D\uFEFF]+/g, '') // strip all whitespace & zero-width chars
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]/g, '-'); // normalize dashes
      console.log(`[Promo] Raw input: "${code}" | Normalized: "${normalizedCode}" | User: ${userId}`);
      const promo = await storage.getPromoCode(normalizedCode);
      console.log(`[Promo] Lookup result:`, promo ? `found id=${promo.id} code=${promo.code}` : "NOT FOUND");
      if (!promo) return res.status(404).json({ message: `Invalid promo code "${normalizedCode}". Please check the code and try again.` });
      if (!promo.isActive) return res.status(400).json({ message: "This promo code is no longer active" });
      if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ message: "This promo code has expired" });
      if ((promo.currentUses ?? 0) >= (promo.maxUses ?? 1)) return res.status(400).json({ message: "This promo code has reached its maximum uses" });

      const existingRedemption = await storage.getUserPromoRedemption(userId);
      if (existingRedemption) return res.status(400).json({ message: "You have already redeemed a promo code" });

      const redemption = await storage.redeemPromoCode(promo.id, userId);
      res.json({
        message: "Promo code redeemed successfully! You now have free access to AI Agents.",
        tier: promo.tier,
        code: promo.code,
        redemption,
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to redeem promo code" });
    }
  });

  app.patch("/api/promo-codes/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const schema = z.object({
        isActive: z.boolean().optional(),
        maxUses: z.number().int().min(1).optional(),
        tier: z.enum(["basic", "pro", "whale"]).optional(),
      });
      const updates = schema.parse(req.body);
      const updated = await storage.updatePromoCode(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update promo code" });
    }
  });

  app.get("/api/promo-codes/me", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const access = await storage.hasActivePromoAccess(userId);
      res.json(access);
    } catch (err) {
      res.status(500).json({ message: "Failed to check promo access" });
    }
  });

  // ── Subscription Guard Helpers ──
  async function getUserTier(req: any): Promise<{ tier: string; limits: import("./crypto-prices").TierLimits }> {
    const userId = (req.session as any)?.userId;
    const { TIER_LIMITS } = await import("./crypto-prices");
    if (!userId) return { tier: "free", limits: TIER_LIMITS["free"] };

    const promoAccess = await storage.hasActivePromoAccess(userId);
    if (promoAccess.hasAccess) {
      const tier = promoAccess.tier || "whale";
      return { tier, limits: TIER_LIMITS[tier] || TIER_LIMITS["whale"] };
    }

    const activeSub = await storage.getUserActiveSubscription(userId);
    const sub = activeSub || await storage.getUserSubscriptionIncludingGrace(userId);
    if (!sub) return { tier: "free", limits: TIER_LIMITS["free"] };
    return { tier: sub.tier, limits: TIER_LIMITS[sub.tier] || TIER_LIMITS["free"] };
  }

  async function checkSubscription(req: any, res: any): Promise<{ tier: string; limits: import("./crypto-prices").TierLimits } | null> {
    const result = await getUserTier(req);
    if (result.tier === "free") {
      res.status(402).json({ message: "Active subscription required. Subscribe to unlock this feature.", code: "SUBSCRIPTION_REQUIRED" });
      return null;
    }
    return result;
  }

  function requireFeature(featureKey: keyof import("./crypto-prices").TierLimits, featureLabel: string) {
    return async (req: any, res: any, next: any) => {
      try {
        const { tier, limits } = await getUserTier(req);
        const val = limits[featureKey];
        if (val === false || val === 0) {
          const upgradeMsg = tier === "free"
            ? `Subscribe to unlock ${featureLabel}.`
            : `Upgrade your plan to access ${featureLabel}.`;
          return res.status(403).json({ message: upgradeMsg, code: "FEATURE_LOCKED", feature: featureKey, currentTier: tier });
        }
        (req as any).tierInfo = { tier, limits };
        next();
      } catch {
        res.status(500).json({ message: "Failed to check subscription" });
      }
    };
  }

  // ── AI Agent Routes (subscription-gated) ──

  app.get("/api/signal-performance", async (req, res) => {
    try {
      const strategy = req.query.strategy as string | undefined;
      if (strategy) {
        const data = await storage.getSignalPerformanceByStrategy(strategy);
        return res.json(data);
      }
      const data = await storage.getAllSignalPerformance();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch signal performance" });
    }
  });

  app.get("/api/signal-performance/report", async (_req, res) => {
    try {
      const report = getSignalPerformanceReport();
      res.json(report);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch signal report" });
    }
  });

  app.get("/api/social-metrics", async (req, res) => {
    try {
      const symbol = req.query.symbol as string | undefined;
      if (symbol) {
        const data = await storage.getTokenSocialMetricsBySymbol(symbol.toUpperCase());
        if (!data) return res.status(404).json({ message: "No social metrics for this symbol" });
        return res.json(data);
      }
      const all = await storage.getTokenSocialMetrics();
      res.json(all);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch social metrics" });
    }
  });

  app.get("/api/smart-money/signals", async (_req, res) => {
    try {
      const all = await storage.getSmartMoneySignals();
      res.json(all);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch smart money signals" });
    }
  });

  app.get("/api/news", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const cached = getNewsSignals();
      if (cached && cached.length > 0) {
        const marketSentiment = getOverallMarketNewsSentiment();
        return res.json({ news: cached.slice(0, limit), marketSentiment });
      }
      const dbNews = await storage.getCryptoNews(limit);
      const marketSentiment = getOverallMarketNewsSentiment();
      res.json({ news: dbNews, marketSentiment });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch crypto news" });
    }
  });

  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
        return res.status(400).json({ message: "Valid email required" });
      }
      const { waitlist } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const existing = await db.select().from(waitlist).where(eq(waitlist.email, email.toLowerCase().trim()));
      if (existing.length > 0) return res.status(409).json({ message: "Email already on waitlist" });
      await db.insert(waitlist).values({ email: email.toLowerCase().trim() });
      const count = await db.select().from(waitlist);
      res.json({ success: true, position: count.length });
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Email already on waitlist" });
      res.status(500).json({ message: "Failed to join waitlist" });
    }
  });

  app.get("/api/fear-greed", async (_req, res) => {
    try {
      const cached = getFearGreedSignal();
      if (cached) return res.json(cached);
      const dbRecord = await storage.getFearGreedLatest();
      res.json(dbRecord || { value: 50, classification: "Neutral", trend: "stable" });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch fear & greed index" });
    }
  });

  app.get("/api/liquidity-events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getLiquidityEvents(limit);
      const flow = getMarketLiquidityFlow();
      res.json({ events, marketFlow: flow });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch liquidity events" });
    }
  });

  app.get("/api/ai-agents", isAuthenticated, async (_req, res) => {
    try {
      const agents = await storage.getAiAgents();
      res.json(agents);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch AI agents" });
    }
  });

  app.get("/api/ai-agents/:id", isAuthenticated, async (req, res) => {
    try {
      const agent = await storage.getAiAgent(parseInt(req.params.id as string));
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/ai-agents", isAuthenticated, async (req, res) => {
    try {
      const subCheck = await checkSubscription(req, res);
      if (!subCheck) return;

      const agents = await storage.getAiAgents();
      if (agents.length >= subCheck.limits.maxAgents) {
        return res.status(403).json({
          message: `Your ${subCheck.tier} plan allows ${subCheck.limits.maxAgents} agent(s). Upgrade for more.`,
          code: "AGENT_LIMIT_REACHED",
        });
      }

      const parsed = insertAiAgentSchema.parse(req.body);
      const agent = await storage.createAiAgent({
        ...parsed,
        maxDailyTrades: Math.min(parsed.maxDailyTrades ?? 10, subCheck.limits.maxDailyTrades),
      });
      res.json(agent);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.patch("/api/ai-agents/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertAiAgentSchema.partial();
      const parsed = partialSchema.parse(req.body);
      const agent = await storage.updateAiAgent(parseInt(req.params.id as string), parsed);
      res.json(agent);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/ai-agents/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAiAgent(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  app.post("/api/ai-agents/:id/start", isAuthenticated, async (req, res) => {
    try {
      const subCheck = await checkSubscription(req, res);
      if (!subCheck) return;

      const agent = await storage.getAiAgent(parseInt(req.params.id as string));
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const updated = await storage.updateAiAgent(agent.id, { status: "running" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to start agent" });
    }
  });

  app.post("/api/ai-agents/:id/stop", isAuthenticated, async (req, res) => {
    try {
      const agent = await storage.getAiAgent(parseInt(req.params.id as string));
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const updated = await storage.updateAiAgent(agent.id, { status: "stopped" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to stop agent" });
    }
  });

  app.get("/api/ai-agents/:id/trades", isAuthenticated, async (req, res) => {
    try {
      const trades = await storage.getAgentTrades(parseInt(req.params.id as string));
      res.json(trades);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch agent trades" });
    }
  });

  app.get("/api/ai-agents/:id/logs", isAuthenticated, async (req, res) => {
    try {
      const logs = await storage.getAgentLogs(parseInt(req.params.id as string));
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch agent logs" });
    }
  });

  app.get("/api/ai-agents/:id/positions", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const positions = await storage.getAgentPositions(parseInt(req.params.id as string), status);
      res.json(positions);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch agent positions" });
    }
  });

  app.get("/api/ai-agents/:id/positions/summary", isAuthenticated, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id as string);
      const openPositions = await storage.getAgentPositions(agentId, "open");
      const closedPositions = await storage.getAgentPositions(agentId, "closed");

      const totalUnrealizedPnl = openPositions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0);
      const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl ?? 0), 0);
      const totalExposure = openPositions.reduce((sum, p) => sum + (p.size * p.currentPrice), 0);

      const winningTrades = closedPositions.filter(p => (p.realizedPnl ?? 0) > 0).length;
      const closedWinRate = closedPositions.length > 0 ? (winningTrades / closedPositions.length) * 100 : 0;

      res.json({
        openPositions: openPositions.length,
        closedPositions: closedPositions.length,
        totalUnrealizedPnl,
        totalRealizedPnl,
        totalExposure,
        closedWinRate,
        positions: openPositions,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch position summary" });
    }
  });

  app.get("/api/market-signals", async (req, res) => {
    try {
      const { getMarketSignals } = await import("./ai/signal-builder");
      const chain = req.query.chain as string | undefined;
      const signals = await getMarketSignals(chain);
      res.json(signals.slice(0, 50));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch market signals" });
    }
  });

  app.get("/api/price-alerts", isAuthenticated, async (_req, res) => {
    try {
      const alerts = await storage.getPriceAlerts();
      res.json(alerts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch price alerts" });
    }
  });

  app.post("/api/price-alerts", isAuthenticated, requireFeature("maxAlerts", "Price Alerts"), async (req, res) => {
    try {
      const { limits, tier } = (req as any).tierInfo;
      const existing = await storage.getPriceAlerts();
      if (existing.length >= limits.maxAlerts) {
        return res.status(403).json({ message: `Your ${tier} plan allows ${limits.maxAlerts} alert(s). Upgrade for more.`, code: "LIMIT_REACHED" });
      }
      const parsed = insertPriceAlertSchema.parse(req.body);
      const alert = await storage.createPriceAlert(parsed);
      res.json(alert);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.patch("/api/price-alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const alert = await storage.updatePriceAlert(parseInt(req.params.id as string), req.body);
      res.json(alert);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/price-alerts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deletePriceAlert(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  app.get("/api/limit-orders", isAuthenticated, async (_req, res) => {
    try {
      const orders = await storage.getLimitOrders();
      res.json(orders);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch limit orders" });
    }
  });

  app.post("/api/limit-orders", isAuthenticated, requireFeature("maxLimitOrders", "Limit Orders"), async (req, res) => {
    try {
      const { limits, tier } = (req as any).tierInfo;
      const existing = await storage.getLimitOrders();
      if (existing.length >= limits.maxLimitOrders) {
        return res.status(403).json({ message: `Your ${tier} plan allows ${limits.maxLimitOrders} limit order(s). Upgrade for more.`, code: "LIMIT_REACHED" });
      }
      const parsed = insertLimitOrderSchema.parse(req.body);
      const order = await storage.createLimitOrder(parsed);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.patch("/api/limit-orders/:id", isAuthenticated, async (req, res) => {
    try {
      const order = await storage.updateLimitOrder(parseInt(req.params.id as string), req.body);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/limit-orders/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteLimitOrder(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  app.get("/api/dca-configs", isAuthenticated, async (_req, res) => {
    try {
      const configs = await storage.getDcaConfigs();
      res.json(configs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch DCA configs" });
    }
  });

  app.post("/api/dca-configs", isAuthenticated, requireFeature("maxDcaConfigs", "DCA Automation"), async (req, res) => {
    try {
      const { limits, tier } = (req as any).tierInfo;
      const existing = await storage.getDcaConfigs();
      if (existing.length >= limits.maxDcaConfigs) {
        return res.status(403).json({ message: `Your ${tier} plan allows ${limits.maxDcaConfigs} DCA config(s). Upgrade for more.`, code: "LIMIT_REACHED" });
      }
      const parsed = insertDcaConfigSchema.parse(req.body);
      const config = await storage.createDcaConfig(parsed);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.patch("/api/dca-configs/:id", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.updateDcaConfig(parseInt(req.params.id as string), req.body);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/dca-configs/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteDcaConfig(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete DCA config" });
    }
  });

  app.get("/api/referral/:code", async (req, res) => {
    try {
      const ref = await storage.getReferral(req.params.code as string);
      if (!ref) return res.status(404).json({ message: "Referral not found" });
      res.json(ref);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch referral" });
    }
  });

  app.get("/api/referral/wallet/:wallet", isAuthenticated, async (req, res) => {
    try {
      const ref = await storage.getReferralByWallet(req.params.wallet as string);
      res.json(ref || null);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch referral" });
    }
  });

  app.post("/api/referrals", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertReferralSchema.parse(req.body);
      const ref = await storage.createReferral(parsed);
      res.json(ref);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.get("/api/gas", async (_req, res) => {
    try {
      const [ethGas, solFees] = await Promise.allSettled([
        fetch("https://api.etherscan.io/api?module=gastracker&action=gasoracle").then(r => r.json()),
        fetch("https://api.mainnet-beta.solana.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getRecentPrioritizationFees", params: [] }),
        }).then(r => r.json()),
      ]);

      const gasData: any = {
        ethereum: { low: 15, standard: 25, fast: 40, instant: 60, baseFee: 20 },
        solana: { avgFee: 0.000005, priorityFee: 0.0001 },
        base: { low: 0.001, standard: 0.005, fast: 0.01 },
        bsc: { low: 3, standard: 5, fast: 7 },
        tron: { bandwidth: 0, energy: 420000 },
      };

      if (ethGas.status === "fulfilled" && ethGas.value?.result) {
        const r = ethGas.value.result;
        gasData.ethereum = {
          low: parseFloat(r.SafeGasPrice || "15"),
          standard: parseFloat(r.ProposeGasPrice || "25"),
          fast: parseFloat(r.FastGasPrice || "40"),
          instant: parseFloat(r.FastGasPrice || "40") * 1.5,
          baseFee: parseFloat(r.suggestBaseFee || "20"),
        };
      }

      if (solFees.status === "fulfilled" && solFees.value?.result) {
        const fees = solFees.value.result;
        const avgPriority = fees.length > 0
          ? fees.reduce((s: number, f: any) => s + f.prioritizationFee, 0) / fees.length / 1e9
          : 0.0001;
        gasData.solana.priorityFee = avgPriority;
      }

      res.json(gasData);
    } catch (err) {
      res.json({
        ethereum: { low: 15, standard: 25, fast: 40, instant: 60, baseFee: 20 },
        solana: { avgFee: 0.000005, priorityFee: 0.0001 },
        base: { low: 0.001, standard: 0.005, fast: 0.01 },
        bsc: { low: 3, standard: 5, fast: 7 },
        tron: { bandwidth: 0, energy: 420000 },
      });
    }
  });

  app.get("/api/trades/export", isAuthenticated, requireFeature("csvExport", "CSV Trade Export"), async (_req, res) => {
    try {
      const allTrades = await storage.getTrades(1000);
      const tokens_list = await storage.getTokens();
      const tokenMap = new Map(tokens_list.map(t => [t.id, t]));

      const csvRows = ["Date,Token,Symbol,Type,Amount,Price,Total,Wallet"];
      allTrades.forEach(trade => {
        const token = tokenMap.get(trade.tokenId);
        csvRows.push([
          trade.timestamp ? new Date(trade.timestamp).toISOString() : "",
          token?.name || "Unknown",
          token?.symbol || "???",
          trade.type,
          trade.amount,
          trade.price,
          trade.total,
          trade.wallet || "",
        ].join(","));
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=nextape_trades.csv");
      res.send(csvRows.join("\n"));
    } catch (err) {
      res.status(500).json({ message: "Failed to export trades" });
    }
  });

  app.get("/api/wallet/balance/:address", isAuthenticated, async (req, res) => {
    try {
      const { address } = req.params;
      if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address as string)) {
        return res.status(400).json({ message: "Invalid Solana address" });
      }
      const rpcUrl = "https://api.mainnet-beta.solana.com";
      const balanceResp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [address],
        }),
      });
      const balanceData = await balanceResp.json() as any;
      const solBalance = (balanceData.result?.value || 0) / 1e9;

      const tokenResp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getTokenAccountsByOwner",
          params: [
            address,
            { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
            { encoding: "jsonParsed" },
          ],
        }),
      });
      const tokenData = await tokenResp.json() as any;

      const tokenBalances = (tokenData.result?.value || [])
        .map((acc: any) => {
          const info = acc.account?.data?.parsed?.info;
          if (!info) return null;
          const amount = parseFloat(info.tokenAmount?.uiAmountString || "0");
          if (amount === 0) return null;
          return {
            mint: info.mint,
            amount,
            decimals: info.tokenAmount?.decimals || 0,
          };
        })
        .filter(Boolean)
        .slice(0, 50);

      res.json({ solBalance, tokenBalances, address });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wallet balance" });
    }
  });

  // ========== Token Balance for Instant Wallet ==========
  app.get("/api/wallets/token-balance", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { chain, tokenAddress } = req.query;
      if (!chain || !tokenAddress) {
        return res.status(400).json({ message: "Missing chain or tokenAddress" });
      }
      const wallet = await storage.getGeneratedWallet(userId, String(chain));
      if (!wallet) return res.json({ balance: 0 });

      const CHAIN_RPCS: Record<string, string> = {
        solana: "https://api.mainnet-beta.solana.com",
        ethereum: "https://eth.llamarpc.com",
        base: "https://mainnet.base.org",
        bsc: "https://bsc-dataseed1.binance.org",
      };
      const rpcUrl = CHAIN_RPCS[String(chain)];
      if (!rpcUrl) return res.json({ balance: 0 });

      if (String(chain) === "solana") {
        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "getTokenAccountsByOwner",
            params: [
              wallet.address,
              { mint: String(tokenAddress) },
              { encoding: "jsonParsed" },
            ],
          }),
        });
        const data = await resp.json() as any;
        const accounts = data.result?.value || [];
        let total = 0;
        for (const acc of accounts) {
          const amt = parseFloat(acc.account?.data?.parsed?.info?.tokenAmount?.uiAmountString || "0");
          total += amt;
        }
        return res.json({ balance: total });
      } else {
        const ERC20_BALANCE_OF = "0x70a08231";
        const paddedAddr = wallet.address.replace("0x", "").padStart(64, "0");
        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "eth_call",
            params: [{ to: String(tokenAddress), data: `${ERC20_BALANCE_OF}${paddedAddr}` }, "latest"],
          }),
        });
        const data = await resp.json() as any;
        const raw = BigInt(data.result || "0x0");
        const balance = Number(raw) / 1e18;
        return res.json({ balance });
      }
    } catch (err) {
      console.error("Token balance error:", err);
      res.json({ balance: 0 });
    }
  });

  // ========== Built-in Wallet Generation (Real Cryptographic Wallets) ==========
  const CHAIN_CONFIGS: Record<string, { nativeSymbol: string; nativePriceUsd: number }> = {
    solana: { nativeSymbol: "SOL", nativePriceUsd: 150 },
    ethereum: { nativeSymbol: "ETH", nativePriceUsd: 3000 },
    base: { nativeSymbol: "ETH", nativePriceUsd: 3000 },
    bsc: { nativeSymbol: "BNB", nativePriceUsd: 600 },
    tron: { nativeSymbol: "TRX", nativePriceUsd: 0.12 },
  };

  const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function base58encode(buffer: Buffer): string {
    const digits = [0];
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      let carry = byte;
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] * 256;
        digits[j] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }
    let str = "";
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) str += BASE58_ALPHABET[0];
    for (let i = digits.length - 1; i >= 0; i--) str += BASE58_ALPHABET[digits[i]];
    return str;
  }

  function generateRealWallet(chain: string): { address: string; privateKey: string } {
    if (chain === "solana") {
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();
      const privateKey = Buffer.from(keypair.secretKey).toString("hex");
      return { address, privateKey };
    }

    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    const privateKeyHex = pk as string;

    if (chain === "tron") {
      const ethAddr = account.address.toLowerCase().replace("0x", "");
      const addrBytes = Buffer.from("41" + ethAddr, "hex");
      const hash1 = crypto.createHash("sha256").update(addrBytes).digest();
      const hash2 = crypto.createHash("sha256").update(hash1).digest();
      const checksum = hash2.slice(0, 4);
      const fullAddr = Buffer.concat([addrBytes, checksum]);
      const tronAddress = base58encode(fullAddr);
      return { address: tronAddress, privateKey: privateKeyHex };
    }

    return { address: account.address, privateKey: privateKeyHex };
  }

  function encryptKey(key: string): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is required for wallet encryption");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", crypto.createHash("sha256").update(secret).digest(), iv);
    let encrypted = cipher.update(key, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  function generateTxHash(chain: string): string {
    const chars = "0123456789abcdef";
    if (chain === "solana") {
      const solChars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      return Array.from({ length: 88 }, () => solChars[Math.floor(Math.random() * solChars.length)]).join("");
    }
    return "0x" + Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  app.get("/api/wallets", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const wallets = await storage.getGeneratedWallets(userId);
      const sanitized = await Promise.all(wallets.map(async (w) => {
        let balance = w.balance;
        try {
          balance = await fetchOnChainBalance(w.chain, w.address);
          if (balance !== w.balance) {
            await storage.updateGeneratedWalletBalance(w.id, balance);
          }
        } catch {}
        return {
          id: w.id,
          chain: w.chain,
          address: w.address,
          balance,
          label: w.label,
          createdAt: w.createdAt,
        };
      }));
      res.json(sanitized);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.post("/api/wallets/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { chain } = req.body;
      if (!chain || !CHAIN_CONFIGS[chain]) {
        return res.status(400).json({ message: "Invalid chain. Supported: solana, ethereum, base, bsc, tron" });
      }

      const existing = await storage.getGeneratedWallet(userId, chain);
      if (existing) {
        return res.json({
          id: existing.id,
          chain: existing.chain,
          address: existing.address,
          balance: existing.balance,
          label: existing.label,
          createdAt: existing.createdAt,
        });
      }

      const { address, privateKey } = generateRealWallet(chain);
      const encrypted = encryptKey(privateKey);
      const config = CHAIN_CONFIGS[chain];

      const wallet = await storage.createGeneratedWallet({
        userId,
        chain,
        address,
        encryptedPrivateKey: encrypted,
        balance: 0,
        label: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Wallet`,
      });

      res.json({
        id: wallet.id,
        chain: wallet.chain,
        address: wallet.address,
        balance: wallet.balance,
        label: wallet.label,
        createdAt: wallet.createdAt,
      });
    } catch (err) {
      console.error("Wallet generation error:", err);
      res.status(500).json({ message: "Failed to generate wallet" });
    }
  });

  app.post("/api/wallets/deposit", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { chain } = req.body;
      if (!chain) {
        return res.status(400).json({ message: "Invalid chain" });
      }
      const wallet = await storage.getGeneratedWallet(userId, chain);
      if (!wallet) return res.status(404).json({ message: "No wallet found for this chain" });
      const onChainBalance = await fetchOnChainBalance(chain, wallet.address);
      await storage.updateGeneratedWalletBalance(wallet.id, onChainBalance);
      res.json({ balance: onChainBalance, address: wallet.address });
    } catch (err) {
      res.status(500).json({ message: "Failed to refresh balance" });
    }
  });

  // ========== Real Balance Refresh from Blockchain RPCs ==========
  const CHAIN_RPC_MAP: Record<string, string> = {
    solana: "https://api.mainnet-beta.solana.com",
    ethereum: "https://eth.llamarpc.com",
    base: "https://mainnet.base.org",
    bsc: "https://bsc-dataseed.binance.org",
    tron: "https://api.trongrid.io",
  };

  async function fetchOnChainBalance(chain: string, address: string): Promise<number> {
    try {
      if (chain === "solana") {
        const resp = await fetch(CHAIN_RPC_MAP.solana, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "getBalance",
            params: [address],
          }),
        });
        const data = await resp.json();
        if (data.result?.value !== undefined) {
          return data.result.value / 1e9;
        }
        return 0;
      }

      if (chain === "tron") {
        const resp = await fetch(`${CHAIN_RPC_MAP.tron}/v1/accounts/${address}`);
        const data = await resp.json();
        if (data.data?.[0]?.balance !== undefined) {
          return data.data[0].balance / 1e6;
        }
        return 0;
      }

      const rpc = CHAIN_RPC_MAP[chain];
      if (!rpc) return 0;
      const resp = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "eth_getBalance",
          params: [address, "latest"],
        }),
      });
      const data = await resp.json();
      if (data.result) {
        const wei = BigInt(data.result);
        return Number(wei) / 1e18;
      }
      return 0;
    } catch (err) {
      console.error(`Balance fetch error for ${chain}:${address}:`, err);
      return 0;
    }
  }

  async function fetchOnChainTokenBalance(chain: string, walletAddress: string, tokenAddress: string): Promise<number> {
    try {
      const rpc = CHAIN_RPC_MAP[chain];
      if (!rpc) return 0;

      if (chain === "solana") {
        const resp = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "getTokenAccountsByOwner",
            params: [
              walletAddress,
              { mint: tokenAddress },
              { encoding: "jsonParsed" },
            ],
          }),
        });
        const data = await resp.json() as any;
        const accounts = data.result?.value || [];
        let total = 0;
        for (const acc of accounts) {
          const amt = parseFloat(acc.account?.data?.parsed?.info?.tokenAmount?.uiAmountString || "0");
          total += amt;
        }
        return total;
      } else {
        const paddedAddr = walletAddress.replace("0x", "").padStart(64, "0");
        const resp = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "eth_call",
            params: [{ to: tokenAddress, data: `0x70a08231${paddedAddr}` }, "latest"],
          }),
        });
        const data = await resp.json() as any;
        const raw = BigInt(data.result || "0x0");
        return Number(raw) / 1e18;
      }
    } catch (err) {
      console.error(`Token balance fetch error for ${chain}:${walletAddress}:${tokenAddress}:`, err);
      return 0;
    }
  }

  app.post("/api/wallets/refresh-balance", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { chain } = req.body;
      if (!chain) {
        return res.status(400).json({ message: "Chain is required" });
      }
      const wallet = await storage.getGeneratedWallet(userId, chain);
      if (!wallet) return res.status(404).json({ message: "No wallet found for this chain" });

      const onChainBalance = await fetchOnChainBalance(chain, wallet.address);
      const updated = await storage.updateGeneratedWalletBalance(wallet.id, onChainBalance);
      res.json({ balance: updated.balance, chain });
    } catch (err) {
      console.error("Balance refresh error:", err);
      res.status(500).json({ message: "Failed to refresh balance" });
    }
  });

  app.post("/api/wallets/refresh-all", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const wallets = await storage.getGeneratedWallets(userId);
      const results: Array<{ chain: string; balance: number }> = [];

      await Promise.all(wallets.map(async (wallet) => {
        try {
          const onChainBalance = await fetchOnChainBalance(wallet.chain, wallet.address);
          await storage.updateGeneratedWalletBalance(wallet.id, onChainBalance);
          results.push({ chain: wallet.chain, balance: onChainBalance });
        } catch {
          results.push({ chain: wallet.chain, balance: wallet.balance });
        }
      }));

      res.json({ balances: results });
    } catch (err) {
      console.error("Refresh all error:", err);
      res.status(500).json({ message: "Failed to refresh balances" });
    }
  });

  function decryptKey(encrypted: string): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is required for wallet decryption");
    const [ivHex, encHex] = encrypted.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", crypto.createHash("sha256").update(secret).digest(), iv);
    let decrypted = decipher.update(encHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  app.post("/api/wallets/:id/export-key", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const walletId = parseInt(req.params.id as string);
      const wallets = await storage.getGeneratedWallets(userId);
      const wallet = wallets.find(w => w.id === walletId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      const privateKey = decryptKey(wallet.encryptedPrivateKey);
      res.json({ privateKey });
    } catch (err) {
      console.error("Key export error:", err);
      res.status(500).json({ message: "Failed to export key" });
    }
  });

  app.delete("/api/wallets/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const walletId = parseInt(req.params.id as string);
      const wallets = await storage.getGeneratedWallets(userId);
      const wallet = wallets.find(w => w.id === walletId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      await storage.deleteGeneratedWallet(walletId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete wallet" });
    }
  });

  app.post("/api/trades/instant", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { tokenId, type, amount, slippageBps, tokenAddress: bodyAddress, chain: bodyChain, tokenPrice, tokenName, tokenSymbol } = req.body;
      let parsedAmount = typeof amount === "number" ? amount : parseFloat(String(amount));
      if (!type || !parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Missing type or amount" });
      }
      if (type !== "buy" && type !== "sell") {
        return res.status(400).json({ message: "Type must be buy or sell" });
      }

      let tokenAddress: string;
      let chain: string;
      let price: number;
      let dbTokenId: number | null = null;

      const numericId = typeof tokenId === "number" ? tokenId : parseInt(String(tokenId));
      if (!isNaN(numericId) && numericId > 0) {
        const token = await storage.getToken(numericId);
        if (token) {
          tokenAddress = token.address;
          chain = token.chain || "solana";
          price = token.price;
          dbTokenId = token.id;
        } else if (bodyAddress) {
          tokenAddress = bodyAddress;
          chain = bodyChain || "solana";
          price = typeof tokenPrice === "number" ? tokenPrice : parseFloat(String(tokenPrice)) || 0;
        } else {
          return res.status(404).json({ message: "Token not found" });
        }
      } else if (bodyAddress) {
        tokenAddress = bodyAddress;
        chain = bodyChain || "solana";
        price = typeof tokenPrice === "number" ? tokenPrice : parseFloat(String(tokenPrice)) || 0;
      } else {
        return res.status(400).json({ message: "Missing tokenId or tokenAddress" });
      }

      if (!tokenAddress) {
        return res.status(400).json({ message: "Could not resolve token address" });
      }

      const wallet = await storage.getGeneratedWallet(userId, chain);
      if (!wallet) {
        return res.status(400).json({ message: `No wallet for ${chain}. Generate one first.` });
      }

      const config = CHAIN_CONFIGS[chain] || CHAIN_CONFIGS.solana;

      const realBalance = await fetchOnChainBalance(chain, wallet.address);
      await storage.updateGeneratedWalletBalance(wallet.id, realBalance);

      if (type === "buy" && realBalance < parsedAmount) {
        return res.status(400).json({
          message: `Insufficient ${config.nativeSymbol} balance. You have ${realBalance.toFixed(6)} ${config.nativeSymbol} on-chain, but need ${parsedAmount.toFixed(6)}. Deposit real ${config.nativeSymbol} to your wallet address: ${wallet.address}`,
        });
      }

      if (type === "sell") {
        const tokenBal = await fetchOnChainTokenBalance(chain, wallet.address, tokenAddress);
        if (tokenBal <= 0) {
          return res.status(400).json({
            message: `No token balance on-chain. You have 0 tokens. Buy tokens first.`,
          });
        }
        if (parsedAmount > tokenBal) {
          parsedAmount = tokenBal;
        }
      }

      const privateKey = decryptKey(wallet.encryptedPrivateKey);
      const rawSlip = parseInt(slippageBps || "100");
      const slip = Math.max(1, Math.min(5000, isNaN(rawSlip) ? 100 : rawSlip));

      let swapResult: { success: boolean; txHash: string; explorerUrl: string; error?: string } | null = null;
      let onChainSuccess = false;

      const swapAmount = parsedAmount;
      try {
        if (chain === "solana") {
          swapResult = await executeSolanaSwap(privateKey, tokenAddress, swapAmount, type, slip);
        } else if (chain === "ethereum" || chain === "base" || chain === "bsc") {
          swapResult = await executeEvmSwap(privateKey, chain, tokenAddress, swapAmount, type, slip);
        } else if (chain === "tron") {
          swapResult = { success: false, txHash: "", explorerUrl: "", error: "Tron swaps not yet supported" };
        } else {
          return res.status(400).json({ message: `Unsupported chain: ${chain}` });
        }
        onChainSuccess = swapResult?.success === true;
      } catch (swapErr: any) {
        console.error("On-chain swap error:", swapErr.message);
        swapResult = { success: false, txHash: "", explorerUrl: "", error: swapErr.message };
      }

      if (!onChainSuccess || !swapResult) {
        const errorMsg = swapResult?.error || "On-chain swap failed. Make sure you have sufficient balance and the token is tradeable.";
        return res.status(400).json({ message: errorMsg });
      }

      const txHash = swapResult.txHash;
      const explorerUrl = swapResult.explorerUrl;
      const onChainBalance = await fetchOnChainBalance(chain, wallet.address);
      await storage.updateGeneratedWalletBalance(wallet.id, onChainBalance);
      const newBalance = onChainBalance;

      const truncAddr = `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`;

      const nativePriceUsd = config.nativePriceUsd || 1;
      const tradeAmount = type === "buy" ? (parsedAmount * nativePriceUsd / (price || 1)) : parsedAmount;
      const tradeTotal = type === "buy" ? (parsedAmount * nativePriceUsd) : (parsedAmount * price);

      let trade;
      if (dbTokenId) {
        trade = await storage.createTrade({
          tokenId: dbTokenId,
          type,
          amount: tradeAmount,
          price,
          total: tradeTotal,
          wallet: truncAddr,
        });
        broadcast({ type: "new_trade", data: trade });

        try {
          await storage.upsertPositionFromTrade(dbTokenId, type, tradeAmount, price, chain);
        } catch (posErr) {
          console.error("Position upsert error (non-fatal):", posErr);
        }
      } else {
        try {
          let existingToken = await storage.getTokenByAddress(tokenAddress);
          if (!existingToken) {
            existingToken = await storage.createToken({
              address: tokenAddress,
              name: tokenName || "Unknown",
              symbol: tokenSymbol || "???",
              price,
              chain,
            });
          }
          dbTokenId = existingToken.id;
          trade = await storage.createTrade({
            tokenId: existingToken.id,
            type,
            amount: tradeAmount,
            price,
            total: tradeTotal,
            wallet: truncAddr,
          });
          broadcast({ type: "new_trade", data: trade });
          try {
            await storage.upsertPositionFromTrade(existingToken.id, type, tradeAmount, price, chain);
          } catch (posErr) {
            console.error("Position upsert error (non-fatal):", posErr);
          }
        } catch (tokenCreateErr) {
          console.error("Auto-create token error (non-fatal):", tokenCreateErr);
          trade = {
            id: 0,
            tokenId: 0,
            type,
            amount: tradeAmount,
            price,
            total: tradeTotal,
            wallet: truncAddr,
            timestamp: new Date().toISOString(),
            tokenName: tokenName || "Unknown",
            tokenSymbol: tokenSymbol || "???",
          };
        }
      }

      res.json({
        trade,
        txHash,
        explorerUrl,
        newBalance,
        chain,
        nativeSymbol: config.nativeSymbol,
      });
    } catch (err: any) {
      console.error("Instant trade error:", err);
      res.status(500).json({ message: err.message || "Trade execution failed" });
    }
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
    ws.send(JSON.stringify({ type: "connected", message: "NextApe Terminal connected" }));
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  const priceCache = new Map<string, number>();

  async function fetchLivePrices() {
    if (clients.size === 0) return;
    try {
      const tokenList = await storage.getTokens();
      const addresses = tokenList.slice(0, 30).map(t => t.address);
      if (addresses.length === 0) return;

      const batchSize = 10;
      const updates: Array<{ id: number; symbol: string; address: string; price: number; priceChange24h: number | null; volume24h: number | null; liquidity: number | null; marketCap: number | null; image?: string | null }> = [];

      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const joined = batch.join(",");
        try {
          const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${joined}`);
          if (!resp.ok) continue;
          const data = await resp.json();
          const pairs = data.pairs || [];

          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (!addr) continue;
            const token = tokenList.find(t => t.address.toLowerCase() === addr.toLowerCase());
            if (!token) continue;

            const newPrice = parseFloat(pair.priceUsd) || 0;
            const oldPrice = priceCache.get(addr) ?? token.price;
            priceCache.set(addr, newPrice);

            const imageUrl = pair.info?.imageUrl || null;
            if (imageUrl && !token.image) {
              try {
                await storage.updateToken(token.id, { image: imageUrl });
              } catch {}
            }

            if (newPrice !== oldPrice && newPrice > 0) {
              updates.push({
                id: token.id,
                symbol: token.symbol,
                address: addr,
                price: newPrice,
                priceChange24h: pair.priceChange?.h24 ?? null,
                volume24h: pair.volume?.h24 ?? null,
                liquidity: pair.liquidity?.usd ?? null,
                marketCap: pair.fdv ?? null,
                image: imageUrl,
              });
            }
          }
        } catch {}
      }

      if (updates.length > 0) {
        broadcast({ type: "price_updates", updates });
        for (const u of updates) {
          try {
            await storage.updateToken(u.id, {
              price: u.price,
              priceChange24h: u.priceChange24h,
              volume24h: u.volume24h,
              liquidity: u.liquidity,
              marketCap: u.marketCap,
            });
          } catch {}
        }
      }
    } catch (err) {
      console.error("Live price fetch error:", err);
    }
  }

  setInterval(fetchLivePrices, 15000);
  setTimeout(fetchLivePrices, 5000);

  async function backfillTokenImages() {
    try {
      const tokenList = await storage.getTokens();
      const noImage = tokenList.filter(t => !t.image);
      if (noImage.length === 0) return;

      const addresses = noImage.map(t => t.address);
      for (let i = 0; i < addresses.length; i += 10) {
        const batch = addresses.slice(i, i + 10);
        try {
          const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`);
          if (!resp.ok) continue;
          const data = await resp.json();
          const pairs = data.pairs || [];
          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            const imageUrl = pair.info?.imageUrl;
            if (!addr || !imageUrl) continue;
            const token = noImage.find(t => t.address.toLowerCase() === addr.toLowerCase());
            if (token) {
              try { await storage.updateToken(token.id, { image: imageUrl }); } catch {}
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, 300));
      }
    } catch {}
  }
  setTimeout(backfillTokenImages, 3000);

  // ── Ave.ai Data API Routes ──
  app.get("/api/ave/search", async (req, res) => {
    try {
      const { searchTokens, normalizeChain, hasApiKey } = await import("./aveai");
      const keyword = String(req.query.keyword || "").trim();
      if (!keyword) return res.json({ tokens: [], source: "ave.ai", hasApiKey: hasApiKey() });
      const chain = req.query.chain ? normalizeChain(String(req.query.chain)) : undefined;
      const limit = Math.min(Number(req.query.limit) || 100, 300);
      const orderby = req.query.orderby ? String(req.query.orderby) : undefined;
      const result = await searchTokens(keyword, chain, limit, orderby);
      res.json({ tokens: result.tokens, source: "ave.ai", hasApiKey: hasApiKey(), error: result.error });
    } catch (err: any) {
      console.error("[AveAI] Search error:", err.message);
      res.json({ tokens: [], error: "Failed to search tokens" });
    }
  });

  app.get("/api/ave/ranks/topics", async (_req, res) => {
    try {
      const { getRankTopics, hasApiKey } = await import("./aveai");
      const result = await getRankTopics();
      res.json({ topics: result.topics, source: "ave.ai", hasApiKey: hasApiKey(), error: result.error });
    } catch (err: any) {
      console.error("[AveAI] Topics error:", err.message);
      res.json({ topics: [] });
    }
  });

  app.get("/api/ave/ranks/:topic", async (req, res) => {
    try {
      const { getRankTokens, hasApiKey } = await import("./aveai");
      const topic = req.params.topic;
      const limit = Math.min(Number(req.query.limit) || 200, 300);
      const result = await getRankTokens(topic, limit);
      res.json({ tokens: result.tokens, source: "ave.ai", hasApiKey: hasApiKey(), error: result.error });
    } catch (err: any) {
      console.error("[AveAI] Ranks error:", err.message);
      res.json({ tokens: [] });
    }
  });

  app.post("/api/ave/prices", async (req, res) => {
    try {
      const { getTokenPrices } = await import("./aveai");
      const tokenIds = req.body.token_ids;
      if (!Array.isArray(tokenIds)) return res.status(400).json({ error: "token_ids array required" });
      const prices = await getTokenPrices(tokenIds.slice(0, 200));
      res.json({ prices, source: "ave.ai" });
    } catch (err: any) {
      console.error("[AveAI] Prices error:", err.message);
      res.json({ prices: {} });
    }
  });

  app.get("/api/ave/kline/token/:chain/:address", async (req, res) => {
    try {
      const { getKlineByToken, normalizeChain } = await import("./aveai");
      const chain = normalizeChain(req.params.chain);
      const address = req.params.address;
      const interval = String(req.query.interval || "1h");
      const size = Math.min(Number(req.query.size) || 100, 500);
      const priceType = String(req.query.price_type || "u");
      const klines = await getKlineByToken(address, chain, interval, size, priceType);
      res.json({ klines, source: "ave.ai" });
    } catch (err: any) {
      console.error("[AveAI] Kline error:", err.message);
      res.json({ klines: [] });
    }
  });

  app.get("/api/ave/kline/pair/:pairId", async (req, res) => {
    try {
      const { getKlineByPair } = await import("./aveai");
      const pairId = req.params.pairId;
      const interval = String(req.query.interval || "1h");
      const size = Math.min(Number(req.query.size) || 100, 500);
      const priceType = String(req.query.price_type || "u");
      const klines = await getKlineByPair(pairId, interval, size, priceType);
      res.json({ klines, source: "ave.ai" });
    } catch (err: any) {
      console.error("[AveAI] Kline pair error:", err.message);
      res.json({ klines: [] });
    }
  });

  app.get("/api/ave/risk/:chain/:address", async (req, res) => {
    try {
      const { getContractRisk, normalizeChain } = await import("./aveai");
      const chain = normalizeChain(req.params.chain);
      const address = req.params.address;
      const risk = await getContractRisk(chain, address);
      res.json({ risk, source: "ave.ai" });
    } catch (err: any) {
      console.error("[AveAI] Risk error:", err.message);
      res.json({ risk: null });
    }
  });

  return httpServer;
}
