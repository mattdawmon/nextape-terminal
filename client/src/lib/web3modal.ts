import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, base, bsc } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

let projectId = "";

const metadata = {
  name: "NextApe Terminal",
  description: "The Most Powerful Crypto Trading Terminal",
  url: window.location.origin,
  icons: [`${window.location.origin}/favicon.ico`],
};

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, base, bsc];

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: projectId || "PLACEHOLDER",
});

let appKitInitialized = false;

export async function initAppKit() {
  if (appKitInitialized) return wagmiAdapter;

  try {
    const res = await fetch("/api/config/walletconnect");
    const data = await res.json();
    projectId = data.projectId;
  } catch {
    console.error("Failed to fetch WalletConnect config");
    return wagmiAdapter;
  }

  const freshAdapter = new WagmiAdapter({
    networks,
    projectId,
  });

  createAppKit({
    adapters: [freshAdapter],
    networks,
    projectId,
    metadata,
    features: {
      analytics: true,
      socials: ["google", "x", "apple", "discord", "farcaster"],
      email: true,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#22c55e",
      "--w3m-border-radius-master": "1px",
    },
  });

  appKitInitialized = true;
  return freshAdapter;
}

export { wagmiAdapter, networks };
