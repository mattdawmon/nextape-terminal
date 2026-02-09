import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TerminalHeader } from "@/components/terminal-header";
import { WalletProvider } from "@/components/wallet-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { useWebSocket } from "@/lib/websocket";
import { useAuth } from "@/hooks/use-auth";
import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import { WagmiProvider } from "wagmi";
import type { DexSearchResult } from "@/components/global-search";
import { CommandPalette, type CommandPaletteResult } from "@/components/command-palette";
import { Skeleton } from "@/components/ui/skeleton";
import { I18nProvider, useTranslation } from "@/i18n";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import DemoPage from "@/pages/demo";
import ScannerPage from "@/pages/scanner";
import TrendingPage from "@/pages/trending";
import NewPairsPage from "@/pages/new-pairs";
import WatchlistPage from "@/pages/watchlist";
import ActivityPage from "@/pages/activity";
import AnalyticsPage from "@/pages/analytics";
import SafetyPage from "@/pages/safety";
import SmartMoneyPage from "@/pages/smart-money";
import CopyTradingPage from "@/pages/copy-trading";
import SniperPage from "@/pages/sniper";
import PortfolioPage from "@/pages/portfolio";
import PricingPage from "@/pages/pricing";
import AiAgentsPage from "@/pages/ai-agents";
import OrdersPage from "@/pages/orders";
import ReferralPage from "@/pages/referral";
import AlertsPage from "@/pages/alerts";
import GasTrackerPage from "@/pages/gas-tracker";
import MemesPage from "@/pages/memes";
import WalletsPage from "@/pages/wallets";
import GuidePage from "@/pages/guide";

function TerminalApp() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChain, setSelectedChain] = useState("all");
  const [searchSelectedToken, setSearchSelectedToken] = useState<DexSearchResult | null>(null);
  const [, navigate] = useLocation();

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === "price_update" || data.type === "new_trade") {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
    }
    if (data.type === "price_updates" && data.updates) {
      queryClient.setQueryData<any[]>(["/api/tokens"], (oldTokens) => {
        if (!oldTokens) return oldTokens;
        return oldTokens.map((token: any) => {
          const update = data.updates.find((u: any) => u.id === token.id);
          if (update) {
            return {
              ...token,
              price: update.price,
              priceChange24h: update.priceChange24h ?? token.priceChange24h,
              volume24h: update.volume24h ?? token.volume24h,
              liquidity: update.liquidity ?? token.liquidity,
              marketCap: update.marketCap ?? token.marketCap,
              image: update.image || token.image,
              _priceDirection: update.price > token.price ? "up" : update.price < token.price ? "down" : null,
              _lastUpdate: Date.now(),
            };
          }
          return token;
        });
      });
    }
  }, []);

  const { isConnected } = useWebSocket(handleWsMessage);

  const handleSearchSelectToken = useCallback((token: DexSearchResult) => {
    setSearchSelectedToken(token);
    navigate("/scanner");
  }, [navigate]);

  const handleCommandSelect = useCallback((token: CommandPaletteResult) => {
    setSearchSelectedToken(token as DexSearchResult);
    navigate("/scanner");
  }, [navigate]);

  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TerminalHeader isConnected={isConnected} onSearch={setSearchQuery} onSelectToken={handleSearchSelectToken} selectedChain={selectedChain} onChainChange={setSelectedChain} />
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary label="Router">
              <Switch>
                <Route path="/">
                  <ErrorBoundary label="AiAgents">
                    <AiAgentsPage />
                  </ErrorBoundary>
                </Route>
                <Route path="/ai-agents" component={AiAgentsPage} />
                <Route path="/scanner">
                  <ErrorBoundary label="Scanner">
                    <ScannerPage searchQuery={searchQuery} selectedChain={selectedChain} externalToken={searchSelectedToken} onExternalTokenConsumed={() => setSearchSelectedToken(null)} />
                  </ErrorBoundary>
                </Route>
                <Route path="/trending" component={TrendingPage} />
                <Route path="/new" component={NewPairsPage} />
                <Route path="/memes" component={MemesPage} />
                <Route path="/watchlist" component={WatchlistPage} />
                <Route path="/activity" component={ActivityPage} />
                <Route path="/analytics" component={AnalyticsPage} />
                <Route path="/safety" component={SafetyPage} />
                <Route path="/smart-money" component={SmartMoneyPage} />
                <Route path="/copy-trading" component={CopyTradingPage} />
                <Route path="/sniper" component={SniperPage} />
                <Route path="/portfolio" component={PortfolioPage} />
                <Route path="/pricing" component={PricingPage} />
                <Route path="/orders" component={OrdersPage} />
                <Route path="/referral" component={ReferralPage} />
                <Route path="/alerts" component={AlertsPage} />
                <Route path="/gas" component={GasTrackerPage} />
                <Route path="/wallets" component={WalletsPage} />
                <Route path="/guide" component={GuidePage} />
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <CommandPalette onSelectToken={handleCommandSelect} />
    </SidebarProvider>
  );
}

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-gain border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-mono">{t.common.initializing}</p>
      </div>
    </div>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (location === "/demo") {
    return <DemoPage />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <TerminalApp />;
}

function AppWithWeb3() {
  const [wagmiConfig, setWagmiConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("./lib/web3modal").then(async (mod) => {
      const adapter = await mod.initAppKit();
      setWagmiConfig(adapter.wagmiConfig);
      setLoading(false);
    });
  }, []);

  if (loading || !wagmiConfig) {
    return (
      <I18nProvider>
        <LoadingScreen />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WalletProvider>
              <Toaster />
              <AppContent />
            </WalletProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </I18nProvider>
  );
}

function App() {
  return <AppWithWeb3 />;
}

export default App;
