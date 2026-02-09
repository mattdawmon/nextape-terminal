import { useState, useEffect, useRef } from "react";
import { type Token } from "@shared/schema";
import { formatPrice, formatCompact, formatPercent, formatTimeAgo } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, ShieldCheck, Flame, ArrowUpRight, ArrowDownRight, Clock, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const KNOWN_SOLANA_ICONS: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png",
};

export function getTokenIconUrl(token: { image?: string | null; address: string; chain?: string | null; symbol?: string }): string | null {
  if (token.image) return token.image;
  const chain = (token.chain || "solana").toLowerCase();
  const addr = token.address;
  if (!addr) return null;
  if (chain === "ethereum") return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${addr}/logo.png`;
  if (chain === "bsc") return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${addr}/logo.png`;
  if (chain === "base") return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${addr}/logo.png`;
  if (chain === "solana" && KNOWN_SOLANA_ICONS[addr]) return KNOWN_SOLANA_ICONS[addr];
  return null;
}

export function TokenLogo({ token, size = 28 }: { token: Token | { symbol: string; image?: string | null; address: string; chain?: string | null }; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const primarySrc = token.image;
  const fallbackSrc = getTokenIconUrl(token);

  if (primarySrc && !imgError) {
    return (
      <img
        src={primarySrc}
        alt={token.symbol}
        width={size}
        height={size}
        className="rounded-full flex-shrink-0 object-cover"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  if (fallbackSrc && !fallbackError && fallbackSrc !== primarySrc) {
    return (
      <img
        src={fallbackSrc}
        alt={token.symbol}
        width={size}
        height={size}
        className="rounded-full flex-shrink-0 object-cover"
        style={{ width: size, height: size }}
        onError={() => setFallbackError(true)}
        loading="lazy"
      />
    );
  }

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f97316", "#ef4444", "#14b8a6", "#a855f7", "#e11d48", "#0ea5e9"];
  const hash = token.symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colorIdx = hash % colors.length;
  const fontSize = size <= 20 ? 7 : size <= 28 ? 9 : 11;

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white"
      style={{ width: size, height: size, backgroundColor: colors[colorIdx], fontSize }}
      data-testid="token-logo-fallback"
    >
      {token.symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function PriceCell({ price, token, className = "" }: { price: number; token: any; className?: string }) {
  const prevPrice = useRef(price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (price !== prevPrice.current) {
      setFlash(price > prevPrice.current ? "up" : "down");
      prevPrice.current = price;
      const timer = setTimeout(() => setFlash(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [price]);

  const dir = (token as any)?._priceDirection;
  const activeFlash = flash || dir;

  return (
    <span
      className={`font-mono font-medium transition-colors duration-300 ${
        activeFlash === "up" ? "text-gain" : activeFlash === "down" ? "text-loss" : ""
      } ${className}`}
    >
      {formatPrice(price)}
    </span>
  );
}

interface TokenTableProps {
  tokens: Token[];
  isLoading?: boolean;
  onSelectToken?: (token: Token) => void;
  onToggleWatchlist?: (tokenId: number) => void;
  onQuickBuy?: (token: Token) => void;
  watchlistedIds?: Set<number>;
  variant?: "full" | "compact";
  hasInstantWallet?: boolean;
}

function TokenRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50">
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="w-24 h-4" />
      <Skeleton className="w-16 h-4 ml-auto" />
      <Skeleton className="w-14 h-4" />
      <Skeleton className="w-16 h-4" />
    </div>
  );
}

export function TokenTable({
  tokens,
  isLoading,
  onSelectToken,
  onToggleWatchlist,
  onQuickBuy,
  watchlistedIds = new Set(),
  variant = "full",
  hasInstantWallet = false,
}: TokenTableProps) {
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <TokenRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">No tokens found</p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="overflow-auto scrollbar-thin">
        {tokens.map((token, idx) => {
          const isGain24h = (token.priceChange24h ?? 0) >= 0;
          const isWatchlisted = watchlistedIds.has(token.id);

          return (
            <div
              key={token.id}
              data-testid={`row-token-${token.id}`}
              className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover-elevate cursor-pointer"
              onClick={() => onSelectToken?.(token)}
            >
              <TokenLogo token={token} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs" data-testid={`text-token-symbol-${token.id}`}>{token.symbol}</span>
                  {token.isVerified && <ShieldCheck className="w-3 h-3 text-info" />}
                  {token.isTrending && <Flame className="w-3 h-3 text-warning" />}
                  {token.isNew && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 text-gain border-gain/30">NEW</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[120px] text-foreground/60">{token.name}</span>
                  <Badge variant="outline" className="text-[7px] px-0.5 py-0 h-3">{(token.chain || "sol").toUpperCase().slice(0, 3)}</Badge>
                  <span className="font-mono">Vol {formatCompact(token.volume24h ?? 0)}</span>
                  <span className="font-mono">Liq {formatCompact(token.liquidity ?? 0)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div data-testid={`text-token-price-${token.id}`}>
                  <PriceCell price={token.price} token={token} className="text-xs" />
                </div>
                <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${isGain24h ? "text-gain" : "text-loss"}`}>
                  {isGain24h ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {formatPercent(token.priceChange24h)}
                </div>
              </div>
              {hasInstantWallet && onQuickBuy && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-shrink-0 text-[9px] text-gain h-6 px-1.5 gap-0.5"
                  data-testid={`button-quick-buy-${token.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickBuy(token);
                  }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  Buy
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="flex-shrink-0"
                data-testid={`button-watchlist-${token.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatchlist?.(token.id);
                }}
              >
                <Star className={`w-3.5 h-3.5 ${isWatchlisted ? "fill-warning text-warning" : "text-muted-foreground"}`} />
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-auto scrollbar-thin">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="text-left py-2 px-3 font-medium sticky top-0 bg-card z-10">#</th>
            <th className="text-left py-2 px-3 font-medium sticky top-0 bg-card z-10">Token</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">Price</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">1h %</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">24h %</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">Volume</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">MCap</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">Liq</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">Holders</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">Txns</th>
            <th className="text-right py-2 px-3 font-medium sticky top-0 bg-card z-10">Age</th>
            {hasInstantWallet && <th className="py-2 px-1 sticky top-0 bg-card z-10"></th>}
            <th className="py-2 px-3 sticky top-0 bg-card z-10"></th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, idx) => {
            const isGain1h = (token.priceChange1h ?? 0) >= 0;
            const isGain24h = (token.priceChange24h ?? 0) >= 0;
            const isWatchlisted = watchlistedIds.has(token.id);

            return (
              <tr
                key={token.id}
                data-testid={`row-token-${token.id}`}
                className="border-b border-border/30 hover-elevate cursor-pointer transition-colors"
                onClick={() => onSelectToken?.(token)}
              >
                <td className="py-2 px-3 text-muted-foreground font-mono">{idx + 1}</td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <TokenLogo token={token} size={28} />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs" data-testid={`text-token-symbol-${token.id}`}>{token.symbol}</span>
                        {token.isVerified && <ShieldCheck className="w-3 h-3 text-info" />}
                        {token.isTrending && <Flame className="w-3 h-3 text-warning" />}
                        {token.isNew && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 text-gain border-gain/30">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-foreground/60 truncate max-w-[180px]" data-testid={`text-token-name-${token.id}`}>{token.name}</span>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 text-right" data-testid={`text-token-price-${token.id}`}>
                  <PriceCell price={token.price} token={token} className="text-xs" />
                </td>
                <td className={`py-2 px-3 text-right font-mono ${isGain1h ? "text-gain" : "text-loss"}`}>
                  <div className="flex items-center justify-end gap-0.5">
                    {isGain1h ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatPercent(token.priceChange1h)}
                  </div>
                </td>
                <td className={`py-2 px-3 text-right font-mono ${isGain24h ? "text-gain" : "text-loss"}`}>
                  <div className="flex items-center justify-end gap-0.5">
                    {isGain24h ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatPercent(token.priceChange24h)}
                  </div>
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {formatCompact(token.volume24h ?? 0)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {formatCompact(token.marketCap ?? 0)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {formatCompact(token.liquidity ?? 0)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {(token.holders ?? 0).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {(token.txns24h ?? 0).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right text-muted-foreground">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-mono">{token.createdAt ? formatTimeAgo(token.createdAt) : "-"}</span>
                  </div>
                </td>
                {hasInstantWallet && (
                  <td className="py-2 px-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[9px] text-gain h-6 px-1.5 gap-0.5"
                      data-testid={`button-quick-buy-${token.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickBuy?.(token);
                      }}
                    >
                      <Zap className="w-2.5 h-2.5" />
                      Buy
                    </Button>
                  </td>
                )}
                <td className="py-2 px-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-watchlist-${token.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist?.(token.id);
                    }}
                  >
                    <Star className={`w-3.5 h-3.5 ${isWatchlisted ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
