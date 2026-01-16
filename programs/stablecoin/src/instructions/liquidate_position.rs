use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::spl_associated_token_account::solana_program::native_token::LAMPORTS_PER_SOL,
    token_2022::{burn_checked, BurnChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use switchboard_on_demand::{default_queue, get_slot};
use switchboard_on_demand::{
    prelude::rust_decimal::{prelude::ToPrimitive, Decimal},
    SwitchboardQuote, SwitchboardQuoteExt,
};

use crate::{
    bps_to_decimal, calculate_health_factor, error::StablecoinError, get_oracle_quote,
    get_price_from_first_quote_feed, get_price_from_quote, validate_above_min_health_factor,
    validate_price, vault_signer, Config, Position, SafeMath, SafeMathAssign, CONFIG_SEED,
    MINT_SEED, POSITION_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct LiquidatePosition<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [POSITION_SEED, position.depositor.key().as_ref()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,
    /// CHECK: SwitchbordOnDemand QueueAccountData
    #[account(
        address = default_queue(),
    )]
    pub oracle_queue: UncheckedAccount<'info>,
    #[account(
        address = oracle_quote.canonical_key(&default_queue())
    )]
    pub oracle_quote: Box<Account<'info, SwitchboardQuote>>,
    #[account(
        mut,
        seeds = [VAULT_SEED, position.key().as_ref()],
        bump = position.vault_bump,
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [MINT_SEED],
        bump = config.mint_bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = liquidator,
    )]
    pub liquidator_token_account: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: Clock sysvar
    pub clock: UncheckedAccount<'info>,
    /// CHECK: Slot hashes sysvar
    #[account(address = sysvar::slot_hashes::ID)]
    pub slot_hashes_sysvar: UncheckedAccount<'info>,
    /// CHECK: Instructions sysvar
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

impl<'info> LiquidatePosition<'info> {
    pub fn handler(ctx: Context<LiquidatePosition>, amount_to_burn: u64) -> Result<()> {
        let LiquidatePosition {
            position,
            config,
            oracle_queue,
            oracle_quote,
            slot_hashes_sysvar,
            instructions_sysvar,
            vault,
            liquidator,
            liquidator_token_account,
            system_program,
            mint,
            token_program,
            clock,
            ..
        } = ctx.accounts;

        let oracle_quote_data = oracle_quote.to_account_data().unwrap();

        let price = if cfg!(not(feature = "test")) {
            let quote = get_oracle_quote(
                oracle_queue.to_account_info(),
                slot_hashes_sysvar.to_account_info(),
                instructions_sysvar.to_account_info(),
                get_slot(&clock.to_account_info()),
                &oracle_quote_data.as_slice(),
            )?;

            get_price_from_quote(quote)?
        } else {
            get_price_from_first_quote_feed(&oracle_quote.feeds)
        };

        validate_price(price)?;

        let mut health_factor =
            calculate_health_factor(vault.lamports(), position.amount_minted, price)?;

        require_gt!(
            bps_to_decimal(config.liquidation_threshold_bps)?,
            health_factor,
            StablecoinError::AboveLiquidationThreshold
        );

        let lamports = Decimal::new(amount_to_burn as i64, MINT_DECIMALS as u32)
            .safe_mul(LAMPORTS_PER_SOL.into())?
            .safe_div(price)?;
        let liquidation_bonus = lamports.safe_mul(bps_to_decimal(config.liquidation_bonus_bps)?)?;
        let amount_to_liquidate = lamports
            .safe_add(liquidation_bonus)?
            .to_u64()
            .ok_or(StablecoinError::ConversionFailed)?;

        let lamport_balance = vault.lamports().safe_sub(amount_to_liquidate)?;
        position.amount_minted.safe_sub_assign(amount_to_burn)?;

        health_factor = calculate_health_factor(lamport_balance, position.amount_minted, price)?;

        validate_above_min_health_factor(
            health_factor,
            bps_to_decimal(config.min_loan_to_value_bps)?,
        )?;

        let position_key = position.key();
        let vault_bump = position.vault_bump;
        let vault_signer: &[&[u8]] = vault_signer!(position_key, vault_bump);

        transfer(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                Transfer {
                    from: vault.to_account_info(),
                    to: liquidator.to_account_info(),
                },
                &[vault_signer],
            ),
            amount_to_liquidate,
        )?;

        burn_checked(
            CpiContext::new(
                token_program.to_account_info(),
                BurnChecked {
                    authority: liquidator.to_account_info(),
                    from: liquidator_token_account.to_account_info(),
                    mint: mint.to_account_info(),
                },
            ),
            amount_to_burn,
            mint.decimals,
        )?;

        Ok(())
    }
}
