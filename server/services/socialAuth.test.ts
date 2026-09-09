import { describe, expect, it } from "vitest";
import {
  buildManagedOAuthUrl,
  decodeOAuthState,
  encodeOAuthState,
} from "@shared/const";
import {
  authRedirect,
  normalizeSocialProvider,
  resolveSocialProvider,
  validateSocialProvider,
} from "./socialAuth";

describe("autenticação social", () => {
  it("normaliza as plataformas Google e Apple do provedor gerenciado", () => {
    expect(normalizeSocialProvider("REGISTERED_PLATFORM_GOOGLE")).toBe("google");
    expect(normalizeSocialProvider("apple")).toBe("apple");
    expect(normalizeSocialProvider("microsoft")).toBeNull();
  });

  it("resolve a plataforma pela lista retornada no user info", () => {
    expect(resolveSocialProvider(["REGISTERED_PLATFORM_EMAIL", "REGISTERED_PLATFORM_APPLE"], null)).toBe("apple");
  });

  it("aceita quando o provedor usado corresponde ao solicitado", () => {
    expect(validateSocialProvider({ requested: "google", resolved: "google" })).toEqual({ ok: true, provider: "google" });
  });

  it("bloqueia troca de provedor e métodos não permitidos", () => {
    expect(validateSocialProvider({ requested: "apple", resolved: "google" })).toEqual({ ok: false, reason: "provider_mismatch" });
    expect(validateSocialProvider({ requested: undefined, resolved: "microsoft" })).toEqual({ ok: false, reason: "unsupported_provider" });
  });

  it("gera somente redirecionamentos internos controlados", () => {
    expect(authRedirect("success", "apple")).toBe("/?auth=success&provider=apple");
    expect(authRedirect("failed")).toBe("/?auth=failed");
  });

  it("leva Google e Apple ao portal gerenciado com escolha explícita", () => {
    const redirectUri = "https://rendebit.example/api/oauth/callback";
    const state = encodeOAuthState({
      redirectUri,
      nonce: "nonce-seguro",
      requestedProvider: "apple",
    });
    const url = new URL(buildManagedOAuthUrl({
      portalUrl: "https://manus.im/",
      appId: "public-app-id",
      redirectUri,
      state,
      requestedProvider: "apple",
    }));

    expect(url.origin + url.pathname).toBe("https://manus.im/app-auth");
    expect(url.searchParams.get("forceLogin")).toBe("true");
    expect(url.searchParams.get("redirectUri")).toBe(redirectUri);
    expect(decodeOAuthState(url.searchParams.get("state")!)).toEqual({
      redirectUri,
      nonce: "nonce-seguro",
      requestedProvider: "apple",
    });
  });
});
