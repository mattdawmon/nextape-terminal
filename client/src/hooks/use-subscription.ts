import { useQuery } from "@tanstack/react-query";

export interface TierLimits {
  maxAgents: number;
  maxDailyTrades: number;
  maxAlerts: number;
  maxLimitOrders: number;
  maxDcaConfigs: number;
  maxCopyTrades: number;
  maxSniperRules: number;
  smartMoneyAccess: boolean;
  smartMoneyFollow: boolean;
  safetyScanner: boolean;
  csvExport: boolean;
  advancedAnalytics: boolean;
}

export interface SubStatus {
  subscription: any | null;
  tier: string;
  limits: TierLimits;
  agentCount: number;
  active: boolean;
  inGracePeriod: boolean;
  gracePeriodEndsAt: string | null;
  renewalFailures: number;
  lastFailureReason: string | null;
  pendingPaymentCount: number;
  promoAccess: { tier: string; code: string } | null;
}

export function useSubscription() {
  const { data: subStatus, isLoading } = useQuery<SubStatus>({
    queryKey: ["/api/subscriptions/me"],
    refetchInterval: 30000,
  });

  const tier = subStatus?.tier || "free";
  const limits = subStatus?.limits;
  const hasSubscription = subStatus?.active === true || subStatus?.inGracePeriod === true || !!subStatus?.promoAccess;

  return {
    subStatus,
    tier,
    limits,
    hasSubscription,
    isLoading,
  };
}

export const TIER_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  whale: "Whale",
};
