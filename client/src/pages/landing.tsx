import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Bot, Shield, TrendingUp, Copy, Crosshair, BarChart3, Lock, Users, Clock, ChevronRight, Wallet, Eye, Brain, Activity, Flame } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import heroImage from "@/assets/images/hero-terminal.png";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const features = [
  {
    icon: Bot,
    title: "AI Trading Agents",
    desc: "Autonomous agents powered by 7 real-time data streams. They learn what works, blacklist what doesn't, and get sharper with every trade.",
  },
  {
    icon: Brain,
    title: "Adaptive Intelligence",
    desc: "News sentiment, Fear & Greed Index, on-chain liquidity, smart money flows — all feeding one adaptive brain that never sleeps.",
  },
  {
    icon: Shield,
    title: "Smart Safety Scanner",
    desc: "Deep contract audits, honeypot detection, holder analysis, and liquidity checks before every trade. Your AI doesn't ape blind.",
  },
  {
    icon: Copy,
    title: "Copy Trading",
    desc: "Mirror whale wallets automatically. Set your own risk parameters. Let the smart money do the research for you.",
  },
  {
    icon: Crosshair,
    title: "Sniper Mode",
    desc: "Set precise entry rules for new tokens. Auto-buy when conditions are met — market cap, liquidity, holder count, and more.",
  },
  {
    icon: BarChart3,
    title: "Smart Money Tracker",
    desc: "Track top trader wallets, see their PnL, win rates, and holdings. Follow the money that actually makes money.",
  },
];

const stats = [
  { value: "7", label: "Data Streams" },
  { value: "5", label: "Chains" },
  { value: "4", label: "AI Strategies" },
  { value: "24/7", label: "Market Coverage" },
];

const chains = ["Solana", "Ethereum", "Base", "BNB Chain", "Tron"];

export default function LandingPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const waitlistMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/waitlist", { email }),
    onSuccess: () => {
      setJoined(true);
      toast({ title: "You're on the list", description: "We'll notify you when spots open up." });
    },
    onError: (err: any) => {
      if (err.message?.includes("already")) {
        setJoined(true);
        toast({ title: "Already on the list", description: "You're already registered. We'll be in touch." });
      } else {
        toast({ title: "Added to waitlist", description: "We'll notify you when access opens." });
        setJoined(true);
      }
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Zap className="w-5 h-5 text-gain" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-gain rounded-full animate-pulse" />
            </div>
            <span className="font-bold text-base tracking-tight">NextApe</span>
            <Badge variant="outline" className="text-[8px] font-mono">TERMINAL</Badge>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#features" className="hover-elevate px-2 py-1 rounded" data-testid="link-features">{t.landing.features}</a>
            <a href="#chains" className="hover-elevate px-2 py-1 rounded" data-testid="link-chains">{t.landing.chains}</a>
            <a href="#access" className="hover-elevate px-2 py-1 rounded" data-testid="link-access">Early Access</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400 gap-1">
              <Lock className="w-2.5 h-2.5" />
              Invite Only
            </Badge>
            <Button size="sm" onClick={() => login()} data-testid="button-login-nav">
              <Wallet className="w-3 h-3 mr-1" />
              Members Login
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative pt-14 overflow-hidden">
        <div className="relative">
          <img
            src={heroImage}
            alt="NextApe Trading Terminal"
            className="w-full h-[480px] md:h-[580px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />

          <div className="absolute inset-0 flex items-center">
            <div className="max-w-6xl mx-auto px-4 w-full">
              <div className="max-w-xl space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px] gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    INVITATION ONLY
                  </Badge>
                  <Badge variant="outline" className="text-gain border-gain/30 text-[10px] gap-1">
                    <Activity className="w-2.5 h-2.5" />
                    AGENTS ARE LIVE
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight text-white">
                  AI Agents That Actually<br />
                  <span className="text-gain">Make Money</span>
                </h1>
                <p className="text-sm md:text-base text-gray-300 leading-relaxed max-w-md">
                  7 real-time data streams. 4 adaptive strategies. One brain that learns from every trade. 
                  NextApe agents don't guess — they evolve.
                </p>
                <p className="text-xs text-amber-400/80">
                  Access is currently limited to invited members only. Join the waitlist to be notified when new spots open.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <Button size="lg" onClick={() => login()} data-testid="button-member-login">
                    <Lock className="w-4 h-4 mr-2" />
                    Member Access
                  </Button>
                  <Button size="lg" variant="outline" className="backdrop-blur-sm" onClick={() => document.getElementById("access")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-join-waitlist-hero">
                    Join Waitlist
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Limited spots</span>
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Early access perks</span>
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  <span>5 chains supported</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 border-b border-border bg-gain/[0.03]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold font-mono text-gain">{s.value}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="chains" className="py-10 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground mb-4">MULTI-CHAIN SUPPORT</p>
          <div className="flex items-center justify-center gap-4 md:gap-8 flex-wrap">
            {chains.map(chain => (
              <Badge key={chain} variant="outline" className="text-xs px-3 py-1.5 font-mono">
                {chain}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 border-b border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[9px] mb-3 gap-1">
              <Eye className="w-2.5 h-2.5" />
              HOW IT WORKS
            </Badge>
            <h2 className="text-2xl font-bold mb-2">Not a Bot. A Trader That Evolves.</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Our AI agents process 7 live data streams every 30 seconds — and learn which signals actually predict profitable trades.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 rounded-full bg-gain/10 flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-4 h-4 text-gain" />
                </div>
                <h3 className="font-semibold text-xs mb-1">1. Ingest</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  News headlines, Fear & Greed, smart money flows, social signals, on-chain liquidity, technicals, and safety audits — all in real-time.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 rounded-full bg-gain/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-4 h-4 text-gain" />
                </div>
                <h3 className="font-semibold text-xs mb-1">2. Decide</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  AI scores every token, weighs conviction against risk, checks for traps, and only enters when the edge is real.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 rounded-full bg-gain/10 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-4 h-4 text-gain" />
                </div>
                <h3 className="font-semibold text-xs mb-1">3. Learn</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Every trade outcome feeds back. Winning signal combos get boosted. Losing patterns get blacklisted. The agent gets sharper every day.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="features" className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">Built for Traders Who Want an Edge</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Professional-grade tools that top traders use — now powered by AI that learns and adapts.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-5">
                  <feature.icon className="w-5 h-5 text-gain mb-3" />
                  <h3 className="font-semibold text-sm mb-1.5">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="access" className="py-16 border-t border-border">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="mb-6">
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[9px] mb-3 gap-1">
              <Flame className="w-2.5 h-2.5" />
              LIMITED ACCESS
            </Badge>
            <h2 className="text-2xl font-bold mb-2">Get Early Access</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              NextApe is currently invite-only. Join the waitlist and be first in line when new spots open. Early members get exclusive perks.
            </p>
          </div>

          <Card className="border-amber-500/20">
            <CardContent className="p-6">
              {!joined ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1"
                      data-testid="input-waitlist-email"
                    />
                    <Button
                      onClick={() => {
                        if (email && email.includes("@")) {
                          waitlistMutation.mutate();
                        } else {
                          toast({ title: "Enter a valid email", variant: "destructive" });
                        }
                      }}
                      disabled={waitlistMutation.isPending}
                      data-testid="button-join-waitlist"
                    >
                      {waitlistMutation.isPending ? "Joining..." : "Join Waitlist"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> No spam</span>
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Early access perks</span>
                    <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Priority onboarding</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-gain/10 flex items-center justify-center mx-auto">
                    <Zap className="w-5 h-5 text-gain" />
                  </div>
                  <h3 className="font-bold text-sm">You're on the list</h3>
                  <p className="text-xs text-muted-foreground">We'll reach out when your spot is ready. Follow us for updates.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 space-y-3">
            <p className="text-xs text-muted-foreground">Already have an invitation code?</p>
            <Button variant="outline" onClick={() => login()} data-testid="button-member-login-bottom">
              <Lock className="w-3 h-3 mr-1.5" />
              Member Login
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4 flex-wrap text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-gain" />
            <span className="font-semibold">NextApe Terminal</span>
            <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-400">INVITE ONLY</Badge>
          </div>
          <p>Not Financial Advice. Trade at your own risk.</p>
        </div>
      </footer>
    </div>
  );
}
