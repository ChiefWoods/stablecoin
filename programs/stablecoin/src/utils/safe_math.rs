use anchor_lang::prelude::*;
use std::panic::Location;
use switchboard_on_demand::prelude::rust_decimal::Decimal;

use crate::{error::StablecoinError, MAX_BASIS_POINTS};

pub trait SafeMath: Sized {
    fn safe_add(self, rhs: Self) -> Result<Self>;
    fn safe_sub(self, rhs: Self) -> Result<Self>;
    fn safe_mul(self, rhs: Self) -> Result<Self>;
    fn safe_div(self, rhs: Self) -> Result<Self>;
}

macro_rules! checked_impl {
    ($t:ty) => {
        impl SafeMath for $t {
            #[track_caller]
            #[inline(always)]
            fn safe_add(self, rhs: $t) -> Result<$t> {
                match self.checked_add(rhs) {
                    Some(result) => Ok(result),
                    None => {
                        let caller = Location::caller();
                        msg!("Math overflow at {}:{}", caller.file(), caller.line());
                        Err(StablecoinError::MathOverflow.into())
                    }
                }
            }

            #[track_caller]
            #[inline(always)]
            fn safe_sub(self, rhs: $t) -> Result<$t> {
                match self.checked_sub(rhs) {
                    Some(result) => Ok(result),
                    None => {
                        let caller = Location::caller();
                        msg!("Math underflow at {}:{}", caller.file(), caller.line());
                        Err(StablecoinError::MathOverflow.into())
                    }
                }
            }

            #[track_caller]
            #[inline(always)]
            fn safe_mul(self, rhs: $t) -> Result<$t> {
                match self.checked_mul(rhs) {
                    Some(result) => Ok(result),
                    None => {
                        let caller = Location::caller();
                        msg!("Math overflow at {}:{}", caller.file(), caller.line());
                        Err(StablecoinError::MathOverflow.into())
                    }
                }
            }

            #[track_caller]
            #[inline(always)]
            fn safe_div(self, rhs: $t) -> Result<$t> {
                match self.checked_div(rhs) {
                    Some(result) => Ok(result),
                    None => {
                        let caller = Location::caller();
                        msg!("Division error at {}:{}", caller.file(), caller.line());
                        Err(StablecoinError::MathOverflow.into())
                    }
                }
            }
        }
    };
}

checked_impl!(u16);
checked_impl!(u32);
checked_impl!(u64);
checked_impl!(u128);
checked_impl!(i64);

pub trait SafeMathAssign: Sized {
    fn safe_add_assign(&mut self, rhs: Self) -> Result<()>;
    fn safe_sub_assign(&mut self, rhs: Self) -> Result<()>;
    fn safe_mul_assign(&mut self, rhs: Self) -> Result<()>;
    fn safe_div_assign(&mut self, rhs: Self) -> Result<()>;
}

macro_rules! assign_impl {
    ($t:ty) => {
        impl SafeMathAssign for $t {
            #[track_caller]
            #[inline(always)]
            fn safe_add_assign(&mut self, rhs: $t) -> Result<()> {
                *self = self.safe_add(rhs)?;
                Ok(())
            }

            #[track_caller]
            #[inline(always)]
            fn safe_sub_assign(&mut self, rhs: $t) -> Result<()> {
                *self = self.safe_sub(rhs)?;
                Ok(())
            }

            #[track_caller]
            #[inline(always)]
            fn safe_mul_assign(&mut self, rhs: $t) -> Result<()> {
                *self = self.safe_mul(rhs)?;
                Ok(())
            }

            #[track_caller]
            #[inline(always)]
            fn safe_div_assign(&mut self, rhs: $t) -> Result<()> {
                *self = self.safe_div(rhs)?;
                Ok(())
            }
        }
    };
}

assign_impl!(u16);
assign_impl!(u32);
assign_impl!(u64);
checked_impl!(Decimal);

pub trait SafePow: Sized {
    fn safe_pow(self, exp: u32) -> Result<Self>;
}

macro_rules! pow_impl {
    ($t:ty) => {
        impl SafePow for $t {
            #[track_caller]
            #[inline(always)]
            fn safe_pow(self, exp: u32) -> Result<$t> {
                match self.checked_pow(exp) {
                    Some(result) => Ok(result),
                    None => {
                        let caller = Location::caller();
                        msg!(
                            "Exponentiation overflow at {}:{}",
                            caller.file(),
                            caller.line()
                        );
                        Err(StablecoinError::MathOverflow.into())
                    }
                }
            }
        }
    };
}

pow_impl!(u64);

pub fn bps_to_decimal(bps: u16) -> Result<Decimal> {
    Decimal::from(bps).safe_div(MAX_BASIS_POINTS.into())
}
