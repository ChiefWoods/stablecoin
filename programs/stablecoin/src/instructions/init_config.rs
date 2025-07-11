use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::{Config, CONFIG_SEED, MINT_SEED};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitConfigArgs {
    pub liquidation_threshold: u16,
    pub liquidation_bonus: u16,
    pub min_health_factor: f64,
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Config::DISCRIMINATOR.len() + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        seeds = [MINT_SEED],
        bump,
        mint::authority = mint,
        mint::decimals = 9,
        mint::freeze_authority = mint,
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl InitConfig<'_> {
    pub fn handler(ctx: Context<InitConfig>, args: InitConfigArgs) -> Result<()> {
        ctx.accounts.config.set_inner(Config {
            bump: ctx.bumps.config,
            mint_bump: ctx.bumps.mint,
            liquidation_threshold: args.liquidation_threshold,
            liquidation_bonus: args.liquidation_bonus,
            min_health_factor: args.min_health_factor,
            authority: ctx.accounts.authority.key(),
            mint: ctx.accounts.mint.key(),
        });

        Ok(())
    }
}
