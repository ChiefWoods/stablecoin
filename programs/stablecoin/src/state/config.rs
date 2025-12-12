use anchor_lang::prelude::*;

/// Config account storing protocol-wide settings.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Address that can update protocol configurations.
    pub authority: Pubkey,
    /// Minimum LTV that a position must maintain, in basis points.
    pub min_loan_to_value_bps: u16,
    /// Minimum LTV at which a position can be liquidated, in basis points.
    pub liquidation_threshold_bps: u16,
    /// Bonus collateral that can be liquidated, in basis points.
    pub liquidation_bonus_bps: u16,
    /// Bump used for seed derivation.
    pub bump: u8,
    /// Bump used for mint seed derivation.
    pub mint_bump: u8,
}
