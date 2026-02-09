import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export function WalletButton() {
  const { user, isWalletConnected, walletAddress, login, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "";

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({ title: "Address copied", description: walletAddress });
    }
  };

  const getExplorerUrl = (address: string) => {
    if (address.startsWith("0x")) {
      return `https://etherscan.io/address/${address}`;
    }
    return `https://solscan.io/account/${address}`;
  };

  if (isWalletConnected && walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 py-1">
          <div className="w-2 h-2 rounded-full bg-gain animate-pulse" />
          <span className="text-[10px] font-mono text-foreground" data-testid="text-wallet-address">
            {shortAddress}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={copyAddress}
            data-testid="button-copy-address"
          >
            <Copy className="w-2.5 h-2.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => window.open(getExplorerUrl(walletAddress), "_blank")}
            data-testid="button-view-explorer"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-disconnect-wallet"
          >
            <LogOut className="w-2.5 h-2.5 text-loss" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={login}
      data-testid="button-connect-wallet"
      className="text-xs gap-1.5"
    >
      <Wallet className="w-3.5 h-3.5" />
      Connect Wallet
    </Button>
  );
}
