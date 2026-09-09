import type { SocialAuthProvider } from "@shared/const";

export const SOCIAL_AUTH_PROVIDERS: readonly SocialAuthProvider[] = [
  "google",
  "apple",
] as const;

export function normalizeSocialProvider(
  value: unknown
): SocialAuthProvider | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("google")) return "google";
  if (normalized.includes("apple")) return "apple";
  return null;
}

export function resolveSocialProvider(
  platforms: unknown,
  fallback: unknown
): SocialAuthProvider | null {
  const direct = normalizeSocialProvider(fallback);
  if (direct) return direct;
  if (!Array.isArray(platforms)) return null;

  for (const platform of platforms) {
    const resolved = normalizeSocialProvider(platform);
    if (resolved) return resolved;
  }
  return null;
}

export function validateSocialProvider(input: {
  requested: unknown;
  resolved: unknown;
}) {
  const requested = normalizeSocialProvider(input.requested);
  const resolved = normalizeSocialProvider(input.resolved);

  if (!resolved) {
    return { ok: false as const, reason: "unsupported_provider" as const };
  }
  if (requested && requested !== resolved) {
    return { ok: false as const, reason: "provider_mismatch" as const };
  }
  return { ok: true as const, provider: resolved };
}

export function authRedirect(
  status: "success" | "provider-mismatch" | "provider-unsupported" | "failed",
  provider?: SocialAuthProvider
) {
  const params = new URLSearchParams({ auth: status });
  if (provider) params.set("provider", provider);
  return `/?${params.toString()}`;
}
