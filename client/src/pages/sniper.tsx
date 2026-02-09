import { useQuery, useMutation } from "@tanstack/react-query";
import { type SniperRule } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Crosshair, Plus, Trash2, Shield, Zap, Settings, Target, AlertTriangle, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { formatCompact } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { TierGate, FeatureLimitBanner } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

const recentSnipes = [
  { token: "PEPE2.0", entry: 0.0000012, current: 0.0000089, pnl: 641.67, time: "2m ago" },
  { token: "WOJAK", entry: 0.00034, current: 0.00028, pnl: -17.65, time: "8m ago" },
  { token: "BODEN", entry: 0.042, current: 0.078, pnl: 85.71, time: "14m ago" },
  { token: "GROK", entry: 0.0089, current: 0.0123, pnl: 38.2, time: "21m ago" },
  { token: "BONK2", entry: 0.0000001, current: 0.0000003, pnl: 200.0, time: "35m ago" },
];

export default function SniperPage() {
  return (
    <TierGate feature="maxSniperRules" featureLabel="Sniper Mode" requiredTier="basic">
      <SniperContent />
    </TierGate>
  );
}

function SniperContent() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { data: rules = [], isLoading } = useQuery<SniperRule[]>({
    queryKey: ["/api/sniper-rules"],
  });

  const [name, setName] = useState("");
  const [chain, setChain] = useState("solana");
  const [minLiquidity, setMinLiquidity] = useState("1000");
  const [maxMcap, setMaxMcap] = useState("1000000");
  const [minHolders, setMinHolders] = useState("10");
  const [maxDevHolding, setMaxDevHolding] = useState("10");
  const [autoBuyAmount, setAutoBuyAmount] = useState("0.5");
  const [slippage, setSlippage] = useState("15");
  const [antiMev, setAntiMev] = useState(true);

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/sniper-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sniper-rules"] });
      toast({ title: "Rule created", description: "Sniper rule is now active" });
      setName("");
      setChain("solana");
      setMinLiquidity("1000");
      setMaxMcap("1000000");
      setMinHolders("10");
      setMaxDevHolding("10");
      setAutoBuyAmount("0.5");
      setSlippage("15");
      setAntiMev(true);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/sniper-rules/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sniper-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sniper-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sniper-rules"] });
      toast({ title: "Deleted", description: "Sniper rule removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      chain,
      minLiquidity: parseFloat(minLiquidity) || 0,
      maxMcap: parseFloat(maxMcap) || 0,
      minHolders: parseInt(minHolders) || 0,
      maxDevHolding: parseFloat(maxDevHolding) || 0,
      autoBuyAmount: parseFloat(autoBuyAmount) || 0,
      slippage: parseFloat(slippage) || 0,
      antiMev,
      enabled: true,
    });
  };

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Crosshair className="w-4 h-4 text-loss" />
        <span className="font-bold text-sm">{t.sniper.title}</span>
        <Badge data-testid="badge-armed" variant="destructive" className="text-[10px]">ARMED</Badge>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-loss" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Active Rules</span>
            </div>
            <span data-testid="text-active-rules" className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`}>{activeCount}</span>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-warning" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Total Snipes</span>
            </div>
            <span data-testid="text-total-snipes" className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`}>{recentSnipes.length}</span>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t.sniper.title}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rules.map((rule) => (
              <Card key={rule.id} data-testid={`card-rule-${rule.id}`} className={`space-y-3 ${isMobile ? "p-3" : "p-4"}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</span>
                    <Badge data-testid={`badge-chain-${rule.id}`} variant="outline" className="text-[10px] font-mono">
                      {rule.chain?.toUpperCase() ?? "SOL"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid={`switch-enabled-${rule.id}`}
                      checked={rule.enabled ?? false}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, enabled: checked })}
                    />
                    <Button
                      data-testid={`button-delete-${rule.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(rule.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-loss" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">{t.sniper.liquidityThreshold}</span>
                    <span className="font-mono">${formatCompact(rule.minLiquidity ?? 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">{t.common.marketCap}</span>
                    <span className="font-mono">${formatCompact(rule.maxMcap ?? 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">{t.common.holders}</span>
                    <span className="font-mono">{rule.minHolders ?? 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">{t.memes.devWallet}</span>
                    <span className="font-mono">{rule.maxDevHolding ?? 0}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">{t.sniper.buyAmount}</span>
                    <span className="font-mono">{rule.autoBuyAmount ?? 0} SOL</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">{t.sniper.maxSlippage}</span>
                    <span className="font-mono">{rule.slippage ?? 0}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className={`w-3 h-3 ${rule.antiMev ? "text-gain" : "text-muted-foreground"}`} />
                    <span className="text-[10px]">{rule.antiMev ? "Anti-MEV ON" : "Anti-MEV OFF"}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-3.5 h-3.5 text-gain" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t.sniper.createRule}</span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.sniper.createRule}</label>
                <Input
                  data-testid="input-rule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sol Gem Hunter"
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.common.chain}</label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger data-testid="select-chain" className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.sniper.liquidityThreshold}</label>
                <Input
                  data-testid="input-min-liquidity"
                  type="number"
                  value={minLiquidity}
                  onChange={(e) => setMinLiquidity(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.common.marketCap}</label>
                <Input
                  data-testid="input-max-mcap"
                  type="number"
                  value={maxMcap}
                  onChange={(e) => setMaxMcap(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.common.holders}</label>
                <Input
                  data-testid="input-min-holders"
                  type="number"
                  value={minHolders}
                  onChange={(e) => setMinHolders(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.memes.devWallet}</label>
                <Input
                  data-testid="input-max-dev-holding"
                  type="number"
                  value={maxDevHolding}
                  onChange={(e) => setMaxDevHolding(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.sniper.buyAmount}</label>
                <Input
                  data-testid="input-auto-buy"
                  type="number"
                  step="0.1"
                  value={autoBuyAmount}
                  onChange={(e) => setAutoBuyAmount(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t.sniper.maxSlippage}</label>
                <Input
                  data-testid="input-slippage"
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1 justify-end">
                <div className="flex items-center gap-2">
                  <Checkbox
                    data-testid="checkbox-anti-mev"
                    id="anti-mev"
                    checked={antiMev}
                    onCheckedChange={(checked) => setAntiMev(checked === true)}
                  />
                  <label htmlFor="anti-mev" className="text-xs flex items-center gap-1 cursor-pointer">
                    <Shield className="w-3 h-3" />
                    Anti-MEV Protection
                  </label>
                </div>
              </div>
            </div>
            <Button
              data-testid="button-create-rule"
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {createMutation.isPending ? t.common.loading : t.sniper.createRule}
            </Button>
          </form>
        </Card>

        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-info" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t.sniper.title}</span>
            <Badge variant="secondary" className="text-[10px]">SIMULATED</Badge>
          </div>
          <div className="space-y-2">
            {recentSnipes.map((snipe, idx) => {
              const isGain = snipe.pnl >= 0;
              return (
                <div
                  key={idx}
                  data-testid={`row-snipe-${idx}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/30 flex-wrap"
                >
                  <div className="flex items-center gap-2">
                    <Target className={`w-3 h-3 ${isGain ? "text-gain" : "text-loss"}`} />
                    <span className="text-xs font-semibold">{snipe.token}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{snipe.time}</span>
                  </div>
                  <div className={`flex items-center gap-3 ${isMobile ? "w-full justify-between mt-1" : ""}`}>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Entry</div>
                      <div className="text-xs font-mono">${snipe.entry < 0.001 ? snipe.entry.toExponential(2) : snipe.entry.toFixed(4)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Current</div>
                      <div className="text-xs font-mono">${snipe.current < 0.001 ? snipe.current.toExponential(2) : snipe.current.toFixed(4)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">PnL</div>
                      <div className={`text-xs font-mono font-bold ${isGain ? "text-gain" : "text-loss"}`}>
                        {isGain ? "+" : ""}{snipe.pnl.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex items-center gap-2 p-3 rounded-md bg-secondary/20">
          <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {t.sniper.subtitle}
          </span>
        </div>
      </div>
    </div>
  );
}
