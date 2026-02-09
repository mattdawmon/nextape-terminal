import { Keypair, Connection, VersionedTransaction, Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import { createWalletClient, http, type Hex, createPublicClient, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, bsc } from "viem/chains";

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const EVM_CHAINS: Record<string, { chain: any; rpc: string; router: string; weth: string; explorer: string }> = {
  ethereum: {
    chain: mainnet,
    rpc: "https://eth.llamarpc.com",
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    explorer: "https://etherscan.io",
  },
  base: {
    chain: base,
    rpc: "https://mainnet.base.org",
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    weth: "0x4200000000000000000000000000000000000006",
    explorer: "https://basescan.org",
  },
  bsc: {
    chain: bsc,
    rpc: "https://bsc-dataseed.binance.org",
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    explorer: "https://bscscan.com",
  },
};

export interface SwapResult {
  success: boolean;
  txHash: string;
  explorerUrl: string;
  error?: string;
}

export async function executeSolanaSwap(
  privateKeyHex: string,
  tokenAddress: string,
  amount: number,
  side: "buy" | "sell",
  slippageBps: number = 100
): Promise<SwapResult> {
  try {
    const secretKey = Buffer.from(privateKeyHex, "hex");
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    const connection = new Connection(SOLANA_RPC, "confirmed");

    const inputMint = side === "buy" ? SOL_MINT : tokenAddress;
    const outputMint = side === "buy" ? tokenAddress : SOL_MINT;

    let inputDecimals = 9;
    if (side === "sell") {
      try {
        const mintPubkey = new PublicKey(tokenAddress);
        const accInfo = await connection.getParsedAccountInfo(mintPubkey);
        if (accInfo.value && "parsed" in (accInfo.value.data as any)) {
          inputDecimals = (accInfo.value.data as any).parsed.info.decimals ?? 6;
        } else {
          inputDecimals = 6;
        }
      } catch {
        inputDecimals = 6;
      }
    }

    const baseUnits = Math.floor(amount * Math.pow(10, inputDecimals));

    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: baseUnits.toString(),
      slippageBps: slippageBps.toString(),
    });

    const quoteResp = await fetch(`${JUPITER_QUOTE_API}/quote?${quoteParams}`);
    if (!quoteResp.ok) {
      const errText = await quoteResp.text();
      return { success: false, txHash: "", explorerUrl: "", error: `Jupiter quote failed: ${errText}` };
    }
    const quoteData = await quoteResp.json();

    const swapResp = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!swapResp.ok) {
      const errText = await swapResp.text();
      return { success: false, txHash: "", explorerUrl: "", error: `Jupiter swap build failed: ${errText}` };
    }

    const swapData = await swapResp.json();
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");

    let txHash: string;

    try {
      const versionedTx = VersionedTransaction.deserialize(new Uint8Array(swapTransactionBuf));
      versionedTx.sign([keypair]);
      const rawTx = versionedTx.serialize();
      txHash = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });
    } catch (versionedErr: any) {
      try {
        const legacyTx = Transaction.from(swapTransactionBuf);
        legacyTx.sign(keypair);
        txHash = await connection.sendRawTransaction(legacyTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      } catch (legacyErr: any) {
        return {
          success: false,
          txHash: "",
          explorerUrl: "",
          error: `Transaction signing failed: ${versionedErr.message || legacyErr.message}`,
        };
      }
    }

    return {
      success: true,
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
    };
  } catch (err: any) {
    return {
      success: false,
      txHash: "",
      explorerUrl: "",
      error: err.message || "Solana swap failed",
    };
  }
}

function padAddress(addr: string): string {
  return addr.replace("0x", "").toLowerCase().padStart(64, "0");
}

function padUint256(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

const SWAP_ETH_FOR_TOKENS_SIG = "0x7ff36ab5";
const SWAP_TOKENS_FOR_ETH_SIG = "0x18cbafe5";
const APPROVE_SIG = "0x095ea7b3";

export async function executeEvmSwap(
  privateKeyHex: string,
  chainName: string,
  tokenAddress: string,
  amount: number,
  side: "buy" | "sell",
  slippageBps: number = 100
): Promise<SwapResult> {
  try {
    const config = EVM_CHAINS[chainName];
    if (!config) {
      return { success: false, txHash: "", explorerUrl: "", error: `Unsupported EVM chain: ${chainName}` };
    }

    const pkHex = (privateKeyHex.startsWith("0x") ? privateKeyHex : `0x${privateKeyHex}`) as Hex;
    const account = privateKeyToAccount(pkHex);

    const walletClient = createWalletClient({
      account,
      chain: config.chain,
      transport: http(config.rpc),
    });

    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpc),
    });

    const isBuy = side === "buy";
    const tokenDecimals = await fetchTokenDecimalsRpc(tokenAddress, config.rpc);
    const inputDecimals = isBuy ? 18 : tokenDecimals;
    const amountWei = parseUnits(amount.toString(), inputDecimals);

    const path = isBuy
      ? [config.weth, tokenAddress]
      : [tokenAddress, config.weth];

    const estimatedOutput = await getAmountsOut(amountWei, path, config.router, config.rpc);
    const slippageFactor = BigInt(10000 - Math.floor(slippageBps));
    const amountOutMin = (estimatedOutput * slippageFactor) / BigInt(10000);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    let lastHash: string = "";

    if (isBuy) {
      const calldata = buildSwapETHForTokens(amountOutMin, path, account.address, deadline);
      const hash = await walletClient.sendTransaction({
        chain: config.chain,
        to: config.router as Hex,
        data: calldata as Hex,
        value: amountWei,
      });
      lastHash = hash;
    } else {
      const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const approveData = APPROVE_SIG + padAddress(config.router) + padUint256(maxApproval);
      try {
        const approveHash = await walletClient.sendTransaction({
          chain: config.chain,
          to: tokenAddress as Hex,
          data: (`0x${approveData.replace("0x", "")}`) as Hex,
          value: BigInt(0),
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash as Hex });
      } catch (approveErr: any) {
        console.log("Approve may already exist or failed:", approveErr.message);
      }

      const calldata = buildSwapTokensForETH(amountWei, amountOutMin, path, account.address, deadline);
      const hash = await walletClient.sendTransaction({
        chain: config.chain,
        to: config.router as Hex,
        data: calldata as Hex,
        value: BigInt(0),
      });
      lastHash = hash;
    }

    return {
      success: true,
      txHash: lastHash,
      explorerUrl: `${config.explorer}/tx/${lastHash}`,
    };
  } catch (err: any) {
    return {
      success: false,
      txHash: "",
      explorerUrl: "",
      error: err.message || "EVM swap failed",
    };
  }
}

async function fetchTokenDecimalsRpc(tokenAddress: string, rpcUrl: string): Promise<number> {
  try {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: tokenAddress, data: "0x313ce567" }, "latest"],
        id: 1,
      }),
    });
    const data = await resp.json();
    if (data.result && data.result !== "0x") {
      return Number(BigInt(data.result));
    }
  } catch {}
  return 18;
}

async function getAmountsOut(amountIn: bigint, path: string[], router: string, rpcUrl: string): Promise<bigint> {
  const selector = "0xd06ca61f";
  const calldata = selector +
    padUint256(amountIn) +
    padUint256(BigInt(64)) +
    padUint256(BigInt(path.length)) +
    path.map(p => padAddress(p)).join("");

  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: router, data: calldata }, "latest"],
      id: 1,
    }),
  });
  const data = await resp.json();
  if (data.result && data.result !== "0x") {
    const hex = data.result.slice(2);
    return BigInt("0x" + hex.slice(-64));
  }
  return BigInt(0);
}

function buildSwapETHForTokens(amountOutMin: bigint, path: string[], to: string, deadline: bigint): string {
  return SWAP_ETH_FOR_TOKENS_SIG +
    padUint256(amountOutMin) +
    padUint256(BigInt(128)) +
    padAddress(to) +
    padUint256(deadline) +
    padUint256(BigInt(path.length)) +
    path.map(p => padAddress(p)).join("");
}

function buildSwapTokensForETH(amountIn: bigint, amountOutMin: bigint, path: string[], to: string, deadline: bigint): string {
  return SWAP_TOKENS_FOR_ETH_SIG +
    padUint256(amountIn) +
    padUint256(amountOutMin) +
    padUint256(BigInt(160)) +
    padAddress(to) +
    padUint256(deadline) +
    padUint256(BigInt(path.length)) +
    path.map(p => padAddress(p)).join("");
}
