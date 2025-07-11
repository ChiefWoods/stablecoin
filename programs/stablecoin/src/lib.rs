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

declare_id!("G5XQC4f9SdwJkbXyta14g5sy9Pq1w3EqsDqtmgaBEvZ1");

#[program]
pub mod stablecoin {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, args: InitConfigArgs) -> Result<()> {
        InitConfig::handler(ctx, args)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
        UpdateConfig::handler(ctx, args)
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        amount_collateral: u64,
        amount_to_mint: u64,
    ) -> Result<()> {
        Deposit::handler(ctx, amount_collateral, amount_to_mint)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount_collateral: u64,
        amount_to_burn: u64,
    ) -> Result<()> {
        Withdraw::handler(ctx, amount_collateral, amount_to_burn)
    }

    pub fn liquidate(ctx: Context<Liquidate>, amount_to_burn: u64) -> Result<()> {
        Liquidate::handler(ctx, amount_to_burn)
    }
}
