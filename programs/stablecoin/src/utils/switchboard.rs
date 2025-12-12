use anchor_lang::prelude::*;

use switchboard_on_demand::{prelude::rust_decimal::Decimal, OracleQuote};

use crate::{error::StablecoinError, SOL_USD_FEED_ID};

pub fn get_price_from_quote(quote: OracleQuote) -> Result<Decimal> {
    Ok(quote
        .feeds()
        .iter()
        .find(|feed| feed.feed_id() == SOL_USD_FEED_ID.as_bytes())
        .ok_or(StablecoinError::MissingRequiredPriceFeed)?
        .value())
}
