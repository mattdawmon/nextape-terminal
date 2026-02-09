import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "wouter";
import {
  Bot, Brain, Shield, Zap, Target, BarChart3,
  TrendingUp, Eye, Activity, Wallet, ChevronDown, ChevronUp,
  Radio, Crosshair, AlertTriangle, Clock, Sparkles,
  Crown, ArrowRight, Layers, Cpu, Gauge
} from "lucide-react";

const DATA_STREAMS = [
  {
    icon: BarChart3,
    title: "Technical Analysis",
    color: "text-blue-400",
    borderColor: "border-blue-400/20",
    desc: "RSI, MACD, EMA crossovers, Bollinger Bands, trend strength, and momentum acceleration across multiple timeframes.",
    detail: "The agent computes 12+ indicators in real-time. It identifies trend alignment, overbought/oversold conditions, and momentum breakouts to time entries and exits precisely."
  },
  {
    icon: Layers,
    title: "On-Chain Data",
    color: "text-purple-400",
    borderColor: "border-purple-400/20",
    desc: "Buy/sell pressure, holder distribution, whale accumulation patterns, liquidity depth, and volume-to-liquidity ratios.",
    detail: "Every token is scored on-chain for buy pressure, holder concentration risk, rug pull probability, and lifecycle phase (launch, growth, mature). High concentration = high risk."
  },
  {
    icon: Shield,
    title: "Risk Management",
    color: "text-gain",
    borderColor: "border-gain/20",
    desc: "Adaptive stop-losses, dynamic position sizing, cooldown periods after losses, and portfolio-level exposure limits.",
    detail: "After consecutive losses, the agent enters a cooldown period with reduced position sizing. Stop-losses and take-profits adjust dynamically based on token volatility and market regime."
  },
  {
    icon: Radio,
    title: "News Sentiment",
    color: "text-cyan-400",
    borderColor: "border-cyan-400/20",
    desc: "Real-time crypto headlines analyzed for sentiment, impact level, and relevance to specific tokens and markets.",
    detail: "Headlines from multiple sources are scored as bullish/bearish/neutral with impact levels (high/medium/low). The agent adjusts conviction and sizing based on breaking market news."
  },
  {
    icon: Gauge,
    title: "Fear & Greed Index",
    color: "text-amber-400",
    borderColor: "border-amber-400/20",
    desc: "Market-wide sentiment tracking. Extreme fear = buying opportunities. Extreme greed = time for caution.",
    detail: "The index is tracked continuously with trend analysis. In extreme fear, agents increase buy bias and position sizes. In extreme greed, they reduce exposure and tighten stops."
  },
  {
    icon: Activity,
    title: "Liquidity Monitoring",
    color: "text-orange-400",
    borderColor: "border-orange-400/20",
    desc: "DEX pool health, liquidity changes, volume spikes, new pool detection, and slippage estimation.",
    detail: "Tokens with thin liquidity or sudden liquidity drops are flagged as dangerous. The agent tracks pool health scores and avoids tokens where a sell would cause excessive slippage."
  },
  {
    icon: Wallet,
    title: "Smart Money Tracking",
    color: "text-pink-400",
    borderColor: "border-pink-400/20",
    desc: "Whale wallet movements, top trader accumulation, net flow analysis, and smart money signal scoring.",
    detail: "The agent tracks what the best-performing wallets are buying and selling. Smart money accumulation = strong buy signal. Smart money distributing = warning to exit."
  },
];

const STRATEGIES = [
  {
    value: "conservative",
    label: "Conservative",
    color: "text-blue-400",
    borderColor: "border-blue-400/20",
    risk: "Low",
    desc: "Focuses on established tokens with strong fundamentals. Smaller positions, tight stop-losses, high conviction required.",
    bestFor: "Capital preservation, steady compounding",
    stopLoss: "5-15%",
    takeProfit: "15-40%",
    trades: "3-8 per day",
  },
  {
    value: "balanced",
    label: "Balanced",
    color: "text-gain",
    borderColor: "border-gain/20",
    risk: "Medium",
    desc: "Mix of established and trending tokens. Moderate position sizing with dynamic risk adjustment based on conditions.",
    bestFor: "Consistent growth with managed risk",
    stopLoss: "10-20%",
    takeProfit: "30-60%",
    trades: "5-15 per day",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    color: "text-orange-400",
    borderColor: "border-orange-400/20",
    risk: "High",
    desc: "Targets breakouts, momentum plays, and trending tokens. Larger positions, wider stops, higher reward targets.",
    bestFor: "Maximum returns in trending markets",
    stopLoss: "15-30%",
    takeProfit: "50-150%",
    trades: "10-25 per day",
  },
  {
    value: "degen",
    label: "Degen",
    color: "text-loss",
    borderColor: "border-loss/20",
    risk: "Extreme",
    desc: "New launches, meme tokens, moonshots. Maximum risk, maximum potential reward. Only for funds you can afford to lose.",
    bestFor: "High-risk moonshot hunting",
    stopLoss: "20-50%",
    takeProfit: "100-500%+",
    trades: "15-40 per day",
  },
];

const SETUP_STEPS = [
  {
    step: 1,
    title: "Create Your Wallet",
    icon: Wallet,
    desc: "Go to the Wallets page and generate an instant trading wallet for your chosen chain (Solana, Ethereum, Base, BNB Chain, or Tron). This wallet is created server-side and used by the agent to execute trades.",
  },
  {
    step: 2,
    title: "Fund Your Wallet",
    icon: Zap,
    desc: "Transfer funds to your trading wallet. The agent needs real tokens to trade. Start small (0.5-2 SOL or equivalent) until you're comfortable with your agent's performance.",
  },
  {
    step: 3,
    title: "Create an Agent",
    icon: Bot,
    desc: "Click 'Create Agent' and configure: name your agent, select your chain, pick a strategy, set your max position size, stop-loss, take-profit, and risk level.",
  },
  {
    step: 4,
    title: "Start the Agent",
    icon: Target,
    desc: "Hit the play button to start your agent. It will immediately begin analyzing the market using all 7 data streams and look for high-conviction trade setups.",
  },
  {
    step: 5,
    title: "Monitor & Adjust",
    icon: Eye,
    desc: "Watch your agent's trades, logs, and performance in real-time. Each trade shows the reasoning, confidence level, and signals used. Adjust settings as needed.",
  },
];

const CONFIG_TIPS = [
  {
    title: "Max Position Size",
    desc: "The maximum amount of tokens the agent will put into a single trade. Start with 0.5-1 SOL. Increase only after you see consistent profits.",
    icon: Layers,
  },
  {
    title: "Stop-Loss %",
    desc: "If a position drops by this percentage, the agent sells automatically. Lower = safer but more false exits. 10-20% is a good starting range.",
    icon: Shield,
  },
  {
    title: "Take-Profit %",
    desc: "When a position gains this percentage, the agent locks in profit. Higher = bigger wins but also more unrealized gains lost. 30-60% is solid.",
    icon: TrendingUp,
  },
  {
    title: "Risk Level (1-10)",
    desc: "Controls overall aggressiveness. Low levels = fewer trades, higher conviction required. High levels = more trades, lower entry threshold.",
    icon: Gauge,
  },
  {
    title: "Max Daily Trades",
    desc: "Limits how many trades the agent can make per day. Prevents overtrading. 5-15 is recommended depending on strategy.",
    icon: Clock,
  },
];

function ExpandableSection({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left py-2 group"
        data-testid={`toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="pl-6 pb-3">{children}</div>}
    </div>
  );
}

export default function GuidePage() {
  const isMobile = useIsMobile();

  return (
    <div className="h-full overflow-y-auto">
      <div className={`space-y-6 max-w-4xl mx-auto ${isMobile ? "p-3" : "p-6"}`}>

        <div>
          <h1 className={`font-bold flex items-center gap-2 ${isMobile ? "text-lg" : "text-xl"}`} data-testid="text-guide-title">
            <Brain className="w-6 h-6 text-gain" />
            How to Use AI Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you need to know to set up and run profitable autonomous trading agents.
          </p>
        </div>

        <Card className="border-gain/20 bg-gain/5">
          <CardContent className={`${isMobile ? "p-4" : "p-5"}`}>
            <div className="flex items-start gap-3">
              <Cpu className="w-5 h-5 text-gain mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gain mb-1">How It Works</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each AI agent is powered by GPT and processes <span className="text-foreground font-medium">7 real-time data streams</span> simultaneously.
                  It scores every token on the market, identifies high-conviction setups, executes trades through your wallet, and continuously learns from
                  results to improve performance over time. No manual intervention required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className={`font-semibold flex items-center gap-2 mb-3 ${isMobile ? "text-sm" : "text-base"}`}>
            <Activity className="w-4 h-4 text-gain" />
            The 7 Data Streams
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Every trade decision is backed by all 7 data sources. The agent weighs each signal based on its historical accuracy and adapts weights as it learns.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DATA_STREAMS.map((stream) => (
              <Card key={stream.title} className={`${stream.borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stream.icon className={`w-4 h-4 ${stream.color}`} />
                    <span className="text-xs font-semibold">{stream.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{stream.desc}</p>
                  <ExpandableSection title="Details" icon={Eye} color="text-muted-foreground">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{stream.detail}</p>
                  </ExpandableSection>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className={`font-semibold flex items-center gap-2 mb-3 ${isMobile ? "text-sm" : "text-base"}`}>
            <Crosshair className="w-4 h-4 text-gain" />
            Trading Strategies
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Choose a strategy that matches your risk tolerance. Each strategy changes how the agent filters tokens, sizes positions, and manages risk.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STRATEGIES.map((s) => (
              <Card key={s.value} className={`${s.borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span className={`text-sm font-semibold ${s.color}`}>{s.label}</span>
                    <Badge variant="outline" className={`text-[9px] ${s.color} ${s.borderColor}`}>
                      {s.risk} Risk
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{s.desc}</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">Best for:</span>
                      <div className="font-medium mt-0.5">{s.bestFor}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trades/day:</span>
                      <div className="font-mono font-medium mt-0.5">{s.trades}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stop-Loss:</span>
                      <div className="font-mono font-medium mt-0.5">{s.stopLoss}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Take-Profit:</span>
                      <div className="font-mono font-medium mt-0.5">{s.takeProfit}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className={`font-semibold flex items-center gap-2 mb-3 ${isMobile ? "text-sm" : "text-base"}`}>
            <Zap className="w-4 h-4 text-gain" />
            Getting Started (5 Steps)
          </h2>
          <div className="space-y-3">
            {SETUP_STEPS.map((step) => (
              <Card key={step.step}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-gain/10 border border-gain/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gain font-mono">{step.step}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <step.icon className="w-4 h-4 text-gain" />
                        <span className="text-sm font-semibold">{step.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className={`font-semibold flex items-center gap-2 mb-3 ${isMobile ? "text-sm" : "text-base"}`}>
            <Target className="w-4 h-4 text-gain" />
            Configuration Tips
          </h2>
          <Card>
            <CardContent className="p-4 space-y-0 divide-y divide-border">
              {CONFIG_TIPS.map((tip) => (
                <div key={tip.title} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <tip.icon className="w-3.5 h-3.5 text-gain" />
                    <span className="text-xs font-semibold">{tip.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-5.5">{tip.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className={`font-semibold flex items-center gap-2 mb-3 ${isMobile ? "text-sm" : "text-base"}`}>
            <Brain className="w-4 h-4 text-gain" />
            How the AI Learns
          </h2>
          <Card className="border-purple-400/20">
            <CardContent className={`${isMobile ? "p-4" : "p-5"} space-y-3`}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The adaptive learning engine tracks the <span className="text-foreground font-medium">performance of every signal combination</span> that leads to a trade.
                After each trade closes, it records which signals were active, the market conditions at entry, and the outcome.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border border-border p-3">
                  <Sparkles className="w-4 h-4 text-purple-400 mb-1.5" />
                  <div className="text-[11px] font-semibold mb-0.5">Signal Scoring</div>
                  <div className="text-[10px] text-muted-foreground">Winning signal patterns get higher weight. Losing patterns get penalized. Over time, the agent prioritizes what actually works.</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <Shield className="w-4 h-4 text-gain mb-1.5" />
                  <div className="text-[11px] font-semibold mb-0.5">Loss Recovery</div>
                  <div className="text-[10px] text-muted-foreground">After consecutive losses, the agent enters cooldown: reduced position sizes, higher conviction threshold, and avoids recently-lost tokens.</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <BarChart3 className="w-4 h-4 text-blue-400 mb-1.5" />
                  <div className="text-[11px] font-semibold mb-0.5">Market Adaptation</div>
                  <div className="text-[10px] text-muted-foreground">The agent identifies bull, bear, and neutral regimes. It adjusts strategy, position sizing, and signal weights based on the current market cycle.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-amber-500">Important Reminders</div>
                <ul className="text-[11px] text-muted-foreground leading-relaxed mt-1.5 space-y-1 list-disc list-inside">
                  <li>Start with small amounts you can afford to lose. AI agents are powerful but no system is 100% risk-free.</li>
                  <li>The agent needs time to learn. Performance improves after the first 20-50 trades as signal weights calibrate.</li>
                  <li>Monitor your agents regularly, especially during the first few days.</li>
                  <li>Different market conditions favor different strategies. Consider running multiple agents with different strategies.</li>
                  <li>Not Financial Advice. Trade at your own risk.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center pb-6">
          <Link href="/ai-agents">
            <Button className="gap-2" data-testid="button-go-to-agents">
              <Bot className="w-4 h-4" />
              Go to AI Agents
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
