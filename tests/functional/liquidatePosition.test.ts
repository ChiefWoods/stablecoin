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
import { Surfpool } from "../surfpool";

describe("liquidatePosition", () => {
  let client: StablecoinClient;
  let program: Program<Stablecoin>;
  let connection: Connection;
  let crossbarClient: CrossbarClient;
  let queue: Queue;

  let configAuthority: Keypair;
  let depositor: Keypair;
  let liquidator: Keypair;

  let configPda: PublicKey;
  let mintPda: PublicKey;
  let positionPda: PublicKey;
  let depositorAta: PublicKey;
  let vaultPda: PublicKey;

  const oracleQuote = SOL_USD_ORACLE_QUOTE;
  const lamports = 5 * LAMPORTS_PER_SOL; // 5 SOL
  const amountToMint = 250 * Math.pow(10, MINT_DECIMALS); // $250

  beforeEach(async () => {
    [configAuthority, depositor, liquidator] = Array.from({ length: 3 }, () =>
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
      {
        publicKey: liquidator.publicKey,
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

    const updateIxs = await queue.fetchManagedUpdateIxs(
      crossbarClient,
      [SOL_USD_FEED_ID],
      {
        instructionIdx: 0,
        payer: depositor.publicKey,
        variableOverrides: {},
      },
    );

    // deposit SOL as collateral
    await program.methods
      .depositCollateral(new BN(lamports), new BN(amountToMint))
      .preInstructions(updateIxs)
      .accounts({
        depositor: depositor.publicKey,
        position: positionPda,
        oracleQuote,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    depositorAta = getAssociatedTokenAddressSync(
      depositor.publicKey,
      mintPda,
      !PublicKey.isOnCurve(depositor.publicKey),
    );

    vaultPda = StablecoinClient.getVaultPda(positionPda);
  });

  test("liquidate half of undercollaterized position", async () => {
    // update config to meet liquidation requirements
    const liquidationThresholdBps = 25000; // 250%
    const minLoanToValueBps = 22500; // 225%

    await program.methods
      .updateConfig({
        liquidationBonusBps: null,
        liquidationThresholdBps,
        minLoanToValueBps,
      })
      .accounts({
        authority: configAuthority.publicKey,
      })
      .signers([configAuthority])
      .rpc();

    const amountToBurn = amountToMint / 2;

    // airdrop liquidator mint tokens to burn
    await Surfpool.setTokenAccount({
      mint: mintPda.toBase58(),
      owner: liquidator.publicKey.toBase58(),
      update: {
        amount: amountToBurn,
      },
    });

    const preLiquidatorBal = await connection.getBalance(liquidator.publicKey);
    const prePositionAcc = await client.fetchProgramAccount(
      positionPda,
      "position",
    );
    const preVaultBal = await connection.getBalance(vaultPda);

    const updateIxs = await queue.fetchManagedUpdateIxs(
      crossbarClient,
      [SOL_USD_FEED_ID],
      {
        instructionIdx: 0,
        payer: depositor.publicKey,
        variableOverrides: {},
      },
    );

    // TODO: Quote is too old error from verified_update instruction
    await program.methods
      .liquidatePosition(new BN(amountToBurn))
      .preInstructions(updateIxs)
      .accounts({
        liquidator: liquidator.publicKey,
        oracleQuote,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([liquidator])
      .rpc();

    const postLiquidatorBal = await connection.getBalance(liquidator.publicKey);

    expect(preLiquidatorBal).toBeLessThan(postLiquidatorBal);

    const postPositionAcc = await client.fetchProgramAccount(
      positionPda,
      "position",
    );

    expect(
      prePositionAcc.amountMinted.eq(
        postPositionAcc.amountMinted.addn(amountToBurn),
      ),
    ).toBeTrue();

    const postVaultBal = await connection.getBalance(vaultPda);

    expect(preVaultBal).toBeGreaterThan(postVaultBal);

    const liquidatorAta = getAssociatedTokenAddressSync(
      mintPda,
      liquidator.publicKey,
      !PublicKey.isOnCurve(liquidator.publicKey),
    );

    const liquidatorAtaAcc = await getAccount(connection, liquidatorAta);

    expect(liquidatorAtaAcc.amount).toBe(0n);
  });

  afterEach(async () => {
    await resetAccounts([configPda, mintPda]);
  });
});
