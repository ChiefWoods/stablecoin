use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Bump used for seed derivation
    pub bump: u8,
    /// Bump used for mint seed derivation
    pub mint_bump: u8,
    /// LTV at which the loan is defined as under collateralized and can be liquidated in basis points
    pub liquidation_threshold: u16,
    /// Bonus percentage of collateral that can be liquidated in basis points
    pub liquidation_bonus: u16,
    /// Minimum health factor at which the loan can be liquidated
    pub min_health_factor: f64,
    /// Address that has authority over the config account
    pub authority: Pubkey,
    /// Address of the stablecoin mint
    pub mint: Pubkey,
}
