import { describe, expect, it } from "vitest";
import { canUseXverseForAutomatedYield, xverseCapabilities } from "./xverse";

describe("Xverse integration boundary", () => {
  it("permite dados e transmissão de transação Bitcoin já assinada", () => {
    expect(xverseCapabilities.xverseApi.bitcoinDataAndRpc).toBe(true);
    expect(xverseCapabilities.xverseApi.broadcastSignedBitcoinTransaction).toBe(true);
  });

  it("não classifica a Xverse como motor custodial de rendimento automático", () => {
    expect(xverseCapabilities.xverseApi.holdsOrganizationKeys).toBe(false);
    expect(xverseCapabilities.xverseApi.signsServerSide).toBe(false);
    expect(xverseCapabilities.satsConnect.requiresVisibleUserApproval).toBe(true);
    expect(canUseXverseForAutomatedYield()).toBe(false);
  });
});
