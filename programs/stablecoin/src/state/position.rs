use anchor_lang::prelude::*;

/// Represents a collateral debt position of a depositor.
#[account]
#[derive(InitSpace)]
pub struct Position {
    /// Address of the depositor.
    pub depositor: Pubkey,
    pub amount_minted: u64,
    /// Bump used for seed derivation.
    pub bump: u8,
    /// Bump used for vault system account seed derivation.
    pub vault_bump: u8,
}
