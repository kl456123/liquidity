import { beginCell, Address, toNano } from "@ton/core";
import { TonClient, WalletContractV4 } from "@ton/ton";
import { sign, mnemonicToPrivateKey } from "@ton/crypto";
import { getClientAndKeypair } from "../src/utils";

async function main() {
  const { tonClient, keypair } = await getClientAndKeypair();
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keypair.publicKey,
  });
  // op
  let internalMessageBody = beginCell()
    .storeUint(0, 32)
    .storeStringTail("Hello Ton!")
    .endCell();

  const walletAddress = wallet.address;

  let internalMessage = beginCell()
    .storeUint(0x18, 6)
    .storeAddress(walletAddress)
    .storeCoins(toNano("0.2"))
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(internalMessageBody)
    .endCell();

  // get seqno and wallet id
  const seqno = (
    await tonClient.runMethod(walletAddress, "seqno")
  ).stack.readNumber();
  const walletId = (
    await tonClient.runMethod(walletAddress, "get_subwallet_id")
  ).stack.readNumber();

  let toSign = beginCell()
    .storeUint(walletId, 32)
    .storeUint(Math.floor(Date.now() / 1e3) + 60, 32)
    .storeUint(seqno, 32)
    .storeUint(0, 8)
    .storeUint(3, 8) // mode
    .storeRef(internalMessage);

  let signature = sign(toSign.endCell().hash(), keypair.secretKey);

  let body = beginCell().storeBuffer(signature).storeBuilder(toSign).endCell();

  // external message
  let externalMessage = beginCell()
    .storeUint(0b10, 2)
    .storeUint(0, 2)
    .storeAddress(walletAddress)
    .storeCoins(0)
    .storeBit(0)
    .storeBit(1)
    .storeRef(body)
    .endCell();

  await tonClient.sendFile(externalMessage.toBoc());
}

main();
