import { useState, useEffect, useCallback, useRef } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatCompact } from "@/lib/format";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Droplets,
  BarChart3,
  Zap,
  Radio,
  Flame,
  Star,
  Wallet,
  Bot,
  Briefcase,
  Shield,
  Crosshair,
  Copy,
  Rocket,
  Bell,
  Fuel,
  Command,
  BookOpen,
} from "lucide-react";
import { useLocation } from "wouter";

const SUPPORTED_CHAINS = ["solana", "ethereum", "base", "bsc", "tron"];
const CHAIN_LABELS: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  bsc: "BNB",
  tron: "TRX",
};
const CHAIN_COLORS: Record<string, string> = {
  solana: "text-[hsl(280,80%,65%)]",
  ethereum: "text-[hsl(220,80%,65%)]",
  base: "text-[hsl(210,80%,55%)]",
  bsc: "text-[hsl(45,90%,55%)]",
  tron: "text-[hsl(0,75%,55%)]",
};

interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd: string;
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  url?: string;
}

export interface CommandPaletteResult {
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

interface CommandPaletteProps {
  onSelectToken?: (token: CommandPaletteResult) => void;
}

const NAV_ITEMS = [
  { title: "Scanner", url: "/scanner", icon: Radio, group: "Navigate" },
  { title: "Trending", url: "/trending", icon: Flame, group: "Navigate" },
  { title: "New Pairs", url: "/new", icon: Zap, group: "Navigate" },
  { title: "Meme Launches", url: "/memes", icon: Rocket, group: "Navigate" },
  { title: "Watchlist", url: "/watchlist", icon: Star, group: "Navigate" },
  { title: "Portfolio", url: "/portfolio", icon: Briefcase, group: "Trading" },
  { title: "AI Agents", url: "/ai-agents", icon: Bot, group: "Trading" },
  { title: "Smart Money", url: "/smart-money", icon: Wallet, group: "Trading" },
  { title: "Copy Trading", url: "/copy-trading", icon: Copy, group: "Trading" },
  { title: "Sniper Mode", url: "/sniper", icon: Crosshair, group: "Trading" },
  { title: "Alerts", url: "/alerts", icon: Bell, group: "Trading" },
  { title: "Token Safety", url: "/safety", icon: Shield, group: "Tools" },
  { title: "Gas Tracker", url: "/gas", icon: Fuel, group: "Tools" },
  { title: "How to Use AI Agents", url: "/guide", icon: BookOpen, group: "Tools" },
];

export function CommandPalette({ onSelectToken }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchDex = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const isAddress = (trimmed.length >= 30 && /^[A-Za-z0-9]+$/.test(trimmed)) ||
        (trimmed.startsWith("0x") && trimmed.length >= 40) ||
        (trimmed.startsWith("T") && trimmed.length >= 30);

      const endpoint = isAddress
        ? `/api/dex/tokens/${encodeURIComponent(trimmed)}`
        : `/api/dex/search?q=${encodeURIComponent(trimmed)}`;
      const resp = await fetch(endpoint);
      const data = await resp.json();
      const pairs = (data.pairs || [])
        .filter((p: DexPair) => SUPPORTED_CHAINS.includes(p.chainId))
        .slice(0, 8);
      setResults(pairs);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => searchDex(query), 300);
    } else {
      setResults([]);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchDex]);

  const handleSelectToken = (pair: DexPair) => {
    const token: CommandPaletteResult = {
      address: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      chain: pair.chainId,
      price: parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      marketCap: pair.fdv ?? 0,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      url: pair.url,
    };
    onSelectToken?.(token);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    setOpen(false);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search tokens, navigate pages... (Ctrl+K)"
        value={query}
        onValueChange={setQuery}
        data-testid="input-command-palette"
      />
      <CommandList>
        <CommandEmpty>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-gain border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Searching DexScreener...</span>
            </div>
          ) : query.length >= 2 ? (
            <span className="text-xs">No tokens found for "{query}"</span>
          ) : (
            <span className="text-xs">Type to search tokens or use commands below</span>
          )}
        </CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="Tokens">
            {results.map((pair, idx) => {
              const price = parseFloat(pair.priceUsd) || 0;
              const change24h = pair.priceChange?.h24 ?? 0;
              const isGain = change24h >= 0;
              return (
                <CommandItem
                  key={`${pair.pairAddress}-${idx}`}
                  value={`${pair.baseToken.symbol} ${pair.baseToken.name} ${pair.baseToken.address}`}
                  onSelect={() => handleSelectToken(pair)}
                  className="cursor-pointer"
                  data-testid={`cmd-token-${pair.baseToken.symbol}-${idx}`}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {pair.baseToken.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{pair.baseToken.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">{pair.baseToken.name}</span>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 ${CHAIN_COLORS[pair.chainId] || ""}`}>
                          {CHAIN_LABELS[pair.chainId] || pair.chainId}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Droplets className="w-2.5 h-2.5" />
                          ${formatCompact(pair.liquidity?.usd ?? 0)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <BarChart3 className="w-2.5 h-2.5" />
                          ${formatCompact(pair.volume?.h24 ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-sm font-medium">{formatPrice(price)}</div>
                      <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${isGain ? "text-gain" : "text-loss"}`}>
                        {isGain ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        {isGain ? "+" : ""}{change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {query.length < 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              {NAV_ITEMS.filter(i => i.group === "Navigate").map((item) => (
                <CommandItem
                  key={item.url}
                  value={item.title}
                  onSelect={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                  data-testid={`cmd-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Trading">
              {NAV_ITEMS.filter(i => i.group === "Trading").map((item) => (
                <CommandItem
                  key={item.url}
                  value={item.title}
                  onSelect={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                  data-testid={`cmd-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Tools">
              {NAV_ITEMS.filter(i => i.group === "Tools").map((item) => (
                <CommandItem
                  key={item.url}
                  value={item.title}
                  onSelect={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                  data-testid={`cmd-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">
            <Command className="w-2.5 h-2.5 inline" />K
          </kbd>
          <span>to open</span>
          <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">/</kbd>
          <span>quick search</span>
          <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">Esc</kbd>
          <span>to close</span>
        </div>
      </div>
    </CommandDialog>
  );
}
