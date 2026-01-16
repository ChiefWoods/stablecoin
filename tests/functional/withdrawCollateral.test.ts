import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { StablecoinClient } from "../StablecoinClient";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
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

describe("withdrawCollateral", () => {
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
  let depositorAta: PublicKey;
  let vaultPda: PublicKey;

  const oracleQuote = SOL_USD_ORACLE_QUOTE;
  const lamports = 5 * LAMPORTS_PER_SOL; // 5 SOL
  const amountToMint = 250 * Math.pow(10, MINT_DECIMALS); // $250

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

    positionPda = StablecoinClient.getPositionPda(depositor.publicKey);

    const ed25519Ix = await queue.fetchQuoteIx(crossbarClient, [
      SOL_USD_FEED_ID,
    ]);

    // deposit SOL as collateral
    await program.methods
      .depositCollateral(new BN(lamports), new BN(amountToMint))
      .preInstructions([ed25519Ix])
      .accounts({
        depositor: depositor.publicKey,
        oracleQuote,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([depositor])
      .rpc();

    depositorAta = getAssociatedTokenAddressSync(
      mintPda,
      depositor.publicKey,
      !PublicKey.isOnCurve(depositor.publicKey),
    );

    vaultPda = StablecoinClient.getVaultPda(positionPda);
  });

  test("withdraw SOL collateral", async () => {
    const prePositionAcc = await client.fetchProgramAccount(
      positionPda,
      "position",
    );
    const preDepositorAtaAcc = await getAccount(connection, depositorAta);
    const preVaultBal = await connection.getBalance(vaultPda);

    const ed25519Ix = await queue.fetchQuoteIx(crossbarClient, [
      SOL_USD_FEED_ID,
    ]);

    const lamports = 2.5 * LAMPORTS_PER_SOL; // 2.5 SOL
    const amountToBurn = 125 * Math.pow(10, MINT_DECIMALS); // $125

    await program.methods
      .withdrawCollateral(new BN(lamports), new BN(amountToBurn))
      .preInstructions([ed25519Ix])
      .accountsPartial({
        depositor: depositor.publicKey,
        oracleQuote,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([depositor])
      .rpc();

    const postPositionAcc = await client.fetchProgramAccount(
      positionPda,
      "position",
    );

    expect(
      prePositionAcc.amountMinted.eq(
        postPositionAcc.amountMinted.add(new BN(amountToBurn)),
      ),
    ).toBeTrue();

    const postDepositorAtaAcc = await getAccount(connection, depositorAta);

    expect(preDepositorAtaAcc.amount).toBe(
      postDepositorAtaAcc.amount + BigInt(amountToBurn),
    );

    const postVaultBal = await connection.getBalance(vaultPda);

    expect(preVaultBal).toBe(postVaultBal + lamports);
  });

  afterEach(async () => {
    await resetAccounts([configPda, mintPda]);
  });
});
