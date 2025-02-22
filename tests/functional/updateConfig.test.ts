import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProgramTestContext } from "solana-bankrun";
import { Stablecoin } from "../../target/types/stablecoin";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { getBankrunSetup } from "../setup";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getConfigPdaAndBump } from "../pda";
import { getConfigAcc } from "../accounts";

describe("updateConfig", () => {
  let { context, provider, program } = {} as {
    context: ProgramTestContext;
    provider: BankrunProvider;
    program: Program<Stablecoin>;
  };

  const authority = Keypair.generate();

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  beforeEach(async () => {
    ({ context, provider, program } = await getBankrunSetup([
      {
        address: authority.publicKey,
        info: {
          lamports: LAMPORTS_PER_SOL * 5,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
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
        authority: authority.publicKey,
        tokenProgram,
      })
      .signers([authority])
      .rpc();
  });

  test("update a config", async () => {
    const liquidationThreshold = 25;
    const liquidationBonus = 5;
    const minHealthFactor = 1.1;

    await program.methods
      .updateConfig({
        liquidationThreshold,
        liquidationBonus,
        minHealthFactor,
      })
      .accounts({
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const [configPda] = getConfigPdaAndBump();
    const configAcc = await getConfigAcc(program, configPda);

    expect(configAcc.liquidationThreshold).toEqual(liquidationThreshold);
    expect(configAcc.liquidationBonus).toEqual(liquidationBonus);
    expect(configAcc.minHealthFactor).toEqual(minHealthFactor);
  });
});
