import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppKitAccount, useDisconnect, useAppKit } from "@reown/appkit/react";
import { useEffect, useRef, useCallback } from "react";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function walletLogin(address: string): Promise<User> {
  const response = await fetch("/api/auth/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ address }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Authentication failed");
  }

  return response.json();
}

async function serverLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const lastAuthAddress = useRef<string | null>(null);
  const isAuthenticating = useRef(false);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginWithWallet = useCallback(async (walletAddress: string) => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;

    try {
      const user = await walletLogin(walletAddress);
      queryClient.setQueryData(["/api/auth/user"], user);
    } catch (error) {
      console.error("Wallet login failed:", error);
    } finally {
      isAuthenticating.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (isConnected && address && address !== lastAuthAddress.current && !isAuthenticating.current) {
      lastAuthAddress.current = address;
      loginWithWallet(address);
    }
    if (!isConnected && lastAuthAddress.current) {
      lastAuthAddress.current = null;
      serverLogout().then(() => {
        queryClient.setQueryData(["/api/auth/user"], null);
      });
    }
  }, [isConnected, address, loginWithWallet, queryClient]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await serverLogout();
      disconnect();
    },
    onSuccess: () => {
      lastAuthAddress.current = null;
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading: isLoading || isAuthenticating.current,
    isAuthenticated: !!user,
    login: () => open(),
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    walletAddress: address,
    isWalletConnected: isConnected,
  };
}
