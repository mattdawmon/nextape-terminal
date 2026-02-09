import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Play, Square, Trash2, Plus, TrendingUp, TrendingDown,
  Activity, Brain, Shield, AlertTriangle, ChevronDown, ChevronUp,
  Zap, Target, BarChart3, Crosshair, ArrowUpRight,
  ArrowDownRight, Eye, Copy, Check, Lock, CreditCard, Clock,
  Crown, Sparkles, X
} from "lucide-react";
import type { AiAgent, AgentTrade, AgentLog, AgentPosition, Subscription } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/i18n";

const CHAINS = [
  { value: "solana", label: "Solana" },
  { value: "ethereum", label: "Ethereum" },
  { value: "base", label: "Base" },
  { value: "bsc", label: "BNB Chain" },
  { value: "tron", label: "Tron" },
  { value: "all", label: "All Chains" },
];

const TIER_INFO: Record<string, { icon: any; label: string; color: string }> = {
  basic: { icon: Zap, label: "Basic", color: "text-blue-400" },
  pro: { icon: Crown, label: "Pro", color: "text-gain" },
  whale: { icon: Sparkles, label: "Whale", color: "text-purple-400" },
};

interface SubStatus {
  subscription: Subscription | null;
  tier: string | null;
  limits: { maxAgents: number; maxDailyTrades: number } | null;
  agentCount: number;
  active: boolean;
  inGracePeriod: boolean;
  gracePeriodEndsAt: string | null;
  renewalFailures: number;
  lastFailureReason: string | null;
  pendingPaymentCount: number;
  promoAccess: { tier: string; code: string; expiresAt?: string | null; expired?: boolean } | null;
}

interface PaymentRecord {
  id: number;
  tier: string;
  chain: string;
  currency: string;
  amountRequiredUsd: number;
  amountRequiredCrypto: number;
  amountReceived: number | null;
  txHash: string | null;
  status: string;
  failureReason: string | null;
  retryCount: number | null;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

interface TierPrice {
  tier: string;
  usdPrice: number;
  limits: { maxAgents: number; maxDailyTrades: number };
  chains: { chain: string; currency: string; cryptoPrice: number; amount: number }[];
}

function useStrategies() {
  const { t } = useTranslation();
  return [
    { value: "conservative", label: t.aiAgents.conservative, desc: t.aiAgents.conservativeDesc, color: "text-blue-400" },
    { value: "balanced", label: t.aiAgents.balanced, desc: t.aiAgents.balancedDesc, color: "text-gain" },
    { value: "aggressive", label: t.aiAgents.aggressive, desc: t.aiAgents.aggressiveDesc, color: "text-orange-400" },
    { value: "degen", label: t.aiAgents.degen, desc: t.aiAgents.degenDesc, color: "text-loss" },
  ];
}

// ── Subscription Status Banner ──
function SubscriptionBanner({ subStatus, onSubscribe }: { subStatus: SubStatus; onSubscribe: () => void }) {
  const { t } = useTranslation();

  if (subStatus.promoAccess && !subStatus.promoAccess.expired) {
    const tierInfo = TIER_INFO[subStatus.promoAccess.tier || "whale"];
    const TierIcon = tierInfo?.icon || Sparkles;
    const expiresAt = subStatus.promoAccess.expiresAt ? new Date(subStatus.promoAccess.expiresAt) : null;
    const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
    const hoursLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))) : null;
    const isUrgent = daysLeft !== null && daysLeft <= 2;
    return (
      <div className={`rounded-md border p-3 ${isUrgent ? "border-warning/30 bg-warning/5" : "border-purple-500/30 bg-purple-500/5"}`}>
        <div className="flex items-center gap-2">
          <TierIcon className={`w-4 h-4 ${isUrgent ? "text-warning" : "text-purple-400"}`} />
          <div className="flex-1">
            <div className="text-xs font-semibold flex items-center gap-1 flex-wrap">
              <span className="text-purple-400">{tierInfo?.label}</span> {t.aiAgents.planActive}
              <Badge variant="outline" className="text-[8px] border-purple-500/30 text-purple-400">{t.aiAgents.promoCode}</Badge>
              {daysLeft !== null && (
                <Badge variant="outline" className={`text-[8px] ${isUrgent ? "border-warning/30 text-warning" : "border-muted-foreground/30 text-muted-foreground"}`}>
                  {daysLeft > 0 ? `${daysLeft}d left` : hoursLeft !== null && hoursLeft > 0 ? `${hoursLeft}h left` : "Expired"}
                </Badge>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {t.aiAgents.freeAccess} <span className="font-mono text-purple-400">{subStatus.promoAccess.code}</span>
              {" "} | {subStatus.limits?.maxAgents === 999 ? t.aiAgents.unlimited : subStatus.limits?.maxAgents} {t.aiAgents.agents}
              {" "} | {subStatus.limits?.maxDailyTrades === 999 ? t.aiAgents.unlimited : subStatus.limits?.maxDailyTrades} {t.aiAgents.tradesDay}
              {isUrgent && <span className="text-warning ml-1">- Subscribe to keep access</span>}
            </div>
          </div>
          {isUrgent && (
            <Button size="sm" variant="outline" className="border-warning/30 text-warning text-[10px]" onClick={onSubscribe}>
              {t.common.subscribe}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (subStatus.promoAccess?.expired) {
    return (
      <div className="rounded-md border border-loss/30 bg-loss/5 p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-loss" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-loss">Free Trial Expired</div>
            <div className="text-[10px] text-muted-foreground">
              Your 7-day free trial has ended. Subscribe to continue using AI Trading Agents.
            </div>
          </div>
          <Button size="sm" onClick={onSubscribe}>{t.common.subscribe}</Button>
        </div>
      </div>
    );
  }

  if (subStatus.inGracePeriod && subStatus.subscription) {
    const tierInfo = TIER_INFO[subStatus.tier || "basic"];
    const TierIcon = tierInfo?.icon || Zap;
    const graceEnds = subStatus.gracePeriodEndsAt ? new Date(subStatus.gracePeriodEndsAt) : null;
    const hoursLeft = graceEnds ? Math.max(0, Math.ceil((graceEnds.getTime() - Date.now()) / (1000 * 60 * 60))) : 0;

    return (
      <div className="rounded-md border border-loss/40 bg-loss/5 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-loss">
                Payment Failed - Grace Period
              </div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                Your <span className={tierInfo?.color}>{tierInfo?.label}</span> subscription has expired.
                You have <span className="font-bold text-loss">{hoursLeft} hours</span> to renew before your agents are deactivated.
                {subStatus.lastFailureReason && (
                  <span className="block mt-0.5 text-loss/70">Reason: {subStatus.lastFailureReason}</span>
                )}
              </div>
            </div>
          </div>
          <Button size="sm" onClick={onSubscribe} data-testid="button-renew-now">
            <CreditCard className="w-3 h-3 mr-1" /> Renew Now
          </Button>
        </div>
      </div>
    );
  }

  if (subStatus.active && subStatus.subscription) {
    const tierInfo = TIER_INFO[subStatus.tier || "basic"];
    const TierIcon = tierInfo?.icon || Zap;
    const expiresAt = new Date(subStatus.subscription.expiresAt);
    const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const isExpiringSoon = daysLeft <= 5;

    return (
      <div className={`rounded-md border p-3 ${isExpiringSoon ? "border-amber-500/30 bg-amber-500/5" : "border-gain/30 bg-gain/5"}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {isExpiringSoon ? <Clock className="w-4 h-4 text-amber-500" /> : <TierIcon className={`w-4 h-4 ${tierInfo?.color}`} />}
            <div>
              <div className="text-xs font-semibold">
                <span className={tierInfo?.color}>{tierInfo?.label}</span> {t.aiAgents.planActive}
                {isExpiringSoon && <span className="text-amber-500 ml-1">- Expiring Soon</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {subStatus.agentCount}/{subStatus.limits?.maxAgents === 999 ? t.aiAgents.unlimited : subStatus.limits?.maxAgents} {t.aiAgents.agents}
                {" "} | {subStatus.limits?.maxDailyTrades === 999 ? t.aiAgents.unlimited : subStatus.limits?.maxDailyTrades} {t.aiAgents.tradesDay}
                {" "} | <span className={isExpiringSoon ? "text-amber-500 font-semibold" : ""}>{daysLeft} days remaining</span>
              </div>
              {subStatus.renewalFailures > 0 && (
                <div className="text-[9px] text-loss mt-0.5">
                  {subStatus.renewalFailures} failed renewal attempt{subStatus.renewalFailures > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isExpiringSoon && (
              <Button size="sm" onClick={onSubscribe} data-testid="button-renew-early">
                <CreditCard className="w-3 h-3 mr-1" /> Renew
              </Button>
            )}
            {subStatus.tier !== "whale" && !isExpiringSoon && (
              <Button size="sm" variant="outline" onClick={onSubscribe} data-testid="button-upgrade-plan">
                <ArrowUpRight className="w-3 h-3 mr-1" /> {t.common.upgrade}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-amber-500">{t.aiAgents.subscriptionRequired}</div>
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              {t.aiAgents.subscriptionDesc}. Pay in SOL, ETH, or BNB.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PromoCodeInput />
          <Button size="sm" onClick={onSubscribe} data-testid="button-subscribe-now">
            <CreditCard className="w-3 h-3 mr-1" /> {t.common.subscribe} Now
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Promo Code Input ──
function PromoCodeInput() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [showInput, setShowInput] = useState(false);

  const redeemMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/promo-codes/redeem", { code: code.trim() }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      toast({ title: t.aiAgents.promoActivated, description: data.message });
      setCode("");
      setShowInput(false);
    },
    onError: async (err: any) => {
      const msg = err.message || t.aiAgents.invalidPromo;
      toast({ title: t.aiAgents.redeemFailed, description: msg, variant: "destructive" });
    },
  });

  if (!showInput) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShowInput(true)} data-testid="button-enter-promo">
        <Sparkles className="w-3 h-3 mr-1" /> {t.aiAgents.haveCode}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder={t.aiAgents.promoCode}
        className="w-28 text-xs font-mono"
        data-testid="input-promo-code"
        onKeyDown={(e) => e.key === "Enter" && code.trim() && redeemMutation.mutate()}
      />
      <Button
        size="sm"
        onClick={() => redeemMutation.mutate()}
        disabled={!code.trim() || redeemMutation.isPending}
        data-testid="button-redeem-promo"
      >
        {redeemMutation.isPending ? "..." : t.common.apply}
      </Button>
      <Button size="icon" variant="ghost" onClick={() => { setShowInput(false); setCode(""); }} data-testid="button-close-promo">
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ── Payment Modal ──
function PaymentModal({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState("solana");
  const [paymentData, setPaymentData] = useState<any>(null);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: pricesData } = useQuery<{ tiers: TierPrice[] }>({
    queryKey: ["/api/subscriptions/prices"],
  });

  const createPaymentMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscriptions/create-payment", { tier: selectedTier, chain: selectedChain }),
    onSuccess: async (res) => {
      const data = await res.json();
      setPaymentData(data);
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscriptions/verify-payment", { paymentId: paymentData?.paymentId, txHash }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({ title: "Payment verified!", description: "Your subscription is now active." });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    },
  });

  const copyAddress = () => {
    if (paymentData?.paymentAddress) {
      navigator.clipboard.writeText(paymentData.paymentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tiers = pricesData?.tiers || [];

  if (paymentData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gain" />
              Complete Payment
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-payment">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="outline" className="text-[9px]">{TIER_INFO[selectedTier || "basic"]?.label}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.common.amount}</span>
              <span className="font-mono font-bold text-gain">{paymentData.amountRequired} {paymentData.currency}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">USD Value</span>
              <span className="font-mono">${paymentData.usdPrice}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.common.chain}</span>
              <span>{CHAINS.find(c => c.value === paymentData.chain)?.label || paymentData.chain}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Send to this address</Label>
            <div className="flex items-center gap-1">
              <Input
                value={paymentData.paymentAddress}
                readOnly
                className="h-8 text-[10px] font-mono"
                data-testid="input-payment-address"
              />
              <Button size="icon" variant="outline" onClick={copyAddress} data-testid="button-copy-address">
                {copied ? <Check className="w-3 h-3 text-gain" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
            <div className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Important
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5 space-y-0.5">
              <div>Send exactly {paymentData.amountRequired} {paymentData.currency} to the address above</div>
              <div>Payment expires in 30 minutes</div>
              <div>After sending, paste your transaction hash below</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.subscription.txHash}</Label>
            <Input
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              placeholder="Paste your transaction hash here"
              className="h-8 text-xs font-mono"
              data-testid="input-tx-hash"
            />
          </div>

          <Button
            onClick={() => verifyMutation.mutate()}
            disabled={!txHash || verifyMutation.isPending}
            className="w-full"
            data-testid="button-verify-payment"
          >
            {verifyMutation.isPending ? "Verifying..." : "Verify Payment"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gain" />
            Subscribe with Crypto
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-payment">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tiers.map((tier) => {
            const info = TIER_INFO[tier.tier];
            const TierIcon = info?.icon || Zap;
            const isSelected = selectedTier === tier.tier;
            const chainPrice = tier.chains.find(c => c.chain === selectedChain);

            return (
              <div
                key={tier.tier}
                className={`rounded-md border p-3 cursor-pointer transition-colors ${
                  isSelected ? "border-gain bg-gain/5" : "border-border hover-elevate"
                }`}
                onClick={() => setSelectedTier(tier.tier)}
                data-testid={`tier-option-${tier.tier}`}
              >
                <div className="text-center space-y-1.5">
                  <TierIcon className={`w-5 h-5 mx-auto ${info?.color}`} />
                  <div className="text-xs font-semibold">{info?.label}</div>
                  <div className="text-xl font-bold font-mono">${tier.usdPrice}<span className="text-[10px] text-muted-foreground">/mo</span></div>
                  {chainPrice && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      ~{chainPrice.amount} {chainPrice.currency}
                    </div>
                  )}
                </div>
                <div className="space-y-1 mt-2">
                  <div className="text-[10px] flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gain" />
                    {tier.limits.maxAgents === 999 ? t.aiAgents.unlimited : tier.limits.maxAgents} AI Agent{tier.limits.maxAgents !== 1 ? "s" : ""}
                  </div>
                  <div className="text-[10px] flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gain" />
                    {tier.limits.maxDailyTrades === 999 ? t.aiAgents.unlimited : tier.limits.maxDailyTrades} {t.aiAgents.tradesDay}
                  </div>
                  <div className="text-[10px] flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gain" />
                    Live market signals
                  </div>
                  {tier.tier !== "basic" && (
                    <div className="text-[10px] flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-gain" />
                      Priority execution
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedTier && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Pay with</Label>
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-payment-chain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(tiers.find(t => t.tier === selectedTier)?.chains || []).map(c => (
                    <SelectItem key={c.chain} value={c.chain}>
                      {CHAINS.find(ch => ch.value === c.chain)?.label || c.chain} ({c.amount} {c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => createPaymentMutation.mutate()}
              disabled={createPaymentMutation.isPending}
              className="w-full"
              data-testid="button-proceed-payment"
            >
              {createPaymentMutation.isPending ? "Generating..." : "Proceed to Payment"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Position Card ──
function PositionCard({ position }: { position: AgentPosition }) {
  const pnlPercent = position.unrealizedPnlPercent ?? 0;
  const isProfitable = pnlPercent >= 0;
  const pnl = position.unrealizedPnl ?? 0;

  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30 font-mono text-[10px]" data-testid={`position-${position.id}`}>
      <div className="flex items-center gap-2">
        <Crosshair className={`w-3 h-3 ${isProfitable ? "text-gain" : "text-loss"}`} />
        <div>
          <span className="font-semibold text-xs">{position.tokenSymbol}</span>
          <span className="text-muted-foreground ml-1">({position.chain})</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-muted-foreground">Entry</div>
          <div>${position.avgEntryPrice < 0.001 ? position.avgEntryPrice.toExponential(2) : position.avgEntryPrice.toFixed(6)}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Current</div>
          <div>${position.currentPrice < 0.001 ? position.currentPrice.toExponential(2) : position.currentPrice.toFixed(6)}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Size</div>
          <div>{position.size.toFixed(4)}</div>
        </div>
        <div className="text-right min-w-[60px]">
          <div className={`font-bold ${isProfitable ? "text-gain" : "text-loss"}`}>
            {isProfitable ? "+" : ""}{pnlPercent.toFixed(1)}%
          </div>
          <div className={`${isProfitable ? "text-gain" : "text-loss"}`}>
            {isProfitable ? "+" : ""}{pnl.toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ──
function AgentCard({ agent, onExpand, isExpanded, isMobile }: { agent: AiAgent; onExpand: () => void; isExpanded: boolean; isMobile: boolean }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const strategies = useStrategies();

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/ai-agents/${agent.id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({ title: "Agent started", description: `${agent.name} is now trading with LIVE market data` });
    },
    onError: (err: any) => {
      toast({ title: "Cannot start agent", description: err.message, variant: "destructive" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/ai-agents/${agent.id}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({ title: "Agent stopped", description: `${agent.name} has been paused` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/ai-agents/${agent.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({ title: "Agent deleted" });
    },
  });

  const strategy = strategies.find(s => s.value === agent.strategy);
  const isRunning = agent.status === "running";
  const pnl = agent.totalPnl ?? 0;
  const isProfitable = pnl >= 0;

  return (
    <Card data-testid={`card-agent-${agent.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`relative ${isRunning ? "animate-pulse" : ""}`}>
              <Bot className={`w-5 h-5 ${isRunning ? "text-gain" : "text-muted-foreground"}`} />
              {isRunning && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gain rounded-full" />}
            </div>
            <div>
              <CardTitle className="text-sm">{agent.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="outline" className={`text-[9px] ${strategy?.color}`}>
                  {strategy?.label}
                </Badge>
                <Badge variant="outline" className="text-[9px]">
                  {CHAINS.find(c => c.value === agent.chain)?.label || agent.chain}
                </Badge>
                <Badge variant={isRunning ? "default" : "secondary"} className="text-[9px]">
                  {isRunning ? t.aiAgents.running : t.aiAgents.stopped}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isRunning ? (
              <Button size="icon" variant="ghost" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending} data-testid={`button-stop-agent-${agent.id}`}>
                <Square className="w-4 h-4 text-loss" />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => startMutation.mutate()} disabled={startMutation.isPending} data-testid={`button-start-agent-${agent.id}`}>
                <Play className="w-4 h-4 text-gain" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid={`button-delete-agent-${agent.id}`}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">{t.aiAgents.totalPnl}</div>
            <div className={`${isMobile ? "text-xs" : "text-sm"} font-mono font-bold ${isProfitable ? "text-gain" : "text-loss"}`}>
              {isProfitable ? "+" : ""}${pnl.toFixed(4)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">{t.common.winRate}</div>
            <div className={`${isMobile ? "text-xs" : "text-sm"} font-mono font-bold`}>{(agent.winRate ?? 0).toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">{t.common.trades}</div>
            <div className={`${isMobile ? "text-xs" : "text-sm"} font-mono font-bold`}>{agent.totalTrades ?? 0}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">Today</div>
            <div className={`${isMobile ? "text-xs" : "text-sm"} font-mono font-bold`}>{agent.dailyTradesUsed ?? 0}/{agent.maxDailyTrades ?? 10}</div>
          </div>
        </div>

        <div className={`grid gap-2 text-[10px] text-muted-foreground ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span>TP: {agent.takeProfitPercent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>SL: {agent.stopLossPercent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span>Max: {agent.maxPositionSize} SOL</span>
          </div>
        </div>

        <div className="text-[9px] text-muted-foreground font-mono truncate">
          {agent.walletAddress}
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={onExpand} data-testid={`button-expand-agent-${agent.id}`}>
          {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {isExpanded ? "Hide" : "Show"} Positions & Activity
        </Button>

        {isExpanded && <AgentActivity agentId={agent.id} />}
      </CardContent>
    </Card>
  );
}

// ── Agent Activity Tabs ──
function AgentActivity({ agentId }: { agentId: number }) {
  const [activeTab, setActiveTab] = useState<"positions" | "trades" | "logs">("positions");
  const { t } = useTranslation();

  const { data: positions = [] } = useQuery<AgentPosition[]>({
    queryKey: ["/api/ai-agents", agentId, "positions"],
    queryFn: () => fetch(`/api/ai-agents/${agentId}/positions?status=open`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: trades = [] } = useQuery<AgentTrade[]>({
    queryKey: ["/api/ai-agents", agentId, "trades"],
    queryFn: () => fetch(`/api/ai-agents/${agentId}/trades`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: logs = [] } = useQuery<AgentLog[]>({
    queryKey: ["/api/ai-agents", agentId, "logs"],
    queryFn: () => fetch(`/api/ai-agents/${agentId}/logs`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0);

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <div className="flex items-center gap-1">
        <Button variant={activeTab === "positions" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("positions")} data-testid={`tab-positions-${agentId}`}>
          <Crosshair className="w-3 h-3 mr-1" /> {t.aiAgents.openPositions} ({positions.length})
        </Button>
        <Button variant={activeTab === "trades" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("trades")} data-testid={`tab-trades-${agentId}`}>
          <Activity className="w-3 h-3 mr-1" /> {t.common.trades}
        </Button>
        <Button variant={activeTab === "logs" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("logs")} data-testid={`tab-logs-${agentId}`}>
          <Brain className="w-3 h-3 mr-1" /> {t.aiAgents.agentLogs}
        </Button>
      </div>

      {activeTab === "positions" && (
        <div>
          {positions.length > 0 && (
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Unrealized {t.common.pnl}</span>
              <span className={`font-mono font-bold ${totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(4)}
              </span>
            </div>
          )}
          {positions.length === 0 ? (
            <div className="text-[10px] text-muted-foreground text-center py-3 flex flex-col items-center gap-1">
              <Eye className="w-4 h-4" />
              {t.aiAgents.noPositions} - agent is scanning for opportunities
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {positions.map(pos => <PositionCard key={pos.id} position={pos} />)}
            </div>
          )}
        </div>
      )}

      {activeTab === "trades" && (
        <div>
          {trades.length === 0 ? (
            <div className="text-[10px] text-muted-foreground text-center py-2">{t.aiAgents.noTrades}</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {trades.slice(0, 15).map(trade => (
                <div key={trade.id} className="flex items-center justify-between text-[10px] font-mono p-1.5 rounded bg-muted/30 flex-wrap gap-1" data-testid={`agent-trade-${trade.id}`}>
                  <div className="flex items-center gap-1.5">
                    {trade.type === "buy" ? <ArrowUpRight className="w-3 h-3 text-gain" /> : <ArrowDownRight className="w-3 h-3 text-loss" />}
                    <span className={trade.type === "buy" ? "text-gain" : "text-loss"}>{trade.type.toUpperCase()}</span>
                    <span>{trade.amount.toFixed(4)}</span>
                    <span className="text-muted-foreground">@ ${trade.price < 0.001 ? trade.price.toExponential(2) : trade.price.toFixed(6)}</span>
                  </div>
                  <span className={(trade.pnl ?? 0) >= 0 ? "text-gain" : "text-loss"}>
                    {(trade.pnl ?? 0) >= 0 ? "+" : ""}${(trade.pnl ?? 0).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div>
          {logs.length === 0 ? (
            <div className="text-[10px] text-muted-foreground text-center py-2">{t.aiAgents.noLogs}</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="text-[10px] p-1.5 rounded bg-muted/30" data-testid={`agent-log-${log.id}`}>
                  <div className="flex items-center justify-between mb-0.5 gap-1">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[8px] ${
                        log.action === "buy" ? "text-gain border-gain/30" :
                        log.action === "sell" ? "text-loss border-loss/30" :
                        log.action === "error" ? "text-destructive border-destructive/30" :
                        log.action === "auto_close" ? "text-orange-400 border-orange-400/30" :
                        "text-muted-foreground"
                      }`}>
                        {log.action.toUpperCase()}
                      </Badge>
                      {log.tokensAnalyzed ? <span className="text-muted-foreground">{log.tokensAnalyzed} {t.aiAgents.tokensAnalyzed}</span> : null}
                    </div>
                    <span className="text-muted-foreground">{log.confidence ? `${log.confidence}% ${t.aiAgents.confidence}` : ""}</span>
                  </div>
                  <div className="text-muted-foreground leading-tight">{log.reasoning}</div>
                  {log.marketContext && <div className="text-[9px] text-muted-foreground/60 mt-0.5 truncate">{log.marketContext}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Agent Form ──
function CreateAgentForm({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const strategies = useStrategies();
  const [name, setName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [chain, setChain] = useState("solana");
  const [strategy, setStrategy] = useState("balanced");
  const [maxPositionSize, setMaxPositionSize] = useState(1);
  const [stopLoss, setStopLoss] = useState(15);
  const [takeProfit, setTakeProfit] = useState(50);
  const [maxDailyTrades, setMaxDailyTrades] = useState(10);
  const [riskLevel, setRiskLevel] = useState(5);

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai-agents", {
      name, walletAddress, chain, strategy,
      status: "stopped", maxPositionSize,
      stopLossPercent: stopLoss, takeProfitPercent: takeProfit,
      maxDailyTrades, riskLevel,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      toast({ title: "Agent created", description: `${name} is ready to deploy with LIVE market signals` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const selectedStrategy = strategies.find(s => s.value === strategy);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="w-4 h-4 text-gain" />
          {t.aiAgents.createAgent}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.aiAgents.agentName}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Alpha Hunter" className="h-8 text-xs" data-testid="input-agent-name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.common.address}</Label>
            <Input value={walletAddress} onChange={e => setWalletAddress(e.target.value)} placeholder="Your wallet address" className="h-8 text-xs font-mono" data-testid="input-wallet-address" />
          </div>
        </div>

        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.common.chain}</Label>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-chain"><SelectValue /></SelectTrigger>
              <SelectContent>{CHAINS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.aiAgents.strategy}</Label>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-strategy"><SelectValue /></SelectTrigger>
              <SelectContent>{strategies.map(s => <SelectItem key={s.value} value={s.value}><span className={s.color}>{s.label}</span></SelectItem>)}</SelectContent>
            </Select>
            {selectedStrategy && <div className="text-[9px] text-muted-foreground">{selectedStrategy.desc}</div>}
          </div>
        </div>

        <div className={`grid gap-3 ${isMobile ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-3"}`}>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.aiAgents.maxPosition} (SOL)</Label>
            <Input type="number" value={maxPositionSize} onChange={e => setMaxPositionSize(Number(e.target.value))} className="h-8 text-xs" min={0.1} max={100} step={0.1} data-testid="input-max-position" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.aiAgents.stopLoss} %</Label>
            <Input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} className="h-8 text-xs" min={1} max={100} data-testid="input-stop-loss" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.aiAgents.takeProfit} %</Label>
            <Input type="number" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} className="h-8 text-xs" min={1} max={1000} data-testid="input-take-profit" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center justify-between">
            <span>{t.aiAgents.riskLevel}</span>
            <span className="font-mono text-muted-foreground">{riskLevel}/10</span>
          </Label>
          <Slider value={[riskLevel]} onValueChange={v => setRiskLevel(v[0])} min={1} max={10} step={1} className="py-1" data-testid="slider-risk-level" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Safe</span><span>Moderate</span><span>YOLO</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.aiAgents.maxDailyTrades}</Label>
          <Input type="number" value={maxDailyTrades} onChange={e => setMaxDailyTrades(Number(e.target.value))} className="h-8 text-xs" min={1} max={100} data-testid="input-max-daily-trades" />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => createMutation.mutate()} disabled={!name || !walletAddress || createMutation.isPending} className="flex-1" data-testid="button-create-agent">
            <Bot className="w-4 h-4 mr-1" />
            {createMutation.isPending ? "Deploying..." : t.aiAgents.createAgent}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-create">{t.common.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Promo Code Gate ──
function PromoCodeGate({ onRedeemed, isMobile }: { onRedeemed: () => void; isMobile: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const redeemMutation = useMutation({
    mutationFn: async (promoCode: string) => {
      const res = await apiRequest("POST", "/api/promo-codes/redeem", { code: promoCode });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      setTimeout(() => onRedeemed(), 1500);
    },
    onError: (err: any) => {
      setError(err.message || "Invalid code");
    },
  });

  if (success) {
    return (
      <Card className="border-gain/30 bg-gain/5">
        <CardContent className="p-6 text-center">
          <Check className="w-10 h-10 text-gain mx-auto mb-3" />
          <div className="text-sm font-semibold text-gain">Access Granted</div>
          <div className="text-xs text-muted-foreground mt-1">Loading your AI trading terminal...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-400/30 bg-amber-400/5">
      <CardContent className={`${isMobile ? "p-4" : "p-6"}`}>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold">Invitation Required</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            AI Trading Agents are currently in private beta. Enter your invitation code below to unlock full access to autonomous trading agents.
          </p>
          <div className="flex items-center gap-2 w-full max-w-sm">
            <Input
              placeholder="Enter invitation code"
              value={code}
              onChange={(e) => {
                const v = e.target.value.toUpperCase()
                  .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]/g, '-')
                  .replace(/[^A-Z0-9\-]/g, '');
                setCode(v);
                setError("");
              }}
              className="font-mono text-sm"
              data-testid="input-promo-code"
            />
            <Button
              onClick={() => redeemMutation.mutate(code.trim())}
              disabled={code.trim().length < 3 || redeemMutation.isPending}
              data-testid="button-redeem-code"
            >
              {redeemMutation.isPending ? "..." : "Redeem"}
            </Button>
          </div>
          {error && <div className="text-xs text-loss" data-testid="text-promo-error">{error}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function AiAgentsPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);

  const { data: agents = [], isLoading } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
    refetchInterval: 10000,
  });

  const { data: subStatus } = useQuery<SubStatus>({
    queryKey: ["/api/subscriptions/me"],
    refetchInterval: 30000,
  });

  const activeAgents = agents.filter(a => a.status === "running");
  const totalPnl = agents.reduce((sum, a) => sum + (a.totalPnl ?? 0), 0);
  const totalTrades = agents.reduce((sum, a) => sum + (a.totalTrades ?? 0), 0);
  const avgWinRate = agents.length > 0
    ? agents.reduce((sum, a) => sum + (a.winRate ?? 0), 0) / agents.length
    : 0;

  const hasSubscription = subStatus?.active === true || subStatus?.inGracePeriod === true;

  const handleNewAgent = () => {
    if (!hasSubscription) {
      toast({
        title: "Invitation Required",
        description: "AI Agents are currently available by invitation only. Redeem a promo code to get access.",
        variant: "destructive",
      });
      return;
    }
    setShowCreate(!showCreate);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className={`space-y-4 max-w-6xl mx-auto ${isMobile ? "p-3" : "p-4"}`}>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-amber-500">NFA Disclaimer</div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                AI Trading Agents use LIVE market data from DexScreener and real signal analysis.
                Not Financial Advice. Trade at your own risk.
              </div>
            </div>
          </div>
        </div>

        {subStatus && (
          <SubscriptionBanner subStatus={subStatus} onSubscribe={() => setShowPayment(true)} />
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className={`font-bold flex items-center gap-2 ${isMobile ? "text-base" : "text-lg"}`}>
              <Bot className="w-5 h-5 text-gain" />
              {t.aiAgents.title}
              <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-400/30">INVITE ONLY</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">{t.aiAgents.subtitle}</p>
          </div>
          <Button onClick={handleNewAgent} data-testid="button-new-agent">
            {hasSubscription ? <Plus className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
            {t.aiAgents.createAgent}
          </Button>
        </div>

        {!hasSubscription && (
          <PromoCodeGate onRedeemed={() => window.location.reload()} isMobile={isMobile} />
        )}

        {showPayment && (
          <PaymentModal onClose={() => setShowPayment(false)} isMobile={isMobile} />
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.common.active} {t.aiAgents.agents}</div>
              <div className={`font-bold font-mono ${isMobile ? "text-base" : "text-xl"}`}>{activeAgents.length}</div>
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{agents.length} total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.aiAgents.totalPnl}</div>
              <div className={`font-bold font-mono ${totalPnl >= 0 ? "text-gain" : "text-loss"} ${isMobile ? "text-base" : "text-xl"}`}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(4)}
              </div>
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Real {t.common.pnl}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.common.winRate}</div>
              <div className={`font-bold font-mono ${isMobile ? "text-base" : "text-xl"}`}>{avgWinRate.toFixed(1)}%</div>
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Average</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.common.totalTrades}</div>
              <div className={`font-bold font-mono ${isMobile ? "text-base" : "text-xl"}`}>{totalTrades}</div>
              <div className={`text-muted-foreground ${isMobile ? "text-[9px]" : "text-[10px]"}`}>All {t.aiAgents.agents}</div>
            </CardContent>
          </Card>
        </div>

        {showCreate && hasSubscription && (
          <CreateAgentForm onClose={() => setShowCreate(false)} isMobile={isMobile} />
        )}

        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Your {t.aiAgents.agents}
          </h2>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{t.common.loading}</div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bot className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <div className="text-sm font-semibold mb-1">{t.aiAgents.noAgents}</div>
                <div className="text-xs text-muted-foreground mb-4">
                  {hasSubscription
                    ? t.aiAgents.noAgentsDesc
                    : "Enter your invitation code above to unlock AI agent creation."
                  }
                </div>
                {hasSubscription && (
                  <Button onClick={() => setShowCreate(true)} data-testid="button-create-first-agent">
                    <Plus className="w-4 h-4 mr-1" /> {t.aiAgents.createAgent}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isExpanded={expandedAgent === agent.id}
                  onExpand={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>

        {!showPayment && (
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Subscription Plans - Pay with Crypto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: "Basic", price: 29, features: ["1 AI Agent", "10 trades/day", "Live market signals", "Basic strategies"], tier: "basic" },
                { name: "Pro", price: 79, features: ["3 AI Agents", "50 trades/day", "All strategies", "Priority execution", "Position tracking"], tier: "pro" },
                { name: "Whale", price: 199, features: ["Unlimited Agents", "Unlimited trades", "All strategies", "Priority execution", "Custom risk profiles", "Advanced signals"], tier: "whale" },
              ].map((plan, i) => {
                const isCurrentTier = subStatus?.tier === plan.tier;
                return (
                  <Card key={plan.name} className={i === 1 ? "border-gain/30" : isCurrentTier ? "border-gain/50" : ""}>
                    <CardContent className={isMobile ? "p-3" : "p-4"}>
                      <div className="text-center mb-3">
                        {isCurrentTier && <Badge variant="outline" className="text-[8px] text-gain border-gain/30 mb-1">Current Plan</Badge>}
                        <div className="text-xs font-semibold">{plan.name}</div>
                        <div className={`font-bold font-mono ${isMobile ? "text-xl" : "text-2xl"}`}>${plan.price}<span className="text-xs text-muted-foreground">/mo</span></div>
                        <div className="text-[9px] text-muted-foreground">Pay in SOL, ETH, or BNB</div>
                      </div>
                      <div className="space-y-1.5">
                        {plan.features.map(f => (
                          <div key={f} className="flex items-center gap-1.5 text-[10px]">
                            <div className="w-1 h-1 rounded-full bg-gain" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant={i === 1 ? "default" : "outline"}
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => setShowPayment(true)}
                        disabled={isCurrentTier}
                        data-testid={`button-subscribe-${plan.tier}`}
                      >
                        {isCurrentTier ? (
                          <><Check className="w-3 h-3 mr-1" /> {t.common.active}</>
                        ) : (
                          <><CreditCard className="w-3 h-3 mr-1" /> {hasSubscription ? t.common.upgrade : t.common.subscribe}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <PaymentHistory />

        <div className="text-[9px] text-muted-foreground text-center py-2">
          NFA - Not Financial Advice. AI agents use live market data. Past performance does not guarantee future results.
        </div>
      </div>
    </div>
  );
}

// ── Payment History ──
function PaymentHistory() {
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: payments = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/subscriptions/payments"],
    enabled: showHistory,
  });

  const [retryPaymentId, setRetryPaymentId] = useState<number | null>(null);
  const [retryTxHash, setRetryTxHash] = useState("");

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscriptions/retry-payment", { paymentId: retryPaymentId, txHash: retryTxHash }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      toast({ title: "Payment verified!", description: "Your subscription has been renewed." });
      setRetryPaymentId(null);
      setRetryTxHash("");
    },
    onError: (err: any) => {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    },
  });

  const markFailedMutation = useMutation({
    mutationFn: (paymentId: number) => apiRequest("POST", "/api/subscriptions/mark-failed", { paymentId, reason: "Payment cancelled by user" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/payments"] });
      toast({ title: "Payment marked as failed" });
    },
  });

  const statusColors: Record<string, string> = {
    pending: "text-amber-500 border-amber-500/30",
    confirmed: "text-gain border-gain/30",
    failed: "text-loss border-loss/30",
    expired: "text-muted-foreground border-border",
  };

  if (!showHistory) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)} className="w-full" data-testid="button-show-payment-history">
        <Clock className="w-3 h-3 mr-1" /> {t.subscription.paymentHistory}
      </Button>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t.subscription.paymentHistory}
        </h2>
        <Button size="icon" variant="ghost" onClick={() => setShowHistory(false)} data-testid="button-hide-payment-history">
          <X className="w-4 h-4" />
        </Button>
      </div>
      {payments.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-xs text-muted-foreground">
            No payments yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payments.map(payment => (
            <Card key={payment.id} data-testid={`payment-record-${payment.id}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${statusColors[payment.status] || ""}`}>
                      {payment.status.toUpperCase()}
                    </Badge>
                    <div>
                      <div className="text-xs font-semibold">
                        {TIER_INFO[payment.tier]?.label || payment.tier} - ${payment.amountRequiredUsd}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {payment.amountRequiredCrypto} {payment.currency} ({payment.chain})
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </div>
                    {payment.retryCount && payment.retryCount > 0 && (
                      <div className="text-[9px] text-muted-foreground">
                        {payment.retryCount} retries
                      </div>
                    )}
                  </div>
                </div>

                {payment.failureReason && (
                  <div className="text-[9px] text-loss mt-1.5 rounded bg-loss/5 p-1.5">
                    {payment.failureReason}
                  </div>
                )}

                {payment.txHash && (
                  <div className="text-[9px] text-muted-foreground mt-1 font-mono truncate">
                    TX: {payment.txHash}
                  </div>
                )}

                {(payment.status === "pending" || payment.status === "failed") && (
                  <div className="mt-2 space-y-1.5">
                    {retryPaymentId === payment.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={retryTxHash}
                          onChange={e => setRetryTxHash(e.target.value)}
                          placeholder="Paste new transaction hash"
                          className="h-7 text-[10px] font-mono flex-1"
                          data-testid={`input-retry-tx-${payment.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => retryMutation.mutate()}
                          disabled={!retryTxHash || retryMutation.isPending}
                          data-testid={`button-submit-retry-${payment.id}`}
                        >
                          {retryMutation.isPending ? "..." : "Verify"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRetryPaymentId(null); setRetryTxHash(""); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRetryPaymentId(payment.id)}
                          data-testid={`button-retry-payment-${payment.id}`}
                        >
                          {t.subscription.retryPayment}
                        </Button>
                        {payment.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markFailedMutation.mutate(payment.id)}
                            disabled={markFailedMutation.isPending}
                            data-testid={`button-cancel-payment-${payment.id}`}
                          >
                            {t.common.cancel}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
