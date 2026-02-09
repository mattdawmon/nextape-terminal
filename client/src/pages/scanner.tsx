import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Token, type Trade } from "@shared/schema";
import { TokenTable } from "@/components/token-table";
import { TradePanel } from "@/components/trade-panel";
import { PriceChart } from "@/components/price-chart";
import { ActivityFeed } from "@/components/activity-feed";
import { TokenDetail } from "@/components/token-detail";
import { StatsBar } from "@/components/stats-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Radio, Flame, Zap, Star, Search, X, ChevronUp, BarChart3, ArrowLeft, List } from "lucide-react";
import { DexSearch } from "@/components/dex-search";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { useWallets } from "@/hooks/use-wallets";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { formatPrice } from "@/lib/format";
import { useTranslation } from "@/i18n";

interface DexSearchResult {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  dexId: string;
  pairAddress: string;
  url?: string;
}

interface ScannerPageProps {
  searchQuery?: string;
  selectedChain?: string;
  externalToken?: DexSearchResult | null;
  onExternalTokenConsumed?: () => void;
}

function dexResultToToken(result: DexSearchResult): Token & { pairAddress?: string } {
  return {
    id: 0,
    address: result.address,
    name: result.name,
    symbol: result.symbol,
    image: null,
    price: result.price,
    priceChange1h: null,
    priceChange24h: result.priceChange24h,
    volume24h: result.volume24h,
    marketCap: result.marketCap,
    liquidity: result.liquidity,
    holders: null,
    txns24h: null,
    buys24h: null,
    sells24h: null,
    topHolderPercent: null,
    isVerified: null,
    isTrending: null,
    isNew: null,
    chain: result.chain,
    launchpad: result.dexId,
    bondingCurveProgress: null,
    graduated: null,
    devWalletPercent: null,
    createdAt: null,
    pairAddress: result.pairAddress,
  } as Token & { pairAddress?: string };
}

export default function ScannerPage({ searchQuery, selectedChain, externalToken, onExternalTokenConsumed }: ScannerPageProps) {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chart">("list");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { wallets, getWalletForChain } = useWallets();
  const { t } = useTranslation();

  useEffect(() => {
    if (externalToken) {
      const token = dexResultToToken(externalToken);
      setSelectedToken(token);
      if (isMobile) {
        setMobileView("chart");
      }
      onExternalTokenConsumed?.();
    }
  }, [externalToken, isMobile, onExternalTokenConsumed]);

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
  });

  const { data: watchlistData = [] } = useQuery<{ tokenId: number }[]>({
    queryKey: ["/api/watchlist"],
  });

  const watchlistedIds = useMemo(
    () => new Set(watchlistData.map((w: any) => w.tokenId)),
    [watchlistData]
  );

  const toggleWatchlistMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      if (watchlistedIds.has(tokenId)) {
        await apiRequest("DELETE", `/api/watchlist/${tokenId}`);
      } else {
        await apiRequest("POST", "/api/watchlist", { tokenId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const filteredTokens = useMemo(() => {
    let filtered = tokens;

    if (selectedChain && selectedChain !== "all") {
      filtered = filtered.filter((t) => t.chain === selectedChain);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    }

    switch (activeTab) {
      case "trending":
        return filtered.filter((t) => t.isTrending);
      case "new":
        return filtered.filter((t) => t.isNew);
      case "watchlist":
        return filtered.filter((t) => watchlistedIds.has(t.id));
      default:
        return filtered;
    }
  }, [tokens, activeTab, searchQuery, watchlistedIds, selectedChain]);

  const quickBuyMutation = useMutation({
    mutationFn: async (token: Token) => {
      const chain = token.chain || "solana";
      const defaultAmounts: Record<string, number> = { solana: 0.1, ethereum: 0.01, base: 0.01, bsc: 0.05, tron: 10 };
      const amount = defaultAmounts[chain] || 0.1;
      const res = await apiRequest("POST", "/api/trades/instant", { tokenId: token.id, type: "buy", amount, tokenAddress: token.address, chain, tokenPrice: token.price, tokenName: token.name, tokenSymbol: token.symbol });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Quick buy executed", description: `Bought at ${result.chain}. Balance: ${result.newBalance.toFixed(4)} ${result.nativeSymbol}` });
    },
    onError: (err: Error) => {
      toast({ title: "Quick buy failed", description: err.message, variant: "destructive" });
    },
  });

  const handleQuickBuy = useCallback((token: Token) => {
    quickBuyMutation.mutate(token);
  }, [quickBuyMutation]);

  const hasAnyInstantWallet = wallets.length > 0;

  const handleSelectToken = useCallback((token: Token) => {
    setSelectedToken(token);
    if (isMobile) {
      setMobileView("chart");
    }
  }, [isMobile]);

  const filterTabs = (
    <div className={`border-b border-border ${isMobile ? "px-2 py-1.5" : "px-3 py-2"}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={isMobile ? "h-7" : "h-7"}>
          <TabsTrigger value="all" className={`gap-1 ${isMobile ? "text-[9px] px-1.5" : "text-[10px] px-2"}`} data-testid="tab-all">
            <Radio className="w-3 h-3" />
            {t.scanner.allTokens}
          </TabsTrigger>
          <TabsTrigger value="trending" className={`gap-1 ${isMobile ? "text-[9px] px-1.5" : "text-[10px] px-2"}`} data-testid="tab-trending">
            <Flame className="w-3 h-3" />
            {t.scanner.trending}
          </TabsTrigger>
          <TabsTrigger value="new" className={`gap-1 ${isMobile ? "text-[9px] px-1.5" : "text-[10px] px-2"}`} data-testid="tab-new">
            <Zap className="w-3 h-3" />
            {t.scanner.newPairs}
          </TabsTrigger>
          <TabsTrigger value="watchlist" className={`gap-1 ${isMobile ? "text-[9px] px-1.5" : "text-[10px] px-2"}`} data-testid="tab-watchlist">
            <Star className="w-3 h-3" />
            {t.scanner.watchlist}
          </TabsTrigger>
          {!isMobile && (
            <TabsTrigger value="live" className="text-[10px] gap-1 px-2" data-testid="tab-live-search">
              <Search className="w-3 h-3" />
              Live Search
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );

  if (isMobile) {
    if (mobileView === "chart" && selectedToken) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-card">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMobileView("list")}
              data-testid="button-back-list"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
              {selectedToken.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-xs font-bold truncate" data-testid="text-mobile-token-symbol">{selectedToken.symbol}</span>
              <span className="font-mono text-xs text-muted-foreground">{formatPrice(selectedToken.price)}</span>
              <span className={`text-[10px] font-mono ${(selectedToken.priceChange24h ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {(selectedToken.priceChange24h ?? 0) >= 0 ? "+" : ""}{(selectedToken.priceChange24h ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <PriceChart token={selectedToken} />
          </div>

          <div className="flex gap-2 p-2 border-t border-border bg-card">
            <Button
              className="flex-1 bg-gain text-white border-gain font-semibold text-xs"
              onClick={() => setMobileTradeOpen(true)}
              data-testid="button-mobile-buy"
            >
              {t.common.buy}
            </Button>
            <Button
              className="flex-1 bg-loss text-white border-loss font-semibold text-xs"
              onClick={() => setMobileTradeOpen(true)}
              data-testid="button-mobile-sell"
            >
              {t.common.sell}
            </Button>
          </div>

          <Drawer open={mobileTradeOpen} onOpenChange={setMobileTradeOpen}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="py-2 px-3 flex items-center justify-between">
                <div>
                  <DrawerTitle className="text-sm">
                    Trade {selectedToken.symbol}
                  </DrawerTitle>
                  <DrawerDescription className="sr-only">Buy or sell tokens</DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button size="icon" variant="ghost" data-testid="button-close-trade-drawer">
                    <X className="w-4 h-4" />
                  </Button>
                </DrawerClose>
              </DrawerHeader>
              <div className="overflow-auto px-1 pb-4">
                <TradePanel token={selectedToken} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <StatsBar tokens={tokens} />
        {filterTabs}

        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
          {activeTab === "live" ? (
            <DexSearch selectedChain={selectedChain} />
          ) : (
            <TokenTable
              tokens={filteredTokens}
              isLoading={tokensLoading}
              onSelectToken={handleSelectToken}
              onToggleWatchlist={(id) => toggleWatchlistMutation.mutate(id)}
              onQuickBuy={handleQuickBuy}
              watchlistedIds={watchlistedIds}
              variant="compact"
              hasInstantWallet={hasAnyInstantWallet}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <StatsBar tokens={tokens} />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={55} minSize={35}>
            <div className="flex flex-col h-full">
              {filterTabs}
              <div className="flex-1 overflow-auto scrollbar-thin">
                {activeTab === "live" ? (
                  <DexSearch selectedChain={selectedChain} />
                ) : (
                  <TokenTable
                    tokens={filteredTokens}
                    isLoading={tokensLoading}
                    onSelectToken={handleSelectToken}
                    onToggleWatchlist={(id) => toggleWatchlistMutation.mutate(id)}
                    onQuickBuy={handleQuickBuy}
                    watchlistedIds={watchlistedIds}
                    variant="full"
                    hasInstantWallet={hasAnyInstantWallet}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="flex flex-col h-full border-l border-border">
              <div className="relative min-h-[200px] bg-card" style={{ flex: "55 1 0%", overflow: "hidden", contain: "strict" }}>
                <PriceChart token={selectedToken} />
              </div>
              <div className="relative z-10 min-h-0 border-t border-border bg-card overflow-y-auto scrollbar-thin" style={{ flex: "45 1 0%" }}>
                <TradePanel token={selectedToken} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
