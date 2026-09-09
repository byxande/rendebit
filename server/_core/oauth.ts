import { COOKIE_NAME, OAUTH_STATE_COOKIE, SOCIAL_SESSION_MS, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { authRedirect, resolveSocialProvider, validateSocialProvider } from "../services/socialAuth";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce, requestedProvider } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const resolvedProvider = resolveSocialProvider(
        (userInfo as { platforms?: unknown }).platforms,
        userInfo.loginMethod ?? userInfo.platform
      );
      const providerCheck = validateSocialProvider({
        requested: requestedProvider,
        resolved: resolvedProvider,
      });
      if (!providerCheck.ok) {
        res.redirect(302, authRedirect(
          providerCheck.reason === "provider_mismatch" ? "provider-mismatch" : "provider-unsupported",
          requestedProvider
        ));
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: providerCheck.provider,
        lastSignedIn: new Date(),
      });

      const storedUser = await db.getUserByOpenId(userInfo.openId);
      if (storedUser) {
        await db.recordAuthEvent({
          userId: storedUser.id,
          provider: providerCheck.provider,
          eventType: "sign_in",
        });
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SOCIAL_SESSION_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SOCIAL_SESSION_MS });

      res.redirect(302, authRedirect("success", providerCheck.provider));
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.redirect(302, authRedirect("failed"));
    }
  });
}
