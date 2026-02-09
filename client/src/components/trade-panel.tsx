import { useState, useEffect, useCallback, useRef } from "react";
import { type Token } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice, formatCompact } from "@/lib/format";
import { Zap, ArrowDownUp, ShieldCheck, Droplets, BarChart3, Wallet, Loader2, AlertTriangle, Info, ExternalLink, CheckCircle2, Plus, ArrowDownToLine, Copy, RefreshCw, Keyboard } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet";
import { useEvmSwap } from "@/hooks/use-evm-swap";
import { VersionedTransaction } from "@solana/web3.js";
import { getUserTier, calculateFee } from "@/lib/fees";
import { useWallets } from "@/hooks/use-wallets";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { playTradeSuccess, playTradeFail } from "@/lib/sounds";
import { TokenLogo } from "@/components/token-table";

interface TradePanelProps {
  token: Token | null;
}

const QUICK_AMOUNTS_SOL = [0.1, 0.5, 1, 2, 5, 10];
const QUICK_AMOUNTS_ETH = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
const QUICK_AMOUNTS_BNB = [0.05, 0.1, 0.5, 1, 2, 5];
const SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS = 1_000_000_000;

const CHAIN_NATIVE: Record<string, { symbol: string; amounts: number[]; priceUsd: number }> = {
  solana: { symbol: "SOL", amounts: QUICK_AMOUNTS_SOL, priceUsd: 150 },
  ethereum: { symbol: "ETH", amounts: QUICK_AMOUNTS_ETH, priceUsd: 3000 },
  base: { symbol: "ETH", amounts: QUICK_AMOUNTS_ETH, priceUsd: 3000 },
  bsc: { symbol: "BNB", amounts: QUICK_AMOUNTS_BNB, priceUsd: 600 },
  tron: { symbol: "TRX", amounts: [10, 50, 100, 500, 1000, 5000], priceUsd: 0.12 },
};

const CHAIN_DEX: Record<string, string> = {
  solana: "NextApe",
  ethereum: "NextApe",
  base: "NextApe",
  bsc: "NextApe",
  tron: "NextApe",
};

const CHAIN_EXPLORER: Record<string, { name: string; txUrl: string }> = {
  solana: { name: "Solscan", txUrl: "https://solscan.io/tx/" },
  ethereum: { name: "Etherscan", txUrl: "https://etherscan.io/tx/" },
  base: { name: "BaseScan", txUrl: "https://basescan.org/tx/" },
  bsc: { name: "BscScan", txUrl: "https://bscscan.com/tx/" },
  tron: { name: "Tronscan", txUrl: "https://tronscan.org/#/transaction/" },
};

export function TradePanel({ token }: TradePanelProps) {
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [showDepositInline, setShowDepositInline] = useState(false);
  const [tradeTab, setTradeTab] = useState("buy");
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [evmQuoteData, setEvmQuoteData] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastTxExplorer, setLastTxExplorer] = useState<string | null>(null);
  const { toast } = useToast();
  const { publicKey, connected: solConnected, signAndSendTransaction, connection } = useWallet();
  const { address: evmAddress, executeSwap: evmSwap, isEvmChain, getQuote: getEvmQuote, isPending: evmPending } = useEvmSwap();
  const { wallets, getWalletForChain, generateWallet, isGenerating, refreshBalance, isRefreshing } = useWallets();

  const chain = token?.chain || "solana";
  const isEvm = isEvmChain(chain);
  const isSolana = chain === "solana";
  const walletConnected = isSolana ? solConnected : !!evmAddress;
  const nativeInfo = CHAIN_NATIVE[chain] || CHAIN_NATIVE.solana;
  const instantWallet = getWalletForChain(chain);
  const dexName = CHAIN_DEX[chain] || "DEX";
  const explorerInfo = CHAIN_EXPLORER[chain];

  const tokenBalanceUrl = token?.address ? `/api/wallets/token-balance?chain=${chain}&tokenAddress=${encodeURIComponent(token.address)}` : null;
  const { data: tokenBalanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/wallets/token-balance", chain, token?.address],
    queryFn: async () => {
      if (!tokenBalanceUrl) return { balance: 0 };
      const res = await fetch(tokenBalanceUrl, { credentials: "include" });
      return res.json();
    },
    enabled: !!token?.address && !!instantWallet,
    refetchInterval: 30000,
  });
  const rpcTokenBalance = tokenBalanceData?.balance ?? 0;

  const { data: positionsData } = useQuery<any[]>({
    queryKey: ["/api/positions"],
    enabled: !!token,
  });
  const positionForToken = positionsData?.find((p: any) => p.tokenId === token?.id);
  const positionBalance = positionForToken?.size ?? 0;

  const tokenBalance = rpcTokenBalance > 0 ? rpcTokenBalance : positionBalance;

  const fetchQuote = useCallback(async (inputMint: string, outputMint: string, amountRaw: string) => {
    if (!amountRaw || parseFloat(amountRaw) <= 0) {
      setQuoteData(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const amount = Math.floor(parseFloat(amountRaw) * LAMPORTS);
      const slippageBps = Math.floor(parseFloat(slippage) * 100);
      const resp = await fetch(
        `/api/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
      );
      const data = await resp.json();
      if (data.outAmount) {
        setQuoteData(data);
      } else {
        setQuoteData(null);
      }
    } catch {
      setQuoteData(null);
    }
    setQuoteLoading(false);
  }, [slippage]);

  const fetchEvmQuote = useCallback(async (tokenAddress: string, amount: string, side: string) => {
    if (!amount || parseFloat(amount) <= 0 || !isEvm) {
      setEvmQuoteData(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const data = await getEvmQuote(chain, tokenAddress, amount, side);
      setEvmQuoteData(data);
    } catch {
      setEvmQuoteData(null);
    }
    setQuoteLoading(false);
  }, [chain, isEvm, getEvmQuote]);

  useEffect(() => {
    if (!token?.address || !buyAmount || parseFloat(buyAmount) <= 0) {
      setQuoteData(null);
      setEvmQuoteData(null);
      return;
    }
    const timeout = setTimeout(() => {
      if (isSolana) {
        fetchQuote(SOL_MINT, token.address, buyAmount);
      } else if (isEvm) {
        fetchEvmQuote(token.address, buyAmount, "buy");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [buyAmount, token?.address, fetchQuote, fetchEvmQuote, isSolana, isEvm]);

  const swapMutation = useMutation({
    mutationFn: async ({ inputMint, outputMint, amount }: { inputMint: string; outputMint: string; amount: string }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const amountRaw = Math.floor(parseFloat(amount) * LAMPORTS);
      const slippageBps = Math.floor(parseFloat(slippage) * 100);
      const quoteResp = await fetch(
        `/api/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountRaw}&slippageBps=${slippageBps}`
      );
      const quote = await quoteResp.json();
      if (!quote.outAmount) throw new Error("No route found for this token pair");
      const swapResp = await fetch("/api/jupiter/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPublicKey: publicKey.toBase58(),
          quoteResponse: quote,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      const swapData = await swapResp.json();
      if (!swapData.swapTransaction) throw new Error(swapData.error || "Failed to create swap transaction");
      const binaryStr = atob(swapData.swapTransaction);
      const transactionBuf = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        transactionBuf[i] = binaryStr.charCodeAt(i);
      }
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      const signature = await signAndSendTransaction(transaction);
      return signature;
    },
    onSuccess: (signature) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      setLastTxHash(signature);
      setLastTxExplorer(`${CHAIN_EXPLORER.solana.txUrl}${signature}`);
      toast({ title: "Trade executed", description: "Transaction confirmed on Solana" });
      setBuyAmount("");
      setSellAmount("");
      setQuoteData(null);
    },
    onError: (err: Error) => {
      toast({ title: "Swap failed", description: err.message, variant: "destructive" });
    },
  });

  const evmSwapMutation = useMutation({
    mutationFn: async ({ tokenAddress, amount, side }: { tokenAddress: string; amount: string; side: string }) => {
      const slippageBps = Math.floor(parseFloat(slippage) * 100);
      return await evmSwap(chain, tokenAddress, amount, side, slippageBps);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      setLastTxHash(result.hash);
      setLastTxExplorer(result.explorerUrl);
      toast({ title: "Trade executed", description: `Transaction confirmed on ${chain === "bsc" ? "BNB Chain" : chain.charAt(0).toUpperCase() + chain.slice(1)}` });
      setBuyAmount("");
      setSellAmount("");
      setEvmQuoteData(null);
    },
    onError: (err: Error) => {
      toast({ title: "Swap failed", description: err.message, variant: "destructive" });
    },
  });

  const instantTradeMutation = useMutation({
    mutationFn: async (data: { tokenId: number | string; type: string; amount: number; slippageBps?: number; tokenAddress?: string; chain?: string; tokenPrice?: number; tokenName?: string; tokenSymbol?: string }) => {
      const res = await apiRequest("POST", "/api/trades/instant", {
        ...data,
        slippageBps: data.slippageBps || Math.round(parseFloat(slippage) * 100),
      });
      return res.json();
    },
    onSuccess: (result) => {
      playTradeSuccess();
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setLastTxHash(result.txHash);
      setLastTxExplorer(result.explorerUrl || null);
      setShowDepositInline(false);
      toast({
        title: "Trade executed on-chain",
        description: `Tx: ${result.txHash.slice(0, 12)}... | Balance: ${result.newBalance.toFixed(6)} ${result.nativeSymbol}`,
      });
      setBuyAmount("");
      setSellAmount("");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/wallets/token-balance"] });
      }, 2000);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/wallets/token-balance"] });
      }, 5000);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/wallets/token-balance"] });
      }, 10000);
    },
    onError: (err: Error) => {
      playTradeFail();
      toast({ title: "Trade failed", description: err.message, variant: "destructive" });
    },
  });


  const handleBuyRef = useRef<(directAmount?: number) => void>(() => {});
  const handleSellRef = useRef<(directAmount?: number) => void>(() => {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!token) return;

      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          setTradeTab("buy");
          break;
        case "s":
          e.preventDefault();
          setTradeTab("sell");
          break;
        case "1": case "2": case "3": case "4": case "5": case "6": {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          const amounts = nativeInfo.amounts;
          if (idx < amounts.length) {
            if (tradeTab === "buy") {
              setBuyAmount(String(amounts[idx]));
            } else {
              const pcts = [10, 25, 50, 75, 99, 100];
              if (idx < pcts.length && tokenBalance > 0) {
                const pct = pcts[idx];
                const sellAmt = pct === 100 ? tokenBalance * 0.99 : tokenBalance * (pct / 100);
                setSellAmount(String(parseFloat(sellAmt.toFixed(8))));
              }
            }
          }
          break;
        }
        case "enter":
          e.preventDefault();
          if (tradeTab === "buy") handleBuyRef.current();
          else handleSellRef.current();
          break;
        case "escape":
          e.preventDefault();
          setBuyAmount("");
          setSellAmount("");
          break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [token, tradeTab, nativeInfo, tokenBalance, buyAmount, sellAmount]);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[120px] p-6 text-muted-foreground">
        <ArrowDownUp className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-xs font-medium">Select a token to trade</p>
      </div>
    );
  }

  const handleBuy = (directAmount?: number) => {
    const amount = directAmount ?? parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    if (directAmount !== undefined) setBuyAmount(String(amount));
    if (instantWallet) {
      if (instantWallet.balance <= 0) {
        setShowDepositInline(true);
        toast({ title: "Wallet needs funding", description: `Deposit ${nativeInfo.symbol} to your wallet to start trading. Your address is shown above.`, variant: "destructive" });
        return;
      }
      if (instantWallet.balance < amount) {
        setShowDepositInline(true);
        toast({ title: "Insufficient balance", description: `You have ${instantWallet.balance.toFixed(6)} ${nativeInfo.symbol} but need ${amount} ${nativeInfo.symbol}. Deposit more funds.`, variant: "destructive" });
        return;
      }
      instantTradeMutation.mutate({ tokenId: token.id, type: "buy", amount, tokenAddress: token.address, chain: token.chain || "solana", tokenPrice: token.price, tokenName: token.name, tokenSymbol: token.symbol });
    } else if (isSolana && solConnected && publicKey) {
      swapMutation.mutate({ inputMint: SOL_MINT, outputMint: token.address, amount: String(amount) });
    } else if (isEvm && evmAddress) {
      evmSwapMutation.mutate({ tokenAddress: token.address, amount: String(amount), side: "buy" });
    } else {
      toast({ title: "No wallet", description: "Create an instant wallet or connect an external wallet to trade.", variant: "destructive" });
    }
  };

  const handleSell = (directAmount?: number) => {
    const amount = directAmount ?? parseFloat(sellAmount);
    if (!amount || amount <= 0) return;
    if (directAmount !== undefined) setSellAmount(String(amount));
    if (instantWallet) {
      instantTradeMutation.mutate({ tokenId: token.id, type: "sell", amount, tokenAddress: token.address, chain: token.chain || "solana", tokenPrice: token.price, tokenName: token.name, tokenSymbol: token.symbol });
    } else if (isSolana && solConnected && publicKey) {
      swapMutation.mutate({ inputMint: token.address, outputMint: SOL_MINT, amount: String(amount) });
    } else if (isEvm && evmAddress) {
      evmSwapMutation.mutate({ tokenAddress: token.address, amount: String(amount), side: "sell" });
    } else {
      toast({ title: "No wallet", description: "Create an instant wallet or connect an external wallet to trade.", variant: "destructive" });
    }
  };

  const isPending = swapMutation.isPending || evmSwapMutation.isPending || evmPending || instantTradeMutation.isPending;

  handleBuyRef.current = handleBuy;
  handleSellRef.current = handleSell;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <TokenLogo token={token} size={24} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs truncate" data-testid="text-trade-symbol">{token.symbol}</span>
            {token.isVerified && <ShieldCheck className="w-3 h-3 text-info flex-shrink-0" />}
            <Badge variant="outline" className="text-[8px] flex-shrink-0">{chain.toUpperCase()}</Badge>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-bold text-xs" data-testid="text-trade-price">{formatPrice(token.price)}</div>
          <div className={`text-[10px] font-mono ${(token.priceChange24h ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
            {(token.priceChange24h ?? 0) >= 0 ? "+" : ""}{(token.priceChange24h ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 border-b border-border text-[10px] font-mono">
        <span className="text-muted-foreground">MCap <span className="text-foreground">{formatCompact(token.marketCap ?? 0)}</span></span>
        <span className="text-muted-foreground">Liq <span className="text-foreground">{formatCompact(token.liquidity ?? 0)}</span></span>
        <span className="text-muted-foreground">Vol <span className="text-foreground">{formatCompact(token.volume24h ?? 0)}</span></span>
      </div>

      {instantWallet ? (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gain/5 border-b border-gain/20" data-testid="instant-wallet-info">
            <Zap className="w-3 h-3 text-gain flex-shrink-0" />
            <span className="text-[10px] font-mono text-gain font-bold">
              {instantWallet.balance.toFixed(instantWallet.balance < 0.001 ? 8 : 4)} {nativeInfo.symbol}
            </span>
            <div className="flex items-center gap-0.5 ml-auto">
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => {
                  refreshBalance(chain).then(() => {
                    toast({ title: "Balance refreshed" });
                  }).catch(() => {});
                }}
                disabled={isRefreshing}
                data-testid="button-refresh-trade-balance"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`h-5 w-5 ${showDepositInline ? "text-gain" : ""}`}
                onClick={() => setShowDepositInline(!showDepositInline)}
                data-testid="button-toggle-deposit-trade"
              >
                <ArrowDownToLine className="w-2.5 h-2.5" />
              </Button>
              <Badge variant="outline" className="text-[8px] gap-0.5 text-gain border-gain/30">
                <Wallet className="w-2.5 h-2.5" />
                Instant
              </Badge>
            </div>
          </div>
          {showDepositInline && (
            <div className="px-3 py-2 bg-gain/5 border-b border-gain/20 space-y-1.5" data-testid="inline-deposit-section">
              <p className="text-[9px] text-muted-foreground">
                Send {nativeInfo.symbol} to this address on {chain === "bsc" ? "BNB Chain" : chain.charAt(0).toUpperCase() + chain.slice(1)}:
              </p>
              <div className="flex items-center gap-1 bg-background rounded p-1.5 border border-border">
                <p className="font-mono text-[9px] text-foreground truncate flex-1" data-testid="text-trade-deposit-address">
                  {instantWallet.address}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(instantWallet.address);
                    toast({ title: "Address copied" });
                  }}
                  data-testid="button-copy-trade-deposit"
                >
                  <Copy className="w-2.5 h-2.5" />
                </Button>
              </div>
              <p className="text-[8px] text-muted-foreground">
                After sending, click the refresh button to update your balance.
              </p>
            </div>
          )}
          {instantWallet.balance === 0 && !showDepositInline && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[hsl(45,90%,55%)]/5 border-b border-[hsl(45,90%,55%)]/20">
              <AlertTriangle className="w-3 h-3 text-[hsl(45,90%,55%)] flex-shrink-0" />
              <span className="text-[9px] text-muted-foreground">No on-chain balance. Send real {nativeInfo.symbol} to trade.</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-[9px] h-5 px-1.5 text-gain"
                onClick={() => setShowDepositInline(true)}
                data-testid="button-fund-wallet-prompt"
              >
                <ArrowDownToLine className="w-2.5 h-2.5 mr-0.5" />
                View Address
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/30 border-b border-border">
          <Zap className="w-3 h-3 text-gain flex-shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-5 px-1.5 text-gain"
            disabled={isGenerating}
            onClick={async () => {
              try {
                await generateWallet(chain);
                toast({ title: "Wallet created", description: `${chain} instant wallet ready. Deposit to start trading.` });
              } catch {}
            }}
            data-testid="button-create-instant-wallet"
          >
            {isGenerating ? <RefreshCw className="w-2.5 h-2.5 mr-0.5 animate-spin" /> : <Plus className="w-2.5 h-2.5 mr-0.5" />}
            Create Instant Wallet
          </Button>
          <span className="text-[9px] text-muted-foreground ml-auto">Zero-confirmation trades</span>
        </div>
      )}

      {(walletConnected || instantWallet) && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border">
          <span className="text-[10px] text-muted-foreground">Slip</span>
          <div className="flex gap-0.5">
            {["0.5", "1", "2", "5"].map((s) => (
              <button
                key={s}
                data-testid={`button-slippage-${s}`}
                onClick={() => setSlippage(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  slippage === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
          <Badge variant="outline" className="text-[9px] ml-auto gap-1">
            <Wallet className="w-2.5 h-2.5" />
            {instantWallet ? "On-Chain" : dexName}
          </Badge>
        </div>
      )}

      {lastTxHash && (
        <div className="flex items-center gap-2 px-3 py-1 bg-gain/5 border-b border-gain/20">
          <CheckCircle2 className="w-3 h-3 text-gain flex-shrink-0" />
          <span className="text-[10px] text-gain font-mono truncate">{lastTxHash.slice(0, 10)}...{lastTxHash.slice(-6)}</span>
          {lastTxExplorer && (
            <a href={lastTxExplorer} target="_blank" rel="noopener noreferrer" className="text-[10px] text-info flex items-center gap-0.5 ml-auto" data-testid="link-tx-explorer">
              <ExternalLink className="w-3 h-3" />
              View
            </a>
          )}
        </div>
      )}

      <div className="px-3 py-2">
        <Tabs value={tradeTab} onValueChange={setTradeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="buy" className="text-xs data-[state=active]:bg-gain/20 data-[state=active]:text-gain" data-testid="tab-buy">
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="text-xs data-[state=active]:bg-loss/20 data-[state=active]:text-loss" data-testid="tab-sell">
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-2 space-y-2">
            {instantWallet && (
              <div className="flex items-center justify-between text-[10px] font-mono bg-secondary/30 rounded px-2 py-1" data-testid="text-buy-balance-info">
                <span className="text-muted-foreground">Available:</span>
                <span className={instantWallet.balance > 0 ? "text-gain font-bold" : "text-loss font-bold"}>
                  {instantWallet.balance.toFixed(instantWallet.balance < 0.001 ? 8 : 4)} {nativeInfo.symbol}
                  {instantWallet.balance <= 0 && " (unfunded)"}
                </span>
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Amount ({nativeInfo.symbol})</label>
              <Input
                data-testid="input-buy-amount"
                type="number"
                placeholder="0.00"
                className="font-mono text-sm h-9"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {nativeInfo.amounts.map((amt) => (
                <Button
                  key={amt}
                  variant="secondary"
                  size="sm"
                  className="text-[10px] font-mono"
                  data-testid={`button-quick-buy-${amt}`}
                  disabled={isPending}
                  onClick={() => handleBuy(amt)}
                >
                  {amt} {nativeInfo.symbol}
                </Button>
              ))}
            </div>
            {buyAmount && parseFloat(buyAmount) > 0 && (
              <div className="space-y-1 px-1">
                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                  {quoteLoading ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Fetching quote...</>
                  ) : quoteData && isSolana ? (
                    <>You get ~{formatCompact(parseInt(quoteData.outAmount) / Math.pow(10, 9))} {token.symbol}</>
                  ) : evmQuoteData && isEvm ? (
                    <>You get ~{formatCompact(parseInt(evmQuoteData.estimatedOutput) / Math.pow(10, evmQuoteData.outputDecimals || 18))} {token.symbol}</>
                  ) : (
                    <>You get ~{formatCompact(parseFloat(buyAmount || "0") / token.price)} {token.symbol}</>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-secondary/30 rounded px-2 py-0.5" data-testid="text-buy-fee">
                  <span className="flex items-center gap-1">
                    <Info className="w-2.5 h-2.5" />
                    Fee ({getUserTier().swapFeePercent}%)
                  </span>
                  <span>{calculateFee(parseFloat(buyAmount)).fee.toFixed(6)} {nativeInfo.symbol}</span>
                </div>
              </div>
            )}
            <Button
              className="w-full bg-gain text-white border-gain font-semibold"
              data-testid="button-execute-buy"
              disabled={!buyAmount || isPending}
              onClick={() => handleBuy()}
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
              {isPending ? "Buying..." : "Buy"}
            </Button>
          </TabsContent>

          <TabsContent value="sell" className="mt-2 space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Amount ({token.symbol})</label>
              <Input
                data-testid="input-sell-amount"
                type="number"
                placeholder="0.00"
                className="font-mono text-sm h-9"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <Button
                  key={pct}
                  variant="secondary"
                  size="sm"
                  className="text-[10px] font-mono"
                  data-testid={`button-quick-sell-${pct}`}
                  disabled={isPending}
                  onClick={() => {
                    if (tokenBalance > 0) {
                      const effectivePct = pct === 100 ? 99 : pct;
                      const amt = Math.floor(tokenBalance * effectivePct / 100 * 1e6) / 1e6;
                      handleSell(amt);
                    } else {
                      toast({ title: "No tokens to sell", description: `You don't hold any ${token.symbol} in your wallet.`, variant: "destructive" });
                    }
                  }}
                >
                  {pct}%
                </Button>
              ))}
            </div>
            {instantWallet && (
              <div className="text-[9px] text-muted-foreground font-mono px-1">
                Balance: {tokenBalance > 0 ? formatCompact(tokenBalance) : "0"} {token.symbol}
              </div>
            )}
            {sellAmount && parseFloat(sellAmount) > 0 && (
              <div className="space-y-1 px-1">
                <div className="text-[10px] text-muted-foreground font-mono">
                  You receive ~{formatCompact(parseFloat(sellAmount || "0") * token.price / nativeInfo.priceUsd)} {nativeInfo.symbol}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-secondary/30 rounded px-2 py-0.5" data-testid="text-sell-fee">
                  <span className="flex items-center gap-1">
                    <Info className="w-2.5 h-2.5" />
                    Fee ({getUserTier().swapFeePercent}%)
                  </span>
                  <span>{calculateFee(parseFloat(sellAmount) * token.price / nativeInfo.priceUsd).fee.toFixed(6)} {nativeInfo.symbol}</span>
                </div>
              </div>
            )}
            <Button
              className="w-full bg-loss text-white border-loss font-semibold"
              data-testid="button-execute-sell"
              disabled={!sellAmount || isPending}
              onClick={() => handleSell()}
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
              {isPending ? "Selling..." : "Sell"}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-1 text-[9px] text-muted-foreground/60 font-mono"
                onClick={() => setShowHotkeys(!showHotkeys)}
                data-testid="button-toggle-hotkeys"
              >
                <Keyboard className="w-3 h-3" />
                Hotkeys
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] max-w-[200px]">
              <div className="space-y-0.5">
                <div><kbd className="bg-secondary px-1 rounded text-[9px]">B</kbd> Buy tab</div>
                <div><kbd className="bg-secondary px-1 rounded text-[9px]">S</kbd> Sell tab</div>
                <div><kbd className="bg-secondary px-1 rounded text-[9px]">1-6</kbd> Quick amounts</div>
                <div><kbd className="bg-secondary px-1 rounded text-[9px]">Enter</kbd> Execute</div>
                <div><kbd className="bg-secondary px-1 rounded text-[9px]">Esc</kbd> Clear</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
