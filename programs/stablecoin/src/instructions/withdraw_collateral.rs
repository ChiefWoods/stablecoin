use anchor_lang::{
    prelude::{pubkey::PUBKEY_BYTES, *},
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{burn_checked, BurnChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use switchboard_on_demand::{
    default_queue, get_switchboard_on_demand_program_id, OnDemandError, QuoteVerifier,
    SwitchboardQuote,
};

use crate::{
    bps_to_decimal, calculate_health_factor, error::StablecoinError, get_price_from_quote,
    validate_above_min_health_factor, validate_price, vault_signer, Config, Position, SafeMath,
    SafeMathAssign, CONFIG_SEED, MINT_SEED, ORACLE_MAX_AGE, POSITION_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [POSITION_SEED, depositor.key().as_ref()],
        bump = position.bump,
        has_one = depositor,
    )]
    pub position: Account<'info, Position>,
    /// CHECK: SwitchbordOnDemand QueueAccountData
    #[account(
        address = default_queue(),
    )]
    pub oracle_queue: UncheckedAccount<'info>,
    /// CHECK: SwitchboardOnDemand SwitchboardQuote
    pub oracle_quote: UncheckedAccount<'info>,
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
        init_if_needed,
        payer = depositor,
        associated_token::mint = mint,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub slot_hashes_sysvar: Sysvar<'info, SlotHashes>,
    /// CHECK: Instructions sysvar
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

impl<'info> WithdrawCollateral<'info> {
    pub fn handler(
        ctx: Context<WithdrawCollateral>,
        collateral_amount: u64,
        amount_to_burn: u64,
    ) -> Result<()> {
        let WithdrawCollateral {
            position,
            vault,
            oracle_queue,
            oracle_quote,
            slot_hashes_sysvar,
            instructions_sysvar,
            config,
            depositor,
            depositor_token_account,
            mint,
            token_program,
            system_program,
            ..
        } = ctx.accounts;

        let lamport_balance = vault.lamports().safe_sub(collateral_amount)?;
        position.amount_minted.safe_sub_assign(amount_to_burn)?;

        let clock = Clock::get()?;

        let oracle_quote_ai = &oracle_quote.to_account_info();
        let oracle_quote_data = oracle_quote_ai.data.borrow();

        let discriminator = &oracle_quote_data[0..SwitchboardQuote::DISCRIMINATOR.len()];

        if discriminator != SwitchboardQuote::DISCRIMINATOR
            || *oracle_quote.owner != get_switchboard_on_demand_program_id()
        {
            return err!(OnDemandError::InvalidQuoteError);
        };

        let quote = QuoteVerifier::new()
            .queue(oracle_queue.to_account_info())
            .slothash_sysvar(slot_hashes_sysvar.to_account_info())
            .ix_sysvar(instructions_sysvar.to_account_info())
            .clock_slot(clock.slot)
            .max_age(ORACLE_MAX_AGE as u64)
            .verify(&oracle_quote_data[SwitchboardQuote::DISCRIMINATOR.len() + PUBKEY_BYTES..])
            .unwrap();

        let price = get_price_from_quote(quote)?;
        validate_price(price)?;

        let health_factor =
            calculate_health_factor(lamport_balance, position.amount_minted, price)?;

        validate_above_min_health_factor(
            health_factor,
            bps_to_decimal(config.min_loan_to_value_bps)?,
        )?;

        let min_rent = Rent::get()?.minimum_balance(vault.data_len());

        require_gte!(
            lamport_balance,
            min_rent,
            StablecoinError::RentBelowMinimumAfterWithdrawal
        );

        let position_key = position.key();
        let vault_bump = position.vault_bump;
        let vault_signer: &[&[u8]] = vault_signer!(position_key, vault_bump);

        transfer(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                Transfer {
                    from: vault.to_account_info(),
                    to: depositor.to_account_info(),
                },
                &[vault_signer],
            ),
            collateral_amount,
        )?;

        if amount_to_burn > 0 {
            burn_checked(
                CpiContext::new(
                    token_program.to_account_info(),
                    BurnChecked {
                        authority: depositor.to_account_info(),
                        from: depositor_token_account.to_account_info(),
                        mint: mint.to_account_info(),
                    },
                ),
                amount_to_burn,
                mint.decimals,
            )?;
        }

        Ok(())
    }
}
