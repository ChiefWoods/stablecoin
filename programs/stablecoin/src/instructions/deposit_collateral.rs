use anchor_lang::{
    prelude::{pubkey::PUBKEY_BYTES, *},
    system_program::{create_account, transfer, CreateAccount, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};
use switchboard_on_demand::{
    default_queue, get_switchboard_on_demand_program_id, OnDemandError, QuoteVerifier,
    SwitchboardQuote,
};

use crate::{
    bps_to_decimal, calculate_health_factor, error::StablecoinError, get_price_from_quote,
    mint_signer, position_signer, validate_above_min_health_factor, validate_price, Config,
    Position, SafeMath, SafeMathAssign, CONFIG_SEED, ID, MINT_SEED, ORACLE_MAX_AGE, POSITION_SEED,
    VAULT_SEED,
};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    /// CHECK: deserialized in handler to initialize if needed
    pub position: UncheckedAccount<'info>,
    /// CHECK: SwitchbordOnDemand QueueAccountData
    #[account(
        address = default_queue(),
    )]
    pub oracle_queue: UncheckedAccount<'info>,
    /// CHECK: SwitchboardOnDemand SwitchboardQuote
    pub oracle_quote: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, position.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [MINT_SEED],
        bump = config.mint_bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = mint,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub slot_hashes_sysvar: Sysvar<'info, SlotHashes>,
    /// CHECK: Instructions sysvar
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

impl<'info> DepositCollateral<'info> {
    pub fn handler(
        ctx: Context<DepositCollateral>,
        collateral_amount: u64,
        amount_to_mint: u64,
    ) -> Result<()> {
        require_gt!(
            collateral_amount,
            0,
            StablecoinError::InvalidCollateralAmount
        );

        let DepositCollateral {
            depositor,
            depositor_token_account,
            mint,
            position,
            token_program,
            vault,
            system_program,
            config,
            oracle_queue,
            oracle_quote,
            instructions_sysvar,
            slot_hashes_sysvar,
            ..
        } = ctx.accounts;

        let mut position = Position::try_deserialize(
            &mut &position.to_account_info().data.borrow()[..],
        )
        .or_else(|_| {
            let depositor_key = depositor.key();
            let position_seeds: &[&[u8]] = &[POSITION_SEED, depositor_key.as_ref()];
            let (position_pda, position_bump) = Pubkey::find_program_address(position_seeds, &ID);

            require_keys_eq!(
                position_pda,
                position.key(),
                StablecoinError::InvalidPositionAddress
            );

            let position_signer: &[&[u8]] = position_signer!(depositor_key, position_bump);
            let space = Position::DISCRIMINATOR.len() + Position::INIT_SPACE;
            let min_rent = Rent::get()?.minimum_balance(space);

            create_account(
                CpiContext::new(
                    system_program.to_account_info(),
                    CreateAccount {
                        from: depositor.to_account_info(),
                        to: position.to_account_info(),
                    },
                )
                .with_signer(&[position_signer]),
                min_rent,
                space as u64,
                &ID,
            )?;

            let new_position = Position {
                bump: position_bump,
                vault_bump: ctx.bumps.vault,
                amount_minted: 0,
                depositor: depositor.key(),
            };

            new_position.serialize(&mut &mut position.to_account_info().data.borrow_mut()[..])?;
            Ok(new_position)
        })?;

        require_keys_eq!(
            *ctx.accounts.position.owner,
            ID,
            StablecoinError::InvalidProgramAccount
        );

        let lamport_balance = vault.lamports().safe_add(collateral_amount)?;
        position.amount_minted.safe_add_assign(amount_to_mint)?;

        let clock = Clock::get()?;

        let oracle_quote_ai = &oracle_quote.to_account_info();
        let oracle_quote_data = oracle_quote_ai.data.borrow();

        let discriminator = &oracle_quote_data[0..SwitchboardQuote::DISCRIMINATOR.len()];

        if discriminator != SwitchboardQuote::DISCRIMINATOR
            || *oracle_quote.owner != get_switchboard_on_demand_program_id()
        {
            return err!(OnDemandError::InvalidQuoteError);
        };

        let quote = QuoteVerifier::new()
            .queue(oracle_queue.to_account_info())
            .slothash_sysvar(slot_hashes_sysvar.to_account_info())
            .ix_sysvar(instructions_sysvar.to_account_info())
            .clock_slot(clock.slot)
            .max_age(ORACLE_MAX_AGE as u64)
            .verify(&oracle_quote_data[SwitchboardQuote::DISCRIMINATOR.len() + PUBKEY_BYTES..])
            .unwrap();

        let price = get_price_from_quote(quote)?;
        validate_price(price)?;

        let health_factor =
            calculate_health_factor(lamport_balance, position.amount_minted, price)?;

        validate_above_min_health_factor(
            health_factor,
            bps_to_decimal(config.min_loan_to_value_bps)?,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            collateral_amount,
        )?;

        let mint_bump = config.mint_bump;
        let mint_signer: &[&[u8]] = mint_signer!(mint_bump);

        if amount_to_mint > 0 {
            mint_to(
                CpiContext::new(
                    token_program.to_account_info(),
                    MintTo {
                        authority: mint.to_account_info(),
                        mint: mint.to_account_info(),
                        to: depositor_token_account.to_account_info(),
                    },
                )
                .with_signer(&[mint_signer]),
                amount_to_mint,
            )?;
        }

        Ok(())
    }
}
