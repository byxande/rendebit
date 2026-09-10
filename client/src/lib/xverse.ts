import XverseWallet, { AddressPurpose, BitcoinNetworkType } from "sats-connect";

export type XverseNetwork = "testnet" | "mainnet";

export type XverseWalletConnection = {
  address: string;
  publicKey: string;
  network: XverseNetwork;
  walletType: "software" | "ledger" | "keystone";
};

function xverseError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Não foi possível falar com a carteira Xverse.";
}

export async function connectXverse(): Promise<XverseWalletConnection> {
  const response = await XverseWallet.request("wallet_connect", {
    addresses: [AddressPurpose.Stacks],
    network: BitcoinNetworkType.Testnet,
    message: "Conectar a carteira Stacks pública à RendeBit.",
  });
  if (response.status !== "success") {
    throw new Error(xverseError(response.error));
  }
  const stacksAddress = response.result.addresses.find(
    address => address.purpose === "stacks"
  );
  if (!stacksAddress) {
    throw new Error("A Xverse não retornou um endereço Stacks.");
  }
  return {
    address: stacksAddress.address,
    publicKey: stacksAddress.publicKey,
    network:
      response.result.network.stacks.name === "mainnet" ? "mainnet" : "testnet",
    walletType: stacksAddress.walletType,
  };
}

export async function signStacksTransaction(
  transaction: string,
  broadcast = false
): Promise<{ transaction: string }> {
  const response = await XverseWallet.request("stx_signTransaction", {
    transaction,
    broadcast,
  });
  if (response.status !== "success") {
    throw new Error(xverseError(response.error));
  }
  return response.result;
}

export async function transferStxFromXverse(input: {
  amountMicroStx: string;
  recipient: string;
  memo?: string;
}) {
  const response = await XverseWallet.request("stx_transferStx", {
    amount: input.amountMicroStx,
    recipient: input.recipient,
    memo: input.memo,
  });
  if (response.status !== "success") {
    throw new Error(xverseError(response.error));
  }
  return response.result;
}

export async function disconnectXverse() {
  await XverseWallet.disconnect();
}
