export type BrazilianCustomerProfile = {
  country: string;
  verificationStatus: string;
  pixOwnershipConfirmed: boolean;
  pixAccountMasked?: string | null;
};

export function assertBrazilianCustomer(
  profile: BrazilianCustomerProfile | null | undefined,
  options: { requirePix?: boolean } = {},
) {
  if (!profile) {
    throw new Error("Complete seu cadastro brasileiro antes de continuar.");
  }
  if (profile.country !== "BR") {
    throw new Error("A RendeBit é exclusiva para residentes no Brasil.");
  }
  if (profile.verificationStatus !== "verified") {
    throw new Error("Conclua a verificação do seu CPF antes de continuar.");
  }
  if (options.requirePix && (!profile.pixOwnershipConfirmed || !profile.pixAccountMasked)) {
    throw new Error("Confirme uma conta Pix da sua titularidade antes de continuar.");
  }
  return profile;
}
