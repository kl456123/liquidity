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
  OutActionSendMsg,
  Cell,
  OpenedContract,
  MessageRelaxed,
} from "@ton/ton";
import { JettonMinter } from "../src/wrappers/JettonMinter";
import { JettonWallet } from "../src/wrappers/JettonWallet";
import { HighloadWalletV3 } from "../src/wrappers/HighloadWalletV3";
import { HighloadQueryId } from "../src/wrappers/HighloadQueryId";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { generateCoffeeMessages } from "../src/coffee";
import { jettonInfos, HIGHLOAD_V3_CODE } from "../src/constants";

import dotenv from "dotenv";
dotenv.config();

const endpoint = "https://toncenter.com/api/v2/jsonRPC";

async function getProviderAndWallet(url: string) {
  const tonClient = new TonClient({
    endpoint,
    apiKey: "29e1e595ee8059a1877eee0caf20bdabec926e87ebea89b39192cdef078ef4c7",
  });

  if (!process.env.MNEMONIC) {
    throw new Error("Environment variable MNEMONIC is required.");
  }

  const mnemonic = process.env.MNEMONIC.split(" ");
  const keys = await mnemonicToPrivateKey(mnemonic);
  const wallet = tonClient.open(
    WalletContractV4.create({
      workchain: 0,
      publicKey: keys.publicKey,
    }),
  );

  if (!(await tonClient.isContractDeployed(wallet.address))) {
    console.log("wallet is not deployed");
  }

  const highloadWallet = tonClient.open(
    HighloadWalletV3.createFromConfig(
      {
        publicKey: keys.publicKey,
        subwalletId: 0x10ad,
        timeout: 60 * 60, // 1 hour
      },
      HIGHLOAD_V3_CODE,
    ),
  );

  const jettonMasterAddr = Address.parse(jettonInfos.usdt.addr);
  const jettonMinter = tonClient.open(
    JettonMinter.createFromAddress(jettonMasterAddr),
  );

  return {
    tonClient,
    wallet,
    secretKey: keys.secretKey,
    highloadWallet,
    jettonMinter,
  };
}

async function batchTransferByWallet(
  wallet: OpenedContract<WalletContractV4>,
  jettonMinter: OpenedContract<JettonMinter>,
  secretKey: Buffer,
) {
  const seqno = await wallet.getSeqno();
  const forwardPayload = beginCell()
    .storeUint(0, 32)
    .storeStringTail("Hello, Ton!")
    .endCell();

  const jettonWalletAddress = await jettonMinter.getWalletAddress(
    wallet.address,
  );
  const amounts = [toNano(0.005), toNano(0.01), toNano(0.006), toNano(0.001)];
  const messages = [];
  const dest = wallet.address;
  for (const amount of amounts) {
    const messageBody = JettonWallet.transferMessage(
      amount,
      dest,
      dest,
      null,
      0n,
      null,
    );

    messages.push(
      internal({
        to: jettonWalletAddress,
        value: toNano("0.1"),
        body: messageBody,
      }),
    );
  }
  return wallet.sendTransfer({
    secretKey,
    seqno,
    messages,
  });
}

async function batchTransferByHighloadWallet(
  wallet: OpenedContract<HighloadWalletV3>,
  jettonMinter: OpenedContract<JettonMinter>,
  secretKey: Buffer,
) {
  const jettonWalletAddress = await jettonMinter.getWalletAddress(
    wallet.address,
  );
  const actions: OutActionSendMsg[] = [];
  const dest = wallet.address;
  for (let i = 0; i < 10; ++i) {
    const messageBody = JettonWallet.transferMessage(
      toNano("0.0001"),
      dest,
      dest,
      null,
      0n,
      null,
    );

    actions.push({
      type: "sendMsg",
      mode: SendMode.PAY_GAS_SEPARATELY,
      outMsg: internal({
        to: jettonWalletAddress,
        value: toNano("0.05"),
        bounce: true,
        body: messageBody,
      }),
    });
  }
  const subwalletId = 0x10ad;
  const timeout = 60 * 60; // must be same as in the contract
  const internalMessageValue = toNano(1); // in real case it is recommended to set the value to 1 TON
  const createdAt = Math.floor(Date.now() / 1000) - 60; // LiteServers have some delay in time

  // NOTE: query id only used once
  const queryHandler = HighloadQueryId.fromShiftAndBitNumber(0n, 8n);

  return wallet.sendBatch(
    secretKey,
    actions,
    subwalletId,
    queryHandler,
    timeout,
    internalMessageValue,
    SendMode.PAY_GAS_SEPARATELY,
    createdAt,
  );
}

async function main() {
  const { tonClient, wallet, secretKey, highloadWallet, jettonMinter } =
    await getProviderAndWallet(endpoint);

  // usdt decimal: 6

  await batchTransferByWallet(wallet, jettonMinter, secretKey);
  await batchTransferByHighloadWallet(highloadWallet, jettonMinter, secretKey);
}

main();
