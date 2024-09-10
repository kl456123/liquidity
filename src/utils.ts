import { TonClient } from "@ton/ton";
import { sign, mnemonicToPrivateKey } from "@ton/crypto";

import dotenv from "dotenv";
dotenv.config();

export async function getClientAndKeypair() {
  const endpoint = "https://toncenter.com/api/v2/jsonRPC";
  const tonClient = new TonClient({
    endpoint,
    apiKey: process.env.API_KEY,
  });

  if (!process.env.MNEMONIC) {
    throw new Error("Environment variable MNEMONIC is required.");
  }

  const mnemonic = process.env.MNEMONIC.split(" ");
  const keypair = await mnemonicToPrivateKey(mnemonic);
  return { keypair, tonClient };
}
