import {
  AccountNamespace,
  Address,
  AnchorProvider,
  Idl,
  IdlAccounts,
  Program,
  Wallet,
} from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

export class ProgramClient<I extends Idl> {
  connection: Connection;
  program: Program<I>;

  constructor(provider: AnchorProvider, idl: any) {
    this.connection = provider.connection;
    this.program = new Program<I>(idl, provider);
  }

  getProgramId() {
    return this.program.programId;
  }

  async fetchProgramAccount<T extends keyof AccountNamespace<I>>(
    pda: Address,
    accountName: T,
  ): Promise<IdlAccounts<I>[T] | null> {
    return await this.program.account[accountName].fetchNullable(pda);
  }

  // fetchMultipleProgramAccounts and fetchAllProgramAccounts stripped
}
