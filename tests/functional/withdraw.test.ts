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

describe("withdraw", () => {
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
  });

  test("withdraw SOL and burn stablecoin", async () => {
    const collateralPda = getCollateralPda(depositor.publicKey);
    let collateralAcc = await fetchCollateralAcc(program, collateralPda);
    const initCollateralLamportBal = collateralAcc.lamportBalance.toNumber();
    const initCollateralAmountMinted = collateralAcc.amountMinted.toNumber();

    const depositorSolAccPda = getSolAccPda(depositor.publicKey);
    let depositorSolAcc = litesvm.getAccount(depositorSolAccPda);
    const initDepositorSolBal = depositorSolAcc.lamports;

    const mintPda = getMintPda();
    const depositorAtaPda = getAssociatedTokenAddressSync(
      mintPda,
      depositor.publicKey,
      false,
      tokenProgram,
    );
    let depositorAta = await getAccount(
      provider.connection,
      depositorAtaPda,
      "confirmed",
      tokenProgram,
    );
    const initDepositorAtaBal = Number(depositorAta.amount);

    const amountCollateral = new BN(LAMPORTS_PER_SOL / 2); // 0.5 SOL
    const amountToBurn = new BN(25 * 10 ** 9); // 25 units

    await program.methods
      .withdraw(amountCollateral, amountToBurn)
      .accountsPartial({
        depositor: depositor.publicKey,
        priceUpdate: SOL_USD_PRICE_FEED_PDA,
        tokenProgram,
      })
      .signers([depositor])
      .rpc();

    collateralAcc = await fetchCollateralAcc(program, collateralPda);

    const postCollateralLamportBal = collateralAcc.lamportBalance.toNumber();
    const postCollateralAmountMinted = collateralAcc.amountMinted.toNumber();

    expect(postCollateralLamportBal).toEqual(
      initCollateralLamportBal - amountCollateral.toNumber(),
    );
    expect(postCollateralAmountMinted).toEqual(
      initCollateralAmountMinted - amountToBurn.toNumber(),
    );

    depositorSolAcc = litesvm.getAccount(depositorSolAccPda);
    const postDepositorSolBal = depositorSolAcc.lamports;

    expect(postDepositorSolBal).toEqual(
      initDepositorSolBal - amountCollateral.toNumber(),
    );

    depositorAta = await getAccount(
      provider.connection,
      depositorAtaPda,
      "confirmed",
      tokenProgram,
    );
    const postDepositorAtaBal = Number(depositorAta.amount);

    expect(postDepositorAtaBal).toEqual(
      initDepositorAtaBal - amountToBurn.toNumber(),
    );
  });

  test("throws if too much SOL withdrawn", async () => {
    const amountCollateral = new BN(LAMPORTS_PER_SOL); // 1 SOL
    const amountToBurn = new BN(25 * 10 ** 9); // 25 units

    try {
      await program.methods
        .withdraw(amountCollateral, amountToBurn)
        .accountsPartial({
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
