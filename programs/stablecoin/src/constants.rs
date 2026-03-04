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
// 0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9
pub const SOL_USD_FEED_ID: [u8; 32] = [
    0x82, 0x25, 0x12, 0xee, 0x9a, 0xdd, 0x93, 0x51, 0x8e, 0xca, 0x1c, 0x10, 0x5a, 0x38, 0x42, 0x28,
    0x41, 0xa7, 0x6c, 0x59, 0x0d, 0xb0, 0x79, 0xee, 0xbb, 0x28, 0x3d, 0xeb, 0x2c, 0x14, 0xca, 0xa9,
];
#[constant]
pub const MINT_DECIMALS: u8 = 6;
