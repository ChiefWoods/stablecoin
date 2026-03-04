use anchor_lang::prelude::{pubkey::PUBKEY_BYTES, *};

use switchboard_on_demand::{
    prelude::rust_decimal::Decimal, OracleQuote, QuoteVerifier, SwitchboardQuote,
};

use crate::{error::StablecoinError, ORACLE_MAX_AGE, SOL_USD_FEED_ID};

pub fn get_oracle_quote<'b, 'info: 'b>(
    queue: AccountInfo<'info>,
    slot_hashes_sysvar: AccountInfo<'info>,
    instructions_sysvar: AccountInfo<'info>,
    slot: u64,
    quote_data: &'b [u8],
) -> Result<OracleQuote<'b>> {
    let mut verifier = QuoteVerifier::new();

    verifier
        .queue(queue.to_account_info())
        .slothash_sysvar(slot_hashes_sysvar.to_account_info())
        .ix_sysvar(instructions_sysvar.to_account_info())
        .clock_slot(slot)
        .max_age(ORACLE_MAX_AGE as u64);

    // discriminator + queue pubkey
    let delimited = &quote_data[SwitchboardQuote::DISCRIMINATOR.len() + PUBKEY_BYTES..];

    let quote = if cfg!(feature = "no-staleness-check") {
        verifier.parse_unverified_delimited(delimited).unwrap()
    } else {
        verifier.verify_delimited(delimited).unwrap()
    };

    Ok(quote)
}

pub fn get_price_from_quote(quote: OracleQuote) -> Result<Decimal> {
    Ok(quote
        .feeds()
        .iter()
        .find(|feed| feed.hex_id() == SOL_USD_FEED_ID)
        .ok_or(StablecoinError::MissingRequiredPriceFeed)?
        .value())
}
