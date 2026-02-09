import { useSubscription, TIER_LABELS, type TierLimits } from "@/hooks/use-subscription";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Zap, Crown, Sparkles, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";

interface TierGateProps {
  feature: keyof TierLimits;
  featureLabel: string;
  children: React.ReactNode;
  requiredTier?: string;
}

export function TierGate({ feature, featureLabel, children, requiredTier = "basic" }: TierGateProps) {
  const { limits, tier, isLoading } = useSubscription();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  const featureValue = limits?.[feature];
  const isAllowed = typeof featureValue === "boolean" ? featureValue : (typeof featureValue === "number" && featureValue > 0);

  if (isAllowed) return <>{children}</>;

  const tierIcons: Record<string, any> = {
    basic: Zap,
    pro: Crown,
    whale: Sparkles,
  };
  const RequiredIcon = tierIcons[requiredTier] || Zap;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6" data-testid="tier-gate-overlay">
      <Card className="max-w-md w-full p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{featureLabel} Locked</h3>
        <p className="text-sm text-muted-foreground">
          Upgrade to <Badge variant="outline"><RequiredIcon className="w-3 h-3 mr-1 inline" />{TIER_LABELS[requiredTier]}</Badge> or higher to access {featureLabel}.
        </p>
        <p className="text-xs text-muted-foreground">
          {t.tierGate.currentTier}: <span className="font-medium">{TIER_LABELS[tier] || "Free"}</span>
        </p>
        <Button
          onClick={() => setLocation("/pricing")}
          className="gap-2"
          data-testid="button-upgrade-tier"
        >
          {t.tierGate.viewPricing} <ArrowRight className="w-4 h-4" />
        </Button>
      </Card>
    </div>
  );
}

interface FeatureLimitBannerProps {
  feature: keyof TierLimits;
  currentCount: number;
  featureLabel: string;
}

export function FeatureLimitBanner({ feature, currentCount, featureLabel }: FeatureLimitBannerProps) {
  const { limits, tier } = useSubscription();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  if (!limits) return null;

  const maxValue = limits[feature];
  if (typeof maxValue !== "number") return null;

  const remaining = maxValue - currentCount;
  if (remaining > Math.ceil(maxValue * 0.5)) return null;

  const atLimit = remaining <= 0;

  return (
    <div className={`flex items-center gap-2 flex-wrap rounded-md border px-3 py-2 text-xs ${atLimit ? "border-loss/30 bg-loss/5" : "border-yellow-500/30 bg-yellow-500/5"}`} data-testid="feature-limit-banner">
      {atLimit ? (
        <span className="text-loss font-medium">
          {featureLabel} limit reached ({currentCount}/{maxValue})
        </span>
      ) : (
        <span className="text-yellow-400 font-medium">
          {remaining} {featureLabel} remaining ({currentCount}/{maxValue})
        </span>
      )}
      <span className="text-muted-foreground">({TIER_LABELS[tier]} plan)</span>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto h-6 text-[10px] gap-1"
        onClick={() => setLocation("/pricing")}
        data-testid="button-upgrade-limit"
      >
        {t.tierGate.upgradeNow}
      </Button>
    </div>
  );
}
