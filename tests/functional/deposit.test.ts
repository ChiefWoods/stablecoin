import { beforeEach, describe, expect, test } from "bun:test";
import { Stablecoin } from "../../target/types/stablecoin";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { getCollateralPda, getMintPda, getSolAccPda } from "../pda";
import { fetchCollateralAcc } from "../accounts";
import { SOL_USD_PRICE_FEED_PDA } from "../constants";
import { LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { expectAnchorError, fundedSystemAccountInfo, getSetup } from "../setup";

describe("deposit", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Stablecoin>;
  };

  const [admin, depositor] = Array.from({ length: 2 }, Keypair.generate);

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  beforeEach(async () => {
    ({ litesvm, provider, program } = await getSetup([
      ...[admin, depositor].map((kp) => {
        return {
          pubkey: kp.publicKey,
          account: fundedSystemAccountInfo(5 * LAMPORTS_PER_SOL),
        };
      }),
    ]));

    const liquidationThreshold = 5000; // 50% in basis points
    const liquidationBonus = 10; // 10% in basis points
    const minHealthFactor = 1.0;

    await program.methods
      .initConfig({
        liquidationThreshold,
        liquidationBonus,
        minHealthFactor,
      })
      .accounts({
        authority: admin.publicKey,
        tokenProgram,
      })
      .signers([admin])
      .rpc();
  });

  test("deposit SOL and mint stablecoin", async () => {
    const amountCollateral = new BN(LAMPORTS_PER_SOL); // 1 SOL
    const amountToMint = new BN(50 * 10 ** 9); // 50 units

    await program.methods
      .deposit(amountCollateral, amountToMint)
      .accounts({
        depositor: depositor.publicKey,
        priceUpdate: SOL_USD_PRICE_FEED_PDA,
        tokenProgram,
      })
      .signers([depositor])
      .rpc();

    const collateralPda = getCollateralPda(depositor.publicKey);
    const collateralAcc = await fetchCollateralAcc(program, collateralPda);

    expect(collateralAcc.initialized).toEqual(true);
    expect(collateralAcc.lamportBalance.toNumber()).toEqual(
      amountCollateral.toNumber(),
    );
    expect(collateralAcc.amountMinted.toNumber()).toEqual(
      amountToMint.toNumber(),
    );
    expect(collateralAcc.depositor).toStrictEqual(depositor.publicKey);

    const depositorSolAccPda = getSolAccPda(depositor.publicKey);
    const depositorSolAcc = litesvm.getAccount(depositorSolAccPda);

    expect(depositorSolAcc.lamports).toEqual(amountCollateral.toNumber());

    const mintPda = getMintPda();
    const depositorAtaPda = getAssociatedTokenAddressSync(
      mintPda,
      depositor.publicKey,
      false,
      tokenProgram,
    );
    const depositorAta = await getAccount(
      provider.connection,
      depositorAtaPda,
      "confirmed",
      tokenProgram,
    );

    expect(Number(depositorAta.amount)).toEqual(amountToMint.toNumber());
  });

  test("throws if insufficient SOL deposited", async () => {
    const amountCollateral = new BN(1); // 1 lamport
    const amountToMint = new BN(50 * 10 ** 9); // 50 units

    try {
      await program.methods
        .deposit(amountCollateral, amountToMint)
        .accounts({
          depositor: depositor.publicKey,
          priceUpdate: SOL_USD_PRICE_FEED_PDA,
          tokenProgram,
        })
        .signers([depositor])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "BelowMinimumHealthFactor");
    }
  });
});
