use anchor_lang::prelude::*;

use crate::{Config, CONFIG_SEED};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateConfigArgs {
    pub liquidation_threshold: Option<u16>,
    pub liquidation_bonus: Option<u16>,
    pub min_health_factor: Option<f64>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, Config>,
}

impl UpdateConfig<'_> {
    pub fn update_config(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
        if let Some(liquidation_threshold) = args.liquidation_threshold {
            ctx.accounts.config.liquidation_threshold = liquidation_threshold;
        }

        if let Some(liquidation_bonus) = args.liquidation_bonus {
            ctx.accounts.config.liquidation_bonus = liquidation_bonus;
        }

        if let Some(min_health_factor) = args.min_health_factor {
            ctx.accounts.config.min_health_factor = min_health_factor;
        }

        Ok(())
    }
}
