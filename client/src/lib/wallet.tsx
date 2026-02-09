import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  address: string;
  balance: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSendTransaction: (tx: VersionedTransaction) => Promise<string>;
  connection: Connection;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  connecting: false,
  publicKey: null,
  address: "",
  balance: null,
  connect: async () => {},
  disconnect: () => {},
  signAndSendTransaction: async () => "",
  connection: new Connection(SOLANA_RPC),
});

export function useWallet() {
  return useContext(WalletContext);
}

function getPhantomProvider(): any {
  if ("solana" in window) {
    const provider = (window as any).solana;
    if (provider?.isPhantom) return provider;
  }
  return null;
}

function getSolflareProvider(): any {
  if ("solflare" in window) {
    return (window as any).solflare;
  }
  return null;
}

function getProvider(): any {
  return getPhantomProvider() || getSolflareProvider() || null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [connection] = useState(() => new Connection(SOLANA_RPC));

  const address = publicKey ? publicKey.toBase58() : "";

  const fetchBalance = useCallback(async (pk: PublicKey) => {
    try {
      const bal = await connection.getBalance(pk);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch {
      setBalance(null);
    }
  }, [connection]);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    if (provider.isConnected && provider.publicKey) {
      const pk = new PublicKey(provider.publicKey.toBase58());
      setPublicKey(pk);
      setConnected(true);
      fetchBalance(pk);
    }

    const handleConnect = (pk: any) => {
      if (pk) {
        const pubkey = new PublicKey(pk.toBase58());
        setPublicKey(pubkey);
        setConnected(true);
        fetchBalance(pubkey);
      }
    };

    const handleDisconnect = () => {
      setPublicKey(null);
      setConnected(false);
      setBalance(null);
    };

    provider.on?.("connect", handleConnect);
    provider.on?.("disconnect", handleDisconnect);

    return () => {
      provider.off?.("connect", handleConnect);
      provider.off?.("disconnect", handleDisconnect);
    };
  }, [fetchBalance]);

  useEffect(() => {
    if (!publicKey || !connected) return;
    const interval = setInterval(() => fetchBalance(publicKey), 15000);
    return () => clearInterval(interval);
  }, [publicKey, connected, fetchBalance]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const resp = await provider.connect();
      const pk = new PublicKey(resp.publicKey.toBase58());
      setPublicKey(pk);
      setConnected(true);
      fetchBalance(pk);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
    setConnecting(false);
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    const provider = getProvider();
    provider?.disconnect?.();
    setPublicKey(null);
    setConnected(false);
    setBalance(null);
  }, []);

  const signAndSendTransaction = useCallback(async (tx: VersionedTransaction): Promise<string> => {
    const provider = getProvider();
    if (!provider) throw new Error("Wallet not connected");

    const { signature } = await provider.signAndSendTransaction(tx);
    return signature;
  }, []);

  return (
    <WalletContext.Provider value={{
      connected,
      connecting,
      publicKey,
      address,
      balance,
      connect,
      disconnect,
      signAndSendTransaction,
      connection,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
