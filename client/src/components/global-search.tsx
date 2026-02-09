import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowUpRight, ArrowDownRight, Droplets, BarChart3, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

const SUPPORTED_CHAINS = ["solana", "ethereum", "base", "bsc", "tron"];
const CHAIN_LABELS: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  bsc: "BNB",
  tron: "TRX",
};

function looksLikeAddress(q: string): boolean {
  const trimmed = q.trim();
  if (trimmed.length >= 30 && /^[A-Za-z0-9]+$/.test(trimmed)) return true;
  if (trimmed.startsWith("0x") && trimmed.length >= 40) return true;
  if (trimmed.startsWith("T") && trimmed.length >= 30) return true;
  return false;
}

export interface DexSearchResult {
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

interface GlobalSearchProps {
  onSearch?: (query: string) => void;
  onSelectToken?: (token: DexSearchResult) => void;
  selectedChain?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

export function GlobalSearch({ onSearch, onSelectToken, selectedChain = "all", className = "", inputClassName = "", placeholder = "Search token name or paste address..." }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [dexResults, setDexResults] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchDex = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setDexResults([]);
      setShowDropdown(false);
      return;
    }

    const isAddress = looksLikeAddress(trimmed);
    if (!isAddress && trimmed.length < 3) {
      setDexResults([]);
      return;
    }

    setLoading(true);
    setShowDropdown(true);
    try {
      const endpoint = isAddress
        ? `/api/dex/tokens/${encodeURIComponent(trimmed)}`
        : `/api/dex/search?q=${encodeURIComponent(trimmed)}`;
      const resp = await fetch(endpoint);
      const data = await resp.json();
      const pairs = (data.pairs || [])
        .filter((p: DexPair) => {
          if (selectedChain && selectedChain !== "all") return p.chainId === selectedChain;
          return SUPPORTED_CHAINS.includes(p.chainId);
        })
        .slice(0, 10);
      setDexResults(pairs);
    } catch {
      setDexResults([]);
    }
    setLoading(false);
  }, [selectedChain]);

  useEffect(() => {
    const timeout = setTimeout(() => searchDex(query), 400);
    return () => clearTimeout(timeout);
  }, [query, searchDex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch?.(value);
  };

  const clearSearch = () => {
    setQuery("");
    setDexResults([]);
    setShowDropdown(false);
    onSearch?.("");
  };

  const handleSelectPair = (pair: DexPair) => {
    if (onSelectToken) {
      const result: DexSearchResult = {
        address: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        chain: pair.chainId,
        price: parseFloat(pair.priceUsd || "0"),
        priceChange24h: pair.priceChange?.h24 ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        liquidity: pair.liquidity?.usd ?? 0,
        marketCap: pair.fdv ?? 0,
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        url: pair.url,
      };
      onSelectToken(result);
    }
    setShowDropdown(false);
    setQuery("");
    onSearch?.("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
      <Input
        data-testid="input-search"
        type="text"
        placeholder={placeholder}
        className={`pl-8 pr-7 text-xs font-mono bg-background border-border ${inputClassName}`}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (dexResults.length > 0) setShowDropdown(true); }}
      />
      {query && (
        <button
          onClick={clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground z-10"
          data-testid="button-clear-search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showDropdown && (query.trim().length >= 2) && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-[400px] overflow-auto shadow-lg border">
          {loading && (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          )}

          {!loading && dexResults.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No tokens found on DexScreener</p>
              <p className="text-[10px] text-muted-foreground mt-1">Try a different name, symbol, or address</p>
            </div>
          )}

          {!loading && dexResults.length > 0 && (
            <div>
              <div className="px-3 py-1.5 border-b border-border">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {dexResults.length} result{dexResults.length !== 1 ? "s" : ""} from DexScreener
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {dexResults.map((pair, idx) => {
                  const change24h = pair.priceChange?.h24 ?? 0;
                  const isGain = change24h >= 0;
                  return (
                    <div
                      key={`${pair.pairAddress}-${idx}`}
                      data-testid={`row-search-result-${idx}`}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover-elevate cursor-pointer"
                      onClick={() => handleSelectPair(pair)}
                    >
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                        {pair.baseToken.symbol.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs">{pair.baseToken.symbol}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{pair.baseToken.name}</span>
                          <Badge variant="secondary" className="text-[8px] font-mono px-1 py-0">
                            {CHAIN_LABELS[pair.chainId] || pair.chainId}
                          </Badge>
                          <Badge variant="outline" className="text-[8px] font-mono px-1 py-0">
                            {pair.dexId}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground font-mono">
                          <span>{pair.baseToken.address.slice(0, 6)}...{pair.baseToken.address.slice(-4)}</span>
                          {pair.liquidity?.usd != null && (
                            <span className="flex items-center gap-0.5">
                              <Droplets className="w-2.5 h-2.5" />
                              ${formatCompact(pair.liquidity.usd)}
                            </span>
                          )}
                          {pair.volume?.h24 != null && (
                            <span className="flex items-center gap-0.5">
                              <BarChart3 className="w-2.5 h-2.5" />
                              ${formatCompact(pair.volume.h24)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-mono font-bold">{formatPrice(parseFloat(pair.priceUsd || "0"))}</div>
                        <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${isGain ? "text-gain" : "text-loss"}`}>
                          {isGain ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                          {isGain ? "+" : ""}{change24h.toFixed(1)}%
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
