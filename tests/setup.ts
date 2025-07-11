import { AnchorError, Program } from "@coral-xyz/anchor";
import { Stablecoin } from "../target/types/stablecoin";
import idl from "../target/idl/stablecoin.json";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { SOL_USD_PRICE_FEED_PDA } from "./constants";
import { AccountInfoBytes } from "litesvm";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { expect } from "bun:test";

const devnetConnection = new Connection(clusterApiUrl("devnet"));

export async function getSetup(
  accounts: { pubkey: PublicKey; account: AccountInfoBytes }[] = [],
) {
  const litesvm = fromWorkspace("./");

  const solUsdPriceFeedInfo = await devnetConnection.getAccountInfo(
    SOL_USD_PRICE_FEED_PDA,
  );

  litesvm.setAccount(SOL_USD_PRICE_FEED_PDA, {
    data: solUsdPriceFeedInfo.data,
    executable: solUsdPriceFeedInfo.executable,
    lamports: solUsdPriceFeedInfo.lamports,
    owner: solUsdPriceFeedInfo.owner,
  });

  for (const { pubkey, account } of accounts) {
    litesvm.setAccount(new PublicKey(pubkey), {
      data: account.data,
      executable: account.executable,
      lamports: account.lamports,
      owner: new PublicKey(account.owner),
    });
  }

  const provider = new LiteSVMProvider(litesvm);
  const program = new Program<Stablecoin>(idl, provider);

  return { litesvm, provider, program };
}

export function fundedSystemAccountInfo(
  lamports: number = LAMPORTS_PER_SOL,
): AccountInfoBytes {
  return {
    lamports,
    data: Buffer.alloc(0),
    owner: SystemProgram.programId,
    executable: false,
  };
}

export async function expectAnchorError(error: Error, code: string) {
  expect(error).toBeInstanceOf(AnchorError);
  const { errorCode } = (error as AnchorError).error;
  expect(errorCode.code).toBe(code);
}
