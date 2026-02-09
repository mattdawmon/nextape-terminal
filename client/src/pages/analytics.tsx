import { useQuery } from "@tanstack/react-query";
import { type Token } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { formatCompact, formatPrice } from "@/lib/format";
import { BarChart3, TrendingUp, Activity, Users, ArrowUpRight, ArrowDownRight, Droplets } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TierGate } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

export default function AnalyticsPage() {
  return (
    <TierGate feature="advancedAnalytics" featureLabel="Advanced Analytics" requiredTier="pro">
      <AnalyticsContent />
    </TierGate>
  );
}

function AnalyticsContent() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: tokens = [], isLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const stats = useMemo(() => {
    const totalVolume = tokens.reduce((s, tk) => s + (tk.volume24h ?? 0), 0);
    const totalMCap = tokens.reduce((s, tk) => s + (tk.marketCap ?? 0), 0);
    const totalLiq = tokens.reduce((s, tk) => s + (tk.liquidity ?? 0), 0);
    const totalHolders = tokens.reduce((s, tk) => s + (tk.holders ?? 0), 0);
    const gainers = tokens.filter((tk) => (tk.priceChange24h ?? 0) > 0).length;
    const losers = tokens.filter((tk) => (tk.priceChange24h ?? 0) < 0).length;

    return { totalVolume, totalMCap, totalLiq, totalHolders, gainers, losers };
  }, [tokens]);

  const volumeData = useMemo(
    () =>
      tokens
        .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
        .slice(0, 10)
        .map((tk) => ({ name: tk.symbol, volume: tk.volume24h ?? 0 })),
    [tokens]
  );

  const pieData = [
    { name: t.analytics.topGainers, value: stats.gainers, color: "hsl(142 71% 45%)" },
    { name: t.analytics.topLosers, value: stats.losers, color: "hsl(0 84% 55%)" },
  ];

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <BarChart3 className="w-4 h-4 text-info" />
        <span className="font-bold text-sm">{t.analytics.title}</span>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={BarChart3} label={t.analytics.totalVolume} value={`$${formatCompact(stats.totalVolume)}`} color="text-info" isMobile={isMobile} />
          <StatCard icon={TrendingUp} label={t.common.marketCap} value={`$${formatCompact(stats.totalMCap)}`} color="text-gain" isMobile={isMobile} />
          <StatCard icon={Droplets} label={t.common.liquidity} value={`$${formatCompact(stats.totalLiq)}`} color="text-warning" isMobile={isMobile} />
          <StatCard icon={Users} label={t.common.holders} value={formatCompact(stats.totalHolders)} color="text-muted-foreground" isMobile={isMobile} />
        </div>

        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"}`}>
          <Card className={`${isMobile ? "p-3" : "lg:col-span-2 p-4"}`}>
            <div className="text-xs font-medium mb-3">{t.analytics.volumeDistribution}</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <XAxis dataKey="name" tick={{ fontSize: isMobile ? 8 : 10, fill: "hsl(215 15% 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(215 15% 50%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220 18% 10%)",
                      border: "1px solid hsl(220 15% 16%)",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                    formatter={(value: number) => [`$${formatCompact(value)}`, t.common.volume]}
                  />
                  <Bar dataKey="volume" fill="hsl(199 89% 48%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={isMobile ? "p-3" : "p-4"}>
            <div className="text-xs font-medium mb-3">{t.analytics.topGainers} vs {t.analytics.topLosers}</div>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 30 : 40}
                    outerRadius={isMobile ? 50 : 65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220 18% 10%)",
                      border: "1px solid hsl(220 15% 16%)",
                      borderRadius: "6px",
                      fontSize: "11px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3 h-3 text-gain" />
                <span className="text-[10px] font-mono">{stats.gainers} {t.analytics.topGainers}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowDownRight className="w-3 h-3 text-loss" />
                <span className="text-[10px] font-mono">{stats.losers} {t.analytics.topLosers}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="text-xs font-medium mb-3">{t.analytics.topGainers}</div>
          <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"}`}>
            {tokens
              .sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0))
              .slice(0, 5)
              .map((token) => {
                const isGain = (token.priceChange24h ?? 0) >= 0;
                return (
                  <div key={token.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{token.symbol}</div>
                      <div className={`text-[10px] font-mono ${isGain ? "text-gain" : "text-loss"}`}>
                        {isGain ? "+" : ""}{(token.priceChange24h ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, isMobile }: { icon: any; label: string; value: string; color: string; isMobile: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{label}</span>
      </div>
      <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`}>{value}</span>
    </Card>
  );
}
