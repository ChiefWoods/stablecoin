import { PublicKey } from "@solana/web3.js";
import { Stablecoin } from "../target/types/stablecoin";
import { ProgramClient } from "./ProgramClient";
import idl from "../target/idl/stablecoin.json";
import { STABLECOIN_PROGRAM_ID } from "./constants";
import { AnchorProvider } from "@coral-xyz/anchor";

export class StablecoinClient extends ProgramClient<Stablecoin> {
  constructor(provider: AnchorProvider) {
    super(provider, idl);
  }

  static getConfigPda() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      STABLECOIN_PROGRAM_ID,
    )[0];
  }

  static getPositionPda(depositor: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("position"), depositor.toBuffer()],
      STABLECOIN_PROGRAM_ID,
    )[0];
  }

  static getVaultPda(position: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), position.toBuffer()],
      STABLECOIN_PROGRAM_ID,
    )[0];
  }

  static getMintPda() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      STABLECOIN_PROGRAM_ID,
    )[0];
  }
}
