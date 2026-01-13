use anchor_lang::prelude::*;
use switchboard_on_demand::prelude::rust_decimal::Decimal;

use crate::{error::StablecoinError, MAX_BASIS_POINTS};

pub fn validate_bps(bps: u16) -> Result<()> {
    require_gte!(MAX_BASIS_POINTS, bps, StablecoinError::InvalidBasisPoints);

    Ok(())
}

pub fn validate_price(price: Decimal) -> Result<()> {
    require_gt!(price, Decimal::ZERO, StablecoinError::InvalidPrice);

    Ok(())
}

pub fn validate_ltv(min_ltv_bps: u16, liquidation_threshold_bps: u16) -> Result<()> {
    require_gt!(
        min_ltv_bps,
        liquidation_threshold_bps,
        StablecoinError::InvalidLtvConfiguration
    );

    Ok(())
}

pub fn validate_above_min_health_factor(
    health_factor: Decimal,
    min_ltv_bps: Decimal,
) -> Result<()> {
    require_gte!(
        health_factor,
        min_ltv_bps,
        StablecoinError::BelowMinimumHealthFactor
    );

    Ok(())
}
