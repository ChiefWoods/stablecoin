use anchor_lang::prelude::*;
use anchor_spl::token::spl_token::native_mint;
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

    let collateral_value =
        Decimal::new(lamports as i64, native_mint::DECIMALS as u32).safe_mul(price)?;
    let usd_minted = Decimal::new(amount_minted as i64, MINT_DECIMALS as u32);
    let health_factor = collateral_value.safe_div(usd_minted)?;

    Ok(health_factor)
}
