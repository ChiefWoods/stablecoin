import { PublicKey } from "@solana/web3.js";
import idl from "../target/idl/stablecoin.json";

const STABLECOIN_PROGRAM_ID = new PublicKey(idl.address);

export function getConfigPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STABLECOIN_PROGRAM_ID,
  )[0];
}

export function getCollateralPda(depositor: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collateral"), depositor.toBuffer()],
    STABLECOIN_PROGRAM_ID,
  )[0];
}

export function getSolAccPda(depositor: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sol"), depositor.toBuffer()],
    STABLECOIN_PROGRAM_ID,
  )[0];
}

export function getMintPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    STABLECOIN_PROGRAM_ID,
  )[0];
}
