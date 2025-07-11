import { beforeEach, describe, expect, test } from "bun:test";
import { Stablecoin } from "../../target/types/stablecoin";
import { Program } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getConfigPda } from "../pda";
import { fetchConfigAcc } from "../accounts";
import { LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { fundedSystemAccountInfo, getSetup } from "../setup";

describe("updateConfig", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Stablecoin>;
  };

  const authority = Keypair.generate();

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  beforeEach(async () => {
    ({ litesvm, provider, program } = await getSetup([
      {
        pubkey: authority.publicKey,
        account: fundedSystemAccountInfo(),
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
    const liquidationThreshold = 2500; // 25% in basis points
    const liquidationBonus = 500; // 5% in basis points
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

    const configPda = getConfigPda();
    const configAcc = await fetchConfigAcc(program, configPda);

    expect(configAcc.liquidationThreshold).toEqual(liquidationThreshold);
    expect(configAcc.liquidationBonus).toEqual(liquidationBonus);
    expect(configAcc.minHealthFactor).toEqual(minHealthFactor);
  });
});
