use anchor_lang::prelude::*;
use anchor_spl::associated_token::spl_associated_token_account::solana_program::native_token::LAMPORTS_PER_SOL;
use switchboard_on_demand::prelude::rust_decimal::Decimal;

use crate::{SafeMath, MINT_DECIMALS};

/// Calculates the health factor given the collateral amount, minted amount,
///
/// Health factor of 1.0 means 1 unit of collateral (SOL) backs 1 unit of debt (stablecoin).
pub fn calculate_health_factor(
    lamports: u64,
    amount_minted: u64,
    price: Decimal,
) -> Result<Decimal> {
    if amount_minted == 0 {
        return Ok(Decimal::MAX);
    }

    let collateral_value = Decimal::from(lamports)
        .safe_mul(price)?
        .safe_div(LAMPORTS_PER_SOL.into())?;
    let usd_minted =
        Decimal::from(amount_minted).safe_div(Decimal::new(1, MINT_DECIMALS as u32))?;
    let health_factor = collateral_value.safe_div(usd_minted)?;

    Ok(health_factor)
}
