export interface FeeTier {
  id: string;
  name: string;
  monthlyPrice: number;
  swapFeePercent: number;
  features: string[];
  highlight?: boolean;
  badge?: string;
}

export const FEE_TIERS: FeeTier[] = [
  {
    id: "free",
    name: "Starter",
    monthlyPrice: 0,
    swapFeePercent: 0.9,
    features: [
      "Real-time token scanner",
      "DexScreener live search",
      "Basic chart & trade panel",
      "5 chains supported",
      "Watchlist (up to 20 tokens)",
      "Community alerts",
    ],
  },
  {
    id: "pro",
    name: "Pro Trader",
    monthlyPrice: 49,
    swapFeePercent: 0.5,
    highlight: true,
    badge: "POPULAR",
    features: [
      "Everything in Starter",
      "0.5% swap fee (vs 0.9%)",
      "Smart Money Tracker",
      "Copy Trading (3 wallets)",
      "Sniper Mode (5 rules)",
      "Portfolio dashboard",
      "Priority execution",
      "Advanced safety scanner",
      "Unlimited watchlist",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    monthlyPrice: 149,
    swapFeePercent: 0.25,
    badge: "BEST VALUE",
    features: [
      "Everything in Pro",
      "0.25% swap fee (lowest)",
      "Unlimited Copy Trading",
      "Unlimited Sniper Rules",
      "MEV Protection",
      "Private RPC endpoints",
      "Whale alerts (real-time)",
      "API access",
      "Dedicated support",
    ],
  },
];

export const REFERRAL_DISCOUNT = 0.1;

export function getUserTier(): FeeTier {
  if (typeof window === "undefined") return FEE_TIERS[0];
  const stored = localStorage.getItem("nextrade_tier");
  return FEE_TIERS.find((t) => t.id === stored) || FEE_TIERS[0];
}

export function setUserTier(tierId: string) {
  localStorage.setItem("nextrade_tier", tierId);
}

export function calculateFee(amount: number, tier?: FeeTier): { fee: number; feePercent: number; afterFee: number } {
  const t = tier || getUserTier();
  const fee = amount * (t.swapFeePercent / 100);
  return {
    fee,
    feePercent: t.swapFeePercent,
    afterFee: amount - fee,
  };
}

export function formatFeePercent(percent: number): string {
  return `${percent}%`;
}
