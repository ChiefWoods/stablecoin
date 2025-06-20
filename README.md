# Stablecoin

USD-pegged stablecoin for [Solana Development Bootcamp](https://github.com/solana-developers/developer-bootcamp-2024).

[Source Repository](https://github.com/ChiefWoods/stablecoin)

## Built With

### Languages

- [![Rust](https://img.shields.io/badge/Rust-f75008?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
- [![TypeScript](https://img.shields.io/badge/TypeScript-ffffff?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

### Libraries

- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)
- [@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)
- [solana-bankrun](https://kevinheavey.github.io/solana-bankrun/)
- [anchor-bankrun](https://kevinheavey.github.io/solana-bankrun/)

### Crates

- [anchor-lang](https://docs.rs/anchor-lang/latest/anchor_lang/)
- [anchor-spl](https://docs.rs/anchor-spl/latest/anchor_spl/)
- [pyth-solana-receiver-sdk](https://docs.rs/pyth-solana-receiver-sdk/latest/pyth_solana_receiver_sdk/)

### Test Runner

- [![Bun](https://img.shields.io/badge/Bun-000?style=for-the-badge&logo=bun)](https://bun.sh/)

## Getting Started

### Prerequisites

1. Update your Solana CLI, Bun toolkit and avm

```bash
agave-install init 2.1.20
bun upgrade
avm init 0.31.1
```

### Setup

1. Clone the repository

```bash
git clone https://github.com/ChiefWoods/stablecoin.git
```

2. Install all dependencies

```bash
bun i
```

3. Resync your program id

```bash
anchor keys sync
```

4. Build the program

```bash
anchor build
```

#### Testing

Run all `.test.ts` files under `/tests`.

```bash
bun test
```

Note: certain test parameters may have to be adjusted as the SOL-USD price fluctuates.

#### Deployment

1. Configure to use localnet

```bash
solana config set -ul
```

2. Deploy the program

```bash
anchor deploy
```

3. Optionally initialize IDL

```bash
anchor idl init -f target/idl/stablecoin.json <PROGRAM_ID>
```

## Issues

View the [open issues](https://github.com/ChiefWoods/stablecoin/issues) for a full list of proposed features and known bugs.

## Acknowledgements

### Resources

- [Shields.io](https://shields.io/)

## Contact

[chii.yuen@hotmail.com](mailto:chii.yuen@hotmail.com)
