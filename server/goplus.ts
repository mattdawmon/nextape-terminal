const GOPLUS_API = "https://api.gopluslabs.io/api/v1";

const CHAIN_ID_MAP: Record<string, string> = {
  ethereum: "1",
  bsc: "56",
  base: "8453",
  arbitrum: "42161",
  polygon: "137",
  avalanche: "43114",
  optimism: "10",
};

export interface GoPlusTokenSecurity {
  is_open_source: string;
  is_proxy: string;
  is_mintable: string;
  owner_address: string;
  can_take_back_ownership: string;
  owner_change_balance: string;
  hidden_owner: string;
  selfdestruct: string;
  external_call: string;
  buy_tax: string;
  sell_tax: string;
  is_honeypot: string;
  honeypot_with_same_creator: string;
  transfer_pausable: string;
  cannot_buy: string;
  cannot_sell_all: string;
  is_anti_whale: string;
  anti_whale_modifiable: string;
  trading_cooldown: string;
  is_blacklisted: string;
  is_whitelisted: string;
  personal_slippage_modifiable: string;
  is_true_token: string;
  is_airdrop_scam: string;
  trust_list: string;
  note: string;
  holder_count: string;
  total_supply: string;
  holders: Array<{
    address: string;
    tag: string;
    is_contract: number;
    balance: string;
    percent: string;
    is_locked: number;
  }>;
  lp_holders: Array<{
    address: string;
    tag: string;
    is_contract: number;
    balance: string;
    percent: string;
    is_locked: number;
    locked_detail?: Array<{
      amount: string;
      end_time: string;
      opt_time: string;
    }>;
  }>;
  lp_total_supply: string;
  creator_address: string;
  creator_balance: string;
  creator_percent: string;
  dex: Array<{
    name: string;
    liquidity: string;
    pair: string;
  }>;
  token_name: string;
  token_symbol: string;
}

export interface TokenSecurityResult {
  isHoneypot: boolean;
  honeypotRisk: number;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isMintable: boolean;
  hasHiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  transferPausable: boolean;
  isAntiWhale: boolean;
  isBlacklisted: boolean;
  holderCount: number;
  creatorAddress: string;
  creatorPercent: number;
  lpLocked: boolean;
  lpLockPercent: number;
  lpLockDays: number;
  topHolders: Array<{
    address: string;
    percent: number;
    tag: string;
    isContract: boolean;
    isLocked: boolean;
  }>;
  lpHolders: Array<{
    address: string;
    percent: number;
    tag: string;
    isLocked: boolean;
  }>;
  dexInfo: Array<{
    name: string;
    liquidity: number;
    pair: string;
  }>;
  totalLiquidity: number;
  overallScore: number;
  raw: GoPlusTokenSecurity | null;
}

const securityCache = new Map<string, { data: TokenSecurityResult; fetchedAt: number }>();
const SECURITY_CACHE_TTL = 120_000;

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function computeSecurityScore(data: GoPlusTokenSecurity): number {
  let score = 100;

  if (data.is_honeypot === "1") score -= 40;
  if (data.cannot_buy === "1") score -= 20;
  if (data.cannot_sell_all === "1") score -= 25;

  const buyTax = parseFloat(data.buy_tax || "0");
  const sellTax = parseFloat(data.sell_tax || "0");
  if (buyTax > 0.1) score -= 15;
  else if (buyTax > 0.05) score -= 8;
  if (sellTax > 0.1) score -= 15;
  else if (sellTax > 0.05) score -= 8;

  if (data.is_open_source !== "1") score -= 12;
  if (data.is_proxy === "1") score -= 5;
  if (data.is_mintable === "1") score -= 10;
  if (data.hidden_owner === "1") score -= 12;
  if (data.can_take_back_ownership === "1") score -= 10;
  if (data.transfer_pausable === "1") score -= 8;
  if (data.selfdestruct === "1") score -= 15;
  if (data.external_call === "1") score -= 5;
  if (data.is_blacklisted === "1") score -= 5;
  if (data.is_airdrop_scam === "1") score -= 20;

  const creatorPct = parseFloat(data.creator_percent || "0") * 100;
  if (creatorPct > 20) score -= 15;
  else if (creatorPct > 10) score -= 8;
  else if (creatorPct > 5) score -= 4;

  const lpHolders = data.lp_holders || [];
  const totalLpLocked = lpHolders.reduce((sum, h) => sum + (h.is_locked ? parseFloat(h.percent || "0") : 0), 0);
  if (totalLpLocked < 0.5) score -= 10;

  if (data.trust_list === "1") score += 10;

  return Math.max(0, Math.min(100, score));
}

function parseTokenSecurity(raw: GoPlusTokenSecurity): TokenSecurityResult {
  const lpHolders = (raw.lp_holders || []).map(h => ({
    address: h.address,
    percent: parseFloat(h.percent || "0") * 100,
    tag: h.tag || "",
    isLocked: h.is_locked === 1,
  }));

  const totalLpLocked = lpHolders.reduce((sum, h) => sum + (h.isLocked ? h.percent : 0), 0);

  let lpLockDays = 0;
  for (const h of raw.lp_holders || []) {
    if (h.is_locked && h.locked_detail) {
      for (const detail of h.locked_detail) {
        const endTime = parseInt(detail.end_time || "0");
        if (endTime > 0) {
          const daysRemaining = Math.max(0, Math.floor((endTime * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
          lpLockDays = Math.max(lpLockDays, daysRemaining);
        }
      }
    }
  }

  const topHolders = (raw.holders || []).map(h => ({
    address: h.address,
    percent: parseFloat(h.percent || "0") * 100,
    tag: h.tag || "",
    isContract: h.is_contract === 1,
    isLocked: h.is_locked === 1,
  }));

  const dexInfo = (raw.dex || []).map(d => ({
    name: d.name,
    liquidity: parseFloat(d.liquidity || "0"),
    pair: d.pair,
  }));

  const totalLiquidity = dexInfo.reduce((sum, d) => sum + d.liquidity, 0);
  const sellTax = parseFloat(raw.sell_tax || "0") * 100;
  const buyTax = parseFloat(raw.buy_tax || "0") * 100;

  let honeypotRisk = 0;
  if (raw.is_honeypot === "1") honeypotRisk = 95;
  else if (raw.cannot_sell_all === "1") honeypotRisk = 80;
  else if (sellTax > 50) honeypotRisk = 70;
  else if (sellTax > 20) honeypotRisk = 40;
  else if (sellTax > 10) honeypotRisk = 20;
  else if (sellTax > 5) honeypotRisk = 10;

  return {
    isHoneypot: raw.is_honeypot === "1",
    honeypotRisk,
    buyTax,
    sellTax,
    isOpenSource: raw.is_open_source === "1",
    isMintable: raw.is_mintable === "1",
    hasHiddenOwner: raw.hidden_owner === "1",
    canTakeBackOwnership: raw.can_take_back_ownership === "1",
    transferPausable: raw.transfer_pausable === "1",
    isAntiWhale: raw.is_anti_whale === "1",
    isBlacklisted: raw.is_blacklisted === "1",
    holderCount: parseInt(raw.holder_count || "0"),
    creatorAddress: raw.creator_address || "",
    creatorPercent: parseFloat(raw.creator_percent || "0") * 100,
    lpLocked: totalLpLocked > 50,
    lpLockPercent: Math.round(totalLpLocked * 100) / 100,
    lpLockDays,
    topHolders,
    lpHolders,
    dexInfo,
    totalLiquidity,
    overallScore: computeSecurityScore(raw),
    raw,
  };
}

export async function getTokenSecurity(chain: string, contractAddress: string): Promise<TokenSecurityResult | null> {
  const chainId = CHAIN_ID_MAP[chain.toLowerCase()];
  if (!chainId) return null;

  const cacheKey = `${chain}:${contractAddress}`.toLowerCase();
  const cached = securityCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SECURITY_CACHE_TTL) {
    return cached.data;
  }

  const url = `${GOPLUS_API}/token_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`;
  const resp = await fetchWithTimeout(url);

  if (!resp || resp.code !== 1 || !resp.result) return null;

  const addrKey = Object.keys(resp.result).find(k =>
    k.toLowerCase() === contractAddress.toLowerCase()
  );
  if (!addrKey) return null;

  const raw = resp.result[addrKey] as GoPlusTokenSecurity;
  const result = parseTokenSecurity(raw);

  securityCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
  return result;
}

export function getGoPlusChainId(chain: string): string | null {
  return CHAIN_ID_MAP[chain.toLowerCase()] || null;
}

export function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() !== "solana" && chain.toLowerCase() !== "tron" && !!CHAIN_ID_MAP[chain.toLowerCase()];
}
