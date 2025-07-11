use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface},
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    calculate_health_factor, error::StablecoinError, Collateral, Config, COLLATERAL_SEED,
    CONFIG_SEED, MINT_SEED, SOL_SEED,
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, depositor.key().as_ref()],
        bump = collateral.bump,
        has_one = depositor,
    )]
    pub collateral: Account<'info, Collateral>,
    pub price_update: Account<'info, PriceUpdateV2>,
    #[account(
        mut,
        seeds = [SOL_SEED, depositor.key().as_ref()],
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
        init_if_needed,
        payer = depositor,
        associated_token::mint = mint,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl Withdraw<'_> {
    pub fn handler(
        ctx: Context<Withdraw>,
        amount_collateral: u64,
        amount_to_burn: u64,
    ) -> Result<()> {
        let collateral = &mut ctx.accounts.collateral;

        collateral.lamport_balance = ctx.accounts.sol_acc.lamports() - amount_collateral;
        collateral.amount_minted -= amount_to_burn;

        let health_factor = calculate_health_factor(
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

        let depositor_key = ctx.accounts.depositor.key();
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
                    to: ctx.accounts.depositor.to_account_info(),
                },
                signer_seeds,
            ),
            amount_collateral,
        )?;

        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    authority: ctx.accounts.depositor.to_account_info(),
                    from: ctx.accounts.depositor_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            amount_to_burn,
        )
    }
}
