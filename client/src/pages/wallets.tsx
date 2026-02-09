import { useWallets, type GeneratedWallet } from "@/hooks/use-wallets";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/i18n";
import { useState, useCallback } from "react";
import {
  Wallet,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Trash2,
  ExternalLink,
  Shield,
  AlertTriangle,
  ArrowDownToLine,
  QrCode,
  Zap,
  TrendingUp,
} from "lucide-react";

const CHAINS = [
  { id: "solana", label: "Solana", symbol: "SOL", color: "text-[hsl(280,80%,65%)]", bg: "bg-[hsl(280,80%,65%)]/10", border: "border-[hsl(280,80%,65%)]/20", accent: "hsl(280,80%,65%)" },
  { id: "ethereum", label: "Ethereum", symbol: "ETH", color: "text-[hsl(220,80%,65%)]", bg: "bg-[hsl(220,80%,65%)]/10", border: "border-[hsl(220,80%,65%)]/20", accent: "hsl(220,80%,65%)" },
  { id: "base", label: "Base", symbol: "ETH", color: "text-[hsl(210,80%,55%)]", bg: "bg-[hsl(210,80%,55%)]/10", border: "border-[hsl(210,80%,55%)]/20", accent: "hsl(210,80%,55%)" },
  { id: "bsc", label: "BNB Chain", symbol: "BNB", color: "text-[hsl(45,90%,55%)]", bg: "bg-[hsl(45,90%,55%)]/10", border: "border-[hsl(45,90%,55%)]/20", accent: "hsl(45,90%,55%)" },
  { id: "tron", label: "Tron", symbol: "TRX", color: "text-[hsl(0,75%,55%)]", bg: "bg-[hsl(0,75%,55%)]/10", border: "border-[hsl(0,75%,55%)]/20", accent: "hsl(0,75%,55%)" },
];

const EXPLORER_MAP: Record<string, (addr: string) => string> = {
  solana: (a) => `https://solscan.io/account/${a}`,
  ethereum: (a) => `https://etherscan.io/address/${a}`,
  base: (a) => `https://basescan.org/address/${a}`,
  bsc: (a) => `https://bscscan.com/address/${a}`,
  tron: (a) => `https://tronscan.org/#/address/${a}`,
};

function WalletCard({ wallet, chainConfig, onDelete, onRefreshBalance, isRefreshing }: {
  wallet: GeneratedWallet;
  chainConfig: typeof CHAINS[0];
  onDelete: (id: number) => void;
  onRefreshBalance: (chain: string) => void;
  isRefreshing: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} ${t.common.copied}` });
  }, [toast, t]);

  const handleRevealKey = useCallback(async () => {
    if (showKey) {
      setShowKey(false);
      setPrivateKey(null);
      return;
    }
    try {
      const res = await apiRequest("POST", `/api/wallets/${wallet.id}/export-key`);
      const data = await res.json();
      setPrivateKey(data.privateKey);
      setShowKey(true);
    } catch {
      toast({ title: t.common.error, description: "Failed to export private key", variant: "destructive" });
    }
  }, [showKey, wallet.id, toast, t]);

  const explorerUrl = EXPLORER_MAP[wallet.chain]?.(wallet.address) || "#";

  return (
    <Card className={`p-4 ${chainConfig.border} border`} data-testid={`card-wallet-${wallet.chain}`}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${chainConfig.bg}`}>
            <Wallet className={`w-4 h-4 ${chainConfig.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-bold text-sm ${chainConfig.color}`}>{chainConfig.label}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0">{chainConfig.symbol}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              {wallet.createdAt ? new Date(wallet.createdAt).toLocaleDateString() : ""}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-1.5">
          <div>
            <p className="font-mono font-bold text-sm" data-testid={`text-balance-${wallet.chain}`}>
              {wallet.balance.toFixed(wallet.balance < 0.001 ? 8 : 4)} {chainConfig.symbol}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onRefreshBalance(wallet.chain)}
            disabled={isRefreshing}
            data-testid={`button-refresh-${wallet.chain}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="bg-secondary/30 rounded-md p-2.5 mb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs text-muted-foreground truncate flex-1" data-testid={`text-address-${wallet.chain}`}>
            {isMobile ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : wallet.address}
          </p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(wallet.address, t.common.address)} data-testid={`button-copy-address-${wallet.chain}`}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" data-testid={`button-explorer-${wallet.chain}`}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {showDeposit && (
        <div className="bg-gain/5 border border-gain/20 rounded-md p-3 mb-3" data-testid={`deposit-section-${wallet.chain}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDownToLine className="w-3.5 h-3.5 text-gain" />
            <span className="text-xs font-medium text-gain">{t.common.deposit} {chainConfig.symbol}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Send {chainConfig.symbol} to this address on <span className="font-medium text-foreground">{chainConfig.label}</span> network. Only send {chainConfig.symbol} or {chainConfig.label} tokens to this address.
          </p>
          <div className="bg-background rounded-md p-2.5 border border-border mb-2">
            <p className="font-mono text-[11px] break-all text-foreground leading-relaxed" data-testid={`text-deposit-address-${wallet.chain}`}>
              {wallet.address}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 flex-1"
              onClick={() => copyToClipboard(wallet.address, "Deposit address")}
              data-testid={`button-copy-deposit-${wallet.chain}`}
            >
              <Copy className="w-3 h-3" />
              {t.wallets.copyAddress}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => onRefreshBalance(wallet.chain)}
              disabled={isRefreshing}
              data-testid={`button-check-deposit-${wallet.chain}`}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              {t.wallets.refreshBalance}
            </Button>
          </div>
          <div className="mt-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[hsl(45,90%,55%)] mt-0.5 shrink-0" />
            <p className="text-[9px] text-muted-foreground">
              After sending, click "{t.wallets.refreshBalance}" to update. Transfers may take a few minutes to confirm on-chain.
            </p>
          </div>
        </div>
      )}

      {showKey && privateKey && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2.5 mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3 h-3 text-destructive" />
            <span className="text-[10px] font-medium text-destructive">{t.wallets.privateKeyWarning}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] text-muted-foreground break-all flex-1" data-testid={`text-private-key-${wallet.chain}`}>
              {privateKey}
            </p>
            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(privateKey, "Private key")} data-testid={`button-copy-key-${wallet.chain}`}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant={showDeposit ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDeposit(!showDeposit)}
          className={`text-xs gap-1.5 ${showDeposit ? "bg-gain text-white border-gain" : ""}`}
          data-testid={`button-deposit-${wallet.chain}`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          {showDeposit ? t.common.close : t.common.deposit}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRevealKey}
          className="text-xs gap-1.5"
          data-testid={`button-reveal-key-${wallet.chain}`}
        >
          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showKey ? t.wallets.hidePrivateKey : t.wallets.showPrivateKey}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(wallet.id)}
          className="text-xs gap-1.5 text-destructive"
          data-testid={`button-delete-wallet-${wallet.chain}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function EmptyChainCard({ chainConfig, onCreate, isCreating }: {
  chainConfig: typeof CHAINS[0];
  onCreate: (chain: string) => void;
  isCreating: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card className={`p-4 border-dashed ${chainConfig.border} border`} data-testid={`card-create-wallet-${chainConfig.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${chainConfig.bg}`}>
            <Wallet className={`w-4 h-4 ${chainConfig.color}`} />
          </div>
          <div>
            <span className={`font-bold text-sm ${chainConfig.color}`}>{chainConfig.label}</span>
            <p className="text-[10px] text-muted-foreground">{t.wallets.noWallets}</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onCreate(chainConfig.id)}
          disabled={isCreating}
          className="gap-1.5 text-xs"
          data-testid={`button-generate-${chainConfig.id}`}
        >
          {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {t.wallets.generateWallet}
        </Button>
      </div>
    </Card>
  );
}

export default function WalletsPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { isAuthenticated, login } = useAuth();
  const { wallets, isLoading, generateWallet, isGenerating, refreshBalance, isRefreshing, refreshAll, isRefreshingAll } = useWallets();
  const { t } = useTranslation();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/wallets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Wallet Removed", description: "Wallet has been deleted" });
    },
    onError: () => {
      toast({ title: t.common.error, description: "Failed to delete wallet", variant: "destructive" });
    },
  });

  const walletMap = new Map<string, GeneratedWallet>();
  wallets.forEach(w => walletMap.set(w.chain, w));

  const handleCreateAll = useCallback(async () => {
    const missing = CHAINS.filter(c => !walletMap.has(c.id));
    for (const chain of missing) {
      try {
        await generateWallet(chain.id);
      } catch {}
    }
    toast({ title: "All Wallets Created", description: "Wallets generated for all chains" });
  }, [walletMap, generateWallet, toast]);

  const handleRefreshAll = useCallback(async () => {
    try {
      await refreshAll();
      toast({ title: t.wallets.refreshBalance, description: "All wallet balances refreshed from blockchain" });
    } catch {
      toast({ title: t.common.error, description: "Failed to refresh some balances", variant: "destructive" });
    }
  }, [refreshAll, toast, t]);

  const handleRefreshOne = useCallback(async (chain: string) => {
    try {
      await refreshBalance(chain);
      toast({ title: t.wallets.refreshBalance, description: `${chain} balance refreshed from blockchain` });
    } catch {
      toast({ title: t.common.error, description: "Failed to refresh balance", variant: "destructive" });
    }
  }, [refreshBalance, toast, t]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="font-bold text-lg mb-1">Connect to Access Wallets</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {t.wallets.subtitle}
          </p>
        </div>
        <Button onClick={login} className="gap-2" data-testid="button-connect-wallet">
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={isMobile ? "p-3 space-y-3" : "p-4 space-y-4"}>
        <Skeleton className="h-8 w-48" />
        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"} gap-3`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? "p-3" : "p-4"} space-y-4 overflow-auto h-full`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-gain" />
          <h1 className="font-bold text-lg" data-testid="text-wallets-title">{t.wallets.title}</h1>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-gain border-gain/30">
            {wallets.length}/{CHAINS.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {wallets.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshAll}
              disabled={isRefreshingAll}
              className="text-xs gap-1.5"
              data-testid="button-refresh-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? "animate-spin" : ""}`} />
              {t.common.refresh}
            </Button>
          )}
          {wallets.length < CHAINS.length && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateAll}
              disabled={isGenerating}
              className="text-xs gap-1.5"
              data-testid="button-create-all-wallets"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.wallets.generateWallet}
            </Button>
          )}
        </div>
      </div>

      <Card className="p-3 bg-secondary/20">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">{t.wallets.warning}</p>
            <p className="text-[10px] text-muted-foreground">
              {t.wallets.fundInstructions}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 bg-gain/5 border-gain/20">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-gain mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-gain">How to start trading</p>
            <div className="text-[10px] text-muted-foreground space-y-0.5 mt-0.5">
              <p>1. Create a wallet for the chain you want to trade on</p>
              <p>2. Click "{t.common.deposit}" and send crypto to your wallet address</p>
              <p>3. Click "{t.wallets.refreshBalance}" after your transfer confirms</p>
              <p>4. Go to any token and use the trade panel to buy/sell instantly</p>
            </div>
          </div>
        </div>
      </Card>

      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"} gap-3`}>
        {CHAINS.map(chainConfig => {
          const wallet = walletMap.get(chainConfig.id);
          if (wallet) {
            return (
              <WalletCard
                key={chainConfig.id}
                wallet={wallet}
                chainConfig={chainConfig}
                onDelete={(id) => deleteMutation.mutate(id)}
                onRefreshBalance={handleRefreshOne}
                isRefreshing={isRefreshing}
              />
            );
          }
          return (
            <EmptyChainCard
              key={chainConfig.id}
              chainConfig={chainConfig}
              onCreate={(chain) => generateWallet(chain)}
              isCreating={isGenerating}
            />
          );
        })}
      </div>
    </div>
  );
}
