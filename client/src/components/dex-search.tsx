import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, TrendingUp, ExternalLink, Droplets, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCompact, formatPrice } from "@/lib/format";

interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd: string;
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  txns?: { h24?: { buys: number; sells: number } };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  pairCreatedAt?: number;
  url?: string;
  info?: { imageUrl?: string };
}

const SUPPORTED_CHAINS = ["solana", "ethereum", "base", "bsc", "tron"];
const CHAIN_LABELS: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  bsc: "BNB",
  tron: "TRX",
};

interface DexSearchProps {
  onSelectToken?: (pair: DexPair) => void;
  selectedChain?: string;
}

export function DexSearch({ onSelectToken, selectedChain = "all" }: DexSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchTokens = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const resp = await fetch(`/api/dex/search?q=${encodeURIComponent(q.trim())}`);
      const data = await resp.json();
      const pairs = (data.pairs || [])
        .filter((p: DexPair) => {
          if (selectedChain && selectedChain !== "all") return p.chainId === selectedChain;
          return SUPPORTED_CHAINS.includes(p.chainId);
        })
        .slice(0, 25);
      setResults(pairs);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [selectedChain]);

  useEffect(() => {
    const timeout = setTimeout(() => searchTokens(query), 400);
    return () => clearTimeout(timeout);
  }, [query, searchTokens]);

  const formatAge = (createdAt?: number) => {
    if (!createdAt) return "N/A";
    const diff = Date.now() - createdAt;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-info" />
          <span className="font-bold text-sm">Live Token Search</span>
          <Badge variant="outline" className="text-[10px] font-mono">DexScreener</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="input-dex-search"
            type="search"
            placeholder="Search any token name, symbol, or address..."
            className="pl-8 text-xs font-mono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No tokens found</p>
            <p className="text-xs mt-1 opacity-60">Try a different search term</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="divide-y divide-border/30">
            {results.map((pair, idx) => {
              const change24h = pair.priceChange?.h24 ?? 0;
              const isGain = change24h >= 0;
              return (
                <div
                  key={`${pair.pairAddress}-${idx}`}
                  data-testid={`row-dex-result-${idx}`}
                  className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer"
                  onClick={() => onSelectToken?.(pair)}
                >
                  {pair.info?.imageUrl ? (
                    <img src={pair.info.imageUrl} alt={pair.baseToken.symbol} className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {pair.baseToken.symbol.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs">{pair.baseToken.symbol}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{pair.baseToken.name}</span>
                      <Badge variant="secondary" className="text-[9px] font-mono">{CHAIN_LABELS[pair.chainId] || pair.chainId}</Badge>
                      <Badge variant="outline" className="text-[9px] font-mono">{pair.dexId}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                      <span>{pair.baseToken.address.slice(0, 6)}...{pair.baseToken.address.slice(-4)}</span>
                      <span>Age: {formatAge(pair.pairCreatedAt)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono font-bold">${formatPrice(parseFloat(pair.priceUsd || "0"))}</div>
                    <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${isGain ? "text-gain" : "text-loss"}`}>
                      {isGain ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                      {isGain ? "+" : ""}{change24h.toFixed(1)}%
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-0.5 text-[10px] font-mono flex-shrink-0">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Droplets className="w-2.5 h-2.5" />
                      <span>${formatCompact(pair.liquidity?.usd ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <BarChart3 className="w-2.5 h-2.5" />
                      <span>${formatCompact(pair.volume?.h24 ?? 0)}</span>
                    </div>
                  </div>
                  {pair.fdv && (
                    <div className="hidden md:block text-[10px] font-mono text-muted-foreground flex-shrink-0">
                      MCap ${formatCompact(pair.fdv)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Search any token across all chains</p>
            <p className="text-xs mt-1 opacity-60">SOL / ETH / BASE / BNB / TRX via DexScreener</p>
          </div>
        )}
      </div>
    </div>
  );
}
