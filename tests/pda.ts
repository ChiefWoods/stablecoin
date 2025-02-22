import { PublicKey } from "@solana/web3.js";
import idl from "../target/idl/stablecoin.json";

export function getConfigPdaAndBump() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    new PublicKey(idl.address)
  );
}

export function getCollateralPdaAndBump(depositor: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collateral"), depositor.toBuffer()],
    new PublicKey(idl.address)
  );
}

export function getSolAccPdaAndBump(depositor: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sol"), depositor.toBuffer()],
    new PublicKey(idl.address)
  );
}

export function getMintPdaAndBump() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    new PublicKey(idl.address)
  );
}
