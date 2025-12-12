import {
  AddressLookupTableAccount,
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { SURFPOOL_RPC_URL } from "./constants";
import { Surfpool } from "./surfpool";
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { expect } from "bun:test";
import { StablecoinClient } from "./StablecoinClient";
import { ON_DEMAND_MAINNET_QUEUE, Queue } from "@switchboard-xyz/on-demand";
import idl from "./../target/idl/stablecoin.json";
import { Stablecoin } from "../target/types/stablecoin";
import { CrossbarClient } from "@switchboard-xyz/common";

export const connection = new Connection(SURFPOOL_RPC_URL, "processed");
const defaultWallet = new Wallet(Keypair.generate());
const provider = new AnchorProvider(connection, defaultWallet, {
  commitment: "processed",
});
const client = new StablecoinClient(provider);

// used only for Switchboard On-Demand Queue
const program = new Program<Stablecoin>(idl, provider);

const crossbarClient = new CrossbarClient("https://crossbar.switchboard.xyz/");
// @ts-ignore
const queue = new Queue(program as Program<Idl>, ON_DEMAND_MAINNET_QUEUE);

await airdropAccount(defaultWallet.publicKey);

export async function airdropAccount(
  publicKey: PublicKey,
  lamports: number = LAMPORTS_PER_SOL,
) {
  await Surfpool.setAccount({
    publicKey: publicKey.toBase58(),
    lamports,
  });
}

export async function getSetup(
  accounts: {
    publicKey: PublicKey;
    lamports?: number;
  }[],
) {
  // airdrops to accounts
  for (const { publicKey, lamports } of accounts) {
    await airdropAccount(publicKey, lamports);
  }

  return { client, crossbarClient, queue };
}

export async function expectError(error: Error, code: string) {
  expect(error.message).toInclude(code);
}

export async function expireBlockhash() {
  const currentSlot = await connection.getSlot("processed");
  while (true) {
    const newSlot = await connection.getSlot("processed");
    if (newSlot > currentSlot) break;
  }
}

/**
 * Resets singleton accounts that persist between tests in the Surfpool environment to a default state.
 * @param pubkeys
 */
export async function resetAccounts(pubkeys: PublicKey[]) {
  pubkeys
    .filter((pk) => pk !== undefined && !pk.equals(PublicKey.default))
    .forEach(async (pubkey) => {
      await Surfpool.setAccount({
        publicKey: pubkey.toBase58(),
        lamports: 0,
        // data: Buffer.alloc(0).toBase64(),
        data: Buffer.alloc(0).toString("base64"),
        executable: false,
        owner: SystemProgram.programId.toBase58(),
      });
    });
}

export async function buildAndSendv0Tx(
  ixs: TransactionInstruction[],
  signers: Signer[],
  luts: AddressLookupTableAccount[] = [],
) {
  const messageV0 = new TransactionMessage({
    payerKey: signers[0].publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: ixs,
  }).compileToV0Message(luts);

  const tx = new VersionedTransaction(messageV0);
  tx.sign(signers);

  const signature = await connection.sendTransaction(tx);
  await connection.confirmTransaction(signature);

  return signature;
}
