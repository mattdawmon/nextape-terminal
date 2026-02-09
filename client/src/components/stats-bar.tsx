import { type Token } from "@shared/schema";
import { formatCompact } from "@/lib/format";
import { TrendingUp, BarChart3, Users, Activity, Flame } from "lucide-react";

interface StatsBarProps {
  tokens: Token[];
}

export function StatsBar({ tokens }: StatsBarProps) {
  const totalVolume = tokens.reduce((sum, t) => sum + (t.volume24h ?? 0), 0);
  const totalMarketCap = tokens.reduce((sum, t) => sum + (t.marketCap ?? 0), 0);
  const trendingCount = tokens.filter((t) => t.isTrending).length;
  const newCount = tokens.filter((t) => t.isNew).length;
  const totalTxns = tokens.reduce((sum, t) => sum + (t.txns24h ?? 0), 0);

  const stats = [
    { icon: BarChart3, label: "Vol", value: `$${formatCompact(totalVolume)}`, color: "text-info" },
    { icon: TrendingUp, label: "MCap", value: `$${formatCompact(totalMarketCap)}`, color: "text-gain" },
    { icon: Flame, label: "Hot", value: String(trendingCount), color: "text-warning" },
    { icon: Users, label: "New", value: String(newCount), color: "text-gain" },
    { icon: Activity, label: "Txns", value: formatCompact(totalTxns), color: "text-muted-foreground" },
  ];

  return (
    <div className="flex items-center gap-3 px-3 py-1 border-b border-border bg-card overflow-x-auto scrollbar-thin">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1 whitespace-nowrap">
          <stat.icon className={`w-3 h-3 ${stat.color} flex-shrink-0`} />
          <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          <span className="text-[10px] font-mono font-medium">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
