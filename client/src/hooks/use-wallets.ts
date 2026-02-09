import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface GeneratedWallet {
  id: number;
  chain: string;
  address: string;
  balance: number;
  label: string | null;
  createdAt: string | null;
}

export function useWallets() {
  const { data: wallets = [], isLoading } = useQuery<GeneratedWallet[]>({
    queryKey: ["/api/wallets"],
    retry: false,
    staleTime: 1000 * 10,
  });

  const generateMutation = useMutation({
    mutationFn: async (chain: string) => {
      const res = await apiRequest("POST", "/api/wallets/generate", { chain });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async ({ chain, amount }: { chain: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/wallets/deposit", { chain, amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
  });

  const refreshBalanceMutation = useMutation({
    mutationFn: async (chain: string) => {
      const res = await apiRequest("POST", "/api/wallets/refresh-balance", { chain });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
  });

  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallets/refresh-all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
  });

  function getWalletForChain(chain: string): GeneratedWallet | undefined {
    return wallets.find(w => w.chain === chain);
  }

  return {
    wallets,
    isLoading,
    generateWallet: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    deposit: depositMutation.mutateAsync,
    refreshBalance: refreshBalanceMutation.mutateAsync,
    isRefreshing: refreshBalanceMutation.isPending,
    refreshAll: refreshAllMutation.mutateAsync,
    isRefreshingAll: refreshAllMutation.isPending,
    getWalletForChain,
  };
}
