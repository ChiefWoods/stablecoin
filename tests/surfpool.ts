import { Keypair, PublicKey } from "@solana/web3.js";
import { SURFPOOL_RPC_URL } from "./constants";
import {
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getMinimumBalanceForRentExemptMultisig,
  MINT_SIZE,
  MintLayout,
  MULTISIG_SIZE,
  MultisigLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { connection } from "./setup";

export enum TimeTravelConfig {
  Epoch = "absoluteEpoch",
  Slot = "absoluteSlot",
  Timestamp = "absoluteTimestamp",
}

export class Surfpool {
  static async setAccount({
    publicKey,
    data = null,
    executable = null,
    lamports = null,
    owner = null,
    rentEpoch = null,
  }: {
    publicKey: string;
    data?: string;
    executable?: boolean;
    lamports?: number;
    owner?: string;
    rentEpoch?: number;
  }) {
    await fetch(SURFPOOL_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "surfnet_setAccount",
        params: [
          publicKey,
          {
            data,
            executable,
            lamports,
            owner,
            rentEpoch,
          },
        ],
      }),
    });
  }

  static async timeTravel({
    config,
    value,
  }: {
    config: TimeTravelConfig;
    value: number;
  }) {
    await fetch(SURFPOOL_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "surfnet_timeTravel",
        params: [
          {
            [config]: value,
          },
        ],
      }),
    });
  }

  static async initMint({
    mint = Keypair.generate().publicKey,
    mintAuthority = PublicKey.default,
    supply = 0n,
    decimals = 6,
    isInitialized = true,
    freezeAuthority = PublicKey.default,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    mint?: PublicKey;
    mintAuthority?: PublicKey;
    supply?: bigint;
    decimals?: number;
    isInitialized?: boolean;
    freezeAuthority?: PublicKey;
    tokenProgram?: PublicKey;
  }) {
    const mintData = Buffer.alloc(MINT_SIZE);

    MintLayout.encode(
      {
        mintAuthority,
        mintAuthorityOption: mintAuthority.equals(PublicKey.default) ? 0 : 1,
        supply,
        decimals,
        isInitialized,
        freezeAuthority,
        freezeAuthorityOption: freezeAuthority.equals(PublicKey.default)
          ? 0
          : 1,
      },
      mintData,
    );

    await Surfpool.setAccount({
      publicKey: mint.toBase58(),
      data: mintData.toHex(),
      lamports: await getMinimumBalanceForRentExemptMint(connection),
      owner: tokenProgram.toBase58(),
    });

    return mint;
  }

  static async setTokenAccount({
    owner,
    mint,
    update = {
      amount: null,
      closeAuthority: null,
      delegate: null,
      delagateAmount: null,
      state: null,
    },
    tokenProgram = TOKEN_PROGRAM_ID.toBase58(),
  }: {
    owner: string;
    mint: string;
    update: {
      amount?: number;
      closeAuthority?: string;
      delegate?: string;
      delagateAmount?: string;
      state?: "initialized" | "frozen" | "closed";
    };
    tokenProgram?: string;
  }) {
    await fetch(SURFPOOL_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "surfnet_setTokenAccount",
        params: [owner, mint, update, tokenProgram],
      }),
    });

    return getAssociatedTokenAddressSync(
      new PublicKey(mint),
      new PublicKey(owner),
      !PublicKey.isOnCurve(owner),
      new PublicKey(tokenProgram),
    );
  }

  static async initMultisig({
    multisig = Keypair.generate().publicKey,
    isInitialized = true,
    m,
    n,
    tokenProgram = TOKEN_PROGRAM_ID,
    signer1 = PublicKey.default,
    signer2 = PublicKey.default,
    signer3 = PublicKey.default,
    signer4 = PublicKey.default,
    signer5 = PublicKey.default,
    signer6 = PublicKey.default,
    signer7 = PublicKey.default,
    signer8 = PublicKey.default,
    signer9 = PublicKey.default,
    signer10 = PublicKey.default,
    signer11 = PublicKey.default,
  }: {
    multisig?: PublicKey;
    isInitialized?: boolean;
    m: number;
    n: number;
    tokenProgram?: PublicKey;
    signer1?: PublicKey;
    signer2?: PublicKey;
    signer3?: PublicKey;
    signer4?: PublicKey;
    signer5?: PublicKey;
    signer6?: PublicKey;
    signer7?: PublicKey;
    signer8?: PublicKey;
    signer9?: PublicKey;
    signer10?: PublicKey;
    signer11?: PublicKey;
  }) {
    const multisigData = Buffer.alloc(MULTISIG_SIZE);

    MultisigLayout.encode(
      {
        isInitialized,
        m,
        n,
        signer1,
        signer2,
        signer3,
        signer4,
        signer5,
        signer6,
        signer7,
        signer8,
        signer9,
        signer10,
        signer11,
      },
      multisigData,
    );

    await Surfpool.setAccount({
      publicKey: multisig.toBase58(),
      data: multisigData.toHex(),
      lamports: await getMinimumBalanceForRentExemptMultisig(connection),
      owner: tokenProgram.toBase58(),
    });

    return multisig;
  }
}
