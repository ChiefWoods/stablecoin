import { beforeEach, describe, expect, test } from "bun:test";
import { Stablecoin } from "../../target/types/stablecoin";
import { Program } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getConfigPda, getMintPda } from "../pda";
import { fetchConfigAcc } from "../accounts";
import { LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { fundedSystemAccountInfo, getSetup } from "../setup";

describe("initConfig", () => {
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
  });

  test("initializes a config", async () => {
    const liquidationThreshold = 5000; // 50% in basis points
    const liquidationBonus = 1000; // 10% in basis points
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

    const configPda = getConfigPda();
    const configAcc = await fetchConfigAcc(program, configPda);

    expect(configAcc.liquidationThreshold).toEqual(liquidationThreshold);
    expect(configAcc.liquidationBonus).toEqual(liquidationBonus);
    expect(configAcc.minHealthFactor).toEqual(minHealthFactor);
    expect(configAcc.authority).toStrictEqual(authority.publicKey);

    const mintPda = getMintPda();

    expect(configAcc.mint).toStrictEqual(mintPda);
  });
});
