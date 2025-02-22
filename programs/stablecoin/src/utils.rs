use anchor_lang::{prelude::*, solana_program::native_token::LAMPORTS_PER_SOL};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::{
    error::StablecoinError, MAXIMUM_AGE, MAX_BASIS_POINTS, PRICE_FEED_DECIMAL_ADJUSTMENT,
    SOL_USD_FEED_ID,
};

pub fn calculate_health_factor(
    lamports: u64,
    amount_minted: u64,
    liquidation_threshold: u16,
    price_feed: &Account<PriceUpdateV2>,
) -> Result<f64> {
    if amount_minted == 0 {
        return Ok(f64::MAX);
    }

    let collateral_lamports_per_usd = get_usd_from_lamports(&lamports, price_feed)?;
    let adjusted_collateral_lamports_per_usd =
        (collateral_lamports_per_usd * liquidation_threshold as u64) / MAX_BASIS_POINTS;
    let health_factor = (adjusted_collateral_lamports_per_usd as f64) / amount_minted as f64;

    Ok(health_factor)
}

fn get_usd_from_lamports(
    amount_in_lamports: &u64,
    price_feed: &Account<PriceUpdateV2>,
) -> Result<u64> {
    let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
    let price = price_feed
        .get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE, &feed_id)?
        .price;

    require_gt!(price, 0, StablecoinError::InvalidPrice);

    let price_in_usd = price as u128 * PRICE_FEED_DECIMAL_ADJUSTMENT;
    let amount_in_usd = (*amount_in_lamports as u128 * price_in_usd) / (LAMPORTS_PER_SOL as u128);

    Ok(amount_in_usd as u64)
}

pub fn get_lamports_from_usd(
    amount_in_usd: &u64,
    price_feed: &Account<PriceUpdateV2>,
) -> Result<u64> {
    let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
    let price = price_feed
        .get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE, &feed_id)?
        .price;

    require_gt!(price, 0, StablecoinError::InvalidPrice);

    let price_in_usd = price as u128 * PRICE_FEED_DECIMAL_ADJUSTMENT;
    let amount_in_lamports = ((*amount_in_usd as u128) * (LAMPORTS_PER_SOL as u128)) / price_in_usd;

    Ok(amount_in_lamports as u64)
}
