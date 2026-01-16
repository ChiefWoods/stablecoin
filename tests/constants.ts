import { PublicKey } from "@solana/web3.js";
import idl from "../target/idl/stablecoin.json";
import {
  ON_DEMAND_DEVNET_QUEUE,
  OracleQuote,
} from "@switchboard-xyz/on-demand";

export const STABLECOIN_PROGRAM_ID = new PublicKey(idl.address);
export const SURFPOOL_RPC_URL = "http://127.0.0.1:8899";

export const MINT_DECIMALS = 6;
export const SOL_USD_FEED_ID =
  "822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9";
export const ON_DEMAND_QUEUE = ON_DEMAND_DEVNET_QUEUE;
export const SOL_USD_ORACLE_QUOTE = OracleQuote.getCanonicalPubkey(
  // using devnet because there's no canonical oracle quote account created with the main Surge SOL/USD feed in mainnet
  ON_DEMAND_QUEUE,
  [SOL_USD_FEED_ID],
)[0];
