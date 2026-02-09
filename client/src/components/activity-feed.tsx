import { type Trade, type Token } from "@shared/schema";
import { formatPrice, formatCompact, formatTimeAgo, formatAddress } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityFeedProps {
  trades: Trade[];
  tokens: Token[];
  isLoading?: boolean;
}

function ActivitySkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
      <Skeleton className="w-6 h-6 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="w-24 h-3" />
        <Skeleton className="w-16 h-2.5" />
      </div>
      <Skeleton className="w-16 h-3" />
    </div>
  );
}

export function ActivityFeed({ trades, tokens, isLoading }: ActivityFeedProps) {
  const tokenMap = new Map(tokens.map((t) => [t.id, t]));

  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 10 }).map((_, i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto scrollbar-thin">
      {trades.map((trade) => {
        const token = tokenMap.get(trade.tokenId);
        const isBuy = trade.type === "buy";

        return (
          <div
            key={trade.id}
            data-testid={`activity-trade-${trade.id}`}
            className="flex items-center gap-2 px-3 py-2 border-b border-border/30 animate-slide-up"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isBuy ? "bg-gain/15" : "bg-loss/15"}`}>
              {isBuy ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold ${isBuy ? "text-gain" : "text-loss"}`}>
                  {isBuy ? "BUY" : "SELL"}
                </span>
                <span className="text-xs font-medium truncate">{token?.symbol || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                <span>{formatAddress(trade.wallet || "anon")}</span>
                <span>-</span>
                <span>{trade.timestamp ? formatTimeAgo(trade.timestamp) : "just now"}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono font-medium">{formatCompact(trade.amount)} SOL</div>
              <div className="text-[10px] font-mono text-muted-foreground">@{formatPrice(trade.price)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
