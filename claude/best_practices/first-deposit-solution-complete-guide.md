# First Deposit Solution - Complete Guide

**Date**: September 2025
**Issue**: First deposit into GMX V2 fork markets failing with cancelled deposits
**Solution**: Deploy and configure mock oracle provider for testnet

## Executive Summary

The first deposit into a GMX V2 market requires special handling and proper oracle provider configuration. This guide documents the complete solution for successfully executing the first deposit, including all the pitfalls encountered and how they were resolved.

## The Problem

When attempting to make the first deposit into a newly deployed GMX V2 market, deposits were consistently being cancelled internally despite transactions appearing successful on-chain. The core issues were:

1. **No Oracle Provider Configured**: GMX V2 requires oracle providers to validate and supply price data during deposit execution
2. **Missing Token-Provider Mapping**: Each token needs an explicitly configured oracle provider
3. **Timing Issues**: Deposits can timeout if not executed quickly enough
4. **Price Format Confusion**: Understanding the correct 30-decimal precision format for prices

### Symptoms
- Deposit creation succeeds (deposit key generated)
- Execution transaction succeeds (status = 1)
- But no market tokens are minted (totalSupply remains 0)
- Internal cancellation due to `receivedMarketTokens = 0`

## The Solution

### Step 1: Deploy Mock Oracle Provider

First, create and deploy a mock oracle provider contract that implements the `IOracleProvider` interface:

**Contract**: `contracts/oracle/MockOracleProvider.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IOracleProvider.sol";
import "./OracleUtils.sol";
import "../price/Price.sol";

contract MockOracleProvider is IOracleProvider {
    using Price for Price.Props;

    mapping(address => Price.Props) public prices;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "MockOracleProvider: only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function getOraclePrice(
        address token,
        bytes memory /* data */
    ) external view returns (OracleUtils.ValidatedPrice memory) {
        Price.Props memory price = prices[token];
        require(price.min > 0 && price.max > 0, "MockOracleProvider: price not set");

        return OracleUtils.ValidatedPrice({
            token: token,
            min: price.min,
            max: price.max,
            timestamp: block.timestamp,
            provider: address(this)
        });
    }

    function shouldAdjustTimestamp() external pure returns (bool) {
        return false;
    }

    function isChainlinkOnChainProvider() external pure returns (bool) {
        return false;
    }

    function setPrice(address token, uint256 minPrice, uint256 maxPrice) external onlyOwner {
        prices[token] = Price.Props({
            min: minPrice,
            max: maxPrice
        });
    }

    function setPriceWithPrecision(address token, uint256 price) external onlyOwner {
        prices[token] = Price.Props({
            min: price,
            max: price
        });
    }
}
```

**Deployment Script**: `claude/scripts/deploy-and-configure-mock-provider.js`

This script:
1. Deploys the MockOracleProvider contract
2. Sets prices for USDT ($1.00) and sNGN ($1/1500)
3. Enables the provider in DataStore
4. Saves deployment info

### Step 2: Configure Oracle Provider in DataStore

The provider must be enabled in DataStore using the correct key structure:

```javascript
// Calculate the key for enabling provider
const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
);

const providerEnabledKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address"],
        [IS_ORACLE_PROVIDER_ENABLED, mockProvider.address]
    )
);

// Enable the provider
await dataStore.setBool(providerEnabledKey, true);
```

### Step 3: Set Token-Provider Mapping

**Critical Step**: Each token must have its oracle provider explicitly set:

**Script**: `claude/scripts/set-token-providers.js`

```javascript
// Calculate the ORACLE_PROVIDER_FOR_TOKEN constant
const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
);

// Set provider for USDT
const usdtProviderKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address"],
        [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDT]
    )
);
await dataStore.setAddress(usdtProviderKey, MOCK_PROVIDER);

// Set provider for sNGN
const sngnProviderKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address"],
        [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, sNGN]
    )
);
await dataStore.setAddress(sngnProviderKey, MOCK_PROVIDER);
```

### Step 4: Create Deposit

**Script**: `claude/scripts/create-deposit-new-market.js`

Key requirements for first deposit:
- Set receiver to `address(1)` (`0x0000000000000000000000000000000000000001`)
- Set `minMarketTokens` to 0
- Provide balanced liquidity (e.g., $1000 USDT + 1,500,000 sNGN = $2000 total)

```javascript
const depositParams = {
    addresses: {
        receiver: "0x0000000000000000000000000000000000000001", // MUST be address(1) for first deposit
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: MARKET,
        initialLongToken: USDT,
        initialShortToken: sNGN,
        longTokenSwapPath: [],
        shortTokenSwapPath: []
    },
    minMarketTokens: 0, // MUST be 0 for first deposit
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: []
};
```

### Step 5: Execute Deposit with Oracle Provider

**Script**: `claude/scripts/execute-with-mock-provider.js`

The execution must include the oracle provider information:

```javascript
const oracleParams = {
    tokens: [USDT, sNGN],
    providers: [MOCK_PROVIDER, MOCK_PROVIDER], // Same provider for both tokens
    data: ["0x", "0x"] // Empty data since mock provider doesn't need it
};

const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
    gasLimit: estimatedGas.mul(120).div(100) // 20% buffer
});
```

## Price Calculation Formula

GMX V2 uses 30 decimals of precision for all prices. The formula is:

```
Price with 30 decimals = Actual Price × 10^(30 - token_decimals)
```

Examples:
- **USDT** (6 decimals, $1.00): `1 × 10^(30-6) = 10^24`
- **sNGN** (18 decimals, $1/1500): `(1/1500) × 10^(30-18) = 10^12 / 1500 ≈ 666,666,666`

## Common Errors and Solutions

### 1. InvalidOracleProvider
**Error**: `0x68b49e6c`
**Cause**: Provider not enabled in DataStore
**Solution**: Enable provider using correct key structure

### 2. InvalidOracleProviderForToken
**Error**: `0x68b49e6c` with two addresses
**Cause**: Token doesn't have the expected provider set
**Solution**: Set provider for each token using `set-token-providers.js`

### 3. OracleBlockNumbersAreSmallerThanRequired
**Error**: `0xd84b8ee8`
**Cause**: Deposit has timed out
**Solution**: Cancel old deposit and create a fresh one

### 4. EmptyDepositAmounts
**Error**: `0x01af8c24`
**Cause**: Token amounts not properly recorded
**Solution**: Ensure proper multicall structure with sendWnt, sendTokens, createDeposit

### 5. MinMarketTokens
**Error**: `0x6c3e27f2`
**Cause**: No market tokens minted but minMarketTokens > 0
**Solution**: Set minMarketTokens = 0 for first deposit

## Complete Execution Flow

1. **Deploy Infrastructure**
   ```bash
   npx hardhat run claude/scripts/deploy-and-configure-mock-provider.js --network arbitrumSepolia
   ```

2. **Configure Token Providers**
   ```bash
   npx hardhat run claude/scripts/set-token-providers.js --network arbitrumSepolia
   ```

3. **Create Deposit**
   ```bash
   npx hardhat run claude/scripts/create-deposit-new-market.js --network arbitrumSepolia
   ```

4. **Execute Deposit Immediately**
   ```bash
   npx hardhat run claude/scripts/execute-with-mock-provider.js --network arbitrumSepolia
   ```

## Key Learnings

1. **Oracle Providers are Essential**: GMX V2 cannot function without properly configured oracle providers
2. **Two-Level Configuration**: Providers must be both enabled AND set as the expected provider for tokens
3. **Timing Matters**: Deposits can timeout, execute them promptly after creation
4. **First Deposit is Special**: Must use address(1) as receiver and 0 for minMarketTokens
5. **Price Precision**: Always use 30 decimal precision for prices
6. **DataStore is Central**: All configuration is stored in DataStore with specific key patterns

## Verification Checklist

- [ ] Mock oracle provider deployed
- [ ] Provider enabled in DataStore
- [ ] Provider set for each token (USDT and sNGN)
- [ ] Prices configured in provider
- [ ] Deposit created with address(1) as receiver
- [ ] Deposit executed before timeout
- [ ] Market tokens minted successfully

## Contract Addresses (Arbitrum Sepolia)

- **DataStore**: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`
- **Oracle**: `0xE89d94669f49D278cCD094A084139eB6639C0a93`
- **ExchangeRouter**: `0x3B33708e9b8242999459EB9b4756C24c846e5936`
- **DepositHandler**: `0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00`
- **USDT Market**: `0x8E4C5f3296A100d4135187C3181258cb8a223bb1`
- **Mock Oracle Provider**: Deployed dynamically

## Conclusion

The first deposit into a GMX V2 market requires careful orchestration of oracle providers, proper configuration in DataStore, and correct timing. This solution provides a working approach for testnet environments using a mock oracle provider. For production, you would need to integrate with real oracle providers like Chainlink or implement a properly secured oracle system with multiple signers.

The key insight is that GMX V2's oracle system is not just about setting prices - it requires a complete provider infrastructure with proper registration and token-specific configuration. Once this infrastructure is in place, deposits can be executed successfully.