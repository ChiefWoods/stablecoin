use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};
use switchboard_on_demand::{default_queue, get_slot};

use crate::{
    bps_to_decimal, calculate_health_factor, error::StablecoinError, get_oracle_quote,
    get_price_from_quote, mint_signer, validate_above_min_health_factor, validate_price, Config,
    Position, SafeMath, SafeMathAssign, CONFIG_SEED, MINT_SEED, POSITION_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        init_if_needed,
        payer = depositor,
        space = Position::DISCRIMINATOR.len() + Position::INIT_SPACE,
        seeds = [POSITION_SEED, depositor.key().as_ref()],
        bump,
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
        bump,
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
    /// CHECK: Clock sysvar
    pub clock: UncheckedAccount<'info>,
    /// CHECK: Slot hashes sysvar
    #[account(address = sysvar::slot_hashes::ID)]
    pub slot_hashes_sysvar: UncheckedAccount<'info>,
    /// CHECK: Instructions sysvar
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

impl<'info> DepositCollateral<'info> {
    pub fn handler(
        ctx: Context<DepositCollateral>,
        collateral_amount: u64,
        amount_to_mint: u64,
    ) -> Result<()> {
        require_gt!(
            collateral_amount,
            0,
            StablecoinError::InvalidCollateralAmount
        );

        let DepositCollateral {
            depositor,
            depositor_token_account,
            mint,
            position,
            token_program,
            vault,
            config,
            oracle_queue,
            oracle_quote,
            instructions_sysvar,
            slot_hashes_sysvar,
            clock,
            ..
        } = ctx.accounts;

        if position.bump == 0 {
            **position = Position {
                depositor: depositor.key(),
                amount_minted: 0,
                bump: ctx.bumps.position,
                vault_bump: ctx.bumps.vault,
            }
        }

        let lamport_balance = vault.lamports().safe_add(collateral_amount)?;
        position.amount_minted.safe_add_assign(amount_to_mint)?;

        let oracle_quote_data = oracle_quote.data.borrow();

        let quote = get_oracle_quote(
            oracle_queue.to_account_info(),
            slot_hashes_sysvar.to_account_info(),
            instructions_sysvar.to_account_info(),
            get_slot(&clock.to_account_info()),
            &oracle_quote_data,
        )?;

        let price = get_price_from_quote(quote)?;
        validate_price(price)?;

        let health_factor =
            calculate_health_factor(lamport_balance, position.amount_minted, price)?;

        validate_above_min_health_factor(
            health_factor,
            bps_to_decimal(config.min_loan_to_value_bps)?,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            collateral_amount,
        )?;

        let mint_bump = config.mint_bump;
        let mint_signer: &[&[u8]] = mint_signer!(mint_bump);

        if amount_to_mint > 0 {
            mint_to(
                CpiContext::new(
                    token_program.to_account_info(),
                    MintTo {
                        authority: mint.to_account_info(),
                        mint: mint.to_account_info(),
                        to: depositor_token_account.to_account_info(),
                    },
                )
                .with_signer(&[mint_signer]),
                amount_to_mint,
            )?;
        }

        Ok(())
    }
}
