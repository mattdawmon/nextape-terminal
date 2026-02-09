import { Zap, Wifi, WifiOff, Command, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WalletButton } from "./wallet-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalSearch, type DexSearchResult } from "./global-search";
import { LanguageSwitcher } from "./language-switcher";
import { useTranslation } from "@/i18n";

interface TerminalHeaderProps {
  isConnected: boolean;
  onSearch?: (query: string) => void;
  onSelectToken?: (token: DexSearchResult) => void;
  selectedChain?: string;
  onChainChange?: (chain: string) => void;
}

const chains = [
  { id: "all", label: "ALL", color: "text-muted-foreground" },
  { id: "solana", label: "SOL", color: "text-[hsl(280,80%,65%)]" },
  { id: "ethereum", label: "ETH", color: "text-[hsl(220,80%,65%)]" },
  { id: "base", label: "BASE", color: "text-[hsl(210,80%,55%)]" },
  { id: "bsc", label: "BNB", color: "text-[hsl(45,90%,55%)]" },
  { id: "tron", label: "TRX", color: "text-[hsl(0,75%,55%)]" },
];

export function TerminalHeader({ isConnected, onSearch, onSelectToken, selectedChain = "all", onChainChange }: TerminalHeaderProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  if (isMobile) {
    return (
      <header className="border-b border-border bg-card">
        <div className="flex items-center gap-2 px-3 py-2">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="w-4 h-4 text-gain flex-shrink-0" />
            <span className="font-bold text-sm tracking-tight" data-testid="text-app-title">NextApe</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {isConnected ? (
              <Wifi className="w-3 h-3 text-gain" />
            ) : (
              <WifiOff className="w-3 h-3 text-loss" />
            )}
            <LanguageSwitcher />
            <WalletButton />
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <GlobalSearch
            onSearch={onSearch}
            onSelectToken={onSelectToken}
            selectedChain={selectedChain}
            className="flex-1 min-w-0"
            inputClassName="h-7 text-[11px]"
            placeholder={t.header.searchPlaceholderShort}
          />
        </div>
        <div className="flex items-center gap-0.5 px-3 pb-2 overflow-x-auto scrollbar-thin" data-testid="chain-selector">
          {chains.map((chain) => (
            <button
              key={chain.id}
              data-testid={`chain-${chain.id}`}
              onClick={() => onChainChange?.(chain.id)}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium whitespace-nowrap ${
                selectedChain === chain.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {chain.label}
            </button>
          ))}
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-card flex-wrap">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-5 h-5 text-gain" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gain rounded-full animate-pulse-glow" />
          </div>
          <span className="font-bold text-base tracking-tight" data-testid="text-app-title">
            NextApe
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {t.badges.terminal}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-0.5" data-testid="chain-selector">
        {chains.map((chain) => (
          <button
            key={chain.id}
            data-testid={`chain-${chain.id}`}
            onClick={() => onChainChange?.(chain.id)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-medium transition-colors ${
              selectedChain === chain.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {chain.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-1 max-w-md mx-4">
        <GlobalSearch
          onSearch={onSearch}
          onSelectToken={onSelectToken}
          selectedChain={selectedChain}
          className="flex-1"
          inputClassName="h-8"
          placeholder={t.header.searchPlaceholder}
        />
        <button
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
          }}
          className="hidden lg:flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 text-[10px] text-muted-foreground font-mono whitespace-nowrap flex-shrink-0 hover-elevate"
          data-testid="button-command-palette"
        >
          <Command className="w-3 h-3" />K
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-gain" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-loss" />
          )}
          <span className="text-[10px] font-mono text-muted-foreground">
            {isConnected ? t.common.live : t.common.offline}
          </span>
        </div>
        <LanguageSwitcher />
        <WalletButton />
      </div>
    </header>
  );
}
