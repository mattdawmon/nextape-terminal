import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { type Hex } from "viem";

const CHAIN_MAP: Record<string, { chainId: number; nativeName: string; nativeDecimals: number }> = {
  ethereum: { chainId: 1, nativeName: "ETH", nativeDecimals: 18 },
  base: { chainId: 8453, nativeName: "ETH", nativeDecimals: 18 },
  bsc: { chainId: 56, nativeName: "BNB", nativeDecimals: 18 },
};

interface EvmQuote {
  chain: string;
  dex: string;
  inputAmount: string;
  estimatedOutput: string;
  path: string[];
  router: string;
  chainId: number;
  explorer: string;
}

interface EvmSwapResult {
  transactions: Array<{ to: string; data: string; value: string }>;
  chain: string;
  chainId: number;
  dex: string;
  estimatedOutput: string;
  amountOutMin: string;
  explorer: string;
}

export function useEvmSwap() {
  const { address, chainId: currentChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

  const getQuote = useCallback(async (chain: string, tokenAddress: string, amount: string, side: string = "buy"): Promise<EvmQuote | null> => {
    try {
      const resp = await fetch(`/api/evm/quote?chain=${chain}&tokenAddress=${tokenAddress}&amount=${amount}&side=${side}`);
      const data = await resp.json();
      if (data.message) throw new Error(data.message);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const executeSwap = useCallback(async (chain: string, tokenAddress: string, amount: string, side: string, slippageBps: number = 100) => {
    if (!address) throw new Error("Wallet not connected");

    setIsPending(true);
    setError(null);
    setTxHash(null);
    setExplorerUrl(null);

    try {
      const chainConfig = CHAIN_MAP[chain];
      if (!chainConfig) throw new Error(`Unsupported chain: ${chain}`);

      if (currentChainId !== chainConfig.chainId) {
        await switchChainAsync({ chainId: chainConfig.chainId });
      }

      const resp = await fetch("/api/evm/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          tokenAddress,
          amount,
          side,
          userAddress: address,
          slippageBps,
        }),
      });

      const swapData: EvmSwapResult = await resp.json();
      if ((swapData as any).message) throw new Error((swapData as any).message);

      let lastHash = "";
      for (const tx of swapData.transactions) {
        const hash = await sendTransactionAsync({
          to: tx.to as Hex,
          data: tx.data as Hex,
          value: BigInt(tx.value),
        });
        lastHash = hash;
      }

      setTxHash(lastHash);
      setExplorerUrl(`${swapData.explorer}/tx/${lastHash}`);
      setIsPending(false);

      return {
        hash: lastHash,
        explorerUrl: `${swapData.explorer}/tx/${lastHash}`,
        dex: swapData.dex,
        estimatedOutput: swapData.estimatedOutput,
      };
    } catch (err: any) {
      setError(err.message || "Swap failed");
      setIsPending(false);
      throw err;
    }
  }, [address, currentChainId, sendTransactionAsync, switchChainAsync]);

  const isEvmChain = useCallback((chain: string) => {
    return chain in CHAIN_MAP;
  }, []);

  const getChainInfo = useCallback((chain: string) => {
    return CHAIN_MAP[chain] || null;
  }, []);

  return {
    address,
    getQuote,
    executeSwap,
    isEvmChain,
    getChainInfo,
    txHash,
    isPending,
    error,
    explorerUrl,
  };
}
