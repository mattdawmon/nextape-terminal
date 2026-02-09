import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type CopyTradeConfig, type SmartWallet } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Plus, Trash2, Settings, ToggleLeft, Target, ShieldAlert, Wallet, TrendingUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TierGate, FeatureLimitBanner } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

export default function CopyTradingPage() {
  return (
    <TierGate feature="maxCopyTrades" featureLabel="Copy Trading" requiredTier="basic">
      <CopyTradingContent />
    </TierGate>
  );
}

function CopyTradingContent() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { data: configs = [], isLoading: configsLoading } = useQuery<CopyTradeConfig[]>({
    queryKey: ["/api/copy-trades"],
  });

  const { data: wallets = [], isLoading: walletsLoading } = useQuery<SmartWallet[]>({
    queryKey: ["/api/smart-wallets"],
  });

  const [selectedWallet, setSelectedWallet] = useState("");
  const [multiplier, setMultiplier] = useState("1");
  const [takeProfit, setTakeProfit] = useState("200");
  const [stopLoss, setStopLoss] = useState("50");
  const [maxPosition, setMaxPosition] = useState("10");

  const walletMap = new Map(wallets.map((w) => [w.id, w]));

  const activeCount = configs.filter((c) => c.enabled).length;

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await apiRequest("POST", "/api/copy-trades", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trades"] });
      toast({ title: "Copy trade created", description: "New copy trade configuration added." });
      setSelectedWallet("");
      setMultiplier("1");
      setTakeProfit("200");
      setStopLoss("50");
      setMaxPosition("10");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/copy-trades/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trades"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/copy-trades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trades"] });
      toast({ title: "Deleted", description: "Copy trade configuration removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedWallet) return;
    createMutation.mutate({
      walletId: parseInt(selectedWallet),
      multiplier: parseFloat(multiplier) || 1,
      takeProfit: parseFloat(takeProfit) || 200,
      stopLoss: parseFloat(stopLoss) || 50,
      maxPosition: parseFloat(maxPosition) || 10,
      enabled: true,
    });
  };

  const isLoading = configsLoading || walletsLoading;

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <Copy className="w-4 h-4 text-info" />
        <span className="font-bold text-sm" data-testid="text-page-title">{t.copyTrading.title}</span>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ToggleLeft className="w-3.5 h-3.5 text-gain" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Active Copies</span>
            </div>
            <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-active-copies">{activeCount}</span>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="w-3.5 h-3.5 text-info" />
              <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Wallets Copied</span>
            </div>
            <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-total-wallets">{configs.length}</span>
          </Card>
        </div>

        {configs.length === 0 ? (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Copy className="w-8 h-8" />
              <span className="text-xs">{t.copyTrading.noConfigs}</span>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {configs.map((config) => {
              const wallet = walletMap.get(config.walletId);
              return (
                <Card key={config.id} className={isMobile ? "p-3" : "p-4"} data-testid={`card-config-${config.id}`}>
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                        <Wallet className="w-3.5 h-3.5 text-info" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold" data-testid={`text-wallet-label-${config.id}`}>
                          {wallet?.label ?? `Wallet #${config.walletId}`}
                        </div>
                        <Badge variant="secondary" className="text-[9px]">
                          {config.chain ?? "solana"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.enabled ?? false}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: config.id, enabled: checked })}
                        data-testid={`switch-toggle-${config.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(config.id)}
                        data-testid={`button-delete-${config.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-loss" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 p-2 rounded-md bg-secondary/30">
                      <TrendingUp className="w-3 h-3 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">Multiplier</div>
                        <div className="text-xs font-mono font-semibold" data-testid={`text-multiplier-${config.id}`}>
                          {config.multiplier ?? 1}x
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-md bg-secondary/30">
                      <Target className="w-3 h-3 text-gain" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">Take Profit</div>
                        <div className="text-xs font-mono font-semibold text-gain" data-testid={`text-takeprofit-${config.id}`}>
                          {config.takeProfit ?? 200}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-md bg-secondary/30">
                      <ShieldAlert className="w-3 h-3 text-loss" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">Stop Loss</div>
                        <div className="text-xs font-mono font-semibold text-loss" data-testid={`text-stoploss-${config.id}`}>
                          {config.stopLoss ?? 50}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-md bg-secondary/30">
                      <Settings className="w-3 h-3 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">Max Position</div>
                        <div className="text-xs font-mono font-semibold" data-testid={`text-maxposition-${config.id}`}>
                          {config.maxPosition ?? 10} SOL
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-info" />
            <span className="text-xs font-semibold">{t.copyTrading.createConfig}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t.copyTrading.sourceWallet}</label>
              <Select value={selectedWallet} onValueChange={setSelectedWallet} data-testid="select-wallet">
                <SelectTrigger data-testid="select-wallet-trigger">
                  <SelectValue placeholder={t.copyTrading.sourceWallet} />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)} data-testid={`select-wallet-option-${w.id}`}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Multiplier</label>
              <Input
                type="number"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                placeholder="1"
                className="font-mono text-xs"
                data-testid="input-multiplier"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t.copyTrading.tradePercentage}</label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="200"
                className="font-mono text-xs"
                data-testid="input-take-profit"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t.copyTrading.slippage}</label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="50"
                className="font-mono text-xs"
                data-testid="input-stop-loss"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t.copyTrading.maxTradeSize}</label>
              <Input
                type="number"
                value={maxPosition}
                onChange={(e) => setMaxPosition(e.target.value)}
                placeholder="10"
                className="font-mono text-xs"
                data-testid="input-max-position"
              />
            </div>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={handleSubmit}
            disabled={!selectedWallet || createMutation.isPending}
            data-testid="button-submit-copy-trade"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {createMutation.isPending ? t.common.loading : t.copyTrading.createConfig}
          </Button>
        </Card>
      </div>
    </div>
  );
}
