import { describe, expect, it } from "vitest";
import { assertBrazilianCustomer } from "./brazilEligibility";

const verifiedProfile = {
  country: "BR",
  verificationStatus: "verified",
  pixOwnershipConfirmed: true,
  pixAccountMasked: "Banco •••• 1234",
};

describe("elegibilidade brasileira", () => {
  it("aceita residente brasileiro verificado com Pix próprio", () => {
    expect(assertBrazilianCustomer(verifiedProfile, { requirePix: true })).toBe(verifiedProfile);
  });

  it("bloqueia cadastro de outro país", () => {
    expect(() => assertBrazilianCustomer({ ...verifiedProfile, country: "US" }))
      .toThrow("exclusiva para residentes no Brasil");
  });

  it("bloqueia CPF ainda não verificado", () => {
    expect(() => assertBrazilianCustomer({ ...verifiedProfile, verificationStatus: "pending" }))
      .toThrow("verificação do seu CPF");
  });

  it("exige conta Pix de mesma titularidade quando necessário", () => {
    expect(() => assertBrazilianCustomer({ ...verifiedProfile, pixOwnershipConfirmed: false }, { requirePix: true }))
      .toThrow("conta Pix da sua titularidade");
  });
});
