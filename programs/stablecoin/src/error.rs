use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Below minimum health factor")]
    BelowMinimumHealthFactor,
    #[msg("Above minimum health factor")]
    AboveMinimumHealthFactor,
    #[msg("Price must be greater than 0")]
    InvalidPrice,
}
