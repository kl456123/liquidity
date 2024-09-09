import { ApiTokenAddress, RoutingApi } from "@swap-coffee/sdk";
import {
  Address,
  TonClient,
  WalletContractV4,
  internal,
  SendMode,
  toNano,
  fromNano,
  Cell,
} from "@ton/ton";

export async function generateCoffeeMessages(sender_address: string) {
  const routingApi = new RoutingApi();

  const assetIn: ApiTokenAddress = {
    blockchain: "ton",
    address: "native", // stands for TON
  };
  const assetOut: ApiTokenAddress = {
    blockchain: "ton",
    address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", // USDT
  };

  const input_amount = 1; // 5 TON

  // let's build an optimal route
  const route = await routingApi.buildRoute({
    input_token: assetIn,
    output_token: assetOut,
    input_amount: input_amount,
    pool_selector: {
      dexes: ["stonfi"],
    },
  });

  console.log(route.data.paths);

  // then we can build transactions payload
  const transactions = await routingApi.buildTransactionsV2({
    sender_address, // address of user's wallet
    slippage: 0.1, // 10% slippage
    paths: route.data.paths,
  });

  let messages = [];

  for (const transaction of transactions.data.transactions) {
    // swap.coffee takes care of all the boring stuff here :)
    messages.push(
      internal({
        to: transaction.address,
        value: fromNano(transaction.value),
        body: Cell.fromBase64(transaction.cell),
      }),
    );
  }
  return messages;
}
