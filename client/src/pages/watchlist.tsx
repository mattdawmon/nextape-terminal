import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Token } from "@shared/schema";
import { TokenTable } from "@/components/token-table";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";
import { Star, ArrowLeft, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWallets } from "@/hooks/use-wallets";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { useTranslation } from "@/i18n";
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

export default function WatchlistPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chart">("list");
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const { toast } = useToast();
  const { wallets } = useWallets();

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const { data: watchlistData = [], isLoading: watchlistLoading } = useQuery<{ tokenId: number }[]>({
    queryKey: ["/api/watchlist"],
  });

  const watchlistedIds = useMemo(
    () => new Set(watchlistData.map((w: any) => w.tokenId)),
    [watchlistData]
  );

  const watchlistedTokens = useMemo(
    () => tokens.filter((t) => watchlistedIds.has(t.id)),
    [tokens, watchlistedIds]
  );

  const toggleWatchlistMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      await apiRequest("DELETE", `/api/watchlist/${tokenId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
  });

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

  const handleSelectToken = useCallback((token: Token) => {
    setSelectedToken(token);
    if (isMobile) {
      setMobileView("chart");
    }
  }, [isMobile]);

  const hasAnyInstantWallet = wallets.length > 0;

  if (isMobile) {
    if (mobileView === "chart" && selectedToken) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-card">
            <Button size="icon" variant="ghost" onClick={() => setMobileView("list")} data-testid="button-back-list">
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
            <Button className="flex-1 bg-gain text-white border-gain font-semibold text-xs" onClick={() => setMobileTradeOpen(true)} data-testid="button-mobile-buy">Buy</Button>
            <Button className="flex-1 bg-loss text-white border-loss font-semibold text-xs" onClick={() => setMobileTradeOpen(true)} data-testid="button-mobile-sell">Sell</Button>
          </div>
          <Drawer open={mobileTradeOpen} onOpenChange={setMobileTradeOpen}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="py-2 px-3 flex items-center justify-between">
                <div>
                  <DrawerTitle className="text-sm">Trade {selectedToken.symbol}</DrawerTitle>
                  <DrawerDescription className="sr-only">Buy or sell tokens</DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button size="icon" variant="ghost" data-testid="button-close-trade-drawer"><X className="w-4 h-4" /></Button>
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
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Star className="w-4 h-4 text-warning" />
          <span className="font-bold text-sm">{t.watchlist.title}</span>
          <span className="text-xs text-muted-foreground font-mono">({watchlistedTokens.length})</span>
        </div>
        <div className="flex-1 overflow-auto scrollbar-thin">
          <TokenTable
            tokens={watchlistedTokens}
            isLoading={tokensLoading || watchlistLoading}
            onSelectToken={handleSelectToken}
            onToggleWatchlist={(id) => toggleWatchlistMutation.mutate(id)}
            onQuickBuy={(token) => quickBuyMutation.mutate(token)}
            watchlistedIds={watchlistedIds}
            variant="compact"
            hasInstantWallet={hasAnyInstantWallet}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={55} minSize={35}>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Star className="w-4 h-4 text-warning" />
                <span className="font-bold text-sm">{t.watchlist.title}</span>
                <span className="text-xs text-muted-foreground font-mono">({watchlistedTokens.length})</span>
              </div>
              <div className="flex-1 overflow-auto scrollbar-thin">
                <TokenTable
                  tokens={watchlistedTokens}
                  isLoading={tokensLoading || watchlistLoading}
                  onSelectToken={handleSelectToken}
                  onToggleWatchlist={(id) => toggleWatchlistMutation.mutate(id)}
                  onQuickBuy={(token) => quickBuyMutation.mutate(token)}
                  watchlistedIds={watchlistedIds}
                  variant="full"
                  hasInstantWallet={hasAnyInstantWallet}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="flex flex-col h-full border-l border-border">
              <div className="h-[55%] min-h-[200px] bg-card">
                <PriceChart token={selectedToken} />
              </div>
              <div className="flex-1 min-h-0 border-t border-border bg-card overflow-auto">
                <TradePanel token={selectedToken} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
