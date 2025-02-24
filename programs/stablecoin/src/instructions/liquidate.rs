use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    calculate_health_factor, error::StablecoinError, get_lamports_from_usd, Collateral, Config,
    COLLATERAL_SEED, CONFIG_SEED, MAX_BASIS_POINTS, MINT_SEED, SOL_SEED,
};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, collateral.depositor.key().as_ref()],
        bump = collateral.bump,
    )]
    pub collateral: Account<'info, Collateral>,
    pub price_update: Account<'info, PriceUpdateV2>,
    #[account(
        mut,
        seeds = [SOL_SEED, collateral.depositor.key().as_ref()],
        bump = collateral.sol_acc_bump,
    )]
    pub sol_acc: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [MINT_SEED],
        bump = config.mint_bump,
        mint::token_program = token_program,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = liquidator,
        associated_token::token_program = token_program
    )]
    pub liquidator_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl Liquidate<'_> {
    pub fn liquidate(ctx: Context<Liquidate>, amount_to_burn: u64) -> Result<()> {
        let mut health_factor = calculate_health_factor(
            ctx.accounts.collateral.lamport_balance,
            ctx.accounts.collateral.amount_minted,
            ctx.accounts.config.liquidation_threshold,
            &ctx.accounts.price_update,
        )?;

        require!(
            health_factor < ctx.accounts.config.min_health_factor,
            StablecoinError::AboveMinimumHealthFactor
        );

        let lamports = get_lamports_from_usd(&amount_to_burn, &ctx.accounts.price_update)?;
        let liquidation_bonus =
            lamports * ctx.accounts.config.liquidation_bonus as u64 / MAX_BASIS_POINTS;
        let amount_to_liquidate = lamports + liquidation_bonus;

        let collateral = &mut ctx.accounts.collateral;

        collateral.lamport_balance = ctx.accounts.sol_acc.lamports() - amount_to_liquidate;
        collateral.amount_minted -= amount_to_burn;

        health_factor = calculate_health_factor(
            ctx.accounts.collateral.lamport_balance,
            ctx.accounts.collateral.amount_minted,
            ctx.accounts.config.liquidation_threshold,
            &ctx.accounts.price_update,
        )?;

        require_gte!(
            health_factor,
            ctx.accounts.config.min_health_factor,
            StablecoinError::BelowMinimumHealthFactor
        );

        let depositor_key = ctx.accounts.collateral.depositor.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            SOL_SEED,
            depositor_key.as_ref(),
            &[ctx.accounts.collateral.sol_acc_bump],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sol_acc.to_account_info(),
                    to: ctx.accounts.liquidator.to_account_info(),
                },
                signer_seeds,
            ),
            amount_to_liquidate,
        )?;

        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    authority: ctx.accounts.liquidator.to_account_info(),
                    from: ctx.accounts.liquidator_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            amount_to_burn,
        )
    }
}
