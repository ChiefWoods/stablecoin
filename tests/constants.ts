import { PublicKey } from "@solana/web3.js";
import idl from "../target/idl/stablecoin.json";
import {
  ON_DEMAND_MAINNET_QUEUE,
  OracleQuote,
} from "@switchboard-xyz/on-demand";

export const STABLECOIN_PROGRAM_ID = new PublicKey(idl.address);
export const SURFPOOL_RPC_URL = "http://127.0.0.1:8899";

export const MINT_DECIMALS = 6;
export const SOL_USD_FEED_ID =
  "4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812";
export const SOL_USD_ORACLE_QUOTE = OracleQuote.getCanonicalPubkey(
  ON_DEMAND_MAINNET_QUEUE,
  [SOL_USD_FEED_ID],
)[0];
