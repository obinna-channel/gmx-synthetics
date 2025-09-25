# GMX V2 Deposit Creation and Execution Flow - Complete Guide

## Overview
This document details the exact process for creating and executing deposits on our GMX V2 fork (Marks Exchange) deployed on Arbitrum Sepolia. This is specifically for initializing the USDTNGN perpetual market with its first liquidity.

## Current Situation Summary

### What's Working ✅
- All contracts deployed successfully on Arbitrum Sepolia
- Deposit creation working perfectly
- Simulation of deposit execution succeeds
- All configuration parameters set correctly

### The Problem ❌
- Actual deposit execution fails with mysterious error `0x95b66fe9`
- This error code doesn't exist in the GMX codebase
- Deposits get cancelled and USDT refunded despite successful transaction
- Simulation works but real execution fails

## Contract Addresses (Arbitrum Sepolia)

```javascript
// Core Contracts
EXCHANGE_ROUTER: 0x28402e44267854D8B7CAD5969BB45eB8aF18663e
DEPOSIT_HANDLER: 0xEfA03387703cc220e6273fB25Fa847d474984057
DEPOSIT_VAULT: 0x149A382b27BF4D9DE20142d3E22d0933c9f8C794
DATA_STORE: 0xB6840dd443CD484Ff8F89cF7D766549b768DB21F
ORACLE: 0x2b44fd56615FFA5F2980cA624871716340762238
READER: 0x4bD6A4cC827779EDE670790a2ee526Fd083703b3
EVENT_EMITTER: 0x85C6A8082346dD07941A271c1Cc8F7DDdEecfa6C

// Market & Tokens
MARKET (USDTNGN): 0x6136252ce73bD4dA432F85b2A7065481DE227601
USDT: 0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6
sNGN: 0xe0dBA0326623dEcE1712581271ebcD846D67b29f
```

## Part 1: Creating a Deposit

### Key Requirements for First Deposit
1. **Receiver MUST be address(1)**: `0x0000000000000000000000000000000000000001`
2. **Execution fee MUST be 0**: No ETH value sent with transaction
3. **Both tokens set to USDT**: For single-token markets, both initialLongToken and initialShortToken must be USDT
4. **Funds in DepositVault**: 100 USDT must be transferred to DepositVault before creating deposit

### The Working Script

```javascript
// scripts/create-first-deposit-correct.js
const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating First Deposit (Correct Parameters) ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // Step 1: Transfer 100 USDT to DepositVault
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    if (vaultBalance.lt(ethers.utils.parseUnits("100", 6))) {
        const transferAmount = ethers.utils.parseUnits("100", 6);
        const tx = await usdt.transfer(DEPOSIT_VAULT, transferAmount);
        await tx.wait();
        console.log("✅ Transferred 100 USDT to DepositVault");
    }

    // Step 2: Create deposit parameters
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // MUST be address(1)
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT, // MUST be USDT, not AddressZero
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0, // MUST be 0
        callbackGasLimit: 0,
        dataList: []
    };

    // Step 3: Create deposit (NO ETH sent)
    const depositTx = await exchangeRouter.createDeposit(depositParams);
    const receipt = await depositTx.wait();

    console.log("✅ Deposit created!");
    console.log("Transaction hash:", depositTx.hash);
}

main().catch(console.error);
```

### How Deposit Amounts Work

**Important Discovery**: The `createDeposit` function does NOT specify amounts in its parameters. Instead:

1. GMX reads the balance from DepositVault using `recordTransferIn`
2. When both tokens are the same (USDT/USDT), all funds go to the long side
3. The second `recordTransferIn` returns 0 because tokens were already recorded

From `DepositUtils.sol`:
```solidity
// if the initialLongToken and initialShortToken are the same, only the initialLongTokenAmount would
// be non-zero, the initialShortTokenAmount would be zero
uint256 initialLongTokenAmount = depositVault.recordTransferIn(params.addresses.initialLongToken);
uint256 initialShortTokenAmount = depositVault.recordTransferIn(params.addresses.initialShortToken);
```

Result: With 100 USDT in DepositVault, the deposit will have:
- Long amount: 100 USDT
- Short amount: 0 USDT

### Getting the Deposit Key

After creation, query the DataStore for your deposit key:

```javascript
const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
);

const accountKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address"],
        [ACCOUNT_DEPOSIT_LIST, signer.address]
    )
);

const depositCount = await dataStore.getBytes32Count(accountKey);
const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
const DEPOSIT_KEY = depositKeys[0]; // Most recent deposit
```

## Part 2: Required Configuration Before Execution

### 1. MIN_ORACLE_SIGNERS = 0
Bypass oracle signature requirements for testing:

```javascript
const MIN_ORACLE_SIGNERS = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
);
await dataStore.setUint(MIN_ORACLE_SIGNERS, 0);
```

### 2. REQUEST_EXPIRATION_TIME = 3600
Set 1 hour expiration window for deposits:

```javascript
const REQUEST_EXPIRATION_TIME = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
);
await dataStore.setUint(REQUEST_EXPIRATION_TIME, 3600);
```

### 3. MAX_PNL_FACTOR_FOR_DEPOSITS = 50%
Critical for deposit validation:

```javascript
const MAX_PNL_FACTOR = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
);

// For longs
const pnlKeyLong = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "bool"],
        [MAX_PNL_FACTOR, MARKET, true]
    )
);
await dataStore.setUint(pnlKeyLong, ethers.utils.parseUnits("0.5", 30)); // 50%

// For shorts
const pnlKeyShort = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "bool"],
        [MAX_PNL_FACTOR, MARKET, false]
    )
);
await dataStore.setUint(pnlKeyShort, ethers.utils.parseUnits("0.5", 30)); // 50%
```

### 4. Oracle Prices
Set prices for both tokens:

```javascript
const oracle = await ethers.getContractAt("Oracle", ORACLE);

// USDT price: $1
const usdtPrice = ethers.utils.parseUnits("1", "30");
await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice });

// sNGN price: 1500 NGN per USD
const ngnPrice = ethers.utils.parseUnits("1500", "30");
await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice });

// Set timestamps
const currentTime = Math.floor(Date.now() / 1000);
await oracle.setTimestamps(currentTime - 30, currentTime + 30);
```

## Part 3: Executing the Deposit

### Simulation (Works ✅)

```javascript
// scripts/simulate-deposit-execution.js
const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

const oracleParams = {
    tokens: [],
    providers: [],
    data: []
};

// Simulate with callStatic
const result = await depositHandler.callStatic.executeDeposit(
    DEPOSIT_KEY,
    oracleParams,
    { from: signer.address, gasLimit: 5000000 }
);

console.log("✅ Simulation successful!");
```

### Actual Execution (Fails ❌)

```javascript
// Same parameters as simulation
const executeTx = await depositHandler.executeDeposit(
    DEPOSIT_KEY,
    oracleParams,
    { gasLimit: 5000000 }
);

const receipt = await executeTx.wait();
// Transaction succeeds but deposit is cancelled internally
```

## The Mysterious Error: 0x95b66fe9

### What We Know:
1. **Error only in actual execution**: Simulations pass, real executions fail
2. **Not in codebase**: This error selector doesn't exist in GMX contracts
3. **Deposit gets cancelled**: The try-catch in DepositHandler catches this error and cancels the deposit
4. **USDT refunded**: Transfer event shows USDT returned from DepositVault to user

### What Happens During Cancellation:

From transaction `0x0cbdd71a5f36c8fdfcb82e72cb8bdccc30b917afeb03bbd69a083b8e1f64a00b`:

```
Event 1: Transfer
  From: 0x149A382b27BF4D9DE20142d3E22d0933c9f8C794 (DepositVault)
  To: 0xBaB0D0892Bf8563B731f8e8970fE856ce9308292 (User)
  Amount: 100 USDT
  Result: REFUND - Deposit was cancelled
```

### Deposit Execution Flow in DepositHandler:

```solidity
try this._executeDeposit{ gas: executionGas }(
    key,
    deposit,
    msg.sender
) {
    // Success path - not reached
} catch (bytes memory reasonBytes) {
    _handleDepositError(
        key,
        startingGas,
        reasonBytes  // Contains 0x95b66fe9
    );
    // This cancels the deposit and refunds tokens
}
```

## All Validation Points That Could Cause Reverts

Based on code analysis, these are all the checks during deposit execution:

1. **EmptyDeposit** - if deposit.account() == address(0)
2. **OracleTimestampsAreSmallerThanRequired** - if oracle.minTimestamp() < deposit.updatedAtTime()
3. **OracleTimestampsAreLargerThanRequestExpirationTime** - if timestamps expired
4. **EmptyMarket** - if market.marketToken == address(0)
5. **DisabledMarket** - if market is disabled
6. **InvalidReceiverForFirstDeposit** - if first deposit but receiver != address(1)
7. **InvalidMinMarketTokensForFirstDeposit** - if minMarketTokens requirement not met
8. **EmptyPrimaryPrice** - if oracle prices not set
9. **PnlFactorExceededForLongs/Shorts** - if MAX_PNL_FACTOR exceeded
10. **EmptyDepositAmountsAfterSwap** - if both amounts are 0 after swaps
11. **InvalidPoolValueForDeposit** - if pool value < 0 or invalid
12. **MinMarketTokens** - if received tokens < minimum requested

None of these produce error `0x95b66fe9`.

## Current Status

### Latest Active Deposit
- **Key**: `0xa086d3ac59bbab5dfeb369072a8f0b04f6cade27fb9324d7d2ec165c937884aa`
- **Account**: 0xBaB0D0892Bf8563B731f8e8970fE856ce9308292
- **Receiver**: 0x0000000000000000000000000000000000000001
- **Amount**: 100 USDT (long side only)
- **Status**: Created but not executed

### Configuration Status ✅
- MIN_ORACLE_SIGNERS: 0
- REQUEST_EXPIRATION_TIME: 3600
- MAX_PNL_FACTOR_FOR_DEPOSITS (longs): 50%
- MAX_PNL_FACTOR_FOR_DEPOSITS (shorts): 50%
- Oracle prices: USDT = $1, sNGN = 1500
- DepositVault balance: 100 USDT

## Next Steps to Debug

1. **Check for custom modifications**: The error might be from Marks-specific changes
2. **Review deployment process**: Something might be misconfigured during deployment
3. **Test with different parameters**: Try smaller amounts or different receiver
4. **Check external dependencies**: The error might be from an external call
5. **Review state differences**: Compare simulation vs actual execution state

## Scripts Reference

All working scripts are in `/scripts/`:
- `create-first-deposit-correct.js` - Creates deposit with correct parameters
- `simulate-deposit-execution-v2.js` - Simulates execution (works)
- `execute-deposit-real.js` - Attempts real execution (fails)
- `check-deposit-and-fix.js` - Sets configuration parameters
- `verify-execution-result.js` - Analyzes transaction results

## Key Learnings

1. **Deposit amounts aren't specified in createDeposit** - They're read from DepositVault
2. **Single-token markets default to long side** - When both tokens are the same
3. **First deposit must go to address(1)** - Special requirement for market initialization
4. **Execution fee must be 0** - For first deposit bypass
5. **Simulations don't guarantee execution success** - State changes can cause differences

## Contact for Help

If you encounter the same `0x95b66fe9` error, check:
1. All configuration parameters are set
2. Oracle prices are fresh (timestamps updated)
3. Deposit hasn't expired (within 3600 seconds)
4. DepositVault has the required USDT

The mystery remains: Why does simulation succeed but execution fail with an unknown error?