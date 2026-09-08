import { describe, expect, it } from "vitest";
import { transactionToHex } from "@stacks/transactions";
import {
  OFFICIAL_SBTC_TESTNET_CONTRACT,
  btcStringToSats,
  buildStbtcDepositTransaction,
  calculateMinSharesOut,
  getStacksTestnetStatus,
  loadStacksTestnetConfig,
} from "./stacksTestnet";

describe("Stacks testnet yield provider", () => {
  it("usa o contrato sBTC testnet oficial e mantém execução real desativada por padrão", () => {
    const config = loadStacksTestnetConfig({});
    expect(config.sbtcContract).toBe(OFFICIAL_SBTC_TESTNET_CONTRACT);
    expect(config.mode).toBe("sandbox");
    expect(config.signerPrivateKey).toBeUndefined();
  });

  it("converte BTC para unidades de 8 casas sem ponto flutuante", () => {
    expect(btcStringToSats("0.00247144")).toBe(BigInt(247144));
    expect(btcStringToSats("1")).toBe(BigInt(100_000_000));
    expect(() => btcStringToSats("0.000000001")).toThrow("no máximo 8 casas");
  });

  it("calcula min-shares-out usando a taxa on-chain e slippage limitado", () => {
    expect(calculateMinSharesOut(BigInt(100_000_000), BigInt(125_000_000), 50)).toBe(BigInt(79_600_000));
    expect(() => calculateMinSharesOut(BigInt(1), BigInt(1), 501)).toThrow("Slippage");
  });

  it("rejeita contratos mainnet em uma configuração testnet", () => {
    expect(() => loadStacksTestnetConfig({
      STACKS_TESTNET_STBTC_CORE_CONTRACT: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1",
    })).toThrow("não pertence à Stacks testnet");
  });

  it("constrói e assina uma chamada deposit testnet com postcondition sBTC", async () => {
    const transaction = await buildStbtcDepositTransaction({
      coreContract: "ST000000000000000000002AMW42H.stbtc-core-test",
      sbtcContract: OFFICIAL_SBTC_TESTNET_CONTRACT,
      signerPrivateKey: `${"1".padStart(64, "0")}01`,
      amountSats: BigInt(100_000),
      minSharesOut: BigInt(99_000),
      fee: 1_000,
      nonce: 0,
    });
    const serialized = transactionToHex(transaction);
    expect(serialized.length).toBeGreaterThan(400);
    expect(transaction.postConditions.values).toHaveLength(1);
  });

  it("confirma o ABI do sBTC oficial e bloqueia stBTC não configurado", async () => {
    const status = await getStacksTestnetStatus({ STACKS_YIELD_MODE: "testnet" });
    expect(status.ready).toBe(false);
    expect(status.contracts?.sbtc.deployed).toBe(true);
    expect(status.contracts?.sbtc.missingFunctions).toEqual([]);
    expect(status.contracts?.stbtcCore.configured).toBe(false);
    expect(status.blocker).toContain("deployment stBTC testnet");
  }, 30_000);
});
