use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    calculate_health_factor, error::StablecoinError, Collateral, Config, COLLATERAL_SEED,
    CONFIG_SEED, MINT_SEED, SOL_SEED,
};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,
    #[account(
        init_if_needed,
        payer = depositor,
        space = Collateral::DISCRIMINATOR.len() + Collateral::INIT_SPACE,
        seeds = [COLLATERAL_SEED, depositor.key().as_ref()],
        bump,
    )]
    pub collateral: Account<'info, Collateral>,
    pub price_update: Account<'info, PriceUpdateV2>,
    #[account(
        mut,
        seeds = [SOL_SEED, depositor.key().as_ref()],
        bump,
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

impl Deposit<'_> {
    pub fn handler(
        ctx: Context<Deposit>,
        amount_collateral: u64,
        amount_to_mint: u64,
    ) -> Result<()> {
        let collateral = &mut ctx.accounts.collateral;

        if !collateral.initialized {
            collateral.set_inner(Collateral {
                initialized: true,
                bump: ctx.bumps.collateral,
                sol_acc_bump: ctx.bumps.sol_acc,
                lamport_balance: 0,
                amount_minted: 0,
                depositor: ctx.accounts.depositor.key(),
            });
        }

        collateral.lamport_balance = ctx.accounts.sol_acc.lamports() + amount_collateral;
        collateral.amount_minted += amount_to_mint;

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

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.sol_acc.to_account_info(),
                },
            ),
            amount_collateral,
        )?;

        let signer_seeds: &[&[&[u8]]] = &[&[MINT_SEED, &[ctx.accounts.config.mint_bump]]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.depositor_ata.to_account_info(),
                },
                signer_seeds,
            ),
            amount_to_mint,
        )
    }
}
