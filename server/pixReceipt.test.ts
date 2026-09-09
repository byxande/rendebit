import { describe, expect, it } from "vitest";
import { createPixReceiptPdf } from "../client/src/lib/pixReceipt";

describe("comprovante Pix demonstrativo", () => {
  it("gera um PDF com valor, status e referências do depósito", async () => {
    const receipt = createPixReceiptPdf({
      id: 42,
      amountBrl: "500.00",
      status: "paid",
      pixCopyPaste: "0002012658RENDEBIT",
      qrCodeText: "0002012658RENDEBIT",
      providerReference: "pix-charge-sandbox-42",
      endToEndId: "E00000000000000000042",
      expiresAt: new Date("2026-09-09T12:00:00.000Z"),
      paidAt: new Date("2026-09-09T11:01:00.000Z"),
      createdAt: new Date("2026-09-09T10:59:00.000Z"),
    });

    expect(receipt.type).toBe("application/pdf");
    const content = await receipt.text();
    expect(content).toMatch(/^%PDF-1.4/);
    expect(content).toContain("RENDEBIT  |  PIX");
    expect(content).toContain("R$ 500,00");
    expect(content).toContain("pix-charge-sandbox-42");
    expect(content).toContain("E00000000000000000042");
    expect(content).toContain("demonstrativo");
  });
});
