use anchor_lang::prelude::*;

use crate::{validate_bps, validate_ltv, Config, CONFIG_SEED};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateConfigArgs {
    pub liquidation_threshold_bps: Option<u16>,
    pub liquidation_bonus_bps: Option<u16>,
    pub min_loan_to_value_bps: Option<u16>,
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
    pub fn handler(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
        let UpdateConfigArgs {
            liquidation_bonus_bps,
            liquidation_threshold_bps,
            min_loan_to_value_bps,
        } = args;

        let config = &mut ctx.accounts.config;

        if let Some(liquidation_threshold_bps) = liquidation_threshold_bps {
            config.liquidation_threshold_bps = liquidation_threshold_bps;
        }

        if let Some(liquidation_bonus_bps) = liquidation_bonus_bps {
            validate_bps(liquidation_bonus_bps)?;

            config.liquidation_bonus_bps = liquidation_bonus_bps;
        }

        if let Some(min_loan_to_value_bps) = min_loan_to_value_bps {
            config.min_loan_to_value_bps = min_loan_to_value_bps;
        }

        validate_ltv(
            config.min_loan_to_value_bps,
            config.liquidation_threshold_bps,
        )?;

        Ok(())
    }
}
