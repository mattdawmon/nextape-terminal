import { useQuery } from "@tanstack/react-query";
import { type Token, type Trade } from "@shared/schema";
import { ActivityFeed } from "@/components/activity-feed";
import { Activity as ActivityIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/i18n";

export default function ActivityPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
  });

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <ActivityIcon className="w-4 h-4 text-info" />
        <span className="font-bold text-sm">{t.activity.title}</span>
        <span className="text-xs text-muted-foreground font-mono">({trades.length} {t.common.trades})</span>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        <ActivityFeed trades={trades} tokens={tokens} isLoading={tradesLoading || tokensLoading} />
      </div>
    </div>
  );
}
