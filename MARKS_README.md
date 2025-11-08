# Marks Protocol - GMX Synthetics Contracts

This repository contains the smart contracts for the Marks protocol, a fork of GMX Synthetics v2 adapted for trading stablecoin FX pairs and other global assets with leverage.

## Overview

Marks is an exchange that lets users trade stablecoin FX and other global assets with leverage, including:
- **Emerging Market FX Pairs**: USDT/NGN (Nigerian Naira), USDT/ARS (Argentine Peso), USDT/PKR (Pakistani Rupee), USDT/COP (Colombian Peso)
- **Stock Indices**: TSLA, AAPL, NVDA, META

The protocol is built on GMX Synthetics v2 architecture with minimal contract modifications and custom market configurations tailored for these asset classes.

## What We Changed

### 1. Custom Oracle Provider Contract

**MockOracleProvider.sol** (`contracts/oracle/MockOracleProvider.sol`)

A simple oracle provider implementation that:
- Implements the `IOracleProvider` interface required by GMX
- Provides `getOraclePrice(token, data)` method that the Oracle contract calls
- Allows prices to be set via `setPrice()` and `setPriceWithPrecision()` methods
- Returns stored prices when queried by the Oracle contract

**Purpose**: Acts as a pluggable price source for the standard GMX Oracle contract, enabling us to supply custom price feeds for our FX and equity index markets.

### 2. Oracle Architecture

The oracle system uses standard GMX contracts with a custom price provider:

```
Marks API (FX/Stock prices)
         ↓
order_keeper_v2.py (Heroku) ─── updates prices ───→ MockOracleProvider
         ↓                                                    ↓
   executes orders                                  provides prices to
         ↓                                                    ↓
   OrderHandler ────────────── queries prices ───→ Oracle Contract
```

**Components:**
- **Oracle Contract** (`0xE89d94669f49D278cCD094A084139eB6639C0a93`): Standard GMX Oracle that validates and stores prices
- **MockOracleProvider** (`0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5`): Custom provider registered with the Oracle that supplies price data
- **order_keeper_v2.py**: Python keeper service deployed on Heroku that:
  - Fetches real-time FX and stock prices from the Marks backend API
  - Updates MockOracleProvider with current prices
  - Executes pending orders using those prices

**How It Works:**
1. order_keeper_v2.py fetches prices from Marks API
2. Keeper calls `setPrice()` on MockOracleProvider to update prices
3. Keeper executes orders by calling OrderHandler
4. OrderHandler queries Oracle contract for prices
5. Oracle calls `getOraclePrice()` on MockOracleProvider
6. MockOracleProvider returns the prices that were set by the keeper
7. Orders execute at those prices

### 3. Custom Token Deployments

Deployed custom tokens on Arbitrum Sepolia for Marks markets:

**Collateral Token:**
- **mUSD** (Marks USD): `0x85bf04B07A6df0172372b959C1C73F3e90F73faf` (6 decimals)

**Index Tokens - FX Pairs:**
- **mUSDTNGN** (USDT/NGN): `0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73` (18 decimals)
- **mUSDTARS** (USDT/ARS): `0xed6890bE2409F0db06a00C809a298E2E06553BE1` (18 decimals)
- **mPKR** (USDT/PKR): `0xDC7e9F5a3D337161880d084131BC16214f2F8EBD` (18 decimals)
- **mCOP** (USDT/COP): `0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8` (18 decimals)

**Index Tokens - Stock Indices:**
- **mTSLA** (Tesla): `0x77d4DdD2E847592fb7710e342C0492A4b85655f4` (18 decimals)
- **mAAPL** (Apple): `0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e` (18 decimals)
- **mNVDA** (NVIDIA): `0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325` (18 decimals)
- **mMETA** (Meta): `0xE2f8B015D23bB0EFdD57D8C08a328180437D031D` (18 decimals)

### 4. Active Markets (Markets 11-18)

The production markets all use **mUSD as collateral** for both long and short positions:

**Stock Index Markets:**
- **Market 11**: mTSLA [mUSD-mUSD] - `0x8ae559448a1482faffC925eF6a233276588348Df`
- **Market 13**: mNVDA [mUSD-mUSD] - `0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C`
- **Market 16**: mAAPL [mUSD-mUSD] - `0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449`
- **Market 17**: mMETA [mUSD-mUSD] - `0xafd908D358315efDBA493311AbE30648DEC4d2dE`

**Emerging Market FX:**
- **Market 12**: mUSDTARS [mUSD-mUSD] - `0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69`
- **Market 14**: mPKR [mUSD-mUSD] - `0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383`
- **Market 15**: mCOP [mUSD-mUSD] - `0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44`
- **Market 18**: mUSDTNGN [mUSD-mUSD] - `0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb`

**Market Parameters:**
- **Max Leverage**: 50-100x depending on asset type
- **Position Fees**: 2.5-7 basis points
- **Liquidation Fees**: 15-30 basis points
- **Max Open Interest**: $250K-$500K per side
- **Collateral**: Single-token mUSD pools (mUSD for both long and short)

Full deployment details: `/claude/deployments/marks-arbitrumSepolia-deployments.md`

### 5. Configuration

**Market Configuration** (`config/markets.ts`):
- Defines all markets with risk parameters optimized for FX and equity indices
- Configures fees, leverage limits, and open interest caps
- Sets price impact and liquidation thresholds appropriate for each asset class

**Token Configuration** (`config/tokens.ts`):
- All custom token addresses and metadata
- Token decimals and transfer settings
- Oracle provider associations

## What We Didn't Change

**All Standard GMX V2 Contracts:**
- Oracle, ExchangeRouter, OrderHandler, PositionHandler
- Deposit/Withdrawal handlers and vaults
- Market creation and liquidity systems
- Fee distribution mechanisms
- Liquidation and ADL (Auto-Deleveraging) logic
- GLV (GMX Liquidity Vault) support
- All execution and settlement logic

**Architecture**: The core GMX V2 architecture remains completely intact. Marks customizations are limited to:
1. Adding one custom oracle provider contract (MockOracleProvider)
2. Configuration of markets and tokens
3. External keeper service for price updates and order execution

This approach allows us to leverage GMX's battle-tested perpetuals infrastructure while customizing it for our specific asset classes.

## Deployment Information

**Network**: Arbitrum Sepolia (Testnet)
- Chain ID: 421614
- Total Contracts Deployed: 90+
- Deployment Date: September 2025

**Core Contract Addresses:**
- **ExchangeRouter**: `0x3B33708e9b8242999459EB9b4756C24c846e5936`
- **Oracle**: `0xE89d94669f49D278cCD094A084139eB6639C0a93`
- **MockOracleProvider**: `0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5`
- **DataStore**: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`
- **MarketFactory**: `0x32697b40be5537c7cF198a898a09BE11b14ce8bE`
- **Reader**: `0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8`
- **EventEmitter**: `0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C`

See full deployment info: `/claude/deployments/marks-arbitrumSepolia-deployments.md`

## Order Keeper (Deployed on Heroku)

**order_keeper_v2.py** (`keeper/order_keeper_v2.py`)

The production keeper is a robust Python service deployed on Heroku that serves as the operational backbone of the Marks protocol. It performs multiple critical functions to keep the protocol running 24/7.

### Core Responsibilities

**1. Price Feed Management**:
   - Fetches real-time FX rates and stock prices from Marks backend API via Socket.IO
   - Updates MockOracleProvider contract with current prices for all supported assets
   - Maintains continuous price feeds during market hours
   - Handles price validation and format conversion (API format → 30-decimal precision for contracts)

**2. Order Execution**:
   - **Event Detection**: Monitors blockchain for `OrderCreated` events in real-time
   - **Order Processing**: Fetches complete order details from contracts using the Reader
   - **Market Orders**: Executes immediately with current prices
   - **Limit Orders**: Monitors price conditions and executes when trigger prices are met
   - **Stop-Loss/Take-Profit**: Automatically executes TP/SL orders when conditions are satisfied
   - **Order Validation**: Verifies order parameters and acceptable price ranges before execution

**3. Liquidation Management**:
   - Continuously monitors all open positions for margin health
   - Identifies positions that fall below minimum collateral requirements
   - Executes liquidations automatically to protect pool solvency
   - Handles liquidation execution with appropriate price impact considerations

**4. Market Hours Enforcement**:
   - Respects US stock market hours (9:30 AM - 4:00 PM ET, Mon-Fri) for equity indices
   - Automatically pauses stock-related operations during market closures
   - FX markets operate 24/7 as expected for currency pairs
   - Logs and handles market hour transitions gracefully

**5. Error Handling & Recovery**:
   - Comprehensive error handling for failed transactions
   - Automatic retry logic with exponential backoff
   - Gas estimation and dynamic gas price management
   - Transaction confirmation tracking
   - Logging of all operations for debugging and monitoring

### Technical Architecture

**Technologies:**
- Python 3.11+ with async/await for concurrent operations
- Web3.py for blockchain interactions
- Socket.IO client for real-time price feeds
- WebSocket connections for event monitoring
- Deployed as a worker dyno on Heroku

**Key Features:**
- **Concurrent Processing**: Handles multiple orders and price updates simultaneously
- **Market-Aware**: Different logic for FX vs equity index markets
- **Gas Optimization**: Smart gas estimation to minimize transaction costs
- **Robust Event Handling**: Reliable detection of orders, liquidations, and position changes
- **Continuous Operation**: Runs 24/7 with automatic reconnection logic

**Environment Variables Required:**
- `ALCHEMY_KEY` or `INFURA_KEY` - RPC endpoint for Arbitrum Sepolia
- `UPDATER_PRIVATE_KEY` - Keeper wallet private key with CONTROLLER role
- Price feed URL is configured to Marks backend API

### Why It's Critical

The order keeper is essential for protocol operation because:
1. **Without price updates**: Orders cannot execute (Oracle would have no prices)
2. **Without order execution**: User orders would never be filled
3. **Without liquidations**: Protocol could become insolvent from underwater positions
4. **Without market hours enforcement**: Stock orders could execute at stale prices during market closures

The keeper ensures the protocol stays operational, responsive, and safe for all users.

## Development Commands

**Compile contracts:**
```bash
npx hardhat compile
```

**Run tests:**
```bash
npx hardhat test
```

**Deploy to Arbitrum Sepolia:**
```bash
npx hardhat deploy --network arbitrumSepolia
```

**Verify contracts:**
```bash
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS>
```

**Update deployment documentation:**
```bash
npx hardhat collect-deployments
```

## Mainnet Preparation

For mainnet deployment, the following changes will be required:

### 1. Oracle Infrastructure

**Current (Testnet):**
- MockOracleProvider updated by single keeper
- Prices from Marks backend API

**Mainnet Options:**
- **Option A**: Multi-signer keeper network with the MockOracleProvider pattern
  - Deploy multiple keepers with different signers
  - Require consensus on prices before updating
  - Add monitoring and alerting

- **Option B**: Integrate with production oracle networks
  - Chainlink Price Feeds for major assets
  - Pyth Network for real-time data
  - Custom keeper network for exotic pairs not covered by standard oracles

- **Option C**: Hybrid approach
  - Use Chainlink/Pyth for stocks (TSLA, AAPL, etc.)
  - Custom keeper network for emerging market FX pairs
  - Implement price validation and manipulation checks

### 2. Risk Parameters

- Review and adjust max leverage based on mainnet liquidity
- Increase reserve factors for riskier assets
- Fine-tune liquidation thresholds
- Adjust price impact parameters based on expected trading volume

### 3. Token Migrations

- Deploy production versions of synthetic tokens
- Establish deep liquidity for mUSD collateral token
- Complete token contract audits

### 4. Market Configuration

- Scale open interest caps based on available liquidity
- Review fee structures for competitiveness
- Configure funding rates appropriately for each market

### 5. Keeper Infrastructure

- Deploy multiple geographically distributed keepers
- Implement keeper rotation and automatic failover
- Add comprehensive monitoring, logging, and alerting
- Set up automated keeper health checks

### 6. Security

- Complete external smart contract audit (especially MockOracleProvider)
- Deploy Timelock contract for critical parameter changes
- Set up multisig for admin functions
- Implement emergency pause mechanisms
- Regular security reviews and monitoring

## Documentation

**GMX V2 Documentation:**
- See main `README.md` for comprehensive GMX Synthetics documentation
- Covers markets, oracle system, fees, funding, borrowing, price impact, and all core mechanisms

**Marks-Specific Documentation:**
- `/claude/deployments/marks-arbitrumSepolia-deployments.md` - Complete deployment addresses
- `/claude/best_practices/MARKET_DEPLOYMENT_GUIDE.md` - Guide for deploying new markets
- `/claude/best_practices/DEPOSIT_REQUIREMENTS.md` - Liquidity deposit requirements

## Architecture Summary

**What Makes Marks Different from Standard GMX:**

1. **Custom Oracle Provider**: MockOracleProvider enables integration with custom price sources for exotic assets
2. **Focus on Emerging Markets**: Purpose-built for FX pairs not typically available on DeFi platforms
3. **Equity Index Support**: Synthetic exposure to major tech stocks
4. **Single-Token Collateral**: All active markets use mUSD for both long and short positions
5. **API-Driven Price Feeds**: Backend API aggregates real-time FX and equity prices from multiple sources
6. **Conservative Risk Management**: Higher reserve factors and appropriate liquidation thresholds for volatile emerging market assets

**Key Technical Decisions:**

- **Minimal Contract Changes**: Only added MockOracleProvider, all other GMX contracts unchanged
- **Configuration-Driven Customization**: Market parameters tuned for specific asset classes
- **Keeper-Based Oracle**: Simple, effective solution for testnet that can scale to multi-signer network
- **Standard GMX Integration**: Seamless compatibility with GMX tooling and infrastructure

## Repository Structure

```
contracts/
├── contracts/                    # Solidity contracts
│   └── oracle/
│       ├── Oracle.sol           # Standard GMX Oracle
│       └── MockOracleProvider.sol  # Custom price provider
├── config/                       # Configuration files
│   ├── markets.ts               # Market definitions
│   ├── tokens.ts                # Token addresses
│   └── oracle.ts                # Oracle settings
├── deploy/                       # Deployment scripts
├── deployments/
│   └── marks/
│       └── arbitrumSepolia/     # Deployed contracts
├── keeper/
│   └── order_keeper_v2.py       # Price keeper + order executor (Heroku)
├── scripts/                      # Utility scripts
├── claude/
│   └── deployments/
│       └── marks-arbitrumSepolia-deployments.md
└── test/                         # Test suite
```

## Support

For questions about GMX Synthetics v2 architecture, refer to the main `README.md`.

For Marks-specific questions, refer to documentation in `/claude` directory.

## License

This project inherits the license from GMX Synthetics. See `LICENSE` for details.
