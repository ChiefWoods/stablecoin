import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { StablecoinClient } from "../StablecoinClient";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getSetup, resetAccounts } from "../setup";
import { Program } from "@coral-xyz/anchor";
import { Stablecoin } from "../../target/types/stablecoin";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("initializeConfig", () => {
  let client: StablecoinClient;
  let program: Program<Stablecoin>;
  let connection: Connection;

  let configAuthority: Keypair;

  let configPda: PublicKey;
  let mintPda: PublicKey;

  beforeEach(async () => {
    configAuthority = Keypair.generate();

    ({ client } = await getSetup([
      {
        publicKey: configAuthority.publicKey,
      },
    ]));

    program = client.program;
    connection = client.connection;

    configPda = StablecoinClient.getConfigPda();
    mintPda = StablecoinClient.getMintPda();
  });

  test("initialize config", async () => {
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

    const configAcc = await client.fetchProgramAccount(configPda, "config");

    expect(configAcc.authority.equals(configAuthority.publicKey)).toBeTrue();
    expect(configAcc.liquidationBonusBps).toBe(liquidationBonusBps);
    expect(configAcc.liquidationThresholdBps).toBe(liquidationThresholdBps);
    expect(configAcc.minLoanToValueBps).toBe(minLoanToValueBps);
  });

  afterEach(async () => {
    await resetAccounts([configPda, mintPda]);
  });
});
