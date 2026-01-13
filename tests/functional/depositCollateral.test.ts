import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { StablecoinClient } from "../StablecoinClient";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { getSetup, resetAccounts } from "../setup";
import { BN, Program } from "@coral-xyz/anchor";
import { Stablecoin } from "../../target/types/stablecoin";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  MINT_DECIMALS,
  SOL_USD_FEED_ID,
  SOL_USD_ORACLE_QUOTE,
} from "../constants";
import {
  getAssociatedTokenAddressSync,
  Queue,
} from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";

describe("depositCollateral", () => {
  let client: StablecoinClient;
  let program: Program<Stablecoin>;
  let connection: Connection;
  let crossbarClient: CrossbarClient;
  let queue: Queue;

  let configAuthority: Keypair;
  let depositor: Keypair;

  let configPda: PublicKey;
  let mintPda: PublicKey;
  let positionPda: PublicKey;

  const oracleQuote = SOL_USD_ORACLE_QUOTE;

  beforeEach(async () => {
    [configAuthority, depositor] = Array.from({ length: 2 }, () =>
      Keypair.generate(),
    );

    ({ client, crossbarClient, queue } = await getSetup([
      {
        publicKey: configAuthority.publicKey,
      },
      {
        publicKey: depositor.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
      },
    ]));

    program = client.program;
    connection = client.connection;

    configPda = StablecoinClient.getConfigPda();
    mintPda = StablecoinClient.getMintPda();

    // initialize config
    const liquidationBonusBps = 250; // 2.5%
    const liquidationThresholdBps = 12500; // 125%
    const minLoanToValueBps = 15000; // 150%

    await program.methods
      .initializeConfig({
        liquidationBonusBps,
        liquidationThresholdBps,
        minLoanToValueBps,
      })
      .accounts({
        authority: configAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([configAuthority])
      .rpc();
  });

  test("deposit SOL as collateral", async () => {
    positionPda = StablecoinClient.getPositionPda(depositor.publicKey);

    const updateIxs = await queue.fetchManagedUpdateIxs(
      crossbarClient,
      [SOL_USD_FEED_ID],
      {
        instructionIdx: 0,
        payer: depositor.publicKey,
        variableOverrides: {},
      },
    );

    const lamports = 5 * LAMPORTS_PER_SOL; // 5 SOL
    const amountToMint = 250 * Math.pow(10, MINT_DECIMALS); // $250

    // TODO: Quote is too old error from verified_update instruction
    await program.methods
      .depositCollateral(new BN(lamports), new BN(amountToMint))
      .preInstructions(updateIxs)
      .accounts({
        depositor: depositor.publicKey,
        oracleQuote,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    const positionAcc = await client.fetchProgramAccount(
      positionPda,
      "position",
    );

    expect(positionAcc.depositor.equals(depositor.publicKey)).toBeTrue();
    expect(positionAcc.amountMinted.eq(new BN(amountToMint))).toBeTrue();

    const depositorAta = getAssociatedTokenAddressSync(
      mintPda,
      depositor.publicKey,
      !PublicKey.isOnCurve(depositor.publicKey),
    );

    const depositorAtaAcc = await getAccount(connection, depositorAta);

    expect(depositorAtaAcc.amount).toBe(BigInt(amountToMint));

    const vaultPda = StablecoinClient.getVaultPda(positionPda);
    const vaultBal = await connection.getBalance(vaultPda);

    expect(vaultBal).toBe(lamports);
  });

  afterEach(async () => {
    await resetAccounts([configPda, mintPda]);
  });
});
