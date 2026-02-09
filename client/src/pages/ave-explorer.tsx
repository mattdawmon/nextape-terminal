import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, TrendingUp, TrendingDown, Flame, Star, Sparkles,
  Shield, ExternalLink, BarChart3, Globe, Zap, Crown,
  ArrowUpRight, ArrowDownRight, Layers, AlertTriangle, Key,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface AveToken {
  token: string;
  chain: string;
  name: string;
  symbol: string;
  current_price_usd: string;
  price_change_1d: string;
  price_change_24h: string;
  market_cap: string;
  fdv: string;
  tvl: string;
  tx_volume_u_24h: string;
  tx_count_24h: number;
  holders: number;
  logo_url: string;
  risk_score: string;
  risk_level: number;
  created_at: number;
  main_pair: string;
  locked_percent: string;
  is_mintable: string;
  has_mint_method: boolean;
  is_honeypot: boolean;
  is_lp_not_locked: boolean;
  has_not_renounced: boolean;
  has_not_open_source: boolean;
  appendix: string;
  token_price_change_5m?: string;
  token_price_change_1h?: string;
  token_price_change_4h?: string;
  token_tx_volume_usd_1h?: string;
  token_tx_volume_usd_24h?: string;
  token_buy_volume_u_5m?: string;
  token_sell_volume_u_5m?: string;
}

interface RankTopic {
  id: string;
  name_en: string;
  name_zh: string;
}

interface AveApiResponse {
  tokens?: AveToken[];
  topics?: RankTopic[];
  source?: string;
  hasApiKey?: boolean;
  error?: string;
}

function formatNumber(val: string | number, decimals = 2): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function formatPrice(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "$0";
  if (n < 0.00001) return `$${n.toExponential(2)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function PriceChange({ value }: { value: string }) {
  const n = parseFloat(value);
  const isPositive = n >= 0;
  return (
    <span className={`text-xs font-mono ${isPositive ? "text-gain" : "text-loss"}`}>
      {isPositive ? "+" : ""}{n.toFixed(2)}%
    </span>
  );
}

function chainBadgeColor(chain: string): string {
  const colors: Record<string, string> = {
    solana: "text-purple-400 border-purple-400/30",
    eth: "text-blue-400 border-blue-400/30",
    bsc: "text-yellow-400 border-yellow-400/30",
    base: "text-blue-300 border-blue-300/30",
    tron: "text-red-400 border-red-400/30",
    arbitrum: "text-blue-500 border-blue-500/30",
    polygon: "text-purple-300 border-purple-300/30",
    avalanche: "text-red-300 border-red-300/30",
    optimism: "text-red-400 border-red-400/30",
  };
  return colors[chain.toLowerCase()] || "text-muted-foreground border-muted-foreground/30";
}

function ApiKeyBanner({ t }: { t: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center" data-testid="banner-ave-api-key">
      <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-4">
        <Key className="w-7 h-7 text-warning" />
      </div>
      <h3 className="font-bold text-sm mb-2">{t.ave.apiKeyRequired}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-4">{t.ave.apiKeyDescription}</p>
      <a href="https://cloud.ave.ai" target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline" className="gap-1 text-xs" data-testid="button-get-ave-key">
          <ExternalLink className="w-3 h-3" />
          {t.ave.getApiKey}
        </Button>
      </a>
    </div>
  );
}

function TokenRow({ token, onClick, isSelected, t }: { token: AveToken; onClick: () => void; isSelected: boolean; t: any }) {
  const riskColor = parseInt(token.risk_score) >= 50 ? "text-gain" : parseInt(token.risk_score) >= 30 ? "text-warning" : "text-loss";
  const age = Math.floor((Date.now() / 1000 - token.created_at) / 86400);
  const ageStr = age >= 365 ? `${Math.floor(age / 365)}y` : age >= 30 ? `${Math.floor(age / 30)}mo` : `${age}d`;

  return (
    <div
      data-testid={`row-ave-token-${token.token}`}
      className={`flex items-center gap-2 px-3 py-2 border-b border-border/30 cursor-pointer hover-elevate ${isSelected ? "bg-accent/20" : ""}`}
      onClick={onClick}
    >
      {token.logo_url ? (
        <img src={token.logo_url} alt={token.symbol} className="w-7 h-7 rounded-full bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">{token.symbol?.charAt(0)}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-xs truncate">{token.symbol}</span>
          <Badge variant="outline" className={`text-[7px] py-0 ${chainBadgeColor(token.chain)}`}>{token.chain.toUpperCase()}</Badge>
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{token.name}</div>
      </div>
      <div className="text-right min-w-[60px]">
        <div className="text-xs font-mono">{formatPrice(token.current_price_usd)}</div>
        <PriceChange value={token.price_change_24h} />
      </div>
      <div className="text-right min-w-[50px] hidden md:block">
        <div className="text-[10px] text-muted-foreground">{t.ave.vol}</div>
        <div className="text-xs font-mono">{formatNumber(token.tx_volume_u_24h, 1)}</div>
      </div>
      <div className="text-right min-w-[50px] hidden lg:block">
        <div className="text-[10px] text-muted-foreground">{t.ave.mcap}</div>
        <div className="text-xs font-mono">{formatNumber(token.market_cap, 1)}</div>
      </div>
      <div className="text-right min-w-[30px] hidden lg:block">
        <div className={`text-[10px] font-mono ${riskColor}`}>{token.risk_score || "?"}</div>
      </div>
      <div className="text-right min-w-[25px] hidden md:block">
        <div className="text-[10px] text-muted-foreground">{ageStr}</div>
      </div>
    </div>
  );
}

function TokenDetail({ token, t }: { token: AveToken; t: any }) {
  let social: Record<string, string> = {};
  try { social = JSON.parse(token.appendix || "{}"); } catch {}

  const riskScore = parseInt(token.risk_score) || 0;
  const riskColor = riskScore >= 50 ? "text-gain" : riskScore >= 30 ? "text-warning" : "text-loss";
  const riskLabel = riskScore >= 50 ? t.ave.riskLow : riskScore >= 30 ? t.ave.riskMedium : t.ave.riskHigh;

  const details = [
    { label: t.common.price, value: formatPrice(token.current_price_usd) },
    { label: "24h", value: <PriceChange value={token.price_change_24h} /> },
    { label: "1d", value: <PriceChange value={token.price_change_1d} /> },
    { label: t.common.marketCap, value: formatNumber(token.market_cap) },
    { label: t.ave.fdv, value: formatNumber(token.fdv) },
    { label: t.ave.tvl, value: formatNumber(token.tvl) },
    { label: `${t.common.volume} 24h`, value: formatNumber(token.tx_volume_u_24h) },
    { label: `${t.ave.txns} 24h`, value: token.tx_count_24h.toLocaleString() },
    { label: t.common.holders, value: token.holders.toLocaleString() },
    { label: t.ave.lpLocked, value: `${(parseFloat(token.locked_percent) * 100).toFixed(1)}%` },
  ];

  if (token.token_price_change_1h) details.push({ label: "1h", value: <PriceChange value={token.token_price_change_1h} /> });
  if (token.token_price_change_4h) details.push({ label: "4h", value: <PriceChange value={token.token_price_change_4h} /> });

  const risks = [
    { label: t.ave.honeypot, safe: !token.is_honeypot },
    { label: t.ave.openSource, safe: !token.has_not_open_source },
    { label: t.ave.renounced, safe: !token.has_not_renounced },
    { label: t.ave.lpLocked, safe: !token.is_lp_not_locked },
    { label: t.ave.mintable, safe: token.is_mintable === "0" },
  ];

  return (
    <div className="space-y-3 p-3 overflow-auto h-full scrollbar-thin">
      <div className="flex items-center gap-2">
        {token.logo_url && <img src={token.logo_url} alt={token.symbol} className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
        <div>
          <div className="font-bold text-sm flex items-center gap-1">
            {token.symbol}
            <Badge variant="outline" className={`text-[8px] ${chainBadgeColor(token.chain)}`}>{token.chain.toUpperCase()}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">{token.name}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono font-bold text-sm">{formatPrice(token.current_price_usd)}</div>
          <PriceChange value={token.price_change_24h} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Shield className={`w-4 h-4 ${riskColor}`} />
        <span className={`text-xs font-semibold ${riskColor}`}>{riskLabel}</span>
        <Badge variant="outline" className={`text-[8px] ${riskColor}`}>{t.ave.score}: {riskScore}/100</Badge>
        <Badge variant="outline" className="text-[8px] text-muted-foreground">
          Ave.ai
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {details.map((d, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30">
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
            <span className="text-xs font-mono">{d.value}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs font-semibold mb-1.5 flex items-center gap-1">
          <Shield className="w-3 h-3" /> {t.ave.securityChecks}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {risks.map((r, i) => (
            <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${r.safe ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}>
              {r.safe ? <Shield className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {r.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground">{t.ave.contract}:</span>
        <code className="text-[9px] font-mono bg-muted px-1 py-0.5 rounded break-all">{token.token}</code>
      </div>

      {(social.website || social.twitter || social.telegram) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {social.website && (
            <a href={social.website} target="_blank" rel="noopener noreferrer">
              <Badge variant="outline" className="text-[8px] cursor-pointer hover-elevate gap-0.5">
                <Globe className="w-2.5 h-2.5" /> Web
              </Badge>
            </a>
          )}
          {social.twitter && (
            <a href={social.twitter} target="_blank" rel="noopener noreferrer">
              <Badge variant="outline" className="text-[8px] cursor-pointer hover-elevate gap-0.5">
                <ExternalLink className="w-2.5 h-2.5" /> X
              </Badge>
            </a>
          )}
          {social.telegram && (
            <a href={social.telegram} target="_blank" rel="noopener noreferrer">
              <Badge variant="outline" className="text-[8px] cursor-pointer hover-elevate gap-0.5">
                <ExternalLink className="w-2.5 h-2.5" /> TG
              </Badge>
            </a>
          )}
        </div>
      )}

      <a
        href={`https://ave.ai/token/${token.token}-${token.chain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
      >
        <Button size="sm" variant="outline" className="text-xs gap-1" data-testid="button-view-on-ave">
          <ExternalLink className="w-3 h-3" /> {t.ave.viewOnAve}
        </Button>
      </a>
    </div>
  );
}

const TOPIC_ICONS: Record<string, typeof Flame> = {
  hot: Flame,
  meme: Sparkles,
  gainer: ArrowUpRight,
  loser: ArrowDownRight,
  new: Zap,
  ai: Sparkles,
  depin: Layers,
  gamefi: Star,
  rwa: Crown,
};

export default function AveExplorerPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [activeTopic, setActiveTopic] = useState("hot");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedToken, setSelectedToken] = useState<AveToken | null>(null);
  const [chainFilter, setChainFilter] = useState("all");

  const { data: topicsData } = useQuery<AveApiResponse>({
    queryKey: ["/api/ave/ranks/topics"],
  });
  const topics = topicsData?.topics || [];
  const apiKeyMissing = topicsData?.hasApiKey === false || topicsData?.error === "AVEAI_KEY_MISSING";

  const { data: rankData, isLoading: rankLoading } = useQuery<AveApiResponse>({
    queryKey: ["/api/ave/ranks", activeTopic],
    enabled: !searchKeyword && !apiKeyMissing,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery<AveApiResponse>({
    queryKey: ["/api/ave/search", searchKeyword, chainFilter],
    enabled: !!searchKeyword && !apiKeyMissing,
    queryFn: async () => {
      const params = new URLSearchParams({ keyword: searchKeyword, limit: "100" });
      if (chainFilter !== "all") params.set("chain", chainFilter);
      const resp = await fetch(`/api/ave/search?${params}`);
      return resp.json();
    },
  });

  const isLoading = searchKeyword ? searchLoading : rankLoading;
  const tokens = useMemo((): AveToken[] => {
    const raw: AveToken[] = searchKeyword ? (searchData?.tokens || []) : (rankData?.tokens || []);
    if (chainFilter === "all") return raw;
    return raw.filter((tk: AveToken) => tk.chain.toLowerCase() === chainFilter.toLowerCase());
  }, [searchKeyword, searchData, rankData, chainFilter]);

  const handleSearch = useCallback(() => {
    const kw = searchInput.trim();
    if (!kw) {
      setSearchKeyword("");
      return;
    }
    setSearchKeyword(kw);
    setSelectedToken(null);
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearchKeyword("");
    setSelectedToken(null);
  }, []);

  const chains = ["all", "solana", "eth", "bsc", "base", "tron", "arbitrum", "polygon"];

  const renderEmptyState = () => {
    if (apiKeyMissing) return <ApiKeyBanner t={t} />;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Globe className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">{searchKeyword ? `${t.ave.noResultsFor} "${searchKeyword}"` : t.ave.noResults}</p>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 flex-wrap">
          <Globe className="w-4 h-4 text-info" />
          <span className="font-bold text-sm">{t.ave.title}</span>
          <Badge variant="outline" className="text-[8px] font-mono text-info border-info/30">{t.ave.subtitle}</Badge>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t.ave.searchPlaceholder}
            className="h-7 text-xs flex-1"
            data-testid="input-ave-search"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} className="h-7 text-xs" data-testid="button-ave-search">
            <Search className="w-3 h-3" />
          </Button>
          {searchKeyword && (
            <Button size="sm" variant="ghost" onClick={handleClearSearch} className="h-7 text-xs">
              {t.common.reset}
            </Button>
          )}
        </div>

        {!searchKeyword && !apiKeyMissing && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border overflow-x-auto scrollbar-thin">
            {topics.map(tp => {
              const Icon = TOPIC_ICONS[tp.id] || BarChart3;
              return (
                <Button
                  key={tp.id}
                  size="sm"
                  variant={activeTopic === tp.id ? "default" : "ghost"}
                  className="h-6 text-[10px] gap-0.5 shrink-0"
                  onClick={() => { setActiveTopic(tp.id); setSelectedToken(null); }}
                  data-testid={`button-topic-${tp.id}`}
                >
                  <Icon className="w-3 h-3" />
                  {tp.name_en}
                </Button>
              );
            })}
          </div>
        )}

        {selectedToken ? (
          <div className="flex-1 overflow-auto">
            <div className="px-3 py-1.5 border-b border-border">
              <Button size="sm" variant="ghost" onClick={() => setSelectedToken(null)} className="text-xs">{t.common.back}</Button>
            </div>
            <TokenDetail token={selectedToken} t={t} />
          </div>
        ) : (
          <div className="flex-1 overflow-auto scrollbar-thin">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                  <Skeleton className="w-7 h-7 rounded-full" />
                  <div className="flex-1 space-y-1"><Skeleton className="w-20 h-3" /><Skeleton className="w-28 h-2.5" /></div>
                  <Skeleton className="w-14 h-3" />
                </div>
              ))
            ) : tokens.length === 0 ? (
              renderEmptyState()
            ) : (
              tokens.map(tk => (
                <TokenRow key={`${tk.chain}-${tk.token}`} token={tk} onClick={() => setSelectedToken(tk)} isSelected={false} t={t} />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={selectedToken ? 60 : 100} minSize={40}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 flex-wrap">
            <Globe className="w-4 h-4 text-info" />
            <span className="font-bold text-sm">{t.ave.title}</span>
            <Badge variant="outline" className="text-[8px] font-mono text-info border-info/30">{t.ave.subtitle}</Badge>

            <div className="flex items-center gap-1 ml-auto">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={t.ave.searchPlaceholder}
                className="h-7 text-xs w-48"
                data-testid="input-ave-search"
              />
              <Button size="sm" variant="outline" onClick={handleSearch} className="h-7" data-testid="button-ave-search">
                <Search className="w-3 h-3" />
              </Button>
              {searchKeyword && (
                <Button size="sm" variant="ghost" onClick={handleClearSearch} className="h-7 text-xs">
                  {t.common.reset}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border flex-wrap">
            {!searchKeyword && !apiKeyMissing && topics.map(tp => {
              const Icon = TOPIC_ICONS[tp.id] || BarChart3;
              return (
                <Button
                  key={tp.id}
                  size="sm"
                  variant={activeTopic === tp.id ? "default" : "ghost"}
                  className="h-6 text-[10px] gap-0.5"
                  onClick={() => { setActiveTopic(tp.id); setSelectedToken(null); }}
                  data-testid={`button-topic-${tp.id}`}
                >
                  <Icon className="w-3 h-3" />
                  {tp.name_en}
                </Button>
              );
            })}

            <div className="flex items-center gap-1 ml-auto">
              {chains.map(c => (
                <Button
                  key={c}
                  size="sm"
                  variant={chainFilter === c ? "default" : "ghost"}
                  className="h-5 text-[9px] px-1.5"
                  onClick={() => setChainFilter(c)}
                  data-testid={`button-chain-${c}`}
                >
                  {c === "all" ? "ALL" : c.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            {isLoading ? (
              Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                  <Skeleton className="w-7 h-7 rounded-full" />
                  <div className="flex-1 space-y-1"><Skeleton className="w-20 h-3" /><Skeleton className="w-28 h-2.5" /></div>
                  <Skeleton className="w-14 h-3" />
                  <Skeleton className="w-12 h-3" />
                  <Skeleton className="w-12 h-3" />
                </div>
              ))
            ) : tokens.length === 0 ? (
              renderEmptyState()
            ) : (
              tokens.map(token => (
                <TokenRow key={`${token.chain}-${token.token}`} token={token} onClick={() => setSelectedToken(token)} isSelected={selectedToken?.token === token.token} t={t} />
              ))
            )}
          </div>

          <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground">
            <span>{tokens.length} {t.ave.tokens}</span>
            <span className="ml-auto">{t.ave.poweredBy}</span>
          </div>
        </div>
      </ResizablePanel>

      {selectedToken && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25}>
            <TokenDetail token={selectedToken} t={t} />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
