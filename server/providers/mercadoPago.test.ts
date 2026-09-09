import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../_core/env";
import { createMercadoPagoPaymentProvider, parsePurchaseId, verifyMercadoPagoWebhookSignature } from "./mercadoPago";

const originalAccessToken = ENV.mercadoPagoAccessToken;

afterEach(() => {
  ENV.mercadoPagoAccessToken = originalAccessToken;
  vi.unstubAllGlobals();
});

describe("Mercado Pago webhook", () => {
  it("valida a assinatura HMAC documentada", () => {
    const secret = "webhook-secret";
    const dataId = "123456";
    const requestId = "request-abc";
    const timestamp = "1742505638683";
    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    expect(verifyMercadoPagoWebhookSignature({
      signature: `ts=${timestamp},v1=${signature}`,
      requestId,
      dataId,
      secret,
    })).toBe(true);
  });

  it("rejeita assinatura alterada", () => {
    expect(verifyMercadoPagoWebhookSignature({
      signature: `ts=1742505638683,v1=${"0".repeat(64)}`,
      requestId: "request-abc",
      dataId: "123456",
      secret: "webhook-secret",
    })).toBe(false);
  });

  it("extrai somente referências de compra RendeBit válidas", () => {
    expect(parsePurchaseId("rendebit-purchase-42")).toBe(42);
    expect(parsePurchaseId("other-42")).toBeNull();
  });

  it("cria checkout hospedado sem expor o token ao cliente", async () => {
    ENV.mercadoPagoAccessToken = "TEST-access-token";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "preference-42",
      sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=42",
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createMercadoPagoPaymentProvider().createCheckout({
      purchaseId: 42,
      amountBrl: "1000.00",
      payerEmail: "user@example.com",
      paymentMethod: "credit_card",
      idempotencyKey: "purchase-42:payment",
      returnBaseUrl: "https://app.rendebit.com.br",
    });

    expect(result.status).toBe("pending");
    expect(result.payload.checkoutUrl).toContain("sandbox.mercadopago.com.br");
    const [, request] = fetchMock.mock.calls[0];
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer TEST-access-token",
      "X-Idempotency-Key": "purchase-42:payment",
    });
    const body = JSON.parse(String(request?.body));
    expect(body.external_reference).toBe("rendebit-purchase-42");
    expect(body.notification_url).toBe("https://app.rendebit.com.br/api/webhooks/mercado-pago");
    expect(body.metadata.payment_method_intent).toBe("credit_card");
  });
});
