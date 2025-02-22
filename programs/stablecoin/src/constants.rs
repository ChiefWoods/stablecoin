use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
pub const COLLATERAL_SEED: &[u8] = b"collateral";
pub const SOL_SEED: &[u8] = b"sol";
pub const MINT_SEED: &[u8] = b"mint";
pub const SOL_USD_FEED_ID: &str =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const MAX_BASIS_POINTS: u64 = 10000;
pub const MAXIMUM_AGE: u64 = 100;
pub const PRICE_FEED_DECIMAL_ADJUSTMENT: u128 = 10; // price feed returns 1e8, multiple by 10 to match lamports 10e9
