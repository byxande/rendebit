import type { Express, Request, Response } from "express";
import { getPurchaseById, recordProviderEvent, rejectPurchasePayment } from "../db";
import {
  getMercadoPagoPayment,
  mercadoPagoConfig,
  parsePurchaseId,
  verifyMercadoPagoWebhookSignature,
} from "../providers/mercadoPago";
import { settleMercadoPagoPurchase } from "../services/purchaseOrchestrator";

function queryValue(request: Request, key: string) {
  const value = request.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerMercadoPagoWebhook(app: Express) {
  app.post("/api/webhooks/mercado-pago", async (request: Request, response: Response) => {
    if (!mercadoPagoConfig.configured || !mercadoPagoConfig.webhookConfigured) {
      response.status(503).json({ received: false, error: "Mercado Pago não configurado" });
      return;
    }

    const signature = request.header("x-signature") ?? "";
    const requestId = request.header("x-request-id") ?? "";
    const dataId = queryValue(request, "data.id") ?? String(request.body?.data?.id ?? "");
    if (!dataId || !verifyMercadoPagoWebhookSignature({ signature, requestId, dataId })) {
      response.status(401).json({ received: false, error: "Assinatura inválida" });
      return;
    }

    const type = queryValue(request, "type") ?? request.body?.type;
    if (type !== "payment") {
      response.status(200).json({ received: true, ignored: true });
      return;
    }

    try {
      const payment = await getMercadoPagoPayment(dataId);
      const purchaseId = parsePurchaseId(payment.external_reference);
      if (!purchaseId) {
        response.status(200).json({ received: true, ignored: true });
        return;
      }
      const purchase = await getPurchaseById(purchaseId);
      if (!purchase || purchase.paymentProvider !== "mercado_pago") {
        response.status(200).json({ received: true, ignored: true });
        return;
      }
      await recordProviderEvent({
        provider: "mercado_pago",
        eventType: `payment.webhook.${payment.status}`,
        externalId: String(payment.id),
        idempotencyKey: `mp-webhook-${payment.id}-${payment.status}`,
        payload: {
          purchaseId,
          paymentId: payment.id,
          status: payment.status,
          statusDetail: payment.status_detail,
          amountBrl: payment.transaction_amount,
          signatureVerified: true,
        },
      });

      response.status(200).json({ received: true });

      if (payment.status === "approved") {
        void settleMercadoPagoPurchase({
          purchaseId,
          paymentReference: String(payment.id),
          amountBrl: Number(payment.transaction_amount ?? 0),
        }).catch(error => console.error("[Mercado Pago] Falha pós-aprovação:", error));
      } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
        void rejectPurchasePayment({ purchaseId, paymentReference: String(payment.id) })
          .catch(error => console.error("[Mercado Pago] Falha ao rejeitar compra:", error));
      }
    } catch (error) {
      console.error("[Mercado Pago] Falha ao processar webhook:", error);
      response.status(500).json({ received: false });
    }
  });
}
