# Solana Token Launchpad

A minimalist web application for creating custom SPL tokens on the Solana blockchain using the Token-2022 program.

## Overview

Solana Token Launchpad provides a simple, intuitive interface for creating and deploying custom tokens on the Solana blockchain. This tool abstracts away the complexity of token creation, allowing users to easily mint new tokens with custom parameters including name, symbol, metadata URL, and initial supply.

## Features

- **Token-2022 Program Support**: Create tokens using Solana's newest token program with enhanced features
- **Custom Token Properties**: Set token name, symbol, and metadata URL
- **Initial Supply Configuration**: Mint your desired initial token supply directly to your wallet
- **Wallet Integration**: Seamless connection with various Solana wallets
- **Clean, Responsive UI**: Dark-themed interface that works across devices
- **Devnet Support**: Test your tokens on Solana's devnet before mainnet deployment

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/FWangZil/solana-token-launchpad.git
   cd solana-token-launchpad
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

## Usage

1. Connect your Solana wallet using the "Select Wallet" button
2. Fill in the token details:
   - **Token Name**: A descriptive name for your token
   - **Token Symbol**: A short identifier (ticker) for your token
   - **Metadata URL**: A URL pointing to JSON metadata for your token
   - **Initial Supply**: The amount of tokens to mint initially
3. Click "Create a token" to initiate the transaction
4. Approve the transaction in your wallet
5. Your new token will be minted to your wallet upon successful creation

## Requirements

- Node.js v16+ and bun
- A Solana wallet (Phantom, Solflare, etc.)
- SOL for transaction fees (on devnet or mainnet)

## Technical Details

The application uses:
- React for the frontend framework
- @solana/web3.js for blockchain interactions
- @solana/wallet-adapter for wallet connections
- @solana/spl-token and @solana/spl-token-metadata for token operations

The token creation process:
1. Creates a new mint account
2. Initializes the mint with metadata pointer
3. Sets up token metadata
4. Creates an associated token account for the user
5. Mints the initial supply to the user's wallet

## Configuration

The application connects to Solana's devnet by default. To change to mainnet or another endpoint, modify the `endpoint` value in `App.js`:

```javascript
<ConnectionProvider endpoint={"https://api.mainnet-beta.solana.com"}>
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgements

- Solana Labs for the web3.js library
- The SPL Token team for the token standards
- All contributors who have helped improve this project
