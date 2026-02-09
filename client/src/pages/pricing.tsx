import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FEE_TIERS, getUserTier, setUserTier, type FeeTier } from "@/lib/fees";
import { Check, Zap, Crown, Shield, ArrowRight, TrendingUp, Users, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

const tierIcons: Record<string, typeof Zap> = {
  free: TrendingUp,
  pro: Zap,
  elite: Crown,
};

export default function PricingPage() {
  const [currentTier, setCurrentTier] = useState(getUserTier().id);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSelectTier = (tier: FeeTier) => {
    setUserTier(tier.id);
    setCurrentTier(tier.id);
    toast({
      title: `Switched to ${tier.name}`,
      description: tier.monthlyPrice === 0
        ? "You're on the free plan."
        : `${tier.swapFeePercent}% swap fee applied to all trades.`,
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-6 h-6 text-gain" />
            <h1 className="text-2xl font-bold" data-testid="text-pricing-title">{t.pricing.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            {t.pricing.subtitle}
          </p>
        </div>

        <div className="mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-bold text-sm">{t.pricing.feeComparison}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t.pricing.savesUpTo}</p>
              </div>
              <div className="flex gap-4 text-xs font-mono">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground">GMGN Free</span>
                  <Badge variant="outline" className="text-loss">1.0%</Badge>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground">NextApe Free</span>
                  <Badge variant="outline" className="text-gain">0.9%</Badge>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground">GMGN Pro</span>
                  <Badge variant="outline" className="text-loss">0.5%</Badge>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground">NextApe Pro</span>
                  <Badge variant="outline" className="text-gain">0.5%</Badge>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground">GMGN VIP</span>
                  <Badge variant="outline" className="text-loss">0.35%</Badge>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground">NextApe Elite</span>
                  <Badge variant="outline" className="text-gain">0.25%</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEE_TIERS.map((tier) => {
            const TierIcon = tierIcons[tier.id] || Zap;
            const isActive = currentTier === tier.id;

            return (
              <Card
                key={tier.id}
                data-testid={`card-tier-${tier.id}`}
                className={`relative p-5 flex flex-col ${tier.highlight ? "border-gain/40" : ""}`}
              >
                {tier.badge && (
                  <Badge
                    className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] ${
                      tier.highlight ? "bg-gain text-white border-gain" : "bg-secondary"
                    }`}
                  >
                    {tier.badge}
                  </Badge>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <TierIcon className={`w-5 h-5 ${tier.highlight ? "text-gain" : "text-muted-foreground"}`} />
                  <h3 className="font-bold text-lg">{tier.name}</h3>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-mono">
                      {tier.monthlyPrice === 0 ? t.common.free : `$${tier.monthlyPrice}`}
                    </span>
                    {tier.monthlyPrice > 0 && (
                      <span className="text-sm text-muted-foreground">{t.pricing.perMonth}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {tier.swapFeePercent}% {t.pricing.swapFee.toLowerCase()}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 space-y-2 mb-5">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${tier.highlight ? "text-gain" : "text-muted-foreground"}`} />
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  data-testid={`button-select-tier-${tier.id}`}
                  className={`w-full ${tier.highlight ? "bg-gain text-white border-gain" : ""}`}
                  variant={isActive ? "secondary" : tier.highlight ? "default" : "outline"}
                  onClick={() => handleSelectTier(tier)}
                  disabled={isActive}
                >
                  {isActive ? t.pricing.currentPlan : tier.monthlyPrice === 0 ? t.pricing.selectPlan : t.common.upgrade}
                  {!isActive && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-info" />
              <h4 className="font-bold text-sm">{t.referral.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Refer friends and earn 10% of their trading fees. No cap on earnings. Share your referral link and watch your income grow.
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="w-4 h-4 text-warning" />
              <h4 className="font-bold text-sm">Volume Discounts</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Trade $100K+ monthly volume and get an additional 10% off your tier's swap fee. High-volume traders save even more.
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-gain" />
              <h4 className="font-bold text-sm">Fee Transparency</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              All fees are shown upfront before you confirm any trade. No hidden charges. Platform fee is deducted from your swap output.
            </p>
          </Card>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>All plans include: Multi-chain support (SOL, ETH, BASE, BNB, TRX) + Real-time WebSocket data + Jupiter & DexScreener integration</p>
          <p className="mt-1">Swap fees are applied to the output amount of each trade. Network gas fees are separate and paid to the blockchain.</p>
        </div>
      </div>
    </div>
  );
}
