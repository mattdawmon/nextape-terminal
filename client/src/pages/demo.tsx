import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronDown,
  Zap,
  Shield,
  Brain,
  Rocket,
  Wallet,
  BarChart3,
  Target,
  Users,
  Bot,
  TrendingUp,
  Globe,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

interface FeatureVideo {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  videoSrc: string;
  icon: typeof Zap;
  highlights: string[];
  color: string;
}

const features: FeatureVideo[] = [
  {
    id: "terminal",
    title: "Professional Trading Terminal",
    subtitle: "Real-Time Market Intelligence",
    description:
      "A powerful, information-dense trading dashboard built for serious traders. Live price streaming via WebSocket, professional TradingView candlestick charts with technical indicators (MA, RSI, MACD, Bollinger Bands), and instant token discovery across 5 major blockchains.",
    videoSrc: "/videos/demo-terminal.mp4",
    icon: BarChart3,
    highlights: [
      "Live WebSocket price streaming",
      "TradingView candlestick charts with 6 timeframes",
      "5 chains: Solana, Ethereum, Base, BNB, Tron",
      "Cmd+K command palette for instant navigation",
    ],
    color: "text-gain",
  },
  {
    id: "safety",
    title: "Token Safety Scanner",
    subtitle: "GoPlus Security API Integration",
    description:
      "Real on-chain security audits powered by GoPlus Security API. Instantly scan any EVM token contract for honeypot detection, buy/sell tax analysis, LP lock verification, holder concentration, and contract verification. Protect your capital before every trade.",
    videoSrc: "/videos/demo-safety.mp4",
    icon: Shield,
    highlights: [
      "Real GoPlus Security API data (no simulations)",
      "Honeypot detection & buy/sell tax analysis",
      "LP lock status & holder concentration",
      "Multi-factor risk scoring (0-100)",
    ],
    color: "text-blue-400",
  },
  {
    id: "ai",
    title: "AI Trading Agents",
    subtitle: "Autonomous Trading Powered by OpenAI",
    description:
      "Deploy autonomous AI trading agents with four distinct risk profiles: Conservative, Balanced, Aggressive, and Degen. Each agent uses OpenAI to analyze market conditions and execute trades 24/7, with full activity logging and real-time performance tracking.",
    videoSrc: "/videos/demo-ai-trading.mp4",
    icon: Bot,
    highlights: [
      "4 risk profiles: Conservative to Degen",
      "Powered by OpenAI GPT models",
      "Real-time activity logs & PnL tracking",
      "Automated position management",
    ],
    color: "text-purple-400",
  },
  {
    id: "memes",
    title: "Meme Token Launchpad",
    subtitle: "Live DexScreener Feed",
    description:
      "Discover the hottest new meme tokens the moment they launch. Live feed of 100+ tokens from DexScreener with launchpad tracking across PumpFun, Raydium, Uniswap, PancakeSwap, and more. Real-time bonding curves, dev wallet analysis, and instant trading.",
    videoSrc: "/videos/demo-memes.mp4",
    icon: Rocket,
    highlights: [
      "100+ live tokens from DexScreener",
      "12+ launchpad discovery",
      "Bonding curve visualization",
      "Auto-refresh every 30 seconds",
    ],
    color: "text-orange-400",
  },
  {
    id: "wallets",
    title: "Multi-Chain Trading Engine",
    subtitle: "Real On-Chain Execution",
    description:
      "Built-in cryptographic wallet generation and real on-chain swap execution. Trade directly on Solana via Jupiter, Ethereum/Base via Uniswap V2, and BNB Chain via PancakeSwap V2. Includes copy trading, sniper mode, limit orders, DCA, and smart money tracking.",
    videoSrc: "/videos/demo-wallets.mp4",
    icon: Wallet,
    highlights: [
      "Real on-chain swaps (Jupiter, Uniswap, PancakeSwap)",
      "Built-in wallet generation per chain",
      "Copy trading & sniper mode",
      "Limit orders, stop orders, DCA automation",
    ],
    color: "text-emerald-400",
  },
];

const stats = [
  { label: "Supported Chains", value: "5", icon: Globe },
  { label: "Live Tokens Tracked", value: "100+", icon: TrendingUp },
  { label: "DEX Protocols", value: "12+", icon: Target },
  { label: "Security Factors", value: "8", icon: Lock },
];

function VideoPlayer({ src, autoplay = false, id }: { src: string; autoplay?: boolean; id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!autoplay || !videoRef.current) return;
    const video = videoRef.current;
    video.muted = false;
    video.play().then(() => {
      setIsPlaying(true);
      setIsMuted(false);
    }).catch(() => {
      video.muted = true;
      video.play().then(() => {
        setIsPlaying(true);
        setIsMuted(true);
      }).catch(() => {});
    });
  }, [autoplay]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden" data-testid={`video-player-${id}`}>
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        className="w-full aspect-video object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button size="icon" variant="ghost" onClick={togglePlay} className="text-white bg-white/10 backdrop-blur-sm" data-testid={`button-play-pause-${id}`}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={toggleMute} className="text-white bg-white/10 backdrop-blur-sm" data-testid={`button-mute-toggle-${id}`}>
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

function FeatureSection({ feature, index }: { feature: FeatureVideo; index: number }) {
  const isReversed = index % 2 !== 0;
  const Icon = feature.icon;

  return (
    <div className="py-16 border-b border-border/30" data-testid={`section-feature-${feature.id}`}>
      <div className={`max-w-6xl mx-auto px-6 flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 lg:gap-12 items-center`}>
        <div className="flex-1 min-w-0">
          <VideoPlayer src={feature.videoSrc} autoplay={index === 0} id={feature.id} />
        </div>
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className={`w-5 h-5 ${feature.color}`} />
            <Badge variant="outline" className={`text-[10px] ${feature.color} border-current/30`}>
              {feature.subtitle}
            </Badge>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight" data-testid={`text-feature-title-${feature.id}`}>
            {feature.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
          <ul className="space-y-2.5">
            {feature.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <ArrowRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${feature.color}`} />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto" data-testid="page-demo">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gain/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Zap className="w-8 h-8 text-gain" />
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight" data-testid="text-demo-title">
              NextApe Terminal
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            The next generation crypto trading terminal. Real on-chain execution,
            live market data, AI-powered trading, and institutional-grade security analysis.
          </p>
          <Badge className="bg-gain/10 text-gain border-gain/30 text-xs mb-8">
            v6.1 - Production Ready
          </Badge>

          <div className="max-w-4xl mx-auto mb-10 rounded-lg overflow-hidden border border-border/30">
            <VideoPlayer src={`/videos/nextape-ad-2min.mp4?v=${Date.now()}`} autoplay={true} id="hero" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <Card key={stat.label} className="p-4 text-center">
                  <StatIcon className="w-5 h-5 text-gain mx-auto mb-2" />
                  <div className="text-2xl font-bold font-mono text-gain" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-10 animate-bounce">
            <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />
          </div>
        </div>
      </div>

      {features.map((feature, index) => (
        <FeatureSection key={feature.id} feature={feature} index={index} />
      ))}

      <div className="py-20 text-center px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold">Built Different</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            NextApe Terminal isn't just another trading dashboard. It's a full-stack trading engine
            with real on-chain execution, live market data from DexScreener and GeckoTerminal,
            security audits from GoPlus, and AI agents powered by OpenAI. Every feature is built
            for production, not simulation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link href="/">
              <Button className="gap-2" data-testid="button-launch-terminal">
                <Zap className="w-4 h-4" />
                Launch Terminal
              </Button>
            </Link>
            <Link href="/safety">
              <Button variant="outline" className="gap-2" data-testid="button-try-scanner">
                <Shield className="w-4 h-4" />
                Try Safety Scanner
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-border/30 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          NextApe Terminal - Professional Crypto Trading Platform
        </p>
      </footer>
    </div>
  );
}
