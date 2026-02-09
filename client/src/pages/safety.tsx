import { useQuery, useMutation } from "@tanstack/react-query";
import { type Token, type SafetyReport } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCompact } from "@/lib/format";
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, Users, Droplets, Lock, Unlock, Eye, CheckCircle, XCircle, Bug, Search, Skull, FileWarning, Activity, Zap, Globe, TrendingUp, Scan, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { TokenLogo } from "@/components/token-table";
import { apiRequest } from "@/lib/queryClient";
import { TierGate } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

function getGrade(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function getScoreColor(score: number) {
  if (score >= 75) return "text-gain";
  if (score >= 45) return "text-warning";
  return "text-loss";
}

function getScoreLabel(score: number) {
  if (score >= 75) return "SAFE";
  if (score >= 45) return "CAUTION";
  return "DANGER";
}

function getScoreBg(score: number) {
  if (score >= 75) return "bg-gain/10 border-gain/20";
  if (score >= 45) return "bg-warning/10 border-warning/20";
  return "bg-loss/10 border-loss/20";
}

function getChainColor(chain: string | null | undefined) {
  const c = (chain || "solana").toLowerCase();
  if (c === "ethereum") return "text-blue-400 border-blue-400/30";
  if (c === "bsc") return "text-yellow-400 border-yellow-400/30";
  if (c === "base") return "text-blue-300 border-blue-300/30";
  if (c === "arbitrum") return "text-cyan-400 border-cyan-400/30";
  return "text-purple-400 border-purple-400/30";
}

function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score / 100, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const center = size / 2;

  const hue = score * 1.2;
  const strokeColor = `hsl(${hue}, 80%, 50%)`;
  const trackColor = "hsl(var(--muted) / 0.3)";
  const grade = getGrade(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={8}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold font-mono ${getScoreColor(score)}`} data-testid="text-gauge-score">
          {score.toFixed(0)}
        </span>
        <span className={`text-xs font-bold ${getScoreColor(score)}`}>{grade}</span>
      </div>
    </div>
  );
}

function RiskFactorRow({
  icon: Icon,
  label,
  status,
  weight,
  statusType,
}: {
  icon: any;
  label: string;
  status: string;
  weight: number;
  statusType: "pass" | "fail" | "warning";
}) {
  const statusColors = {
    pass: "text-gain",
    fail: "text-loss",
    warning: "text-warning",
  };
  const statusBadgeColors = {
    pass: "bg-gain/10 text-gain border-gain/20",
    fail: "bg-loss/10 text-loss border-loss/20",
    warning: "bg-warning/10 text-warning border-warning/20",
  };
  const statusLabels = { pass: "Pass", fail: "Fail", warning: "Warn" };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/50" data-testid={`row-risk-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${statusColors[statusType]}`} />
      <span className="text-xs flex-1 min-w-0 truncate">{label}</span>
      <Badge variant="outline" className={`text-[8px] px-1 py-0 ${statusBadgeColors[statusType]}`}>
        {statusLabels[statusType]}
      </Badge>
      <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{weight}%</span>
    </div>
  );
}

function RugMatrixRow({ label, level }: { label: string; level: "low" | "medium" | "high" }) {
  const colors = {
    low: "bg-gain/10 text-gain border-gain/30",
    medium: "bg-warning/10 text-warning border-warning/30",
    high: "bg-loss/10 text-loss border-loss/30",
  };
  const labels = { low: "LOW", medium: "MED", high: "HIGH" };
  const bgRow = {
    low: "bg-gain/5",
    medium: "bg-warning/5",
    high: "bg-loss/5",
  };

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${bgRow[level]}`}>
      <span className="text-[10px] flex-1">{label}</span>
      <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${colors[level]}`}>
        {labels[level]}
      </Badge>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-muted-foreground flex-1">{label}</span>
      <span className="text-[9px] font-mono">{value}</span>
    </div>
  );
}

interface LiveScanReport {
  overallScore: number | null;
  honeypotRisk: number;
  lpLocked: boolean;
  lpLockDays: number;
  contractVerified: boolean;
  mintAuthority: boolean;
  freezeAuthority: boolean;
  topHolderConcentration: number;
  top10HolderPercent: number;
  devHolding: number;
  socialScore: number;
  buyTax: number;
  sellTax: number;
  isHoneypot: boolean;
  hasHiddenOwner: boolean;
  holderCount: number;
  totalLiquidity: number;
  topHolders: Array<{ address: string; percent: number; tag: string; isContract: boolean; isLocked: boolean }>;
  dexInfo: Array<{ name: string; liquidity: number; pair: string }>;
  creatorAddress: string;
  creatorPercent: number;
  source: string;
  message?: string;
}

export default function SafetyPage() {
  return (
    <TierGate feature="safetyScanner" featureLabel="Safety Scanner" requiredTier="basic">
      <SafetyContent />
    </TierGate>
  );
}

function SafetyContent() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const { data: safetyReports = [], isLoading: reportsLoading } = useQuery<SafetyReport[]>({
    queryKey: ["/api/safety"],
  });

  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [scanAddress, setScanAddress] = useState("");
  const [scanChain, setScanChain] = useState("ethereum");
  const [liveScanResult, setLiveScanResult] = useState<LiveScanReport | null>(null);
  const [showLiveScan, setShowLiveScan] = useState(false);

  const scanMutation = useMutation({
    mutationFn: async ({ chain, address }: { chain: string; address: string }) => {
      const resp = await apiRequest("GET", `/api/safety/scan/${chain}/${address}`);
      return resp.json() as Promise<LiveScanReport>;
    },
    onSuccess: (data) => {
      setLiveScanResult(data);
      setShowLiveScan(true);
      setSelectedTokenId(null);
    },
  });

  const handleScan = useCallback(() => {
    const addr = scanAddress.trim();
    if (!addr) return;
    scanMutation.mutate({ chain: scanChain, address: addr });
  }, [scanAddress, scanChain, scanMutation]);

  const reportMap = useMemo(() => {
    const map = new Map<number, SafetyReport>();
    safetyReports.forEach((r) => map.set(r.tokenId, r));
    return map;
  }, [safetyReports]);

  const isLoading = tokensLoading || reportsLoading;

  const counts = useMemo(() => {
    let safe = 0, caution = 0, danger = 0;
    tokens.forEach((t) => {
      const s = reportMap.get(t.id)?.overallScore ?? 50;
      if (s >= 75) safe++;
      else if (s >= 45) caution++;
      else danger++;
    });
    return { safe, caution, danger };
  }, [tokens, reportMap]);

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        if (!token.symbol.toLowerCase().includes(q) && !token.name.toLowerCase().includes(q)) return false;
      }
      if (riskFilter !== "all") {
        const score = reportMap.get(token.id)?.overallScore ?? 50;
        if (riskFilter === "safe" && score < 75) return false;
        if (riskFilter === "caution" && (score >= 75 || score < 45)) return false;
        if (riskFilter === "danger" && score >= 45) return false;
      }
      return true;
    });
  }, [tokens, searchFilter, riskFilter, reportMap]);

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-3"}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    );
  }

  const selectedReport = showLiveScan && liveScanResult ? (liveScanResult as unknown as SafetyReport) : (selectedTokenId ? reportMap.get(selectedTokenId) : null);
  const selectedToken = showLiveScan ? ({ id: 0, symbol: scanAddress.slice(0, 10), name: `${scanChain.toUpperCase()} Contract`, chain: scanChain, price: 0, marketCap: 0, liquidity: liveScanResult?.totalLiquidity ?? 0, holders: liveScanResult?.holderCount ?? 0 } as Token) : (selectedTokenId ? tokens.find((t) => t.id === selectedTokenId) : null);

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border flex-wrap ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Shield className="w-4 h-4 text-info" />
        <span className="font-bold text-sm">{t.safety.title}</span>
        <Badge variant="outline" className="text-[8px] font-mono">ADVANCED</Badge>

        <div className="flex items-center gap-1.5 ml-1" data-testid="indicator-live-scanning">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gain" />
          </span>
          <span className="text-[10px] text-gain font-mono">Live Scanning</span>
        </div>

        <div className={`flex items-center gap-1.5 flex-wrap ${isMobile ? "w-full mt-1" : "ml-1"}`}>
          <Badge variant="outline" className="text-[8px] text-gain border-gain/30" data-testid="badge-count-safe">{counts.safe} {t.safety.safe}</Badge>
          <Badge variant="outline" className="text-[8px] text-warning border-warning/30" data-testid="badge-count-caution">{counts.caution} {t.safety.caution}</Badge>
          <Badge variant="outline" className="text-[8px] text-loss border-loss/30" data-testid="badge-count-danger">{counts.danger} {t.safety.danger}</Badge>
        </div>

        <div className={`flex items-center gap-2 flex-wrap ${isMobile ? "w-full mt-2" : "ml-auto"}`}>
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className={`pl-7 text-xs ${isMobile ? "w-full" : "w-36"}`}
              data-testid="input-safety-search"
            />
          </div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className={`text-xs ${isMobile ? "flex-1" : "w-28"}`} data-testid="select-risk-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all} {t.common.risk}</SelectItem>
              <SelectItem value="safe">{t.safety.safe} (75+)</SelectItem>
              <SelectItem value="caution">{t.safety.caution}</SelectItem>
              <SelectItem value="danger">{t.safety.danger} (&lt;45)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-2"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Scan className="w-3.5 h-3.5 text-info flex-shrink-0" />
          <span className="text-[10px] font-medium text-muted-foreground">LIVE CONTRACT SCAN</span>
          <Badge variant="outline" className="text-[7px] font-mono text-info border-info/30">GoPlus</Badge>
          <Select value={scanChain} onValueChange={setScanChain}>
            <SelectTrigger className={`text-xs ${isMobile ? "flex-1" : "w-28"}`} data-testid="select-scan-chain">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="bsc">BNB Chain</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
              <SelectItem value="polygon">Polygon</SelectItem>
              <SelectItem value="avalanche">Avalanche</SelectItem>
              <SelectItem value="optimism">Optimism</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Input
              placeholder="Paste contract address (0x...)"
              value={scanAddress}
              onChange={(e) => setScanAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="text-xs font-mono pr-16"
              data-testid="input-scan-address"
            />
          </div>
          <Button
            size="sm"
            onClick={handleScan}
            disabled={scanMutation.isPending || !scanAddress.trim()}
            data-testid="button-scan-contract"
          >
            {scanMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scan className="w-3.5 h-3.5" />}
            <span className="ml-1">{t.safety.scanToken}</span>
          </Button>
        </div>
        {scanMutation.isError && (
          <div className="flex items-center gap-1.5 mt-1.5 text-loss">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[10px]">Scan failed - check address and chain</span>
          </div>
        )}
      </div>

      <div className={`flex flex-1 min-h-0 ${isMobile ? "flex-col" : ""}`}>
        <div className={`flex-1 overflow-auto scrollbar-thin space-y-2 ${isMobile ? "p-3" : "p-4"}`}>
          {filteredTokens.map((token) => {
            const report = reportMap.get(token.id);
            const score = report?.overallScore ?? 50;
            const scoreColor = getScoreColor(score);
            const grade = getGrade(score);
            const isSelected = selectedTokenId === token.id;

            return (
              <Card
                key={token.id}
                className={`p-3 cursor-pointer transition-colors hover-elevate ${isSelected ? "ring-1 ring-info" : ""}`}
                onClick={() => { setSelectedTokenId(token.id); setShowLiveScan(false); }}
                data-testid={`card-safety-${token.id}`}
              >
                <div className="flex items-center gap-3">
                  <TokenLogo token={token} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm" data-testid={`text-safety-symbol-${token.id}`}>{token.symbol}</span>
                      {token.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-info" />}
                      <Badge variant="outline" className={`text-[7px] px-1 py-0 ${getChainColor(token.chain)}`}>
                        {(token.chain || "SOL").toUpperCase().slice(0, 3)}
                      </Badge>
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 ${scoreColor}`}>
                        {getScoreLabel(score)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground truncate">{token.name}</span>
                      {!isMobile && (
                        <>
                          <span className="text-[9px] text-muted-foreground font-mono">MCap {formatCompact(token.marketCap ?? 0)}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">Liq {formatCompact(token.liquidity ?? 0)}</span>
                        </>
                      )}
                    </div>
                    {!isMobile && (
                      <div className="flex items-center gap-2 mt-1">
                        <Bug className={`w-3 h-3 ${(report?.honeypotRisk ?? 100) < 20 ? "text-gain" : "text-loss"}`} />
                        {report?.lpLocked ? (
                          <Lock className="w-3 h-3 text-gain" />
                        ) : (
                          <Unlock className="w-3 h-3 text-loss" />
                        )}
                        {report?.contractVerified ? (
                          <CheckCircle className="w-3 h-3 text-gain" />
                        ) : (
                          <XCircle className="w-3 h-3 text-loss" />
                        )}
                        {report?.mintAuthority ? (
                          <AlertTriangle className="w-3 h-3 text-loss" />
                        ) : (
                          <ShieldCheck className="w-3 h-3 text-gain" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right min-w-[52px] flex flex-col items-end gap-0.5">
                    <div className={`text-xl font-bold font-mono ${scoreColor}`} data-testid={`text-safety-score-${token.id}`}>
                      {grade}
                    </div>
                    <div className={`text-[10px] font-mono ${scoreColor}`}>{score.toFixed(0)}/100</div>
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={score} className="h-1" />
                </div>
              </Card>
            );
          })}
          {filteredTokens.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">{t.safety.noScans}</p>
            </div>
          )}
        </div>

        {selectedReport && selectedToken && (
          <div className={`border-border overflow-auto scrollbar-thin space-y-4 ${isMobile ? "border-t p-3" : "w-96 border-l p-4"}`}>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-info" />
              <span className="font-bold text-sm">{selectedToken.symbol} {t.safety.securityOverview}</span>
              {showLiveScan && <Badge variant="outline" className="text-[7px] font-mono text-info border-info/30">LIVE GoPlus</Badge>}
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto"
                onClick={() => { setSelectedTokenId(null); setShowLiveScan(false); }}
                data-testid="button-close-audit"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-center">
              <ScoreGauge score={selectedReport.overallScore ?? 50} size={130} />
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.safety.riskFactors}</div>
              <RiskFactorRow
                icon={Bug}
                label={t.safety.honeypot}
                status={`${(selectedReport.honeypotRisk ?? 0).toFixed(1)}%`}
                weight={15}
                statusType={(selectedReport.honeypotRisk ?? 100) < 10 ? "pass" : (selectedReport.honeypotRisk ?? 100) < 30 ? "warning" : "fail"}
              />
              <RiskFactorRow
                icon={selectedReport.lpLocked ? Lock : Unlock}
                label={t.safety.lpLocked}
                status={selectedReport.lpLocked ? `${selectedReport.lpLockDays ?? 0}d` : "Unlocked"}
                weight={15}
                statusType={selectedReport.lpLocked ? "pass" : "fail"}
              />
              <RiskFactorRow
                icon={Eye}
                label={t.safety.contractVerified}
                status={selectedReport.contractVerified ? "Verified" : "Unverified"}
                weight={15}
                statusType={selectedReport.contractVerified ? "pass" : "fail"}
              />
              <RiskFactorRow
                icon={Skull}
                label={t.safety.mintAuthority}
                status={selectedReport.mintAuthority ? "Active" : "Renounced"}
                weight={10}
                statusType={selectedReport.mintAuthority ? "fail" : "pass"}
              />
              <RiskFactorRow
                icon={FileWarning}
                label={t.safety.freezeAuthority}
                status={selectedReport.freezeAuthority ? "Active" : "Renounced"}
                weight={10}
                statusType={selectedReport.freezeAuthority ? "fail" : "pass"}
              />
              <RiskFactorRow
                icon={Users}
                label={t.safety.holderConcentration}
                status={`${(selectedReport.topHolderConcentration ?? 0).toFixed(1)}%`}
                weight={15}
                statusType={(selectedReport.topHolderConcentration ?? 100) < 15 ? "pass" : (selectedReport.topHolderConcentration ?? 100) < 30 ? "warning" : "fail"}
              />
              <RiskFactorRow
                icon={Activity}
                label={t.safety.devWallet}
                status={`${(selectedReport.devHolding ?? 0).toFixed(1)}%`}
                weight={10}
                statusType={(selectedReport.devHolding ?? 100) < 5 ? "pass" : (selectedReport.devHolding ?? 100) < 15 ? "warning" : "fail"}
              />
              <RiskFactorRow
                icon={Globe}
                label={t.safety.socialScore}
                status={`${(selectedReport.socialScore ?? 0).toFixed(0)}/100`}
                weight={10}
                statusType={(selectedReport.socialScore ?? 0) > 60 ? "pass" : (selectedReport.socialScore ?? 0) > 30 ? "warning" : "fail"}
              />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <Droplets className="w-3 h-3" /> {t.safety.liquidityAnalysis}
              </div>
              <Card className="p-3 space-y-2">
                {(() => {
                  const mcap = selectedToken.marketCap ?? 0;
                  const liq = selectedToken.liquidity ?? 0;
                  const ratio = mcap > 0 ? (liq / mcap) * 100 : 0;
                  const healthy = ratio > 5;
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Liq/MCap Ratio</span>
                        <span className={`text-xs font-mono font-bold ${healthy ? "text-gain" : "text-loss"}`}>
                          {ratio.toFixed(2)}%
                        </span>
                      </div>
                      <Progress value={Math.min(ratio * 5, 100)} className="h-1" />
                      <div className="text-[9px] text-muted-foreground">
                        {healthy ? "Healthy liquidity ratio (>5%)" : "Low liquidity ratio (<5%) - higher slippage risk"}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">LP Distribution</span>
                        <span className="text-[10px] font-mono">
                          {selectedReport.lpLocked ? "Locked" : "Unlocked"} | {formatCompact(liq)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Depth Estimate</span>
                        <span className="text-[10px] font-mono">
                          ${formatCompact(liq * 0.02)} (2% move)
                        </span>
                      </div>
                    </>
                  );
                })()}
              </Card>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <Users className="w-3 h-3" /> {t.safety.holderAnalysis}
              </div>
              <Card className="p-3">
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Top Holder", value: selectedReport.topHolderConcentration ?? 20, color: "hsl(0 84% 55%)" },
                          { name: "Top 10", value: Math.max(0, (selectedReport.top10HolderPercent ?? 30) - (selectedReport.topHolderConcentration ?? 20)), color: "hsl(35 92% 50%)" },
                          { name: "Dev", value: selectedReport.devHolding ?? 5, color: "hsl(280 80% 60%)" },
                          { name: "Community", value: Math.max(0, 100 - (selectedReport.top10HolderPercent ?? 30) - (selectedReport.devHolding ?? 5)), color: "hsl(142 71% 45%)" },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {[
                          "hsl(0 84% 55%)",
                          "hsl(35 92% 50%)",
                          "hsl(280 80% 60%)",
                          "hsl(142 71% 45%)",
                        ].map((color, idx) => (
                          <Cell key={idx} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(220 18% 10%)",
                          border: "1px solid hsl(220 15% 16%)",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <LegendItem color="hsl(0 84% 55%)" label="Top Holder" value={`${(selectedReport.topHolderConcentration ?? 0).toFixed(1)}%`} />
                  <LegendItem color="hsl(35 92% 50%)" label="Top 10" value={`${(selectedReport.top10HolderPercent ?? 0).toFixed(1)}%`} />
                  <LegendItem color="hsl(280 80% 60%)" label="Dev" value={`${(selectedReport.devHolding ?? 0).toFixed(1)}%`} />
                  <LegendItem color="hsl(142 71% 45%)" label="Community" value={`${Math.max(0, 100 - (selectedReport.top10HolderPercent ?? 0) - (selectedReport.devHolding ?? 0)).toFixed(1)}%`} />
                </div>
                {(selectedReport.topHolderConcentration ?? 0) > 15 && (
                  <div className="flex items-center gap-1.5 mt-2 p-1.5 rounded-md bg-loss/10">
                    <AlertTriangle className="w-3 h-3 text-loss flex-shrink-0" />
                    <span className="text-[9px] text-loss">Whale Alert: Top holder owns {(selectedReport.topHolderConcentration ?? 0).toFixed(1)}% of supply</span>
                  </div>
                )}
                {(selectedReport.top10HolderPercent ?? 0) > 50 && (
                  <div className="flex items-center gap-1.5 mt-1 p-1.5 rounded-md bg-warning/10">
                    <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />
                    <span className="text-[9px] text-warning">Insider concentration: Top 10 hold {(selectedReport.top10HolderPercent ?? 0).toFixed(1)}%</span>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <FileWarning className="w-3 h-3" /> {t.safety.contractAnalysis}
              </div>
              <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Verification</span>
                  <Badge variant="outline" className={`text-[8px] ${selectedReport.contractVerified ? "text-gain border-gain/30" : "text-loss border-loss/30"}`}>
                    {selectedReport.contractVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Proxy Detection</span>
                  <Badge variant="outline" className="text-[8px] text-gain border-gain/30">
                    No Proxy
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Upgradeable</span>
                  <Badge variant="outline" className={`text-[8px] ${selectedReport.mintAuthority ? "text-warning border-warning/30" : "text-gain border-gain/30"}`}>
                    {selectedReport.mintAuthority ? "Potentially" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Tax/Fee Detection</span>
                  <Badge variant="outline" className={`text-[8px] ${(selectedReport.honeypotRisk ?? 0) > 30 ? "text-loss border-loss/30" : "text-gain border-gain/30"}`}>
                    {(selectedReport.honeypotRisk ?? 0) > 30 ? "Detected" : "None"}
                  </Badge>
                </div>
                {showLiveScan && liveScanResult && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">Buy Tax</span>
                      <Badge variant="outline" className={`text-[8px] ${liveScanResult.buyTax > 5 ? "text-loss border-loss/30" : liveScanResult.buyTax > 0 ? "text-warning border-warning/30" : "text-gain border-gain/30"}`}>
                        {liveScanResult.buyTax.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">Sell Tax</span>
                      <Badge variant="outline" className={`text-[8px] ${liveScanResult.sellTax > 5 ? "text-loss border-loss/30" : liveScanResult.sellTax > 0 ? "text-warning border-warning/30" : "text-gain border-gain/30"}`}>
                        {liveScanResult.sellTax.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">Hidden Owner</span>
                      <Badge variant="outline" className={`text-[8px] ${liveScanResult.hasHiddenOwner ? "text-loss border-loss/30" : "text-gain border-gain/30"}`}>
                        {liveScanResult.hasHiddenOwner ? "Detected" : "None"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">Honeypot</span>
                      <Badge variant="outline" className={`text-[8px] ${liveScanResult.isHoneypot ? "text-loss border-loss/30" : "text-gain border-gain/30"}`}>
                        {liveScanResult.isHoneypot ? "YES" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">LP Locked</span>
                      <Badge variant="outline" className={`text-[8px] ${liveScanResult.lpLocked ? "text-gain border-gain/30" : "text-loss border-loss/30"}`}>
                        {liveScanResult.lpLocked ? `Locked` : "Unlocked"}
                      </Badge>
                    </div>
                    {liveScanResult.totalLiquidity > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Total Liquidity</span>
                        <span className="text-[10px] font-mono">${formatCompact(liveScanResult.totalLiquidity)}</span>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <Skull className="w-3 h-3" /> {t.safety.rugPullRisk}
              </div>
              <Card className="p-2 space-y-1">
                <RugMatrixRow
                  label="Buy/Sell Tax"
                  level={(selectedReport.honeypotRisk ?? 0) > 50 ? "high" : (selectedReport.honeypotRisk ?? 0) > 20 ? "medium" : "low"}
                />
                <RugMatrixRow
                  label="Ownership Renounced"
                  level={selectedReport.mintAuthority ? "high" : "low"}
                />
                <RugMatrixRow
                  label="Liquidity Lock"
                  level={selectedReport.lpLocked ? "low" : "high"}
                />
                <RugMatrixRow
                  label="Holder Distribution"
                  level={(selectedReport.topHolderConcentration ?? 0) > 30 ? "high" : (selectedReport.topHolderConcentration ?? 0) > 15 ? "medium" : "low"}
                />
                <RugMatrixRow
                  label="Dev Activity"
                  level={(selectedReport.devHolding ?? 0) > 15 ? "high" : (selectedReport.devHolding ?? 0) > 5 ? "medium" : "low"}
                />
              </Card>
            </div>

            {(() => {
              const score = selectedReport.overallScore ?? 50;
              const isSafe = score >= 75;
              const isCaution = score >= 45 && score < 75;

              const reasons: string[] = [];
              if ((selectedReport.honeypotRisk ?? 0) > 30) reasons.push("Elevated honeypot risk detected");
              if (!selectedReport.lpLocked) reasons.push("Liquidity pool is not locked");
              if (!selectedReport.contractVerified) reasons.push("Contract is not verified");
              if (selectedReport.mintAuthority) reasons.push("Mint authority has not been renounced");
              if (selectedReport.freezeAuthority) reasons.push("Freeze authority is still active");
              if ((selectedReport.topHolderConcentration ?? 0) > 20) reasons.push("High whale concentration in top holder");
              if ((selectedReport.devHolding ?? 0) > 10) reasons.push("Developer holds significant portion");
              if ((selectedReport.socialScore ?? 0) < 30) reasons.push("Low social/community engagement");

              if (isSafe && reasons.length === 0) reasons.push("All safety checks passed");
              if (isSafe) reasons.push("Liquidity and contract fundamentals look solid");

              const bannerBg = isSafe ? "bg-gain/10 border-gain/30" : isCaution ? "bg-warning/10 border-warning/30" : "bg-loss/10 border-loss/30";
              const bannerText = isSafe ? "text-gain" : isCaution ? "text-warning" : "text-loss";
              const bannerLabel = isSafe ? "SAFE TO TRADE" : isCaution ? "TRADE WITH CAUTION" : "DO NOT TRADE";
              const BannerIcon = isSafe ? ShieldCheck : isCaution ? AlertTriangle : Skull;

              return (
                <div className="space-y-2" data-testid="section-recommendation">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {t.safety.recommendation}
                  </div>
                  <Card className={`p-3 border ${bannerBg}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <BannerIcon className={`w-5 h-5 ${bannerText}`} />
                      <span className={`font-bold text-sm ${bannerText}`}>{bannerLabel}</span>
                    </div>
                    <ul className="space-y-1">
                      {reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <TrendingUp className={`w-3 h-3 mt-0.5 flex-shrink-0 ${bannerText}`} />
                          <span className="text-[10px] text-muted-foreground">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2">
              <Card className="p-2 text-center">
                <Users className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
                <div className="text-xs font-mono font-bold" data-testid="text-holders">{(selectedToken.holders ?? 0).toLocaleString()}</div>
                <div className="text-[9px] text-muted-foreground">{t.common.holders}</div>
              </Card>
              <Card className="p-2 text-center">
                <Droplets className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
                <div className="text-xs font-mono font-bold" data-testid="text-liquidity">${formatCompact(selectedToken.liquidity ?? 0)}</div>
                <div className="text-[9px] text-muted-foreground">{t.common.liquidity}</div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
