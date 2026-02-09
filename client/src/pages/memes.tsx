import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";
import { Rocket, ArrowLeft, X, GraduationCap, Clock, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWallets } from "@/hooks/use-wallets";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatCompact, formatPercent, formatTimeAgo } from "@/lib/format";
import { TokenLogo } from "@/components/token-table";
import { useTranslation } from "@/i18n";

interface MemeToken {
  id: string | number;
  address: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  priceChange1h: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  liquidity: number | null;
  holders: number | null;
  txns24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  chain: string;
  launchpad: string;
  bondingCurveProgress: number;
  graduated: boolean;
  devWalletPercent: number | null;
  createdAt: string | null;
  pairAddress: string | null;
  dexUrl: string | null;
  boosts: number | null;
}
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LAUNCHPAD_LABELS: Record<string, { label: string; color: string }> = {
  pumpfun: { label: "PumpFun", color: "text-gain" },
  pumpswap: { label: "PumpSwap", color: "text-gain" },
  fourmeme: { label: "Four.Meme", color: "text-info" },
  moonshot: { label: "Moonshot", color: "text-warning" },
  bonkbot: { label: "BonkBot", color: "text-gain" },
  flap: { label: "Flap", color: "text-info" },
  raydium: { label: "Raydium", color: "text-muted-foreground" },
  orca: { label: "Orca", color: "text-info" },
  jupiter: { label: "Jupiter", color: "text-gain" },
  meteora: { label: "Meteora", color: "text-warning" },
  uniswap: { label: "Uniswap", color: "text-info" },
  pancakeswap: { label: "PancakeSwap", color: "text-warning" },
  sunswap: { label: "SunSwap", color: "text-loss" },
  aerodrome: { label: "Aerodrome", color: "text-info" },
  baseswap: { label: "BaseSwap", color: "text-info" },
  sushiswap: { label: "SushiSwap", color: "text-warning" },
  camelot: { label: "Camelot", color: "text-warning" },
  launchlab: { label: "LaunchLab", color: "text-gain" },
};

const CHAIN_BADGES: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  bsc: "BNB",
  tron: "TRX",
};

function BondingCurveBar({ progress, graduated }: { progress: number | null; graduated: boolean | null }) {
  const pct = progress ?? 0;
  const isGraduated = graduated === true;
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <div className="flex-1">
        <Progress
          value={pct}
          className="h-1.5"
        />
      </div>
      <span className={`text-[10px] font-mono tabular-nums ${isGraduated ? "text-gain" : "text-muted-foreground"}`}>
        {pct.toFixed(0)}%
      </span>
      {isGraduated && (
        <GraduationCap className="w-3 h-3 text-gain flex-shrink-0" />
      )}
    </div>
  );
}

function MemeRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50">
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="w-24 h-4" />
      <Skeleton className="w-16 h-4 ml-auto" />
      <Skeleton className="w-20 h-4" />
      <Skeleton className="w-14 h-4" />
    </div>
  );
}

function MemeTokenRow({
  token,
  onSelect,
  onQuickBuy,
  hasInstantWallet,
  variant,
}: {
  token: MemeToken;
  onSelect: (t: MemeToken) => void;
  onQuickBuy: (t: MemeToken) => void;
  hasInstantWallet: boolean;
  variant: "full" | "compact";
}) {
  const launchpad = LAUNCHPAD_LABELS[token.launchpad || ""] || { label: token.launchpad, color: "text-muted-foreground" };
  const chainBadge = CHAIN_BADGES[token.chain || "solana"] || token.chain;
  const isGraduated = token.graduated === true;
  const pct24h = token.priceChange24h ?? 0;
  const devPct = token.devWalletPercent ?? 0;

  if (variant === "compact") {
    return (
      <div
        className="flex items-center gap-2 px-2 py-2 border-b border-border/30 hover-elevate cursor-pointer"
        onClick={() => onSelect(token)}
        data-testid={`meme-row-${token.id}`}
      >
        <TokenLogo token={token as any} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold truncate">{token.symbol}</span>
            <Badge variant="outline" className={`text-[7px] px-0.5 py-0 ${launchpad.color} border-current/20`}>{launchpad.label}</Badge>
          </div>
          <span className="text-[11px] text-foreground/60 truncate block max-w-[140px]">{token.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[10px] text-muted-foreground">{formatPrice(token.price)}</span>
            <span className={`text-[10px] font-mono ${pct24h >= 0 ? "text-gain" : "text-loss"}`}>
              {pct24h >= 0 ? "+" : ""}{pct24h.toFixed(1)}%
            </span>
            {token.createdAt && (
              <span className="text-[9px] text-muted-foreground font-mono" data-testid={`text-age-${token.id}`}>
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />{formatTimeAgo(token.createdAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <BondingCurveBar progress={token.bondingCurveProgress} graduated={token.graduated} />
          {hasInstantWallet && (
            <Button
              size="sm"
              variant="outline"
              className="h-5 text-[9px] px-1.5 text-gain border-gain/30"
              onClick={(e) => { e.stopPropagation(); onQuickBuy(token); }}
              data-testid={`button-quick-buy-meme-${token.id}`}
            >
              Quick Buy
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-[2fr_1fr_0.7fr_1fr_0.7fr_0.6fr_1.2fr_auto] items-center gap-2 px-3 py-2 border-b border-border/30 hover-elevate cursor-pointer text-xs"
      onClick={() => onSelect(token)}
      data-testid={`meme-row-${token.id}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <TokenLogo token={token as any} size={28} />
        <div className="min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold truncate">{token.symbol}</span>
            <Badge variant="outline" className={`text-[7px] px-0.5 py-0 ${launchpad.color} border-current/20`}>{launchpad.label}</Badge>
            <Badge variant="outline" className="text-[7px] px-0.5 py-0">{chainBadge}</Badge>
            {isGraduated && (
              <Badge variant="outline" className="text-[7px] px-0.5 py-0 text-gain border-gain/30">
                <GraduationCap className="w-2.5 h-2.5 mr-0.5" />DEX
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-foreground/60 truncate block max-w-[180px]">{token.name}</span>
        </div>
      </div>

      <div className="text-right">
        <div className="font-mono">{formatPrice(token.price)}</div>
        <div className={`text-[10px] font-mono ${pct24h >= 0 ? "text-gain" : "text-loss"}`}>
          {pct24h >= 0 ? "+" : ""}{pct24h.toFixed(1)}%
        </div>
      </div>

      <div className="text-right font-mono text-muted-foreground">
        {formatCompact(token.marketCap ?? 0)}
      </div>

      <div className="text-right font-mono text-muted-foreground">
        {formatCompact(token.volume24h ?? 0)}
      </div>

      <div className="text-right">
        <span className={`font-mono ${devPct > 10 ? "text-loss" : devPct > 5 ? "text-warning" : "text-gain"}`}>
          {devPct.toFixed(1)}%
        </span>
      </div>

      <div className="text-right text-muted-foreground font-mono" data-testid={`text-age-full-${token.id}`}>
        {token.createdAt ? formatTimeAgo(token.createdAt) : "-"}
      </div>

      <BondingCurveBar progress={token.bondingCurveProgress} graduated={token.graduated} />

      <div className="flex items-center gap-1">
        {hasInstantWallet && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[9px] px-1.5 text-gain border-gain/30"
            onClick={(e) => { e.stopPropagation(); onQuickBuy(token); }}
            data-testid={`button-quick-buy-meme-${token.id}`}
          >
            Quick Buy
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MemesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chart">("list");
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const [chainFilter, setChainFilter] = useState("all");
  const [launchpadFilter, setLaunchpadFilter] = useState("all");
  const [graduatedFilter, setGraduatedFilter] = useState("all");
  const [sortBy, setSortBy] = useState("volume");
  const { toast } = useToast();
  const { wallets } = useWallets();

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (chainFilter !== "all") params.set("chain", chainFilter);
    if (launchpadFilter !== "all") params.set("launchpad", launchpadFilter);
    if (graduatedFilter !== "all") params.set("graduated", graduatedFilter);
    if (sortBy) params.set("sortBy", sortBy);
    return params.toString();
  }, [chainFilter, launchpadFilter, graduatedFilter, sortBy]);

  const { data: memes = [], isLoading } = useQuery<MemeToken[]>({
    queryKey: [`/api/tokens/memes?${queryParams}`],
    refetchInterval: 30_000,
  });

  const quickBuyMutation = useMutation({
    mutationFn: async (token: MemeToken) => {
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

  const handleSelectToken = useCallback((token: MemeToken) => {
    setSelectedToken(token);
    if (isMobile) setMobileView("chart");
  }, [isMobile]);

  const hasAnyInstantWallet = wallets.length > 0;

  const graduatedCount = memes.filter(t => t.graduated === true).length;
  const internalCount = memes.filter(t => t.graduated === false || t.graduated === null).length;

  const filterBar = (
    <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-border bg-card/50">
      <Select value={chainFilter} onValueChange={setChainFilter}>
        <SelectTrigger className="h-7 w-[90px] text-[10px]" data-testid="select-chain-filter">
          <SelectValue placeholder="Chain" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.memes.allChains}</SelectItem>
          <SelectItem value="solana">Solana</SelectItem>
          <SelectItem value="ethereum">Ethereum</SelectItem>
          <SelectItem value="base">Base</SelectItem>
          <SelectItem value="bsc">BNB</SelectItem>
          <SelectItem value="tron">Tron</SelectItem>
        </SelectContent>
      </Select>

      <Select value={launchpadFilter} onValueChange={setLaunchpadFilter}>
        <SelectTrigger className="h-7 w-[110px] text-[10px]" data-testid="select-launchpad-filter">
          <SelectValue placeholder="Launchpad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.memes.allLaunchpads}</SelectItem>
          <SelectItem value="pumpfun">PumpFun</SelectItem>
          <SelectItem value="raydium">Raydium</SelectItem>
          <SelectItem value="orca">Orca</SelectItem>
          <SelectItem value="jupiter">Jupiter</SelectItem>
          <SelectItem value="meteora">Meteora</SelectItem>
          <SelectItem value="uniswap">Uniswap</SelectItem>
          <SelectItem value="pancakeswap">PancakeSwap</SelectItem>
          <SelectItem value="aerodrome">Aerodrome</SelectItem>
          <SelectItem value="fourmeme">Four.Meme</SelectItem>
          <SelectItem value="moonshot">Moonshot</SelectItem>
          <SelectItem value="sushiswap">SushiSwap</SelectItem>
          <SelectItem value="sunswap">SunSwap</SelectItem>
        </SelectContent>
      </Select>

      <Select value={graduatedFilter} onValueChange={setGraduatedFilter}>
        <SelectTrigger className="h-7 w-[100px] text-[10px]" data-testid="select-graduated-filter">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.memes.allStatuses}</SelectItem>
          <SelectItem value="true">Graduated</SelectItem>
          <SelectItem value="false">Bonding</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="h-7 w-[100px] text-[10px]" data-testid="select-sort-by">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="volume">Volume</SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="mcap">Market Cap</SelectItem>
          <SelectItem value="curve">Curve %</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground font-mono">
        <span className="text-gain">{graduatedCount} graduated</span>
        <span>/</span>
        <span className="text-warning">{internalCount} bonding</span>
      </div>
    </div>
  );

  const tableHeader = (
    <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr_0.7fr_0.6fr_1.2fr_auto] items-center gap-2 px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
      <span>{t.common.token}</span>
      <span className="text-right">{t.common.price}</span>
      <span className="text-right">{t.common.marketCap}</span>
      <span className="text-right">{t.common.volume}</span>
      <span className="text-right">{t.memes.devWallet}</span>
      <span className="text-right">{t.common.age}</span>
      <span>{t.memes.bondingCurve}</span>
      <span></span>
    </div>
  );

  if (isMobile) {
    if (mobileView === "chart" && selectedToken) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-card">
            <Button size="icon" variant="ghost" onClick={() => setMobileView("list")} data-testid="button-back-list">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <TokenLogo token={selectedToken as any} size={20} />
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-xs font-bold truncate" data-testid="text-mobile-token-symbol">{selectedToken.symbol}</span>
              <span className="font-mono text-xs text-muted-foreground">{formatPrice(selectedToken.price)}</span>
              <span className={`text-[10px] font-mono ${(selectedToken.priceChange24h ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {(selectedToken.priceChange24h ?? 0) >= 0 ? "+" : ""}{(selectedToken.priceChange24h ?? 0).toFixed(1)}%
              </span>
              {selectedToken.launchpad && (
                <Badge variant="outline" className={`text-[7px] px-0.5 py-0 ${LAUNCHPAD_LABELS[selectedToken.launchpad]?.color || ""}`}>
                  {LAUNCHPAD_LABELS[selectedToken.launchpad]?.label || selectedToken.launchpad}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PriceChart token={selectedToken as any} />
          </div>
          <div className="flex gap-2 p-2 border-t border-border bg-card">
            <Button className="flex-1 bg-gain text-white border-gain font-semibold text-xs" onClick={() => setMobileTradeOpen(true)} data-testid="button-mobile-buy">{t.common.buy}</Button>
            <Button className="flex-1 bg-loss text-white border-loss font-semibold text-xs" onClick={() => setMobileTradeOpen(true)} data-testid="button-mobile-sell">{t.common.sell}</Button>
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
                <TradePanel token={selectedToken as any} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Rocket className="w-4 h-4 text-gain" />
          <span className="font-bold text-sm">{t.memes.title}</span>
          <span className="text-xs text-muted-foreground font-mono">({memes.length})</span>
        </div>
        {filterBar}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <MemeRowSkeleton key={i} />)
          ) : memes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Rocket className="w-8 h-8 mb-2 opacity-40" />
              <span className="text-sm">{t.memes.noTokensFound}</span>
              <span className="text-xs">{t.memes.filters}</span>
            </div>
          ) : (
            memes.map(token => (
              <MemeTokenRow
                key={token.id}
                token={token}
                onSelect={handleSelectToken}
                onQuickBuy={(t) => quickBuyMutation.mutate(t)}
                hasInstantWallet={hasAnyInstantWallet}
                variant="compact"
              />
            ))
          )}
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
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <Rocket className="w-4 h-4 text-gain" />
                <span className="font-bold text-sm">{t.memes.title}</span>
                <span className="text-xs text-muted-foreground font-mono">({memes.length})</span>
              </div>
              {filterBar}
              {tableHeader}
              <div className="flex-1 overflow-auto scrollbar-thin">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <MemeRowSkeleton key={i} />)
                ) : memes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Rocket className="w-8 h-8 mb-2 opacity-40" />
                    <span className="text-sm">{t.memes.noTokensFound}</span>
                    <span className="text-xs">{t.memes.filters}</span>
                  </div>
                ) : (
                  memes.map(token => (
                    <MemeTokenRow
                      key={token.id}
                      token={token}
                      onSelect={handleSelectToken}
                      onQuickBuy={(t) => quickBuyMutation.mutate(t)}
                      hasInstantWallet={hasAnyInstantWallet}
                      variant="full"
                    />
                  ))
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="flex flex-col h-full border-l border-border">
              <div className="relative min-h-[200px] bg-card" style={{ flex: "55 1 0%", overflow: "hidden", contain: "strict" }}>
                <PriceChart token={selectedToken as any} />
              </div>
              <div className="relative z-10 min-h-0 border-t border-border bg-card overflow-y-auto scrollbar-thin" style={{ flex: "45 1 0%" }}>
                <TradePanel token={selectedToken as any} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
