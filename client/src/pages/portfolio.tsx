import { useQuery } from "@tanstack/react-query";
import { type Token, type Position, type Trade } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompact, formatPrice, formatPercent } from "@/lib/format";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Download,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/i18n";

export default function PortfolioPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
  });

  const isLoading = positionsLoading || tokensLoading || tradesLoading;

  const tokenMap = useMemo(() => {
    const map = new Map<number, Token>();
    tokens.forEach((t) => map.set(t.id, t));
    return map;
  }, [tokens]);

  const openPositions = useMemo(() => positions.filter((p) => p.size > 0.0001), [positions]);
  const closedPositions = useMemo(() => positions.filter((p) => p.size <= 0.0001), [positions]);

  const stats = useMemo(() => {
    const totalValue = openPositions.reduce((s, p) => s + p.currentPrice * p.size, 0);
    const totalUnrealizedPnl = openPositions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
    const totalRealizedPnl = positions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
    const totalTrades = trades.length;
    return { totalValue, totalUnrealizedPnl, totalRealizedPnl, totalTrades };
  }, [openPositions, positions, trades]);

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
        <Skeleton className="h-40 rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border flex-wrap ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Briefcase className="w-4 h-4 text-info" />
        <span className="font-bold text-sm" data-testid="text-portfolio-title">{t.portfolio.title}</span>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.open("/api/trades/export", "_blank");
            }}
            data-testid="button-export-csv"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isMobile ? "Export" : t.portfolio.exportCsv}
          </Button>
        </div>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Wallet}
            label={t.portfolio.totalValue}
            value={`$${formatCompact(stats.totalValue)}`}
            color="text-info"
            testId="stat-portfolio-value"
            isMobile={isMobile}
          />
          <StatCard
            icon={stats.totalUnrealizedPnl >= 0 ? TrendingUp : TrendingDown}
            label={t.portfolio.unrealizedPnl}
            value={`${stats.totalUnrealizedPnl >= 0 ? "+" : ""}$${formatCompact(Math.abs(stats.totalUnrealizedPnl))}`}
            color={stats.totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}
            testId="stat-unrealized-pnl"
            isMobile={isMobile}
          />
          <StatCard
            icon={DollarSign}
            label={t.portfolio.totalPnl}
            value={`${stats.totalRealizedPnl >= 0 ? "+" : ""}$${formatCompact(Math.abs(stats.totalRealizedPnl))}`}
            color={stats.totalRealizedPnl >= 0 ? "text-gain" : "text-loss"}
            testId="stat-realized-pnl"
            isMobile={isMobile}
          />
          <StatCard
            icon={History}
            label={t.common.totalTrades}
            value={`${stats.totalTrades}`}
            color="text-info"
            testId="stat-total-trades"
            isMobile={isMobile}
          />
        </div>

        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="text-xs font-medium mb-3">{t.portfolio.holdings}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-positions">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium">{t.common.token}</th>
                  <th className="text-right py-2 px-3 font-medium">{t.portfolio.quantity}</th>
                  {!isMobile && <th className="text-right py-2 px-3 font-medium">{t.portfolio.entryPrice}</th>}
                  <th className="text-right py-2 px-3 font-medium">{t.portfolio.currentPrice}</th>
                  <th className="text-right py-2 px-3 font-medium">{t.portfolio.unrealizedPnl}</th>
                  {!isMobile && <th className="text-right py-2 px-3 font-medium">{t.portfolio.totalPnl}</th>}
                  {!isMobile && <th className="text-right py-2 pl-3 font-medium">{t.common.chain}</th>}
                </tr>
              </thead>
              <tbody>
                {openPositions.length === 0 ? (
                  <tr>
                    <td colSpan={isMobile ? 4 : 7} className="text-center py-8 text-muted-foreground">
                      {t.portfolio.noHoldings}
                    </td>
                  </tr>
                ) : (
                  openPositions.map((pos) => {
                    const token = tokenMap.get(pos.tokenId);
                    const uPnl = pos.unrealizedPnl ?? 0;
                    const uPnlPct = pos.unrealizedPnlPercent ?? 0;
                    const rPnl = pos.realizedPnl ?? 0;
                    const isGain = uPnl >= 0;
                    const isRGain = rPnl >= 0;

                    return (
                      <tr
                        key={pos.id}
                        className="border-b border-border/50 hover-elevate"
                        data-testid={`row-position-${pos.id}`}
                      >
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold">
                              {token?.symbol?.slice(0, 2) ?? "??"}
                            </div>
                            <span className="font-semibold" data-testid={`text-token-symbol-${pos.id}`}>
                              {token?.symbol ?? "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-3 font-mono" data-testid={`text-size-${pos.id}`}>
                          {formatCompact(pos.size)}
                        </td>
                        {!isMobile && (
                          <td className="text-right py-2 px-3 font-mono" data-testid={`text-avg-entry-${pos.id}`}>
                            {formatPrice(pos.avgEntry)}
                          </td>
                        )}
                        <td className="text-right py-2 px-3 font-mono" data-testid={`text-current-price-${pos.id}`}>
                          {formatPrice(pos.currentPrice)}
                        </td>
                        <td className="text-right py-2 px-3" data-testid={`text-unrealized-pnl-${pos.id}`}>
                          <div className={`flex items-center justify-end gap-1 font-mono ${isGain ? "text-gain" : "text-loss"}`}>
                            {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span>${formatCompact(Math.abs(uPnl))}</span>
                            {!isMobile && <span className="text-muted-foreground">({formatPercent(uPnlPct)})</span>}
                          </div>
                        </td>
                        {!isMobile && (
                          <td className="text-right py-2 px-3" data-testid={`text-realized-pnl-${pos.id}`}>
                            <span className={`font-mono ${isRGain ? "text-gain" : "text-loss"}`}>
                              {isRGain ? "+" : ""}${formatCompact(Math.abs(rPnl))}
                            </span>
                          </td>
                        )}
                        {!isMobile && (
                          <td className="text-right py-2 pl-3">
                            <Badge variant="outline" className="text-[9px]" data-testid={`badge-chain-${pos.id}`}>
                              {pos.chain ?? "solana"}
                            </Badge>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="flex items-center gap-2 mb-3">
            <History className="w-3.5 h-3.5 text-info" />
            <span className="text-xs font-medium">{t.portfolio.tradeHistory}</span>
            <Badge variant="outline" className="text-[9px] ml-auto">
              {trades.length} {t.common.trades.toLowerCase()}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-trades">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium">{t.common.token}</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-right py-2 px-3 font-medium">{t.common.amount}</th>
                  <th className="text-right py-2 px-3 font-medium">{t.common.price}</th>
                  <th className="text-right py-2 px-3 font-medium">{t.common.total}</th>
                  {!isMobile && <th className="text-right py-2 px-3 font-medium">Wallet</th>}
                  {!isMobile && <th className="text-right py-2 pl-3 font-medium">Time</th>}
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={isMobile ? 5 : 7} className="text-center py-8 text-muted-foreground">
                      {t.portfolio.noTrades}
                    </td>
                  </tr>
                ) : (
                  trades.map((trade) => {
                    const token = tokenMap.get(trade.tokenId);
                    const isBuy = trade.type === "buy";
                    const tradeTime = trade.timestamp ? new Date(trade.timestamp) : null;

                    return (
                      <tr
                        key={trade.id}
                        className="border-b border-border/50"
                        data-testid={`row-trade-${trade.id}`}
                      >
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold">
                              {token?.symbol?.slice(0, 2) ?? "??"}
                            </div>
                            <span className="font-semibold" data-testid={`text-trade-symbol-${trade.id}`}>
                              {token?.symbol ?? "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${isBuy ? "text-gain border-gain/30" : "text-loss border-loss/30"}`}
                            data-testid={`badge-trade-type-${trade.id}`}
                          >
                            {trade.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="text-right py-2 px-3 font-mono" data-testid={`text-trade-amount-${trade.id}`}>
                          {formatCompact(trade.amount)}
                        </td>
                        <td className="text-right py-2 px-3 font-mono" data-testid={`text-trade-price-${trade.id}`}>
                          {formatPrice(trade.price)}
                        </td>
                        <td className="text-right py-2 px-3 font-mono" data-testid={`text-trade-total-${trade.id}`}>
                          ${formatCompact(trade.total)}
                        </td>
                        {!isMobile && (
                          <td className="text-right py-2 px-3 font-mono text-muted-foreground" data-testid={`text-trade-wallet-${trade.id}`}>
                            {trade.wallet ?? "-"}
                          </td>
                        )}
                        {!isMobile && (
                          <td className="text-right py-2 pl-3 text-muted-foreground" data-testid={`text-trade-time-${trade.id}`}>
                            {tradeTime ? tradeTime.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  testId,
  isMobile,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  testId: string;
  isMobile: boolean;
}) {
  return (
    <Card className="p-3" data-testid={testId}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{label}</span>
      </div>
      <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`}>{value}</span>
    </Card>
  );
}
