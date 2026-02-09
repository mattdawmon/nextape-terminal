import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Fuel, Zap, ArrowRightLeft, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/i18n";

interface EvmGas {
  low: number;
  standard: number;
  fast: number;
  instant?: number;
  baseFee?: number;
}

interface SolanaGas {
  avgFee: number;
  priorityFee: number;
}

interface TronGas {
  bandwidth: number;
  energy: number;
}

interface GasData {
  ethereum: EvmGas & { instant: number; baseFee: number };
  solana: SolanaGas;
  base: EvmGas;
  bsc: EvmGas;
  tron: TronGas;
}

const tierColors: Record<string, string> = {
  low: "text-gain",
  standard: "text-warning",
  fast: "text-orange-400",
  instant: "text-loss",
};

const tierBg: Record<string, string> = {
  low: "bg-gain/10",
  standard: "bg-warning/10",
  fast: "bg-orange-400/10",
  instant: "bg-loss/10",
};

function estimateCostGwei(gwei: number, gasLimit: number, ethPrice: number): string {
  const costEth = (gwei * gasLimit) / 1e9;
  const costUsd = costEth * ethPrice;
  if (costUsd < 0.01) return "<$0.01";
  return `$${costUsd.toFixed(2)}`;
}

export default function GasTrackerPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: gasData, isLoading } = useQuery<GasData>({
    queryKey: ["/api/gas"],
    refetchInterval: 15000,
  });

  if (isLoading || !gasData) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <Skeleton className="h-10 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const ethPrice = 3200;
  const solPrice = 120;

  const comparisonData = [
    { name: "ETH", low: gasData.ethereum.low, standard: gasData.ethereum.standard, fast: gasData.ethereum.fast },
    { name: "Base", low: gasData.base.low, standard: gasData.base.standard, fast: gasData.base.fast },
    { name: "BSC", low: gasData.bsc.low, standard: gasData.bsc.standard, fast: gasData.bsc.fast },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Fuel className="w-4 h-4 text-info" />
        <span className="font-bold text-sm">{t.gasTracker.title}</span>
        <Badge variant="outline" className="text-[10px] font-mono">{t.common.live}</Badge>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className={isMobile ? "p-3" : "p-4"} data-testid="card-gas-ethereum">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-info" />
              <span className="text-sm font-semibold">Ethereum</span>
              <Badge variant="outline" className="text-[10px] font-mono">EVM</Badge>
            </div>
            <div className={`grid gap-2 mb-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
              <GasTier label={t.common.low} value={gasData.ethereum.low} unit="Gwei" tier="low" />
              <GasTier label="Standard" value={gasData.ethereum.standard} unit="Gwei" tier="standard" />
              <GasTier label="Fast" value={gasData.ethereum.fast} unit="Gwei" tier="fast" />
              <GasTier label="Instant" value={gasData.ethereum.instant} unit="Gwei" tier="instant" />
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mb-2">
              Base Fee: {gasData.ethereum.baseFee} Gwei
            </div>
            <div className="space-y-1">
              <EstimatedCost
                icon={ArrowRightLeft}
                label={t.gasTracker.swapCost}
                cost={estimateCostGwei(gasData.ethereum.standard, 150000, ethPrice)}
              />
              <EstimatedCost
                icon={Send}
                label={t.gasTracker.transferCost}
                cost={estimateCostGwei(gasData.ethereum.standard, 65000, ethPrice)}
              />
            </div>
          </Card>

          <Card className={isMobile ? "p-3" : "p-4"} data-testid="card-gas-solana">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-gain" />
              <span className="text-sm font-semibold">Solana</span>
              <Badge variant="outline" className="text-[10px] font-mono">SVM</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <GasTier label={t.gasTracker.avgGas} value={gasData.solana.avgFee} unit="SOL" tier="low" decimals={6} />
              <GasTier label="Priority" value={gasData.solana.priorityFee} unit="SOL" tier="standard" decimals={6} />
            </div>
            <div className="space-y-1 mt-3">
              <EstimatedCost
                icon={ArrowRightLeft}
                label={t.gasTracker.swapCost}
                cost={`$${(gasData.solana.avgFee * solPrice).toFixed(4)}`}
              />
              <EstimatedCost
                icon={Send}
                label={t.gasTracker.transferCost}
                cost={`$${((gasData.solana.avgFee * 0.5) * solPrice).toFixed(4)}`}
              />
            </div>
          </Card>

          <Card className={isMobile ? "p-3" : "p-4"} data-testid="card-gas-base">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-info" />
              <span className="text-sm font-semibold">Base</span>
              <Badge variant="outline" className="text-[10px] font-mono">L2</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <GasTier label={t.common.low} value={gasData.base.low} unit="Gwei" tier="low" />
              <GasTier label="Standard" value={gasData.base.standard} unit="Gwei" tier="standard" />
              <GasTier label="Fast" value={gasData.base.fast} unit="Gwei" tier="fast" />
            </div>
            <div className="space-y-1 mt-3">
              <EstimatedCost
                icon={ArrowRightLeft}
                label={t.gasTracker.swapCost}
                cost={estimateCostGwei(gasData.base.standard, 150000, ethPrice)}
              />
              <EstimatedCost
                icon={Send}
                label={t.gasTracker.transferCost}
                cost={estimateCostGwei(gasData.base.standard, 65000, ethPrice)}
              />
            </div>
          </Card>

          <Card className={isMobile ? "p-3" : "p-4"} data-testid="card-gas-bsc">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-warning" />
              <span className="text-sm font-semibold">BSC</span>
              <Badge variant="outline" className="text-[10px] font-mono">EVM</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <GasTier label={t.common.low} value={gasData.bsc.low} unit="Gwei" tier="low" />
              <GasTier label="Standard" value={gasData.bsc.standard} unit="Gwei" tier="standard" />
              <GasTier label="Fast" value={gasData.bsc.fast} unit="Gwei" tier="fast" />
            </div>
            <div className="space-y-1 mt-3">
              <EstimatedCost
                icon={ArrowRightLeft}
                label={t.gasTracker.swapCost}
                cost={estimateCostGwei(gasData.bsc.standard, 150000, 600)}
              />
              <EstimatedCost
                icon={Send}
                label={t.gasTracker.transferCost}
                cost={estimateCostGwei(gasData.bsc.standard, 65000, 600)}
              />
            </div>
          </Card>

          <Card className={isMobile ? "p-3" : "p-4"} data-testid="card-gas-tron">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-loss" />
              <span className="text-sm font-semibold">Tron</span>
              <Badge variant="outline" className="text-[10px] font-mono">TVM</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <GasTier label="Bandwidth" value={gasData.tron.bandwidth} unit="TRX" tier="low" />
              <GasTier label="Energy" value={gasData.tron.energy} unit="TRX" tier="standard" />
            </div>
            <div className="space-y-1 mt-3">
              <EstimatedCost
                icon={ArrowRightLeft}
                label={t.gasTracker.swapCost}
                cost={`~${(gasData.tron.energy * 0.14).toFixed(2)} TRX`}
              />
              <EstimatedCost
                icon={Send}
                label={t.gasTracker.transferCost}
                cost={`~${(gasData.tron.bandwidth * 0.14).toFixed(2)} TRX`}
              />
            </div>
          </Card>
        </div>

        <Card className={isMobile ? "p-3" : "p-4"} data-testid="card-gas-comparison">
          <div className="text-xs font-medium mb-3">EVM {t.gasTracker.gasPrice} (Gwei)</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(215 15% 50%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(215 15% 50%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220 18% 10%)",
                    border: "1px solid hsl(220 15% 16%)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  formatter={(value: number, name: string) => [`${value} Gwei`, name]}
                />
                <Bar dataKey="low" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} name={t.common.low} />
                <Bar dataKey="standard" fill="hsl(48 96% 53%)" radius={[3, 3, 0, 0]} name="Standard" />
                <Bar dataKey="fast" fill="hsl(25 95% 53%)" radius={[3, 3, 0, 0]} name="Fast" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function GasTier({
  label,
  value,
  unit,
  tier,
  decimals = 1,
}: {
  label: string;
  value: number;
  unit: string;
  tier: string;
  decimals?: number;
}) {
  return (
    <div className={`rounded-md p-2 ${tierBg[tier] ?? "bg-secondary/30"}`} data-testid={`gas-tier-${tier}-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono ${tierColors[tier] ?? "text-foreground"}`}>
        {value.toFixed(decimals)}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono">{unit}</div>
    </div>
  );
}

function EstimatedCost({
  icon: Icon,
  label,
  cost,
}: {
  icon: any;
  label: string;
  cost: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <span className="font-mono font-medium">{cost}</span>
    </div>
  );
}
