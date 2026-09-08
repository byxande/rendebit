import {
  Pc,
  broadcastTransaction,
  cvToValue,
  deserializeTransaction,
  fetchAbi,
  fetchCallReadOnlyFunction,
  getAddressFromPrivateKey,
  makeContractCall,
  principalCV,
  transactionToHex,
  uintCV,
} from "@stacks/transactions";
import { c32addressDecode, versions } from "c32check";
import { getProviderEventByIdempotencyKey, recordProviderEvent } from "../db";
import type { YieldProvider } from "./types";

export const OFFICIAL_SBTC_TESTNET_CONTRACT = "SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token";
const DEFAULT_TESTNET_API = "https://api.testnet.hiro.so";
const DEFAULT_SENDER = "ST000000000000000000002AMW42H";
const RATIO_SCALE = BigInt(100_000_000);

type ContractId = `${string}.${string}`;

type StacksTestnetConfig = {
  mode: "sandbox" | "testnet";
  apiUrl: string;
  sbtcContract: ContractId;
  stbtcCoreContract?: ContractId;
  stbtcTokenContract?: ContractId;
  stbtcDataContract?: ContractId;
  signerPrivateKey?: string;
  slippageBps: number;
  confirmationTimeoutMs: number;
};

type ContractCheck = {
  contract: string;
  configured: boolean;
  deployed: boolean;
  expectedFunctions: string[];
  missingFunctions: string[];
  error?: string;
};

function splitContract(contract: string): { address: string; name: string } {
  const separator = contract.indexOf(".");
  if (separator <= 0 || separator === contract.length - 1) throw new Error(`Principal de contrato inválido: ${contract}`);
  return { address: contract.slice(0, separator), name: contract.slice(separator + 1) };
}

function testnetPrincipal(contract: string): ContractId {
  const { address, name } = splitContract(contract);
  const [version] = c32addressDecode(address);
  if (version !== versions.testnet.p2pkh && version !== versions.testnet.p2sh) {
    throw new Error(`O contrato ${address}.${name} não pertence à Stacks testnet.`);
  }
  return `${address}.${name}`;
}

function optionalTestnetPrincipal(value?: string): ContractId | undefined {
  const normalized = value?.trim();
  return normalized ? testnetPrincipal(normalized) : undefined;
}

function normalizePrivateKey(value?: string) {
  const normalized = value?.trim().replace(/^0x/, "");
  if (!normalized) return undefined;
  if (!/^[0-9a-fA-F]{64}(01)?$/.test(normalized)) throw new Error("STACKS_TESTNET_SIGNER_PRIVATE_KEY possui formato inválido.");
  return normalized;
}

function integerEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function loadStacksTestnetConfig(env: NodeJS.ProcessEnv = process.env): StacksTestnetConfig {
  const requestedMode = env.STACKS_YIELD_MODE === "testnet" ? "testnet" : "sandbox";
  return {
    mode: requestedMode,
    apiUrl: (env.STACKS_TESTNET_API_URL || DEFAULT_TESTNET_API).replace(/\/+$/, ""),
    sbtcContract: testnetPrincipal(env.STACKS_TESTNET_SBTC_CONTRACT || OFFICIAL_SBTC_TESTNET_CONTRACT),
    stbtcCoreContract: optionalTestnetPrincipal(env.STACKS_TESTNET_STBTC_CORE_CONTRACT),
    stbtcTokenContract: optionalTestnetPrincipal(env.STACKS_TESTNET_STBTC_TOKEN_CONTRACT),
    stbtcDataContract: optionalTestnetPrincipal(env.STACKS_TESTNET_STBTC_DATA_CONTRACT),
    signerPrivateKey: normalizePrivateKey(env.STACKS_TESTNET_SIGNER_PRIVATE_KEY),
    slippageBps: integerEnv(env.STACKS_TESTNET_SLIPPAGE_BPS, 50, 0, 500),
    confirmationTimeoutMs: integerEnv(env.STACKS_TESTNET_CONFIRMATION_TIMEOUT_MS, 120_000, 10_000, 600_000),
  };
}

export function btcStringToSats(btcAmount: string) {
  const match = btcAmount.trim().match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) throw new Error("Quantidade BTC inválida; use no máximo 8 casas decimais.");
  return BigInt(match[1]) * RATIO_SCALE + BigInt((match[2] || "").padEnd(8, "0"));
}

export function calculateMinSharesOut(amountSats: bigint, sbtcPerStbtc: bigint, slippageBps: number) {
  if (amountSats <= BigInt(0) || sbtcPerStbtc <= BigInt(0)) throw new Error("Valores de depósito e taxa precisam ser positivos.");
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 500) throw new Error("Slippage fora do intervalo permitido.");
  const quotedShares = amountSats * RATIO_SCALE / sbtcPerStbtc;
  return quotedShares * BigInt(10_000 - slippageBps) / BigInt(10_000);
}

function readClarityUint(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (value && typeof value === "object" && "value" in value) return readClarityUint((value as { value: unknown }).value);
  throw new Error("Resposta Clarity não contém um uint válido.");
}

async function checkContract(contract: ContractId | undefined, expectedFunctions: string[]): Promise<ContractCheck> {
  if (!contract) return { contract: "não configurado", configured: false, deployed: false, expectedFunctions, missingFunctions: expectedFunctions };
  const { address, name } = splitContract(contract);
  try {
    const abi = await fetchAbi({ contractAddress: address, contractName: name, network: "testnet" });
    const names = new Set(abi.functions.map(fn => fn.name));
    const missingFunctions = expectedFunctions.filter(fn => !names.has(fn));
    return { contract, configured: true, deployed: missingFunctions.length === 0, expectedFunctions, missingFunctions };
  } catch (error) {
    return {
      contract,
      configured: true,
      deployed: false,
      expectedFunctions,
      missingFunctions: expectedFunctions,
      error: error instanceof Error ? error.message : "Falha ao consultar ABI",
    };
  }
}

export async function getStacksTestnetStatus(env: NodeJS.ProcessEnv = process.env) {
  let config: StacksTestnetConfig;
  try {
    config = loadStacksTestnetConfig(env);
  } catch (error) {
    return { network: "testnet" as const, ready: false, mode: "sandbox" as const, error: error instanceof Error ? error.message : "Configuração inválida" };
  }

  const [sbtc, stbtcCore, stbtcToken, stbtcData] = await Promise.all([
    checkContract(config.sbtcContract, ["get-balance", "get-balance-available", "get-decimals", "transfer"]),
    checkContract(config.stbtcCoreContract, ["deposit"]),
    checkContract(config.stbtcTokenContract, ["get-balance", "get-decimals", "transfer"]),
    checkContract(config.stbtcDataContract, ["get-sbtc-per-stbtc-up"]),
  ]);
  const signerAddress = config.signerPrivateKey ? getAddressFromPrivateKey(config.signerPrivateKey, "testnet") : undefined;
  const ready = config.mode === "testnet" && Boolean(signerAddress) && [sbtc, stbtcCore, stbtcToken, stbtcData].every(item => item.deployed);
  return {
    network: "testnet" as const,
    mode: config.mode,
    ready,
    signerConfigured: Boolean(signerAddress),
    signerAddress,
    slippageBps: config.slippageBps,
    contracts: { sbtc, stbtcCore, stbtcToken, stbtcData },
    blocker: ready ? undefined : "Ative o modo testnet, configure o signer e informe um deployment stBTC testnet verificável.",
  };
}

async function readContractUint(contract: ContractId, functionName: string, senderAddress: string, functionArgs: Parameters<typeof fetchCallReadOnlyFunction>[0]["functionArgs"] = []) {
  const { address, name } = splitContract(contract);
  const clarityValue = await fetchCallReadOnlyFunction({
    contractAddress: address,
    contractName: name,
    functionName,
    functionArgs,
    senderAddress,
    network: "testnet",
  });
  return readClarityUint(cvToValue(clarityValue));
}

async function getTransactionStatus(txid: string, apiUrl: string) {
  const response = await fetch(`${apiUrl}/extended/v1/tx/${txid}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Falha ao consultar transação ${txid}: HTTP ${response.status}.`);
  return response.json() as Promise<{ tx_status?: string; tx_result?: { repr?: string } }>;
}

async function waitForTransaction(txid: string, apiUrl: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const transaction = await getTransactionStatus(txid, apiUrl);
    if (transaction) {
      if (transaction.tx_status === "success") return transaction;
      if (transaction.tx_status && transaction.tx_status !== "pending") {
        throw new Error(`Transação stBTC terminou com status ${transaction.tx_status}: ${transaction.tx_result?.repr || "sem detalhe"}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 3_000));
  }
  throw new Error(`Tempo esgotado aguardando confirmação da transação ${txid}.`);
}

export async function buildStbtcDepositTransaction(input: {
  coreContract: ContractId;
  sbtcContract: ContractId;
  signerPrivateKey: string;
  amountSats: bigint;
  minSharesOut: bigint;
  fee?: number;
  nonce?: number;
}) {
  const core = splitContract(testnetPrincipal(input.coreContract));
  const sbtcContract = testnetPrincipal(input.sbtcContract);
  const senderAddress = getAddressFromPrivateKey(input.signerPrivateKey, "testnet");
  return makeContractCall({
    contractAddress: core.address,
    contractName: core.name,
    functionName: "deposit",
    functionArgs: [uintCV(input.amountSats), uintCV(input.minSharesOut)],
    senderKey: input.signerPrivateKey,
    network: "testnet",
    fee: input.fee,
    nonce: input.nonce,
    postConditionMode: "deny",
    postConditions: [Pc.principal(senderAddress).willSendEq(input.amountSats).ft(sbtcContract, "sbtc-token")],
    validateWithAbi: false,
  });
}

export function createStacksTestnetYieldProvider(env: NodeJS.ProcessEnv = process.env): YieldProvider {
  return {
    provider: "stacks_testnet",
    network: "testnet",
    async preflight() {
      const status = await getStacksTestnetStatus(env);
      if (!status.ready) throw new Error(status.blocker || status.error || "Integração Stacks testnet indisponível.");
    },

    async activatePosition({ btcAmount, idempotencyKey }) {
      const config = loadStacksTestnetConfig(env);
      if (config.mode !== "testnet" || !config.signerPrivateKey || !config.stbtcCoreContract || !config.stbtcDataContract) {
        throw new Error("Integração stBTC testnet não está totalmente configurada.");
      }

      const intentKey = `${idempotencyKey}:signed-transaction`;
      const existingIntent = await getProviderEventByIdempotencyKey(intentKey);
      let txid: string;
      let signedTransaction: string;
      let amountSats: bigint;
      let minSharesOut: bigint;
      let ratio: bigint;

      if (existingIntent) {
        const payload = JSON.parse(existingIntent.payload) as { txid: string; signedTransaction: string; amountSats: string; minSharesOut: string; ratio: string };
        txid = payload.txid;
        signedTransaction = payload.signedTransaction;
        amountSats = BigInt(payload.amountSats);
        minSharesOut = BigInt(payload.minSharesOut);
        ratio = BigInt(payload.ratio);
      } else {
        const senderAddress = getAddressFromPrivateKey(config.signerPrivateKey, "testnet");
        amountSats = btcStringToSats(btcAmount);
        if (amountSats <= BigInt(0)) throw new Error("A posição precisa ser maior que zero.");

        const sbtcBalance = await readContractUint(config.sbtcContract, "get-balance-available", senderAddress, [principalCV(senderAddress)]);
        if (sbtcBalance < amountSats) throw new Error(`Saldo sBTC testnet insuficiente: ${sbtcBalance} sats disponíveis para ${amountSats} sats.`);

        ratio = await readContractUint(config.stbtcDataContract, "get-sbtc-per-stbtc-up", senderAddress);
        if (ratio <= BigInt(0)) throw new Error("Taxa stBTC/sBTC inválida.");
        minSharesOut = calculateMinSharesOut(amountSats, ratio, config.slippageBps);
        const transaction = await buildStbtcDepositTransaction({
          coreContract: config.stbtcCoreContract,
          sbtcContract: config.sbtcContract,
          signerPrivateKey: config.signerPrivateKey,
          amountSats,
          minSharesOut,
        });
        txid = transaction.txid();
        signedTransaction = transactionToHex(transaction);
        await recordProviderEvent({
          provider: "stacks_testnet",
          eventType: "yield.deposit.signed",
          externalId: txid,
          idempotencyKey: intentKey,
          payload: { txid, signedTransaction, amountSats: amountSats.toString(), minSharesOut: minSharesOut.toString(), ratio: ratio.toString(), network: "testnet" },
        });
      }

      const current = await getTransactionStatus(txid, config.apiUrl);
      if (!current) {
        const broadcast = await broadcastTransaction({ transaction: deserializeTransaction(signedTransaction), network: "testnet" });
        if (!("txid" in broadcast) || "error" in broadcast) {
          const rejection = broadcast as { error?: string; reason?: string };
          throw new Error(`Broadcast stBTC rejeitado: ${rejection.reason || rejection.error || "motivo desconhecido"}.`);
        }
      }
      await waitForTransaction(txid, config.apiUrl, config.confirmationTimeoutMs);

      return {
        externalId: txid,
        status: "active",
        payload: {
          btcAmount,
          route: "BTC>sBTC>stBTC",
          network: "testnet",
          txid,
          amountSats: amountSats.toString(),
          minSharesOut: minSharesOut.toString(),
          ratio: ratio.toString(),
        },
      };
    },
  };
}
