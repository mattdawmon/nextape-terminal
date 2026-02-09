import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Token, type LimitOrder, type DcaConfig } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCompact, formatPrice } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ListOrdered, RefreshCw, Plus, Trash2, X, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TierGate } from "@/components/tier-gate";
import { useTranslation } from "@/i18n";

function LimitOrdersTab() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: orders = [], isLoading } = useQuery<LimitOrder[]>({
    queryKey: ["/api/limit-orders"],
  });
  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const [tokenId, setTokenId] = useState("");
  const [type, setType] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [amount, setAmount] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [chain, setChain] = useState("solana");

  const tokenMap = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/limit-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/limit-orders"] });
      toast({ title: t.orders.createOrder, description: "Limit order placed successfully" });
      setTokenId("");
      setAmount("");
      setTriggerPrice("");
      setSlippage("1");
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/limit-orders/${id}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/limit-orders"] });
      toast({ title: t.common.cancel, description: "Order cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/limit-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/limit-orders"] });
      toast({ title: t.common.delete, description: "Order removed" });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenId || !amount || !triggerPrice) return;
    createMutation.mutate({
      tokenId: parseInt(tokenId),
      type,
      orderType,
      amount: parseFloat(amount),
      triggerPrice: parseFloat(triggerPrice),
      slippage: parseFloat(slippage) || 1,
      chain,
    });
  };

  const statusColor = (status: string) => {
    if (status === "filled") return "text-gain";
    if (status === "cancelled") return "text-loss";
    return "text-warning";
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className={isMobile ? "p-3" : "p-4"}>
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider">{t.orders.limitOrder}</span>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={tokenId} onValueChange={setTokenId}>
            <SelectTrigger data-testid="select-order-token">
              <SelectValue placeholder={t.common.token} />
            </SelectTrigger>
            <SelectContent>
              {tokens.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">{t.common.buy}</SelectItem>
              <SelectItem value="sell">{t.common.sell}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orderType} onValueChange={setOrderType}>
            <SelectTrigger data-testid="select-order-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="limit">{t.orders.limitOrder}</SelectItem>
              <SelectItem value="stop">{t.orders.stopOrder}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            data-testid="input-order-amount"
            type="number"
            step="any"
            placeholder={t.common.amount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            data-testid="input-order-trigger-price"
            type="number"
            step="any"
            placeholder={t.orders.targetPrice}
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
          />
          <Input
            data-testid="input-order-slippage"
            type="number"
            step="any"
            placeholder="Slippage %"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
          />
          <Select value={chain} onValueChange={setChain}>
            <SelectTrigger data-testid="select-order-chain">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solana">Solana</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="bsc">BSC</SelectItem>
              <SelectItem value="tron">Tron</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="button-create-order" type="submit" disabled={createMutation.isPending || !tokenId || !amount || !triggerPrice}>
            {createMutation.isPending ? "Placing..." : t.orders.createOrder}
          </Button>
        </form>
      </Card>

      {orders.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ListOrdered className="w-8 h-8" />
            <span className="text-xs">{t.orders.noOrders}</span>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2">{t.common.token}</th>
                  <th className="text-left px-3 py-2">{t.orders.orderType}</th>
                  {!isMobile && <th className="text-left px-3 py-2">Order</th>}
                  <th className="text-right px-3 py-2">{t.common.amount}</th>
                  <th className="text-right px-3 py-2">{t.orders.targetPrice}</th>
                  <th className="text-center px-3 py-2">{t.common.status}</th>
                  {!isMobile && <th className="text-left px-3 py-2">Created</th>}
                  <th className="text-right px-3 py-2">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const token = tokenMap.get(order.tokenId);
                  return (
                    <tr key={order.id} data-testid={`row-order-${order.id}`} className="border-b border-border/50 hover-elevate">
                      <td className="px-3 py-2 font-semibold">{token?.symbol ?? `#${order.tokenId}`}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${order.type === "buy" ? "text-gain border-gain/30" : "text-loss border-loss/30"}`}>
                          {order.type.toUpperCase()}
                        </Badge>
                      </td>
                      {!isMobile && (
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">{order.orderType}</Badge>
                        </td>
                      )}
                      <td className="text-right px-3 py-2">{formatCompact(order.amount)}</td>
                      <td className="text-right px-3 py-2">{formatPrice(order.triggerPrice)}</td>
                      <td className="text-center px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${statusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                      </td>
                      {!isMobile && (
                        <td className="px-3 py-2 text-muted-foreground">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}
                        </td>
                      )}
                      <td className="text-right px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {order.status === "pending" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-cancel-order-${order.id}`}
                              onClick={() => cancelMutation.mutate(order.id)}
                              disabled={cancelMutation.isPending}
                            >
                              <X className="w-3.5 h-3.5 text-warning" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-delete-order-${order.id}`}
                            onClick={() => deleteMutation.mutate(order.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-loss" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function DcaConfigsTab() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: configs = [], isLoading } = useQuery<DcaConfig[]>({
    queryKey: ["/api/dca-configs"],
  });
  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const [tokenId, setTokenId] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [maxExecutions, setMaxExecutions] = useState("0");
  const [chain, setChain] = useState("solana");

  const tokenMap = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/dca-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dca-configs"] });
      toast({ title: t.orders.dca, description: "DCA configuration added" });
      setTokenId("");
      setAmount("");
      setMaxExecutions("0");
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/dca-configs/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dca-configs"] });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/dca-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dca-configs"] });
      toast({ title: t.common.delete, description: "DCA configuration removed" });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenId || !amount) return;
    createMutation.mutate({
      tokenId: parseInt(tokenId),
      amount: parseFloat(amount),
      frequency,
      maxExecutions: parseInt(maxExecutions) || 0,
      chain,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className={isMobile ? "p-3" : "p-4"}>
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider">{t.orders.dca}</span>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <Select value={tokenId} onValueChange={setTokenId}>
            <SelectTrigger data-testid="select-dca-token">
              <SelectValue placeholder={t.common.token} />
            </SelectTrigger>
            <SelectContent>
              {tokens.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            data-testid="input-dca-amount"
            type="number"
            step="any"
            placeholder={t.orders.amountPerBuy}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger data-testid="select-dca-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">{t.orders.hourly}</SelectItem>
              <SelectItem value="daily">{t.orders.daily}</SelectItem>
              <SelectItem value="weekly">{t.orders.weekly}</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">{t.orders.monthly}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            data-testid="input-dca-max-executions"
            type="number"
            placeholder="Max executions (0=unlimited)"
            value={maxExecutions}
            onChange={(e) => setMaxExecutions(e.target.value)}
          />
          <Select value={chain} onValueChange={setChain}>
            <SelectTrigger data-testid="select-dca-chain">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solana">Solana</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="bsc">BSC</SelectItem>
              <SelectItem value="tron">Tron</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="button-create-dca" type="submit" disabled={createMutation.isPending || !tokenId || !amount}>
            {createMutation.isPending ? "Creating..." : t.orders.dca}
          </Button>
        </form>
      </Card>

      {configs.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-8 h-8" />
            <span className="text-xs">{t.orders.noDca}</span>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2">{t.common.token}</th>
                  <th className="text-right px-3 py-2">{t.common.amount}</th>
                  <th className="text-left px-3 py-2">{t.orders.interval}</th>
                  {!isMobile && <th className="text-right px-3 py-2">Invested</th>}
                  <th className="text-right px-3 py-2">{t.orders.executed}</th>
                  <th className="text-center px-3 py-2">{t.common.enabled}</th>
                  <th className="text-right px-3 py-2">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => {
                  const token = tokenMap.get(config.tokenId);
                  return (
                    <tr key={config.id} data-testid={`row-dca-${config.id}`} className="border-b border-border/50 hover-elevate">
                      <td className="px-3 py-2 font-semibold">{token?.symbol ?? `#${config.tokenId}`}</td>
                      <td className="text-right px-3 py-2">{formatCompact(config.amount)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-[10px]">{config.frequency}</Badge>
                      </td>
                      {!isMobile && (
                        <td className="text-right px-3 py-2 text-gain">{formatPrice(config.totalInvested ?? 0)}</td>
                      )}
                      <td className="text-right px-3 py-2">
                        {config.executionCount ?? 0}
                        {config.maxExecutions && config.maxExecutions > 0 ? `/${config.maxExecutions}` : ""}
                      </td>
                      <td className="text-center px-3 py-2">
                        <Switch
                          data-testid={`switch-dca-enabled-${config.id}`}
                          checked={config.enabled ?? false}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: config.id, enabled: checked })}
                        />
                      </td>
                      <td className="text-right px-3 py-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-delete-dca-${config.id}`}
                          onClick={() => deleteMutation.mutate(config.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-loss" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <TierGate feature="maxLimitOrders" featureLabel="Orders & DCA" requiredTier="basic">
      <OrdersContent />
    </TierGate>
  );
}

function OrdersContent() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <ListOrdered className="w-4 h-4 text-info" />
        <span className="font-bold text-sm" data-testid="text-page-title">{t.orders.title}</span>
      </div>

      <div className={isMobile ? "p-3" : "p-4"}>
        <Tabs defaultValue="limit-orders">
          <TabsList className="mb-4">
            <TabsTrigger value="limit-orders" data-testid="tab-limit-orders">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              {t.orders.limitOrder}
            </TabsTrigger>
            <TabsTrigger value="dca" data-testid="tab-dca">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t.orders.dca}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="limit-orders">
            <LimitOrdersTab />
          </TabsContent>
          <TabsContent value="dca">
            <DcaConfigsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
