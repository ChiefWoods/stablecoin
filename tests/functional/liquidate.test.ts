import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProgramTestContext } from "solana-bankrun";
import { Stablecoin } from "../../target/types/stablecoin";
import { AnchorError, BN, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { getBankrunSetup } from "../setup";
import {
  ACCOUNT_SIZE,
  AccountLayout,
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
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";

describe("liquidate", () => {
  let { context, provider, program } = {} as {
    context: ProgramTestContext;
    provider: BankrunProvider;
    program: Program<Stablecoin>;
  };

  const [admin, depositor, liquidator] = Array.from(
    { length: 3 },
    Keypair.generate
  );
  const [mintPda] = getMintPdaAndBump();

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  const liquidatorAtaPda = getAssociatedTokenAddressSync(
    mintPda,
    liquidator.publicKey,
    false,
    tokenProgram
  );

  beforeEach(async () => {
    const liquidatorMintAtaData = Buffer.alloc(ACCOUNT_SIZE);

    AccountLayout.encode(
      {
        amount: BigInt(100 * 10 ** 9),
        closeAuthority: liquidator.publicKey,
        closeAuthorityOption: 1,
        delegate: PublicKey.default,
        delegateOption: 0,
        delegatedAmount: BigInt(0),
        isNative: BigInt(0),
        isNativeOption: 0,
        mint: mintPda,
        owner: liquidator.publicKey,
        state: 1,
      },
      liquidatorMintAtaData
    );

    ({ context, provider, program } = await getBankrunSetup([
      ...[admin, depositor, liquidator].map((kp) => {
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
      {
        address: liquidatorAtaPda,
        info: {
          lamports: LAMPORTS_PER_SOL,
          data: liquidatorMintAtaData,
          owner: tokenProgram,
          executable: false,
        },
      },
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

  test("liquidate collateral partially", async () => {
    const minHealthFactor = 2.0; // Crank up minHealthFactor to trigger liquidation

    await program.methods
      .updateConfig({
        liquidationThreshold: null,
        liquidationBonus: null,
        minHealthFactor,
      })
      .accounts({
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const [collateralPda] = getCollateralPdaAndBump(depositor.publicKey);
    let collateralAcc = await getCollateralAcc(program, collateralPda);

    const initCollateralLamportBal = collateralAcc.lamportBalance.toNumber();
    const initCollateralAmountMinted = collateralAcc.amountMinted.toNumber();

    const [depositedSolAccPda] = getSolAccPdaAndBump(depositor.publicKey);
    const initDepositedSolAccLamports = (
      await context.banksClient.getAccount(depositedSolAccPda)
    ).lamports;
    const initLiquidatorLamports = (
      await context.banksClient.getAccount(liquidator.publicKey)
    ).lamports;

    const initLiquidatorAtaBal = (
      await getAccount(
        provider.connection,
        liquidatorAtaPda,
        "confirmed",
        tokenProgram
      )
    ).amount;

    const amountToBurn = new BN(25 * 10 ** 9); // 25 units

    await program.methods
      .liquidate(amountToBurn)
      .accountsPartial({
        liquidator: liquidator.publicKey,
        collateral: collateralPda,
        priceUpdate: SOL_USD_PRICE_FEED_PDA,
        tokenProgram,
      })
      .signers([liquidator])
      .rpc();

    collateralAcc = await getCollateralAcc(program, collateralPda);

    const postCollateralLamportBal = collateralAcc.lamportBalance.toNumber();
    const postCollateralAmountMinted = collateralAcc.amountMinted.toNumber();

    expect(postCollateralLamportBal).toBeLessThan(initCollateralLamportBal);
    expect(postCollateralAmountMinted).toBeLessThan(initCollateralAmountMinted);

    const postDepositedSolAccLamports = (
      await context.banksClient.getAccount(depositedSolAccPda)
    ).lamports;
    const postLiquidatorLamports = (
      await context.banksClient.getAccount(liquidator.publicKey)
    ).lamports;

    expect(postDepositedSolAccLamports).toBeLessThan(
      initDepositedSolAccLamports
    );
    expect(postLiquidatorLamports).toBeGreaterThan(initLiquidatorLamports);

    const postLiquidatorAtaBal = (
      await getAccount(
        provider.connection,
        liquidatorAtaPda,
        "confirmed",
        tokenProgram
      )
    ).amount;

    expect(postLiquidatorAtaBal).toBeLessThan(initLiquidatorAtaBal);
  });

  test("throws if collateral account is above minimum health factor", async () => {
    const [collateralPda] = getCollateralPdaAndBump(depositor.publicKey);
    const amountToBurn = new BN(25 * 10 ** 9); // 25 units

    try {
      await program.methods
        .liquidate(amountToBurn)
        .accountsPartial({
          liquidator: liquidator.publicKey,
          collateral: collateralPda,
          priceUpdate: SOL_USD_PRICE_FEED_PDA,
          tokenProgram,
        })
        .signers([liquidator])
        .rpc();
    } catch (err) {
      expect(err).toBeInstanceOf(AnchorError);

      const { error } = err as AnchorError;
      expect(error.errorCode.code).toEqual("AboveMinimumHealthFactor");
      expect(error.errorCode.number).toEqual(6001);
    }
  });

  test("throws if collateral account is still below minimum health factor after liquidation", async () => {
    const minHealthFactor = 2.0; // Crank up minHealthFactor to trigger liquidation

    await program.methods
      .updateConfig({
        liquidationThreshold: null,
        liquidationBonus: null,
        minHealthFactor,
      })
      .accounts({
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const [collateralPda] = getCollateralPdaAndBump(depositor.publicKey);
    const amountToBurn = new BN(1 * 10 ** 9); // 1 unit

    try {
      await program.methods
        .liquidate(amountToBurn)
        .accountsPartial({
          liquidator: liquidator.publicKey,
          collateral: collateralPda,
          priceUpdate: SOL_USD_PRICE_FEED_PDA,
          tokenProgram,
        })
        .signers([liquidator])
        .rpc();
    } catch (err) {
      expect(err).toBeInstanceOf(AnchorError);

      const { error } = err as AnchorError;
      expect(error.errorCode.code).toEqual("BelowMinimumHealthFactor");
      expect(error.errorCode.number).toEqual(6000);
    }
  });
});
