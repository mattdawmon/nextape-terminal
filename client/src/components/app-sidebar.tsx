import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BarChart3, Flame, Star, Activity, Zap, Radio, Shield, Wallet, Copy, Crosshair, Briefcase, CreditCard, Bot, LogOut, ListOrdered, Users, Bell, Fuel, Rocket, Key, BookOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { WalletManager } from "@/components/wallet-manager";
import { useTranslation } from "@/i18n";

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, walletAddress } = useAuth();
  const { t } = useTranslation();

  const terminalItems = [
    { title: t.nav.scanner, url: "/scanner", icon: Radio, badgeKey: "live" as const },
    { title: t.nav.trending, url: "/trending", icon: Flame },
    { title: t.nav.newPairs, url: "/new", icon: Zap },
    { title: t.nav.memeLaunches, url: "/memes", icon: Rocket, badgeKey: "hot" as const },
    { title: t.nav.watchlist, url: "/watchlist", icon: Star },
    { title: t.nav.activity, url: "/activity", icon: Activity },
    { title: t.nav.alerts, url: "/alerts", icon: Bell },
  ];

  const tradingItems = [
    { title: t.nav.wallets, url: "/wallets", icon: Key, badgeKey: "easy" as const },
    { title: t.nav.smartMoney, url: "/smart-money", icon: Wallet },
    { title: t.nav.copyTrading, url: "/copy-trading", icon: Copy },
    { title: t.nav.sniperMode, url: "/sniper", icon: Crosshair },
    { title: t.nav.ordersDca, url: "/orders", icon: ListOrdered },
    { title: t.nav.portfolio, url: "/portfolio", icon: Briefcase },
  ];

  const analyticsItems = [
    { title: t.nav.marketOverview, url: "/analytics", icon: BarChart3 },
    { title: t.nav.tokenSafety, url: "/safety", icon: Shield },
    { title: t.nav.gasTracker, url: "/gas", icon: Fuel },
    { title: t.nav.pricingFees, url: "/pricing", icon: CreditCard },
    { title: t.nav.referral, url: "/referral", icon: Users },
  ];

  const badgeStyles: Record<string, string> = {
    live: "text-gain border-gain/30",
    hot: "text-warning border-warning/30",
    new: "text-info border-info/30",
    easy: "text-info border-info/30",
  };

  const badgeLabels: Record<string, string> = {
    live: t.badges.live,
    hot: t.badges.hot,
    new: t.badges.new,
    easy: t.badges.easy,
  };

  type NavItem = { title: string; url: string; icon: typeof Radio; badgeKey?: string };
  const renderNavGroup = (items: NavItem[], label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = location === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild data-active={isActive} data-testid={`nav-${item.url.replace("/", "") || "scanner"}`}>
                  <Link href={item.url}>
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs">{item.title}</span>
                    {item.badgeKey && (
                      <Badge variant="outline" className={`ml-auto text-[8px] px-1 py-0 ${badgeStyles[item.badgeKey] || ""}`}>
                        {badgeLabels[item.badgeKey] || item.badgeKey}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  const displayAddress = walletAddress ? truncateAddress(walletAddress) : user?.walletAddress ? truncateAddress(user.walletAddress) : t.common.connected;

  return (
    <Sidebar>
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-5 h-5 text-gain" />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-gain rounded-full animate-pulse-glow" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight">NextApe</span>
            <Badge variant="outline" className="ml-1.5 text-[8px] font-mono">v6.1</Badge>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  data-active={location === "/" || location === "/ai-agents"}
                  data-testid="nav-ai-agents"
                  className="h-10 bg-gain/10 border border-gain/20 data-[active=true]:bg-gain/20 data-[active=true]:border-gain/40"
                >
                  <Link href="/ai-agents">
                    <Bot className="w-5 h-5 text-gain" />
                    <span className="text-sm font-semibold">{t.nav.aiAgents}</span>
                    <Badge variant="outline" className="ml-auto text-[8px] px-1 py-0 text-amber-400 border-amber-400/30">
                      INVITE ONLY
                    </Badge>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/guide"} data-testid="nav-guide">
                  <Link href="/guide">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs">How to Use</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {renderNavGroup(terminalItems, t.nav.terminal)}
        {renderNavGroup(tradingItems, t.nav.trading)}
        {renderNavGroup(analyticsItems, t.nav.analytics)}
        {user && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">{t.nav.instantWallets}</SidebarGroupLabel>
            <SidebarGroupContent>
              <WalletManager />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-2">
        {user && (
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-[9px] bg-gain/20 text-gain">
                <Wallet className="w-3 h-3" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono font-medium truncate" data-testid="text-user-name">{displayAddress}</div>
              <div className="text-[9px] text-muted-foreground">{t.common.connected}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground font-mono text-center">
          SOL / ETH / BASE / BNB / TRX
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
