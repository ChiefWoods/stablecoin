use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Position will be below minimum health factor")]
    BelowMinimumHealthFactor,
    #[msg("Cannot liquidate positions above liquidation threshold")]
    AboveLiquidationThreshold,
    #[msg("Price must be greater than 0")]
    InvalidPrice,
    #[msg("Basis points cannot be greater than 10000")]
    InvalidBasisPoints,
    #[msg("Position address is invalid")]
    InvalidPositionAddress,
    #[msg("Math operation overflow")]
    MathOverflow,
    #[msg("Math conversion failed")]
    ConversionFailed,
    #[msg("SOL/USD price feed is not in oracle quote account")]
    MissingRequiredPriceFeed,
    #[msg("Account is not owned by program")]
    InvalidProgramAccount,
    #[msg("Vault rent will be below minimum after withdrawal")]
    RentBelowMinimumAfterWithdrawal,
    #[msg("Collateral amount must be greater than 0")]
    InvalidCollateralAmount,
    #[msg("Liquidation threshold must be greater than minimum LTV")]
    InvalidLtvConfiguration,
}
