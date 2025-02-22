import { Program } from "@coral-xyz/anchor";
import { AddedAccount, ProgramTestContext, startAnchor } from "solana-bankrun";
import { Stablecoin } from "../target/types/stablecoin";
import idl from "../target/idl/stablecoin.json";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { SOL_USD_PRICE_FEED_PDA } from "./constants";
import { BankrunContextWrapper } from "./bankrunContextWrapper";

const devnetConnection = new Connection(clusterApiUrl("devnet"));

export async function getBankrunSetup(accounts: AddedAccount[] = []) {
  const context = await startAnchor("", [], accounts, 400000n);

  const wrappedContext = new BankrunContextWrapper(context);
  const provider = wrappedContext.provider;
  const program = new Program(idl as Stablecoin, provider);

  await setPriceFeedAccs(context, [SOL_USD_PRICE_FEED_PDA]);

  return {
    context: wrappedContext.context,
    provider,
    program,
  };
}

export async function setPriceFeedAccs(
  context: ProgramTestContext,
  pubkeys: PublicKey[]
) {
  const accInfos = await devnetConnection.getMultipleAccountsInfo(pubkeys);

  accInfos.forEach((info, i) => {
    context.setAccount(pubkeys[i], info);
  });
}
