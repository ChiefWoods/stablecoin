use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const POSITION_SEED: &[u8] = b"position";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const MINT_SEED: &[u8] = b"mint";
#[constant]
pub const MAX_BASIS_POINTS: u16 = 10000;
#[constant]
pub const ORACLE_MAX_AGE: u16 = 100;
#[constant]
pub const SOL_USD_FEED_ID: &str =
    "822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9";
#[constant]
pub const MINT_DECIMALS: u8 = 6;
