import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Referral } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatCompact } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Copy, Gift, Award, TrendingUp, Shield, Star, Zap } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/i18n";

const TIERS = [
  { name: "Bronze", min: 0, max: 5, percent: 10, icon: Shield, color: "text-orange-400" },
  { name: "Silver", min: 5, max: 20, percent: 15, icon: Star, color: "text-zinc-400" },
  { name: "Gold", min: 20, max: 50, percent: 20, icon: Award, color: "text-yellow-400" },
  { name: "Platinum", min: 50, max: Infinity, percent: 30, icon: Zap, color: "text-cyan-400" },
];

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getTierForCount(count: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (count >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[0];
}

export default function ReferralPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { walletAddress } = useAuth();
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const { data: referral, isLoading } = useQuery<Referral | null>({
    queryKey: ["/api/referral/wallet", walletAddress ?? ""],
    enabled: !!walletAddress,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/referrals", {
        code: generateCode(),
        ownerWallet: walletAddress,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral/wallet", walletAddress ?? ""] });
      toast({ title: "Referral code generated", description: "Share your code to start earning" });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const referralCount = referral?.referredWallets?.length ?? 0;
  const currentTier = getTierForCount(referralCount);
  const referralLink = referral ? `nextape.app?ref=${referral.code}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: t.common.copied, description: "Referral link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!walletAddress) {
    return (
      <div className="flex flex-col h-full overflow-auto scrollbar-thin">
        <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
          <Users className="w-4 h-4 text-gain" />
          <span className="font-bold text-sm" data-testid="text-page-title">{t.referral.title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-6 max-w-md text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Connect your wallet to access the referral program</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}>
        <Users className="w-4 h-4 text-gain" />
        <span className="font-bold text-sm" data-testid="text-page-title">{t.referral.title}</span>
      </div>

      <div className={`space-y-4 max-w-4xl mx-auto w-full ${isMobile ? "p-3" : "p-4"}`}>
        <Card className={isMobile ? "p-4" : "p-6"}>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-full bg-gain/10 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-gain" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`font-bold mb-1 ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-hero-title">
                {t.referral.subtitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.referral.step1}. {t.referral.step2}. {t.referral.step3}.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TIERS.map((tier) => {
            const TierIcon = tier.icon;
            const isActive = referral && currentTier.name === tier.name;
            return (
              <Card
                key={tier.name}
                data-testid={`card-tier-${tier.name.toLowerCase()}`}
                className={`${isMobile ? "p-3" : "p-4"} ${isActive ? "border-gain/40" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TierIcon className={`w-4 h-4 ${tier.color}`} />
                  <span className="text-xs font-bold">{tier.name}</span>
                  {isActive && <Badge variant="outline" className="text-[8px] text-gain border-gain/30 ml-auto">{t.common.active.toUpperCase()}</Badge>}
                </div>
                <div className={`font-bold font-mono text-gain ${isMobile ? "text-base" : "text-lg"}`}>{tier.percent}%</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {tier.max === Infinity ? `${tier.min}+ referrals` : `${tier.min}-${tier.max} referrals`}
                </div>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-md" />
            <Skeleton className="h-20 rounded-md" />
          </div>
        ) : referral ? (
          <>
            <Card className={isMobile ? "p-3" : "p-4"}>
              <div className="flex items-center gap-2 mb-3">
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider">{t.referral.shareLink}</span>
              </div>
              <div className={`flex gap-2 ${isMobile ? "flex-col" : "flex-row items-center"}`}>
                <div className="flex-1 bg-secondary rounded-md px-3 py-2 font-mono text-sm truncate" data-testid="text-referral-link">
                  {referralLink}
                </div>
                <Button
                  data-testid="button-copy-referral"
                  variant="outline"
                  onClick={handleCopy}
                  className={isMobile ? "w-full" : ""}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  {copied ? t.common.copied : t.referral.copyLink}
                </Button>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                Code: {referral.code}
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-info" />
                  <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.referral.totalReferrals}</span>
                </div>
                <span className={`font-bold font-mono ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-total-referrals">{referralCount}</span>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-gain" />
                  <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>{t.referral.totalEarnings}</span>
                </div>
                <span className={`font-bold font-mono text-gain ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-total-earnings">
                  ${formatCompact(referral.totalEarnings ?? 0)}
                </span>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5" style={{ color: "var(--warning)" }} />
                  <span className={`text-muted-foreground uppercase tracking-wider ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Tier</span>
                </div>
                <span className={`font-bold font-mono ${currentTier.color} ${isMobile ? "text-base" : "text-lg"}`} data-testid="text-current-tier">
                  {currentTier.name}
                </span>
              </Card>
            </div>
          </>
        ) : (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center gap-3">
              <Gift className="w-10 h-10 text-muted-foreground" />
              <p className="text-xs text-muted-foreground text-center">
                {t.referral.inviteFriends}
              </p>
              <Button
                data-testid="button-generate-referral"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Generating..." : "Generate Referral Code"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
