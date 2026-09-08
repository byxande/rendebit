export const xverseCapabilities = {
  product: "Xverse API + Sats Connect",
  role: "optional_self_custody" as const,
  xverseApi: {
    bitcoinDataAndRpc: true,
    portfolioAndMarketData: true,
    swapWorkflows: true,
    broadcastSignedBitcoinTransaction: true,
    holdsOrganizationKeys: false,
    signsServerSide: false,
    executesStacksYieldAutonomously: false,
  },
  satsConnect: {
    connectsUserWallet: true,
    signsStacksTransactions: true,
    requiresVisibleUserApproval: true,
  },
  recommendation: "Use Xverse as an optional self-custody path. Keep the primary automated yield flow behind an institutional custodian or Wallet-as-a-Service with segregated accounts and server-side signing policies.",
  reviewedAt: "2026-09-08",
} as const;

export function canUseXverseForAutomatedYield() {
  return xverseCapabilities.xverseApi.signsServerSide
    && xverseCapabilities.xverseApi.executesStacksYieldAutonomously
    && !xverseCapabilities.satsConnect.requiresVisibleUserApproval;
}
