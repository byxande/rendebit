import type { Request, Response } from "express";
import {
  getTreasurySettingsByReconciliationTask,
  reconcileDailyTreasury,
} from "../db";
import { sdk, type AuthenticatedUser } from "../_core/sdk";

export async function runDailyReconciliationHeartbeat(
  req: Request,
  res: Response
) {
  let user: AuthenticatedUser;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  try {
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }
    const settings = await getTreasurySettingsByReconciliationTask(
      user.taskUid
    );
    if (!settings) {
      return res.json({ ok: true, skipped: "orphan" });
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const reconciliation = await reconcileDailyTreasury(
      settings.ownerUserId,
      dateKey
    );
    return res.json({
      ok: true,
      dateKey,
      reconciliationId: reconciliation.id,
      status: reconciliation.status,
      exceptions: reconciliation.exceptions
        ? JSON.parse(reconciliation.exceptions)
        : [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Heartbeat] daily reconciliation failed", error);
    return res.status(500).json({
      error: message,
      context: { path: req.path },
      timestamp: new Date().toISOString(),
    });
  }
}
