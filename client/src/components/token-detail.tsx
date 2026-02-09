import { type Token, type SafetyReport } from "@shared/schema";
import { formatPrice, formatCompact, formatPercent, formatAddress, formatTimeAgo } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldAlert,
  Flame,
  Copy,
  ExternalLink,
  Users,
  Droplets,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Activity,
  Eye,
  Lock,
  Unlock,
  Bug,
  CheckCircle,
  XCircle,
  Wallet,
  Zap,
  AlertTriangle,
  Brain,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TokenLogo } from "@/components/token-table";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface TokenHolder {
  rank: number;
  address: string;
  percentage: number;
  value: number;
  type: "dev" | "insider" | "whale" | "holder";
  label?: string;
  lastActivity?: string;
}

interface TokenHolderData {
  holders: TokenHolder[];
  totalHolders: number;
  whaleCount: number;
  insiderCount: number;
  top10Percent: number;
  top20Percent: number;
}

interface TokenInsider {
  address: string;
  type: "dev" | "early_buyer" | "smart_money";
  percentage: number;
  value: number;
  buyPrice: number;
  currentPnl: number;
  lastTx: string;
  txCount: number;
}

interface TokenInsiderData {
  insiders: TokenInsider[];
  devWallet: { address: string; percentage: number; lastActivity: string } | null;
  earlyBuyerCount: number;
  smartMoneyCount: number;
}

interface TokenDetailProps {
  token: Token | null;
}

const HOLDER_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f97316", "#ef4444", "#14b8a6", "#a855f7"];
const TYPE_COLORS: Record<string, string> = {
  dev: "text-loss",
  insider: "text-warning",
  whale: "text-info",
  holder: "text-muted-foreground",
};
const TYPE_LABELS: Record<string, string> = {
  dev: "Dev",
  insider: "Insider",
  whale: "Whale",
  holder: "Holder",
  early_buyer: "Early Buyer",
  smart_money: "Smart Money",
};

export function TokenDetail({ token }: TokenDetailProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm font-medium">Select a token</p>
        <p className="text-xs mt-1 opacity-60">View detailed analytics and trade</p>
      </div>
    );
  }

  const isGain24h = (token.priceChange24h ?? 0) >= 0;
  const buyRatio = token.txns24h ? ((token.buys24h ?? 0) / token.txns24h) * 100 : 50;

  const copyAddress = () => {
    navigator.clipboard.writeText(token.address);
    toast({ title: "Address copied", description: token.address });
  };

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <TokenLogo token={token} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base" data-testid={`text-detail-symbol-${token.id}`}>{token.symbol}</span>
              {token.isVerified && <ShieldCheck className="w-4 h-4 text-info" />}
              {token.isTrending && <Flame className="w-4 h-4 text-warning" />}
              {token.isNew && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 text-gain border-gain/30">NEW</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">{token.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
            {formatAddress(token.address)}
          </span>
          <Button size="icon" variant="ghost" onClick={copyAddress} data-testid="button-copy-address">
            <Copy className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" data-testid="button-explorer">
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-8 p-0 justify-start gap-0">
          <TabsTrigger value="overview" className="rounded-none text-[10px] h-8 px-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-info" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="holders" className="rounded-none text-[10px] h-8 px-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-info" data-testid="tab-holders">
            Holders
          </TabsTrigger>
          <TabsTrigger value="insiders" className="rounded-none text-[10px] h-8 px-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-info" data-testid="tab-insiders">
            Insiders
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-none text-[10px] h-8 px-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-info" data-testid="tab-security">
            Security
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab token={token} isGain24h={isGain24h} buyRatio={buyRatio} />
          </TabsContent>
          <TabsContent value="holders" className="mt-0">
            <HoldersTab token={token} />
          </TabsContent>
          <TabsContent value="insiders" className="mt-0">
            <InsidersTab token={token} />
          </TabsContent>
          <TabsContent value="security" className="mt-0">
            <SecurityTab token={token} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function MetricCell({ icon: Icon, label, value, testId }: { icon: any; label: string; value: string; testId?: string }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        <Icon className="w-3 h-3" />
        <span className="text-[10px]">{label}</span>
      </div>
      <span className="text-xs font-mono font-medium" data-testid={testId}>{value}</span>
    </div>
  );
}

function OverviewTab({ token, isGain24h, buyRatio }: { token: Token; isGain24h: boolean; buyRatio: number }) {
  const holderDistribution = [
    { name: "Top 10", value: token.topHolderPercent ?? 0 },
    { name: "Others", value: 100 - (token.topHolderPercent ?? 0) },
  ];

  return (
    <div>
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold font-mono" data-testid={`text-detail-price-${token.id}`}>{formatPrice(token.price)}</span>
          <div className={`flex items-center gap-0.5 text-sm font-mono ${isGain24h ? "text-gain" : "text-loss"}`}>
            {isGain24h ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {formatPercent(token.priceChange24h)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <MetricCell icon={BarChart3} label="Market Cap" value={`$${formatCompact(token.marketCap ?? 0)}`} testId={`text-mcap-${token.id}`} />
        <MetricCell icon={Droplets} label="Liquidity" value={`$${formatCompact(token.liquidity ?? 0)}`} testId={`text-liq-${token.id}`} />
        <MetricCell icon={Users} label="Holders" value={(token.holders ?? 0).toLocaleString()} testId={`text-holders-${token.id}`} />
        <MetricCell icon={Activity} label="24h Txns" value={(token.txns24h ?? 0).toLocaleString()} testId={`text-txns-${token.id}`} />
      </div>

      <div className="px-3 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Buy / Sell Ratio (24h)</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gain" data-testid={`text-buys-${token.id}`}>{token.buys24h ?? 0}</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden bg-loss/30">
            <div className="h-full bg-gain rounded-full" style={{ width: `${buyRatio}%` }} />
          </div>
          <span className="text-[10px] font-mono text-loss" data-testid={`text-sells-${token.id}`}>{token.sells24h ?? 0}</span>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Holder Distribution</div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={holderDistribution}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={18}
                  outerRadius={30}
                  strokeWidth={0}
                >
                  <Cell fill="#6366f1" />
                  <Cell fill="hsl(var(--muted))" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Top 10 Holders</span>
              <span className="text-[10px] font-mono font-medium" data-testid={`text-top10-${token.id}`}>{(token.topHolderPercent ?? 0).toFixed(1)}%</span>
            </div>
            <Progress value={token.topHolderPercent ?? 0} className="h-1.5" />
            {token.devWalletPercent != null && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">Dev Wallet</span>
                <span className="text-[10px] font-mono font-medium text-warning" data-testid={`text-devwallet-${token.id}`}>{token.devWalletPercent.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <MetricCell icon={TrendingUp} label="1h Change" value={formatPercent(token.priceChange1h)} testId={`text-change1h-${token.id}`} />
        <MetricCell icon={BarChart3} label="Volume 24h" value={`$${formatCompact(token.volume24h ?? 0)}`} testId={`text-vol-${token.id}`} />
      </div>
    </div>
  );
}

function HoldersTab({ token }: { token: Token }) {
  const { data, isLoading, isError } = useQuery<TokenHolderData>({
    queryKey: ["/api/tokens", token.id, "holders"],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/${token.id}/holders`);
      if (!res.ok) throw new Error("Failed to fetch holders");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-md" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs">Failed to load holder data</p>
      </div>
    );
  }

  if (data.holders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs">No holder data available</p>
      </div>
    );
  }

  const chartData = data.holders.slice(0, 10).map((h) => ({
    name: formatAddress(h.address),
    value: h.percentage,
  }));

  return (
    <div>
      <div className="grid grid-cols-3 gap-px bg-border border-b border-border">
        <div className="bg-card px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Total</div>
          <span className="text-xs font-mono font-medium" data-testid={`text-total-holders-${token.id}`}>{data.totalHolders.toLocaleString()}</span>
        </div>
        <div className="bg-card px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Whales</div>
          <span className="text-xs font-mono font-medium text-info" data-testid={`text-whale-count-${token.id}`}>{data.whaleCount}</span>
        </div>
        <div className="bg-card px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Insiders</div>
          <span className="text-xs font-mono font-medium text-warning" data-testid={`text-insider-count-${token.id}`}>{data.insiderCount}</span>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Top 10 Distribution</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
                formatter={(val: number) => [`${val.toFixed(2)}%`, "Holdings"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={HOLDER_COLORS[i % HOLDER_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground">Top 10: <span className="font-mono font-medium text-foreground">{data.top10Percent.toFixed(1)}%</span></span>
          <span className="text-[10px] text-muted-foreground">Top 20: <span className="font-mono font-medium text-foreground">{data.top20Percent.toFixed(1)}%</span></span>
        </div>
      </div>

      <div>
        {data.holders.map((holder) => (
          <div
            key={holder.rank}
            className="flex items-center gap-2 px-3 py-2 border-b border-border/30"
            data-testid={`card-holder-${holder.rank}`}
          >
            <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">{holder.rank}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono truncate">{formatAddress(holder.address)}</span>
                <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3 ${TYPE_COLORS[holder.type]}`}>
                  {TYPE_LABELS[holder.type] || holder.type}
                </Badge>
                {holder.label && (
                  <span className="text-[8px] text-muted-foreground">{holder.label}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] font-mono font-medium">{holder.percentage.toFixed(2)}%</div>
              <div className="text-[9px] font-mono text-muted-foreground">${formatCompact(holder.value)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsidersTab({ token }: { token: Token }) {
  const { data, isLoading, isError } = useQuery<TokenInsiderData>({
    queryKey: ["/api/tokens", token.id, "insiders"],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/${token.id}/insiders`);
      if (!res.ok) throw new Error("Failed to fetch insiders");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Eye className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs">Failed to load insider data</p>
      </div>
    );
  }

  const devInsiders = data.insiders.filter((i) => i.type === "dev");
  const earlyBuyers = data.insiders.filter((i) => i.type === "early_buyer");
  const smartMoney = data.insiders.filter((i) => i.type === "smart_money");

  return (
    <div>
      {data.devWallet && (
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Wallet className="w-3 h-3 text-loss" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dev Wallet</span>
          </div>
          <Card className="p-2.5" data-testid={`card-dev-wallet-${token.id}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono truncate block">{formatAddress(data.devWallet.address)}</span>
                <span className="text-[9px] text-muted-foreground">{formatTimeAgo(data.devWallet.lastActivity)}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-mono font-bold text-loss">{data.devWallet.percentage.toFixed(2)}%</span>
                <div className="text-[9px] text-muted-foreground">held</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-border border-b border-border">
        <div className="bg-card px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Early Buyers</div>
          <span className="text-xs font-mono font-medium text-warning" data-testid={`text-early-buyers-${token.id}`}>{data.earlyBuyerCount}</span>
        </div>
        <div className="bg-card px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Smart Money</div>
          <span className="text-xs font-mono font-medium text-info" data-testid={`text-smart-money-${token.id}`}>{data.smartMoneyCount}</span>
        </div>
      </div>

      {earlyBuyers.length > 0 && (
        <div className="border-b border-border">
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-warning" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Early Buyers</span>
            </div>
          </div>
          {earlyBuyers.map((insider, idx) => (
            <InsiderRow key={idx} insider={insider} tokenId={token.id} index={idx} />
          ))}
        </div>
      )}

      {smartMoney.length > 0 && (
        <div className="border-b border-border">
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3 h-3 text-info" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Smart Money</span>
            </div>
          </div>
          {smartMoney.map((insider, idx) => (
            <InsiderRow key={idx} insider={insider} tokenId={token.id} index={idx} />
          ))}
        </div>
      )}

      {data.insiders.length === 0 && !data.devWallet && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Eye className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs">No insider activity detected</p>
        </div>
      )}
    </div>
  );
}

function InsiderRow({ insider, tokenId, index }: { insider: TokenInsider; tokenId: number; index: number }) {
  const isPnlPositive = insider.currentPnl >= 0;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-border/30"
      data-testid={`card-insider-${tokenId}-${index}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono truncate">{formatAddress(insider.address)}</span>
          <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3 ${insider.type === "early_buyer" ? "text-warning" : "text-info"}`}>
            {TYPE_LABELS[insider.type] || insider.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[9px] text-muted-foreground font-mono">{insider.txCount} txns</span>
          <span className="text-[9px] text-muted-foreground">{formatTimeAgo(insider.lastTx)}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[10px] font-mono font-medium">{insider.percentage.toFixed(2)}%</div>
        <div className={`text-[9px] font-mono ${isPnlPositive ? "text-gain" : "text-loss"}`}>
          {isPnlPositive ? "+" : ""}{formatCompact(insider.currentPnl)}
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ token }: { token: Token }) {
  const tokenIdStr = String(token.id);
  const isLiveToken = tokenIdStr.startsWith("live-") || (token as any).isLive;
  const isEvmChain = token.chain && !["solana", "tron"].includes((token.chain || "").toLowerCase());

  const { data: reports = [], isLoading: dbLoading } = useQuery<SafetyReport[]>({
    queryKey: ["/api/safety"],
    enabled: !isLiveToken,
  });

  const { data: liveReport, isLoading: liveLoading } = useQuery<any>({
    queryKey: [`/api/safety/scan-token/${tokenIdStr}`],
    enabled: isLiveToken || isEvmChain,
    staleTime: 60000,
  });

  const isLoading = isLiveToken ? liveLoading : dbLoading;

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        <Skeleton className="h-20 rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-md" />
        ))}
      </div>
    );
  }

  const dbReport = reports.find((r) => r.tokenId === token.id);
  const hasGoPlus = liveReport && liveReport.source === "goplus" && liveReport.overallScore != null;
  const report = hasGoPlus ? (liveReport as SafetyReport) : dbReport;
  const isLiveData = hasGoPlus;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Shield className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs">{isLiveToken && liveReport?.message ? liveReport.message : "No security report available"}</p>
      </div>
    );
  }

  const score = report.overallScore ?? 50;
  const scoreColor = score >= 75 ? "text-gain" : score >= 45 ? "text-warning" : "text-loss";
  const scoreLabel = score >= 75 ? "SAFE" : score >= 45 ? "CAUTION" : "DANGER";
  const scoreBg = score >= 75 ? "bg-gain/10 border-gain/20" : score >= 45 ? "bg-warning/10 border-warning/20" : "bg-loss/10 border-loss/20";

  const rugIndicators = [];
  if ((report.honeypotRisk ?? 0) > 50) rugIndicators.push("High honeypot risk");
  if (!report.lpLocked) rugIndicators.push("LP not locked");
  if (report.mintAuthority) rugIndicators.push("Mint authority enabled");
  if (report.freezeAuthority) rugIndicators.push("Freeze authority enabled");
  if ((report.devHolding ?? 0) > 10) rugIndicators.push("High dev holding");
  if ((report.topHolderConcentration ?? 0) > 50) rugIndicators.push("High holder concentration");

  return (
    <div>
      <div className="px-3 py-3 border-b border-border">
        <Card className={`p-3 ${scoreBg}`} data-testid={`card-safety-score-${token.id}`}>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className={`text-3xl font-bold font-mono ${scoreColor}`}>{score.toFixed(0)}</div>
              <div className="text-[10px] text-muted-foreground">/ 100</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={`text-[8px] ${scoreColor}`}>{scoreLabel}</Badge>
                {isLiveData && <Badge variant="outline" className="text-[7px] text-info border-info/30">GoPlus Live</Badge>}
              </div>
              <Progress value={score} className="h-1.5 mt-2" />
            </div>
          </div>
        </Card>
      </div>

      <div className="px-3 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">Risk Factors</div>
        <div className="space-y-1.5">
          <SecurityRow
            icon={Bug}
            label="Honeypot Risk"
            value={`${(report.honeypotRisk ?? 0).toFixed(1)}%`}
            good={(report.honeypotRisk ?? 100) < 20}
            testId={`text-honeypot-${token.id}`}
          />
          <SecurityRow
            icon={report.lpLocked ? Lock : Unlock}
            label="LP Locked"
            value={report.lpLocked ? `Yes (${report.lpLockDays ?? 0}d)` : "No"}
            good={!!report.lpLocked}
            testId={`text-lp-lock-${token.id}`}
          />
          <SecurityRow
            icon={report.contractVerified ? CheckCircle : XCircle}
            label="Contract Verified"
            value={report.contractVerified ? "Yes" : "No"}
            good={!!report.contractVerified}
            testId={`text-contract-${token.id}`}
          />
          <SecurityRow
            icon={report.mintAuthority ? AlertTriangle : CheckCircle}
            label="Mint Authority"
            value={report.mintAuthority ? "Enabled" : "Revoked"}
            good={!report.mintAuthority}
            testId={`text-mint-auth-${token.id}`}
          />
          <SecurityRow
            icon={report.freezeAuthority ? AlertTriangle : CheckCircle}
            label="Freeze Authority"
            value={report.freezeAuthority ? "Enabled" : "Revoked"}
            good={!report.freezeAuthority}
            testId={`text-freeze-auth-${token.id}`}
          />
          <SecurityRow
            icon={Users}
            label="Dev Holding"
            value={`${(report.devHolding ?? 0).toFixed(1)}%`}
            good={(report.devHolding ?? 100) < 5}
            testId={`text-dev-holding-${token.id}`}
          />
          <SecurityRow
            icon={Users}
            label="Top Holder Conc."
            value={`${(report.topHolderConcentration ?? 0).toFixed(1)}%`}
            good={(report.topHolderConcentration ?? 100) < 30}
            testId={`text-holder-conc-${token.id}`}
          />
        </div>
      </div>

      {rugIndicators.length > 0 && (
        <div className="px-3 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3 h-3 text-loss" />
            <span className="text-[10px] uppercase tracking-wider text-loss font-medium">Rug Pull Indicators</span>
          </div>
          <div className="space-y-1">
            {rugIndicators.map((indicator, idx) => (
              <div key={idx} className="flex items-center gap-1.5" data-testid={`text-rug-indicator-${token.id}-${idx}`}>
                <XCircle className="w-3 h-3 text-loss flex-shrink-0" />
                <span className="text-[10px] text-loss">{indicator}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rugIndicators.length === 0 && (
        <div className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-gain" />
            <span className="text-[10px] text-gain font-medium">No major rug pull indicators detected</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityRow({ icon: Icon, label, value, good, testId }: { icon: any; label: string; value: string; good: boolean; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3 h-3 ${good ? "text-gain" : "text-loss"}`} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className={`text-[10px] font-mono font-medium ${good ? "text-gain" : "text-loss"}`} data-testid={testId}>{value}</span>
    </div>
  );
}
