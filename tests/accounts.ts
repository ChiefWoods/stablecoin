import { PublicKey } from "@solana/web3.js";
import { Stablecoin } from "../target/types/stablecoin";
import { Program } from "@coral-xyz/anchor";

export async function fetchConfigAcc(
  program: Program<Stablecoin>,
  configPda: PublicKey,
) {
  return await program.account.config.fetchNullable(configPda);
}

export async function fetchCollateralAcc(
  program: Program<Stablecoin>,
  collateralPda: PublicKey,
) {
  return await program.account.collateral.fetchNullable(collateralPda);
}
