import { beforeEach, describe, expect, it, vi } from "vitest";

const xverseMock = vi.hoisted(() => ({
  request: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("sats-connect", () => ({
  default: xverseMock,
  AddressPurpose: { Stacks: "stacks" },
  BitcoinNetworkType: { Testnet: "Testnet" },
}));

import { connectXverse, signStacksTransaction } from "../client/src/lib/xverse";

describe("Xverse wallet adapter", () => {
  beforeEach(() => {
    xverseMock.request.mockReset();
    xverseMock.disconnect.mockReset();
  });

  it("conecta com consentimento e preserva somente o endereço e a chave pública", async () => {
    xverseMock.request.mockResolvedValue({
      status: "success",
      result: {
        addresses: [
          {
            address: "ST2J8EVYHP16A7KTF8VGDXVG7Z2WZK4DMCYNEQ26",
            publicKey: "02ab",
            purpose: "stacks",
            walletType: "software",
          },
        ],
        network: { stacks: { name: "testnet" } },
      },
    });

    await expect(connectXverse()).resolves.toEqual({
      address: "ST2J8EVYHP16A7KTF8VGDXVG7Z2WZK4DMCYNEQ26",
      publicKey: "02ab",
      network: "testnet",
      walletType: "software",
    });
    expect(xverseMock.request).toHaveBeenCalledWith("wallet_connect", {
      addresses: ["stacks"],
      network: "Testnet",
      message: "Conectar a carteira Stacks pública à RendeBit.",
    });
  });

  it("pede assinatura sem broadcast automático por padrão", async () => {
    xverseMock.request.mockResolvedValue({
      status: "success",
      result: { transaction: "deadbeef" },
    });

    await expect(signStacksTransaction("aabbcc")).resolves.toEqual({
      transaction: "deadbeef",
    });
    expect(xverseMock.request).toHaveBeenCalledWith("stx_signTransaction", {
      transaction: "aabbcc",
      broadcast: false,
    });
  });

  it("propaga a rejeição visível da carteira", async () => {
    xverseMock.request.mockResolvedValue({
      status: "error",
      error: { code: -32000, message: "Usuário recusou a conexão" },
    });

    await expect(connectXverse()).rejects.toThrow("Usuário recusou a conexão");
  });
});
