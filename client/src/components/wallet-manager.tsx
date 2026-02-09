import { useState } from "react";
import { useWallets, type GeneratedWallet } from "@/hooks/use-wallets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, Copy, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const CHAIN_INFO: Record<string, { name: string; symbol: string; color: string }> = {
  solana: { name: "Solana", symbol: "SOL", color: "text-purple-400" },
  ethereum: { name: "Ethereum", symbol: "ETH", color: "text-blue-400" },
  base: { name: "Base", symbol: "ETH", color: "text-blue-300" },
  bsc: { name: "BNB Chain", symbol: "BNB", color: "text-yellow-400" },
  tron: { name: "Tron", symbol: "TRX", color: "text-red-400" },
};

const SUPPORTED_CHAINS = ["solana", "ethereum", "base", "bsc", "tron"];

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletManager() {
  const { wallets, isLoading, generateWallet, isGenerating } = useWallets();
  const [expanded, setExpanded] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async (chain: string) => {
    try {
      await generateWallet(chain);
      toast({ title: "Wallet created", description: `${CHAIN_INFO[chain]?.name || chain} wallet generated` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const existingChains = new Set(wallets.map(w => w.chain));
  const missingChains = SUPPORTED_CHAINS.filter(c => !existingChains.has(c));

  return (
    <div className="px-2 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs"
        data-testid="button-wallet-manager-toggle"
      >
        <Wallet className="w-3.5 h-3.5 text-gain" />
        <span className="font-medium">Instant Wallets</span>
        {wallets.length > 0 && (
          <Badge variant="outline" className="text-[8px] ml-auto mr-1">{wallets.length}</Badge>
        )}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1" data-testid="wallet-manager-content">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {wallets.map((w) => {
                const info = CHAIN_INFO[w.chain];
                return (
                  <div key={w.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/30" data-testid={`wallet-card-${w.chain}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-semibold ${info?.color || ""}`}>{info?.name || w.chain}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono text-muted-foreground">{truncateAddr(w.address)}</span>
                        <button
                          onClick={() => handleCopy(w.address)}
                          className="p-0.5"
                          data-testid={`button-copy-addr-${w.chain}`}
                        >
                          {copiedAddr === w.address
                            ? <Check className="w-2.5 h-2.5 text-gain" />
                            : <Copy className="w-2.5 h-2.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] font-mono font-bold">{w.balance.toFixed(4)}</span>
                      <span className="text-[9px] text-muted-foreground ml-0.5">{info?.symbol}</span>
                    </div>
                  </div>
                );
              })}

              {missingChains.length > 0 && (
                <div className="pt-1">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider px-2 mb-1">Add Wallet</div>
                  <div className="flex flex-wrap gap-1 px-2">
                    {missingChains.map(chain => (
                      <Button
                        key={chain}
                        variant="outline"
                        size="sm"
                        className="text-[9px] h-6 px-2 gap-1"
                        disabled={isGenerating}
                        onClick={() => handleGenerate(chain)}
                        data-testid={`button-generate-${chain}`}
                      >
                        <Plus className="w-2.5 h-2.5" />
                        {CHAIN_INFO[chain]?.name || chain}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {wallets.length === 0 && missingChains.length === SUPPORTED_CHAINS.length && (
                <div className="text-center py-2">
                  <p className="text-[10px] text-muted-foreground mb-1.5">No wallets yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] gap-1"
                    disabled={isGenerating}
                    onClick={() => handleGenerate("solana")}
                    data-testid="button-generate-first-wallet"
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Create Solana Wallet
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
