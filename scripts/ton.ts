import { getHttpEndpoint, getHttpV4Endpoint } from "@orbs-network/ton-access";
import {
  Address,
  TonClient,
  TonClient4,
  WalletContractV4,
  beginCell,
  internal,
  SendMode,
  toNano,
  fromNano,
  Cell,
  JettonMaster,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { generateCoffeeMessages } from "../src/coffee";

import dotenv from "dotenv";
dotenv.config();

async function main() {
  if (!process.env.MNEMONIC) {
    throw new Error("Environment variable MNEMONIC is required.");
  }

  const mnemonic = process.env.MNEMONIC.split(" ");

  // const endpoint = await getHttpEndpoint({ network: "mainnet" });
  // const endpoint = 'https://go.getblock.io/1750e70332c54bc7a6c5e86e30496dc0'
  // const endpoint = 'https://go.getblock.io/5317436104224c4886ea4e5abf97ad83'
  const endpoint = "https://toncenter.com/api/v2/jsonRPC";
  // const endpoint = "https://mainnet-v4.tonhubapi.com";
  const tonClient = new TonClient({
    endpoint,
    apiKey: "29e1e595ee8059a1877eee0caf20bdabec926e87ebea89b39192cdef078ef4c7",
  });

  const keys = await mnemonicToPrivateKey(mnemonic);
  const wallet = tonClient.open(
    WalletContractV4.create({
      workchain: 0,
      publicKey: keys.publicKey,
    }),
  );

  const sender = wallet.sender(keys.secretKey);
  console.log(await wallet.getBalance());

  if (!(await tonClient.isContractDeployed(wallet.address))) {
    console.log("wallet is not deployed");
  }

  const to = wallet.address.toString({ bounceable: false });
  // const messages = await generateCoffeeMessages(to);
  const seqno = await wallet.getSeqno();

  // usdt decimal: 6
  const jettonMasterAddr = Address.parse(
    "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  );
  const jettonMaster = tonClient.open(JettonMaster.create(jettonMasterAddr));
  const jettonWalletAddress = await jettonMaster.getWalletAddress(
    wallet.address,
  );
  const dest = wallet.address;

  const forwardPayload = beginCell()
    .storeUint(0, 32)
    .storeStringTail("Hello, Ton!")
    .endCell();

  const amounts = [toNano(0.005), toNano(0.01), toNano(0.006), toNano(0.001)];
  const messages = [];
  for (const amount of amounts) {
    const messageBody = beginCell()
      .storeUint(0x0f8a7ea5, 32)
      .storeUint(0, 64)
      .storeCoins(amount)
      .storeAddress(dest)
      .storeAddress(dest)
      .storeBit(0)
      .storeCoins(toNano("0.02"))
      .storeBit(1)
      .storeRef(forwardPayload)
      .endCell();
    messages.push(
      internal({
        to: jettonWalletAddress,
        value: toNano("0.1"),
        bounce: true,
        body: messageBody,
      }),
    );
  }

  await wallet.sendTransfer({
    secretKey: keys.secretKey,
    seqno,
    messages,
  });
}

main();
