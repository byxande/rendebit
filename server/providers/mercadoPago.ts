import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";
import type { PurchasePaymentMethod, PurchasePaymentProvider } from "./types";

const MP_API = "https://api.mercadopago.com";

export const mercadoPagoConfig = {
  provider: "mercado_pago" as const,
  checkout: "Checkout Pro (Preferences API)",
  configured: Boolean(ENV.mercadoPagoAccessToken),
  webhookConfigured: Boolean(ENV.mercadoPagoWebhookSecret),
  mode: ENV.mercadoPagoMode,
  role: "Receber BRL por Pix ou cartão; não compra BTC" as const,
};

type MercadoPagoPreference = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
};

function assertConfigured() {
  if (!ENV.mercadoPagoAccessToken) {
    throw new Error("Mercado Pago não configurado. Adicione MERCADO_PAGO_ACCESS_TOKEN aos secrets do backend.");
  }
}

async function mercadoPagoRequest<T>(path: string, init: RequestInit = {}) {
  assertConfigured();
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ENV.mercadoPagoAccessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `HTTP ${response.status}`;
    throw new Error(`Mercado Pago recusou a solicitação: ${message}`);
  }
  return payload as T;
}

export function createMercadoPagoPaymentProvider(): PurchasePaymentProvider {
  return {
    provider: "mercado_pago",
    mode: ENV.mercadoPagoMode,
    async createCheckout({ purchaseId, amountBrl, payerEmail, paymentMethod, idempotencyKey, returnBaseUrl }) {
      const baseUrl = returnBaseUrl.replace(/\/$/, "");
      const preference = await mercadoPagoRequest<MercadoPagoPreference>("/checkout/preferences", {
        method: "POST",
        headers: { "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          items: [{
            id: `rendebit-btc-${purchaseId}`,
            title: "Aporte RendeBit",
            description: "Pagamento em BRL para compra e aplicação de Bitcoin",
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(amountBrl),
          }],
          payer: payerEmail ? { email: payerEmail } : undefined,
          external_reference: `rendebit-purchase-${purchaseId}`,
          statement_descriptor: "RENDEBIT",
          back_urls: {
            success: `${baseUrl}/?view=lotes&payment=approved`,
            pending: `${baseUrl}/?view=lotes&payment=pending`,
            failure: `${baseUrl}/?view=lotes&payment=failure`,
          },
          auto_return: "approved",
          notification_url: `${baseUrl}/api/webhooks/mercado-pago`,
          metadata: { purchase_id: purchaseId, payment_method_intent: paymentMethod },
        }),
      });
      const checkoutUrl = ENV.mercadoPagoMode === "production"
        ? preference.init_point
        : preference.sandbox_init_point ?? preference.init_point;
      if (!preference.id || !checkoutUrl) throw new Error("Mercado Pago não retornou uma URL de checkout válida.");
      return {
        externalId: preference.id,
        status: "pending",
        payload: { checkoutUrl, paymentMethod, paymentStatus: "pending" },
      };
    },
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  return mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

export function verifyMercadoPagoWebhookSignature(input: {
  signature: string;
  requestId: string;
  dataId: string;
  secret?: string;
}) {
  const secret = input.secret ?? ENV.mercadoPagoWebhookSecret;
  if (!secret) return false;
  const parts = Object.fromEntries(input.signature.split(",").map(part => part.trim().split("=", 2)));
  const timestamp = parts.ts;
  const received = parts.v1;
  if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const dataId = /[a-z]/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest = `id:${dataId};request-id:${input.requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function parsePurchaseId(externalReference?: string) {
  const match = externalReference?.match(/^rendebit-purchase-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function normalizeMercadoPagoMethod(payment: MercadoPagoPayment): PurchasePaymentMethod {
  return payment.payment_type_id === "credit_card" ? "credit_card" : "pix";
}
