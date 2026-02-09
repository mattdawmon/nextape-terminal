import { useQuery, useMutation } from "@tanstack/react-query";
import { type Token, type PriceAlert } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { formatPrice } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { TierGate, FeatureLimitBanner } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

const alertTypeLabels: Record<string, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  percent_change_up: "% Change Up",
  percent_change_down: "% Change Down",
};

const alertTypeColors: Record<string, string> = {
  price_above: "text-gain",
  price_below: "text-loss",
  percent_change_up: "text-gain",
  percent_change_down: "text-loss",
};

export default function AlertsPage() {
  return (
    <TierGate feature="maxAlerts" featureLabel="Price Alerts" requiredTier="free">
      <AlertsContent />
    </TierGate>
  );
}

function AlertsContent() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<PriceAlert[]>({
    queryKey: ["/api/price-alerts"],
  });

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [alertType, setAlertType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [chain, setChain] = useState("solana");

  const tokenMap = useMemo(() => {
    const map = new Map<number, Token>();
    tokens.forEach((t) => map.set(t.id, t));
    return map;
  }, [tokens]);

  const isPercent = alertType === "percent_change_up" || alertType === "percent_change_down";

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/price-alerts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      toast({ title: "Alert created", description: "Price alert is now active" });
      setSelectedTokenId("");
      setAlertType("");
      setTargetValue("");
      setChain("solana");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/price-alerts/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/price-alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      toast({ title: "Deleted", description: "Price alert removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTokenId || !alertType || !targetValue) return;

    const payload: Record<string, unknown> = {
      tokenId: parseInt(selectedTokenId),
      type: alertType,
      chain,
      enabled: true,
    };

    if (isPercent) {
      payload.percentChange = parseFloat(targetValue);
    } else {
      payload.targetPrice = parseFloat(targetValue);
    }

    createMutation.mutate(payload);
  };

  const isLoading = alertsLoading || tokensLoading;

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Bell className="w-4 h-4 text-info" />
        <span className="font-bold text-sm">{t.alerts.title}</span>
        <span className="text-xs text-muted-foreground font-mono">({alerts.length} alerts)</span>
      </div>

      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <Card className={isMobile ? "p-3" : "p-4"}>
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t.alerts.createAlert}</span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select value={selectedTokenId} onValueChange={setSelectedTokenId}>
                <SelectTrigger data-testid="select-token">
                  <SelectValue placeholder={t.alerts.tokenSymbol} />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map((token) => (
                    <SelectItem key={token.id} value={String(token.id)}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger data-testid="select-alert-type">
                  <SelectValue placeholder={t.alerts.alertType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_above">{`${t.common.price} ${t.alerts.above}`}</SelectItem>
                  <SelectItem value="price_below">{`${t.common.price} ${t.alerts.below}`}</SelectItem>
                  <SelectItem value="percent_change_up">{t.alerts.percentChange}</SelectItem>
                  <SelectItem value="percent_change_down">{t.alerts.percentChange}</SelectItem>
                </SelectContent>
              </Select>

              <Input
                data-testid="input-target-value"
                type="number"
                step="any"
                placeholder={isPercent ? t.alerts.percentChange : t.alerts.targetPrice}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />

              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger data-testid="select-chain">
                  <SelectValue placeholder={t.common.chain} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solana">Solana</SelectItem>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="bsc">BSC</SelectItem>
                  <SelectItem value="tron">Tron</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              data-testid="button-create-alert"
              type="submit"
              disabled={!selectedTokenId || !alertType || !targetValue || createMutation.isPending}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {createMutation.isPending ? t.common.loading : t.alerts.createAlert}
            </Button>
          </form>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t.alerts.title}</span>
          </div>

          {alerts.length === 0 ? (
            <Card className="p-6">
              <div className="text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.alerts.noAlerts}</p>
                <p className="text-xs mt-1">{t.alerts.subtitle}</p>
              </div>
            </Card>
          ) : (
            alerts.map((alert) => {
              const token = tokenMap.get(alert.tokenId);
              const typeColor = alertTypeColors[alert.type] ?? "text-muted-foreground";
              const isUp = alert.type === "price_above" || alert.type === "percent_change_up";
              const isPct = alert.type === "percent_change_up" || alert.type === "percent_change_down";

              return (
                <Card key={alert.id} data-testid={`card-alert-${alert.id}`} className="p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      {isUp ? (
                        <TrendingUp className={`w-3.5 h-3.5 ${typeColor}`} />
                      ) : (
                        <TrendingDown className={`w-3.5 h-3.5 ${typeColor}`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" data-testid={`text-alert-token-${alert.id}`}>
                          {token?.symbol ?? `Token #${alert.tokenId}`}
                        </span>
                        <Badge variant="outline" className={`text-[10px] font-mono ${typeColor}`}>
                          {alertTypeLabels[alert.type] ?? alert.type}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {(alert.chain ?? "solana").toUpperCase()}
                        </Badge>
                        {alert.triggered && (
                          <Badge variant="destructive" className="text-[10px]">
                            TRIGGERED
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {isPct
                          ? `${alert.percentChange ?? 0}%`
                          : formatPrice(alert.targetPrice ?? 0)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        data-testid={`switch-alert-${alert.id}`}
                        checked={alert.enabled ?? false}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: alert.id, enabled: checked })
                        }
                      />
                      <Button
                        data-testid={`button-delete-alert-${alert.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(alert.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-loss" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
