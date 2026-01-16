pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
pub use utils::*;

declare_id!("5qbQCdx3i67qT9yw4AmvM1oqneynXqbUzkdzTTR95u2v");

#[program]
pub mod stablecoin {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        args: InitializeConfigArgs,
    ) -> Result<()> {
        InitializeConfig::handler(ctx, args)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
        UpdateConfig::handler(ctx, args)
    }

    pub fn deposit_collateral(
        ctx: Context<DepositCollateral>,
        amount_collateral: u64,
        amount_to_mint: u64,
    ) -> Result<()> {
        DepositCollateral::handler(ctx, amount_collateral, amount_to_mint)
    }

    pub fn withdraw_collateral(
        ctx: Context<WithdrawCollateral>,
        amount_collateral: u64,
        amount_to_burn: u64,
    ) -> Result<()> {
        WithdrawCollateral::handler(ctx, amount_collateral, amount_to_burn)
    }

    pub fn liquidate_position(ctx: Context<LiquidatePosition>, amount_to_burn: u64) -> Result<()> {
        LiquidatePosition::handler(ctx, amount_to_burn)
    }
}
