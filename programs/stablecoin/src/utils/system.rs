use anchor_lang::prelude::*;

/// Lifted from private `anchor_lang::common::close`: https://github.com/coral-xyz/anchor/blob/714d5248636493a3d1db1481f16052836ee59e94/lang/src/common.rs#L6
pub fn close<'info>(info: AccountInfo<'info>, sol_destination: AccountInfo<'info>) -> Result<()> {
    let dest_starting_lamports = sol_destination.lamports();
    **sol_destination.lamports.borrow_mut() =
        dest_starting_lamports.checked_add(info.lamports()).unwrap();
    **info.lamports.borrow_mut() = 0;

    info.assign(&system_program::ID);
    info.resize(0).map_err(Into::into)
}
