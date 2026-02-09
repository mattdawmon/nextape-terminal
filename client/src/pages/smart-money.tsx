import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { type SmartWallet, type WalletHolding, type WalletTrade, type Token } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCompact, formatPrice, formatAddress, formatTimeAgo, formatPercent } from "@/lib/format";
import {
  Wallet, TrendingUp, Eye, Copy, Users, Trophy, BarChart3,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  Crown, Clock, Target, Activity, Zap, Star, UserPlus, UserMinus,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { TierGate } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

const CHAIN_COLORS: Record<string, string> = {
  solana: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ethereum: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  base: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  bsc: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  arbitrum: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  polygon: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  avalanche: "bg-red-500/20 text-red-400 border-red-500/30",
};

const TOKEN_SYMBOLS: Record<number, string> = {
  1: "SOL", 2: "ETH", 3: "BONK", 4: "WIF", 5: "JUP",
  6: "RNDR", 7: "PYTH", 8: "JTO", 9: "MEME", 10: "PEPE",
  11: "DOGE", 12: "ARB", 13: "OP", 14: "AVAX", 15: "MATIC",
};

const BAR_COLORS = [
  "hsl(142, 71%, 45%)", "hsl(220, 70%, 55%)", "hsl(280, 60%, 55%)",
  "hsl(35, 85%, 55%)", "hsl(190, 70%, 50%)", "hsl(350, 65%, 55%)",
  "hsl(160, 60%, 45%)", "hsl(50, 80%, 50%)",
];

function getTokenSymbol(tokenId: number, tokens: Token[]): string {
  const found = tokens.find((t) => t.id === tokenId);
  if (found) return found.symbol;
  return TOKEN_SYMBOLS[tokenId] || `TKN${tokenId}`;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

type SortKey = "pnl7d" | "pnl30d" | "winRate" | "totalTrades" | "avgTradeSize" | "followers";

export default function SmartMoneyPage() {
  return (
    <TierGate feature="smartMoneyAccess" featureLabel="Smart Money Tracker" requiredTier="pro">
      <SmartMoneyContent />
    </TierGate>
  );
}

function SmartMoneyContent() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("pnl7d");
  const [sortAsc, setSortAsc] = useState(false);
  const [followedWallets, setFollowedWallets] = useState<Set<number>>(new Set());

  const { data: wallets = [], isLoading } = useQuery<SmartWallet[]>({
    queryKey: ["/api/smart-wallets"],
  });

  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const stats = useMemo(() => {
    const total = wallets.length;
    const topPnl = wallets.reduce((m, w) => Math.max(m, w.pnl7d ?? 0), 0);
    const avgWin = total > 0
      ? wallets.reduce((s, w) => s + (w.winRate ?? 0), 0) / total
      : 0;
    const totalVolume = wallets.reduce(
      (s, w) => s + (w.avgTradeSize ?? 0) * (w.totalTrades ?? 0),
      0
    );
    return { total, topPnl, avgWin, totalVolume };
  }, [wallets]);

  const sorted = useMemo(() => {
    return [...wallets].sort((a, b) => {
      const av = (a[sortKey] as number) ?? 0;
      const bv = (b[sortKey] as number) ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
  }, [wallets, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function toggleFollow(walletId: number) {
    setFollowedWallets((prev) => {
      const next = new Set(prev);
      if (next.has(walletId)) next.delete(walletId);
      else next.add(walletId);
      return next;
    });
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  }

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Wallet className="w-4 h-4 text-info" />
        <span className="font-bold text-sm" data-testid="text-page-title">{t.smartMoney.title}</span>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-info" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.smartMoney.topWallets}</span>
            </div>
            <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-total-wallets">{stats.total}</span>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-gain" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.smartMoney.totalPnl} 7d</span>
            </div>
            <span className={`font-bold font-mono text-gain ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-top-pnl">
              ${formatCompact(stats.topPnl)}
            </span>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-warning" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.smartMoney.winRate}</span>
            </div>
            <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-avg-winrate">
              {stats.avgWin.toFixed(1)}%
            </span>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-info" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.common.volume}</span>
            </div>
            <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-total-volume">
              ${formatCompact(stats.totalVolume)}
            </span>
          </Card>
        </div>

        <Card className="p-0 overflow-visible">
          <div className="overflow-x-auto">
            <table className={`w-full ${isMobile ? "text-[11px]" : "text-xs"}`} data-testid="table-leaderboard">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">{t.smartMoney.walletAddress}</th>
                  {!isMobile && <th className="text-left px-3 py-2 font-medium">{t.common.chain}</th>}
                  {!isMobile && <th className="text-left px-3 py-2 font-medium">{t.common.address}</th>}
                  <th
                    className="text-right px-3 py-2 font-medium cursor-pointer select-none"
                    onClick={() => handleSort("pnl7d")}
                    data-testid="sort-pnl7d"
                  >
                    {t.common.pnl} 7d <SortIcon col="pnl7d" />
                  </th>
                  {!isMobile && (
                    <th
                      className="text-right px-3 py-2 font-medium cursor-pointer select-none"
                      onClick={() => handleSort("pnl30d")}
                      data-testid="sort-pnl30d"
                    >
                      {t.common.pnl} 30d <SortIcon col="pnl30d" />
                    </th>
                  )}
                  <th
                    className="text-right px-3 py-2 font-medium cursor-pointer select-none"
                    onClick={() => handleSort("winRate")}
                    data-testid="sort-winrate"
                  >
                    {t.common.winRate} <SortIcon col="winRate" />
                  </th>
                  {!isMobile && (
                    <th
                      className="text-right px-3 py-2 font-medium cursor-pointer select-none"
                      onClick={() => handleSort("totalTrades")}
                      data-testid="sort-trades"
                    >
                      {t.common.trades} <SortIcon col="totalTrades" />
                    </th>
                  )}
                  {!isMobile && (
                    <th
                      className="text-right px-3 py-2 font-medium cursor-pointer select-none"
                      onClick={() => handleSort("avgTradeSize")}
                      data-testid="sort-avg-size"
                    >
                      {t.smartMoney.avgHoldTime} <SortIcon col="avgTradeSize" />
                    </th>
                  )}
                  {!isMobile && <th className="text-right px-3 py-2 font-medium">{t.common.status}</th>}
                  {!isMobile && (
                    <th
                      className="text-right px-3 py-2 font-medium cursor-pointer select-none"
                      onClick={() => handleSort("followers")}
                      data-testid="sort-followers"
                    >
                      {t.smartMoney.following} <SortIcon col="followers" />
                    </th>
                  )}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((wallet, idx) => (
                  <WalletRow
                    key={wallet.id}
                    wallet={wallet}
                    rank={idx + 1}
                    isExpanded={expandedId === wallet.id}
                    onToggle={() => setExpandedId(expandedId === wallet.id ? null : wallet.id)}
                    isMobile={isMobile}
                    isFollowed={followedWallets.has(wallet.id)}
                    onToggleFollow={() => toggleFollow(wallet.id)}
                    tokens={tokens}
                    colSpan={isMobile ? 5 : 12}
                  />
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={isMobile ? 5 : 12} className="text-center py-8 text-muted-foreground text-xs">
                      {t.smartMoney.noWallets}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PnlCell({ value }: { value: number | null }) {
  const v = value ?? 0;
  const isPositive = v >= 0;
  return (
    <span className={`font-mono ${isPositive ? "text-gain" : "text-loss"}`}>
      {isPositive ? "+" : ""}${formatCompact(v)}
    </span>
  );
}

function ChainBadge({ chain }: { chain: string | null }) {
  const c = (chain ?? "solana").toLowerCase();
  const colorClass = CHAIN_COLORS[c] || "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${colorClass}`}>
      {c.toUpperCase()}
    </Badge>
  );
}

function WalletRow({
  wallet,
  rank,
  isExpanded,
  onToggle,
  isMobile,
  isFollowed,
  onToggleFollow,
  tokens,
  colSpan,
}: {
  wallet: SmartWallet;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  isMobile: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
  tokens: Token[];
  colSpan: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      <tr
        className="border-b border-border/50 hover-elevate cursor-pointer transition-colors"
        onClick={onToggle}
        data-testid={`row-wallet-${wallet.id}`}
      >
        <td className="px-3 py-2 font-mono text-muted-foreground">
          {rank <= 3 ? <Crown className="w-3.5 h-3.5 text-warning inline" /> : rank}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold" data-testid={`text-label-${wallet.id}`}>{wallet.label}</span>
            {wallet.isWhale && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0" data-testid={`badge-whale-${wallet.id}`}>
                WHALE
              </Badge>
            )}
            {isMobile && <ChainBadge chain={wallet.chain} />}
          </div>
        </td>
        {!isMobile && (
          <td className="px-3 py-2" data-testid={`text-chain-${wallet.id}`}>
            <ChainBadge chain={wallet.chain} />
          </td>
        )}
        {!isMobile && (
          <td className="px-3 py-2 font-mono text-muted-foreground" data-testid={`text-address-${wallet.id}`}>
            {formatAddress(wallet.address)}
          </td>
        )}
        <td className="text-right px-3 py-2" data-testid={`text-pnl7d-${wallet.id}`}>
          <PnlCell value={wallet.pnl7d} />
        </td>
        {!isMobile && (
          <td className="text-right px-3 py-2" data-testid={`text-pnl30d-${wallet.id}`}>
            <PnlCell value={wallet.pnl30d} />
          </td>
        )}
        <td className="text-right px-3 py-2 font-mono" data-testid={`text-winrate-${wallet.id}`}>
          {(wallet.winRate ?? 0).toFixed(1)}%
        </td>
        {!isMobile && (
          <td className="text-right px-3 py-2 font-mono" data-testid={`text-trades-${wallet.id}`}>
            {wallet.totalTrades ?? 0}
          </td>
        )}
        {!isMobile && (
          <td className="text-right px-3 py-2 font-mono" data-testid={`text-avgsize-${wallet.id}`}>
            ${formatCompact(wallet.avgTradeSize ?? 0)}
          </td>
        )}
        {!isMobile && (
          <td className="text-right px-3 py-2 text-muted-foreground" data-testid={`text-lastactive-${wallet.id}`}>
            {wallet.lastActive ? formatTimeAgo(wallet.lastActive) : "-"}
          </td>
        )}
        {!isMobile && (
          <td className="text-right px-3 py-2 font-mono" data-testid={`text-followers-${wallet.id}`}>
            {formatCompact(wallet.followers ?? 0)}
          </td>
        )}
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={isFollowed ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={(e) => { e.stopPropagation(); onToggleFollow(); }}
              data-testid={`button-follow-${wallet.id}`}
            >
              {isFollowed ? <UserMinus className="w-3 h-3 mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
              {isFollowed ? t.smartMoney.unfollow : t.smartMoney.follow}
            </Button>
            {!isMobile && (
              <button
                className="flex items-center gap-1 text-[10px] font-medium text-info hover:underline"
                onClick={(e) => { e.stopPropagation(); }}
                data-testid={`button-copy-trade-${wallet.id}`}
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={colSpan} className="p-0">
            <WalletDetail wallet={wallet} tokens={tokens} />
          </td>
        </tr>
      )}
    </>
  );
}

function WalletDetail({ wallet, tokens }: { wallet: SmartWallet; tokens: Token[] }) {
  const { t } = useTranslation();
  const walletId = wallet.id;

  const { data: holdings = [], isLoading: loadingHoldings } = useQuery<WalletHolding[]>({
    queryKey: [`/api/smart-wallets/${walletId}/holdings`],
  });

  const { data: trades = [], isLoading: loadingTrades } = useQuery<WalletTrade[]>({
    queryKey: [`/api/smart-wallets/${walletId}/trades`],
  });

  const perfStats = useMemo(() => {
    const pnl7d = wallet.pnl7d ?? 0;
    const pnl30d = wallet.pnl30d ?? 0;
    const totalTrades = wallet.totalTrades ?? 0;
    const avgSize = wallet.avgTradeSize ?? 0;
    const totalInvested = avgSize * totalTrades;
    const pnl7dPct = totalInvested > 0 ? (pnl7d / totalInvested) * 100 : 0;
    const pnl30dPct = totalInvested > 0 ? (pnl30d / totalInvested) * 100 : 0;
    const avgHoldHours = Math.floor(seededRandom(walletId * 7) * 72) + 2;
    const bestTrade = trades.length > 0
      ? Math.max(...trades.map((t) => t.total))
      : seededRandom(walletId * 13) * 50000 + 5000;
    return { pnl7d, pnl30d, pnl7dPct, pnl30dPct, totalTrades, avgHoldHours, bestTrade };
  }, [wallet, walletId, trades]);

  const portfolioData = useMemo(() => {
    if (holdings.length === 0) return [];
    const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
    if (totalValue === 0) return [];
    return holdings.map((h) => ({
      name: getTokenSymbol(h.tokenId, tokens),
      value: h.currentValue ?? 0,
      pct: totalValue > 0 ? ((h.currentValue ?? 0) / totalValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings, tokens]);

  const tradingPatterns = useMemo(() => {
    const tokenCounts: Record<number, number> = {};
    trades.forEach((t) => {
      tokenCounts[t.tokenId] = (tokenCounts[t.tokenId] || 0) + 1;
    });
    const mostTradedId = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1])[0];
    const mostTraded = mostTradedId ? getTokenSymbol(parseInt(mostTradedId[0]), tokens) : "-";
    const avgPosSize = trades.length > 0
      ? trades.reduce((s, t) => s + t.total, 0) / trades.length
      : wallet.avgTradeSize ?? 0;
    const daysActive = 30;
    const frequency = (wallet.totalTrades ?? 0) / daysActive;
    return {
      mostTraded,
      avgPosSize,
      preferredChain: (wallet.chain ?? "solana").toUpperCase(),
      frequency: frequency.toFixed(1),
    };
  }, [trades, tokens, wallet]);

  const isLoading = loadingHoldings || loadingTrades;

  return (
    <div className="bg-secondary/20 border-t border-border p-4 space-y-4" data-testid={`detail-wallet-${walletId}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Target className="w-3.5 h-3.5 text-info" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{t.smartMoney.portfolioBreakdown}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MiniStat
          label={`${t.common.pnl} 7d`}
          value={`${perfStats.pnl7d >= 0 ? "+" : ""}$${formatCompact(perfStats.pnl7d)}`}
          sub={formatPercent(perfStats.pnl7dPct)}
          color={perfStats.pnl7d >= 0 ? "text-gain" : "text-loss"}
          icon={<TrendingUp className="w-3 h-3" />}
          testId={`stat-pnl7d-${walletId}`}
        />
        <MiniStat
          label={`${t.common.pnl} 30d`}
          value={`${perfStats.pnl30d >= 0 ? "+" : ""}$${formatCompact(perfStats.pnl30d)}`}
          sub={formatPercent(perfStats.pnl30dPct)}
          color={perfStats.pnl30d >= 0 ? "text-gain" : "text-loss"}
          icon={<TrendingUp className="w-3 h-3" />}
          testId={`stat-pnl30d-${walletId}`}
        />
        <div className="rounded-md border border-border/50 p-2" data-testid={`stat-winrate-${walletId}`}>
          <div className="flex items-center gap-1 mb-1">
            <Target className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{t.common.winRate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{(wallet.winRate ?? 0).toFixed(1)}%</span>
            <div className="flex-1">
              <Progress value={wallet.winRate ?? 0} className="h-1.5" />
            </div>
          </div>
        </div>
        <MiniStat
          label={t.common.totalTrades}
          value={String(perfStats.totalTrades)}
          icon={<Activity className="w-3 h-3" />}
          testId={`stat-totaltrades-${walletId}`}
        />
        <MiniStat
          label={t.smartMoney.avgHoldTime}
          value={`${perfStats.avgHoldHours}h`}
          icon={<Clock className="w-3 h-3" />}
          testId={`stat-holdtime-${walletId}`}
        />
        <MiniStat
          label={t.smartMoney.bestTrade}
          value={`$${formatCompact(perfStats.bestTrade)}`}
          color="text-gain"
          icon={<Star className="w-3 h-3" />}
          testId={`stat-besttrade-${walletId}`}
        />
      </div>

      {portfolioData.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-info" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t.smartMoney.portfolioBreakdown}</span>
          </div>
          <div className="h-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[portfolioData.reduce((acc, item, i) => ({ ...acc, [item.name]: item.pct }), {})]} layout="vertical" barCategoryGap={0}>
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" hide dataKey="name" />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const item = payload[0];
                    return (
                      <div className="bg-popover border border-border rounded-md px-2 py-1 text-[10px]">
                        <span className="font-mono font-semibold">{item.name}</span>
                        <span className="text-muted-foreground ml-1">{Number(item.value).toFixed(1)}%</span>
                      </div>
                    );
                  }}
                />
                {portfolioData.map((item, i) => (
                  <Bar key={item.name} dataKey={item.name} stackId="a" fill={BAR_COLORS[i % BAR_COLORS.length]} radius={i === 0 ? [4, 0, 0, 4] : i === portfolioData.length - 1 ? [0, 4, 4, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {portfolioData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                <span className="text-[9px] font-mono text-muted-foreground">{item.name} {item.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3.5 h-3.5 text-info" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t.portfolio.holdings}</span>
          </div>
          {loadingHoldings ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)}
            </div>
          ) : holdings.length === 0 ? (
            <div className="text-[10px] text-muted-foreground py-4 text-center">{t.portfolio.noHoldings}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]" data-testid={`table-holdings-${walletId}`}>
                <thead>
                  <tr className="text-muted-foreground uppercase tracking-wider">
                    <th className="text-left py-1 font-medium">{t.common.token}</th>
                    <th className="text-right py-1 font-medium">{t.common.amount}</th>
                    <th className="text-right py-1 font-medium">{t.portfolio.entryPrice}</th>
                    <th className="text-right py-1 font-medium">{t.common.price}</th>
                    <th className="text-right py-1 font-medium">{t.common.pnl}</th>
                    <th className="text-right py-1 font-medium">{t.common.pnl} %</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const pnl = h.unrealizedPnl ?? 0;
                    const cost = h.avgCost * h.amount;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                    const maxBarWidth = 60;
                    const barWidth = Math.min(Math.abs(pnlPct) / 2, maxBarWidth);
                    return (
                      <tr key={h.id} className="border-t border-border/30" data-testid={`row-holding-${h.id}`}>
                        <td className="py-1.5">
                          <span className="font-mono font-semibold">{getTokenSymbol(h.tokenId, tokens)}</span>
                        </td>
                        <td className="text-right py-1.5 font-mono">{formatCompact(h.amount)}</td>
                        <td className="text-right py-1.5 font-mono">{formatPrice(h.avgCost)}</td>
                        <td className="text-right py-1.5 font-mono">{formatPrice(h.currentValue ?? 0)}</td>
                        <td className={`text-right py-1.5 font-mono ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
                          {pnl >= 0 ? "+" : ""}${formatCompact(pnl)}
                        </td>
                        <td className="text-right py-1.5">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-16 h-1.5 rounded-full bg-muted relative overflow-hidden">
                              <div
                                className={`absolute top-0 h-full rounded-full ${pnl >= 0 ? "bg-gain right-1/2" : "bg-loss left-1/2"}`}
                                style={{ width: `${barWidth}%`, [pnl >= 0 ? "right" : "left"]: "50%" }}
                              />
                            </div>
                            <span className={`font-mono text-[9px] ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
                              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t.smartMoney.recentTrades}</span>
          </div>
          {loadingTrades ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)}
            </div>
          ) : trades.length === 0 ? (
            <div className="text-[10px] text-muted-foreground py-4 text-center">{t.portfolio.noTrades}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]" data-testid={`table-trades-${walletId}`}>
                <thead>
                  <tr className="text-muted-foreground uppercase tracking-wider">
                    <th className="text-left py-1 font-medium">{t.alerts.alertType}</th>
                    <th className="text-left py-1 font-medium">{t.common.token}</th>
                    <th className="text-right py-1 font-medium">{t.common.amount}</th>
                    <th className="text-right py-1 font-medium">{t.common.price}</th>
                    <th className="text-right py-1 font-medium">{t.common.total}</th>
                    <th className="text-right py-1 font-medium">{t.common.pnl}</th>
                    <th className="text-right py-1 font-medium">{t.common.age}</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((tr) => {
                    const isBuy = tr.type === "buy";
                    const tradePnl = isBuy
                      ? 0
                      : tr.total * (seededRandom(tr.id * 31) * 0.6 - 0.2);
                    return (
                      <tr key={tr.id} className="border-t border-border/30" data-testid={`row-trade-${tr.id}`}>
                        <td className="py-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${isBuy ? "bg-gain/10 text-gain border-gain/30" : "bg-loss/10 text-loss border-loss/30"}`}
                            data-testid={`badge-trade-type-${tr.id}`}
                          >
                            {isBuy ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
                            {tr.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-1.5 font-mono font-semibold">{getTokenSymbol(tr.tokenId, tokens)}</td>
                        <td className="text-right py-1.5 font-mono">{formatCompact(tr.amount)}</td>
                        <td className="text-right py-1.5 font-mono">{formatPrice(tr.price)}</td>
                        <td className="text-right py-1.5 font-mono">${formatCompact(tr.total)}</td>
                        <td className={`text-right py-1.5 font-mono ${tradePnl >= 0 ? "text-gain" : "text-loss"}`}>
                          {isBuy ? "-" : `${tradePnl >= 0 ? "+" : ""}$${formatCompact(Math.abs(tradePnl))}`}
                        </td>
                        <td className="text-right py-1.5 text-muted-foreground">
                          {tr.timestamp ? formatTimeAgo(tr.timestamp) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-warning" />
          <span className="text-[10px] font-medium uppercase tracking-wider">{t.smartMoney.tradingPatterns}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border border-border/50 p-2" data-testid={`pattern-most-traded-${walletId}`}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">{t.smartMoney.mostTraded}</span>
            <span className="font-mono font-semibold text-sm">{tradingPatterns.mostTraded}</span>
          </div>
          <div className="rounded-md border border-border/50 p-2" data-testid={`pattern-avg-pos-${walletId}`}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">{t.smartMoney.avgHoldTime}</span>
            <span className="font-mono font-semibold text-sm">${formatCompact(tradingPatterns.avgPosSize)}</span>
          </div>
          <div className="rounded-md border border-border/50 p-2" data-testid={`pattern-chain-${walletId}`}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">{t.smartMoney.preferredChain}</span>
            <span className="font-mono font-semibold text-sm">{tradingPatterns.preferredChain}</span>
          </div>
          <div className="rounded-md border border-border/50 p-2" data-testid={`pattern-frequency-${walletId}`}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">{t.smartMoney.frequency}</span>
            <span className="font-mono font-semibold text-sm">{tradingPatterns.frequency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  color,
  icon,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="rounded-md border border-border/50 p-2" data-testid={testId}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <span className={`font-mono font-bold text-sm ${color ?? ""}`}>{value}</span>
      {sub && (
        <span className={`text-[9px] font-mono ml-1 ${color ?? "text-muted-foreground"}`}>{sub}</span>
      )}
    </div>
  );
}
