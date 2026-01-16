#[macro_export]
macro_rules! position_signer {
    ($depositor_key: expr, $bump: expr) => {
        &[POSITION_SEED, $depositor_key.as_ref(), &[$bump]]
    };
}

#[macro_export]
macro_rules! mint_signer {
    ($bump: expr) => {
        &[MINT_SEED, &[$bump]]
    };
}

#[macro_export]
macro_rules! vault_signer {
    ($position_key: expr, $bump: expr) => {
        &[VAULT_SEED, $position_key.as_ref(), &[$bump]]
    };
}
