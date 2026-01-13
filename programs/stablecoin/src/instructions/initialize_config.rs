use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::{validate_bps, validate_ltv, Config, CONFIG_SEED, MINT_DECIMALS, MINT_SEED};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeConfigArgs {
    pub liquidation_threshold_bps: u16,
    pub liquidation_bonus_bps: u16,
    pub min_loan_to_value_bps: u16,
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
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
        mint::decimals = MINT_DECIMALS,
        mint::freeze_authority = mint,
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl InitializeConfig<'_> {
    pub fn handler(ctx: Context<InitializeConfig>, args: InitializeConfigArgs) -> Result<()> {
        let InitializeConfig { authority, .. } = ctx.accounts;

        validate_bps(args.liquidation_bonus_bps)?;
        validate_ltv(args.min_loan_to_value_bps, args.liquidation_threshold_bps)?;

        ctx.accounts.config.set_inner(Config {
            bump: ctx.bumps.config,
            mint_bump: ctx.bumps.mint,
            liquidation_threshold_bps: args.liquidation_threshold_bps,
            liquidation_bonus_bps: args.liquidation_bonus_bps,
            min_loan_to_value_bps: args.min_loan_to_value_bps,
            authority: authority.key(),
        });

        Ok(())
    }
}
