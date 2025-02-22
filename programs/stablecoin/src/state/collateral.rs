use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Collateral {
    /// Boolean indicating if the account has been initialized
    pub initialized: bool,
    /// Bump used for seed derivation
    pub bump: u8,
    /// Bump used for SOL account seed derivation
    pub sol_acc_bump: u8,
    // Amount of lamports in balance
    pub lamport_balance: u64,
    // Amount of stablecoin minted
    pub amount_minted: u64,
    // Address of the depositor
    pub depositor: Pubkey,
}
