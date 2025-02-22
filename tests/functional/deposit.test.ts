import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProgramTestContext } from "solana-bankrun";
import { Stablecoin } from "../../target/types/stablecoin";
import { AnchorError, BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { getBankrunSetup } from "../setup";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getCollateralPdaAndBump,
  getMintPdaAndBump,
  getSolAccPdaAndBump,
} from "../pda";
import { getCollateralAcc } from "../accounts";
import { SOL_USD_PRICE_FEED_PDA } from "../constants";

describe("deposit", () => {
  let { context, provider, program } = {} as {
    context: ProgramTestContext;
    provider: BankrunProvider;
    program: Program<Stablecoin>;
  };

  const [admin, depositor] = Array.from({ length: 2 }, Keypair.generate);

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  beforeEach(async () => {
    ({ context, provider, program } = await getBankrunSetup([
      ...[admin, depositor].map((kp) => {
        return {
          address: kp.publicKey,
          info: {
            lamports: LAMPORTS_PER_SOL * 5,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
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

    const [collateralPda, collateralBump] = getCollateralPdaAndBump(
      depositor.publicKey
    );
    const collateralAcc = await getCollateralAcc(program, collateralPda);

    expect(collateralAcc.initialized).toEqual(true);
    expect(collateralAcc.bump).toEqual(collateralBump);
    expect(collateralAcc.lamportBalance.toNumber()).toEqual(
      amountCollateral.toNumber()
    );
    expect(collateralAcc.amountMinted.toNumber()).toEqual(
      amountToMint.toNumber()
    );
    expect(collateralAcc.depositor).toStrictEqual(depositor.publicKey);

    const [depositorSolAccPda, depositorSolAccBump] = getSolAccPdaAndBump(
      depositor.publicKey
    );
    const depositorSolAcc = await context.banksClient.getAccount(
      depositorSolAccPda
    );

    expect(collateralAcc.solAccBump).toEqual(depositorSolAccBump);
    expect(depositorSolAcc.lamports).toEqual(amountCollateral.toNumber());

    const [mintPda] = getMintPdaAndBump();
    const depositorAtaPda = getAssociatedTokenAddressSync(
      mintPda,
      depositor.publicKey,
      false,
      tokenProgram
    );
    const depositorAta = await getAccount(
      provider.connection,
      depositorAtaPda,
      "confirmed",
      tokenProgram
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
      expect(err).toBeInstanceOf(AnchorError);

      const { error } = err as AnchorError;
      expect(error.errorCode.code).toEqual("BelowMinimumHealthFactor");
      expect(error.errorCode.number).toEqual(6000);
    }
  });
});
