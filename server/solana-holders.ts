const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

const holderCache = new Map<string, { data: SolanaHolderResult; fetchedAt: number }>();
const CACHE_TTL = 120_000;

interface TokenAccountInfo {
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

export interface SolanaHolderResult {
  holders: TokenAccountInfo[];
  totalSupply: number;
  decimals: number;
}

let lastRpcCall = 0;
const MIN_RPC_INTERVAL = 500;

async function solanaRpcCall(method: string, params: any[], retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const now = Date.now();
    const waitTime = Math.max(0, MIN_RPC_INTERVAL - (now - lastRpcCall));
    if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
    lastRpcCall = Date.now();

    try {
      const resp = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.status === 429) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`[SolanaRPC] Rate limited, backing off ${backoff}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      if (!resp.ok) throw new Error(`Solana RPC ${method} failed: ${resp.status}`);
      const json = await resp.json() as any;
      if (json.error) throw new Error(`Solana RPC error: ${json.error.message}`);
      return json.result;
    } catch (err: any) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error(`Solana RPC ${method} failed after ${retries} retries`);
}

export async function getSolanaTokenHolders(mintAddress: string): Promise<SolanaHolderResult | null> {
  const cached = holderCache.get(mintAddress);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const largestAccounts = await solanaRpcCall("getTokenLargestAccounts", [mintAddress, { commitment: "finalized" }]);
    const supplyResult = await solanaRpcCall("getTokenSupply", [mintAddress, { commitment: "finalized" }]);

    if (!largestAccounts?.value || !supplyResult?.value) return null;

    const totalSupply = parseFloat(supplyResult.value.uiAmountString || "0");
    const decimals = supplyResult.value.decimals || 0;

    if (totalSupply <= 0) return null;

    const holders: TokenAccountInfo[] = largestAccounts.value.map((acc: any) => ({
      address: acc.address,
      amount: acc.amount,
      decimals: acc.decimals,
      uiAmount: parseFloat(acc.uiAmountString || "0"),
      uiAmountString: acc.uiAmountString || "0",
    }));

    const result: SolanaHolderResult = { holders, totalSupply, decimals };
    holderCache.set(mintAddress, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.log(`[SolanaRPC] getTokenLargestAccounts failed for ${mintAddress}:`, (err as Error).message);
    return null;
  }
}

export function formatSolanaHolders(
  holderData: SolanaHolderResult,
  marketCap: number,
  _chain: string = "solana"
) {
  const { holders, totalSupply } = holderData;

  const holdersList = holders.slice(0, 20).map((h, i) => {
    const rank = i + 1;
    const percentage = totalSupply > 0 ? (h.uiAmount / totalSupply) * 100 : 0;

    let type: "dev" | "insider" | "whale" | "holder" = "holder";
    let label: string | undefined;

    if (rank === 1 && percentage > 5) {
      type = "whale";
      label = "Top Holder";
    } else if (percentage > 3) {
      type = "whale";
      label = `Whale #${rank}`;
    } else if (rank <= 5) {
      type = "insider";
      label = `Major Holder #${rank}`;
    }

    return {
      rank,
      address: h.address,
      percentage: Math.round(percentage * 100) / 100,
      value: Math.round((percentage / 100) * marketCap * 100) / 100,
      balance: h.uiAmount,
      type,
      label,
      lastActivity: null,
      source: "solana_rpc" as const,
    };
  });

  const top10Percent = holdersList.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
  const top20Percent = holdersList.reduce((sum, h) => sum + h.percentage, 0);
  const whaleCount = holdersList.filter(h => h.type === "whale").length;
  const insiderCount = holdersList.filter(h => h.type === "insider").length;

  return {
    holders: holdersList,
    whaleCount,
    insiderCount,
    top10Percent: Math.round(top10Percent * 100) / 100,
    top20Percent: Math.round(top20Percent * 100) / 100,
    source: "solana_rpc",
  };
}

export function formatSolanaInsiders(
  holderData: SolanaHolderResult,
  price: number,
  marketCap: number
) {
  const { holders, totalSupply } = holderData;

  const insiders: any[] = [];

  const topHolder = holders[0];
  if (topHolder) {
    const pct = totalSupply > 0 ? (topHolder.uiAmount / totalSupply) * 100 : 0;
    insiders.push({
      address: topHolder.address,
      type: pct > 5 ? "dev" : "whale",
      percentage: Math.round(pct * 100) / 100,
      value: Math.round((pct / 100) * marketCap * 100) / 100,
      balance: topHolder.uiAmount,
      buyPrice: null,
      currentPnl: null,
      lastTx: null,
      txCount: null,
      source: "solana_rpc",
    });
  }

  holders.slice(1, 10).forEach((h, i) => {
    const pct = totalSupply > 0 ? (h.uiAmount / totalSupply) * 100 : 0;
    if (pct < 0.1) return;

    let type = "holder";
    if (pct > 3) type = "whale";
    else if (i < 3) type = "early_buyer";
    else type = "smart_money";

    insiders.push({
      address: h.address,
      type,
      percentage: Math.round(pct * 100) / 100,
      value: Math.round((pct / 100) * marketCap * 100) / 100,
      balance: h.uiAmount,
      buyPrice: null,
      currentPnl: null,
      lastTx: null,
      txCount: null,
      source: "solana_rpc",
    });
  });

  const devEntry = insiders[0];
  const earlyBuyers = insiders.filter(i => i.type === "early_buyer" || i.type === "whale");
  const smartMoney = insiders.filter(i => i.type === "smart_money");

  return {
    insiders,
    devWallet: devEntry ? {
      address: devEntry.address,
      percentage: devEntry.percentage,
      lastActivity: null,
    } : null,
    earlyBuyerCount: earlyBuyers.length,
    smartMoneyCount: smartMoney.length,
    source: "solana_rpc",
  };
}
