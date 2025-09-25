# GMX V2 Deposit Creation Failure - Critical Issue Report

**Date**: September 23, 2025
**Severity**: Critical - Blocks all liquidity provision
**Environment**: Arbitrum Sepolia Testnet
**Project**: Marks Exchange (GMX V2 Fork)

## Executive Summary

The deposit creation process for adding liquidity to GMX V2 markets is completely non-functional. Despite all contracts being deployed successfully and all configuration parameters being set correctly, deposits fail with either `EmptyDepositAmounts` error or silent transaction failures. This prevents any liquidity from being added to the markets, making the exchange unusable.

## Contract Addresses

```javascript
// Core Contracts (Arbitrum Sepolia)
EXCHANGE_ROUTER: 0x3B33708e9b8242999459EB9b4756C24c846e5936
DEPOSIT_HANDLER: 0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00
DEPOSIT_VAULT: 0x8672091de3AF3a02bE48cFB753810A736D9F6379
ROUTER: 0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc
DATA_STORE: 0xD70154A2e4BEF0485Bb6d90265a4F878A4556111
ROLE_STORE: 0x4943c063691259B677f3D7BC808C9C3090321EbB

// Market 1: sNGN [USDT-sNGN]
MARKET: 0x53b49A28054D108d7050B0E5C317001bE984EB2D
USDT (long token): 0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6
sNGN (short token): 0xd66e60AA5b6982649a116e6944Daec22b15468Ad
```

## The Problem

### Expected Behavior
1. User approves Router to spend tokens
2. User transfers tokens to DepositVault (via ExchangeRouter.sendTokens or direct transfer)
3. User calls ExchangeRouter.createDeposit to create a deposit
4. Deposit is created and can be executed by keepers

### Actual Behavior
The `createDeposit` function consistently fails at step 3, regardless of how tokens are transferred to the vault.

### Root Cause Analysis

The issue stems from the `recordTransferIn` mechanism in DepositUtils.sol:

```solidity
// From DepositUtils.sol lines 54-76
function createDeposit(...) external returns (bytes32) {
    // ...

    // Records the difference between current balance and previously recorded balance
    uint256 initialLongTokenAmount = depositVault.recordTransferIn(params.addresses.initialLongToken);
    uint256 initialShortTokenAmount = depositVault.recordTransferIn(params.addresses.initialShortToken);

    // ... (execution fee handling)

    if (initialLongTokenAmount == 0 && initialShortTokenAmount == 0) {
        revert Errors.EmptyDepositAmounts();  // <-- This is where it fails
    }

    // ...
}
```

The `recordTransferIn` function returns the DIFFERENCE between the current token balance and the previously recorded balance. If tokens are already in the vault and recorded, or if no new tokens arrived since the last check, it returns 0.

## Debugging Attempts

### 1. Multicall Approach (FAILED)
**Attempt**: Combine sendTokens and createDeposit in a single multicall transaction

```javascript
// Encode both operations
const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
    USDT, DEPOSIT_VAULT, usdtAmount
]);
const sendSngnData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
    sNGN, DEPOSIT_VAULT, sngnAmount
]);
const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
    depositParams
]);

// Execute as multicall
await exchangeRouter.multicall([sendUsdtData, sendSngnData, createDepositData]);
```

**Result**: Transaction reverts silently with status 0
**Reason**: Both `sendTokens` and `createDeposit` have `nonReentrant` modifiers, and multicall uses `delegatecall`, causing reentrancy guard conflicts

### 2. Two-Step Approach (FAILED)
**Attempt**: Transfer tokens first, then create deposit in separate transaction

```javascript
// Step 1: Transfer tokens
await exchangeRouter.multicall([sendUsdtData, sendSngnData]);

// Step 2: Create deposit
await exchangeRouter.createDeposit(depositParams);
```

**Result**: `EmptyDepositAmounts` error
**Reason**: Tokens are in vault but already "recorded" from the transfer, so `recordTransferIn` returns 0

### 3. Direct Transfer Approach (FAILED)
**Attempt**: Transfer tokens directly to vault, then immediately call createDeposit

```javascript
// Transfer directly (no Router)
await usdt.transfer(DEPOSIT_VAULT, usdtAmount);
await sngn.transfer(DEPOSIT_VAULT, sngnAmount);

// Create deposit
await exchangeRouter.createDeposit(depositParams);
```

**Result**: Transaction fails with no clear error
**Reason**: Even with unrecorded tokens in vault, createDeposit still fails

### 4. Sync and Create Approach (FAILED)
**Attempt**: Manually sync vault balances, then create deposit

```javascript
// Sync token balances to record them
await depositVault.syncTokenBalance(USDT);
await depositVault.syncTokenBalance(sNGN);

// Try to create deposit
await exchangeRouter.createDeposit(depositParams);
```

**Result**: `EmptyDepositAmounts` error
**Reason**: Syncing records the balances, so `recordTransferIn` returns 0

## Current Deposit Script

This is the most recent attempt at creating a deposit:

```javascript
const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit for Market 1 (USDT-sNGN) ===\n");
    console.log("Signer address:", signer.address);

    // Deployment addresses from latest deployment
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const router = await ethers.getContractAt("Router", ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Deposit configuration
    const DEPOSIT_MODE = "dual"; // Provide both USDT and sNGN
    const usdtAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
    const sngnAmount = ethers.utils.parseUnits("1500", 18); // 1500 sNGN

    // Step 1: Approve Router (NOT ExchangeRouter!)
    console.log("\n📍 STEP 1: Approve Router to spend tokens");

    const usdtAllowance = await usdt.allowance(signer.address, ROUTER);
    if (usdtAllowance.lt(usdtAmount)) {
        const approveTx = await usdt.approve(ROUTER, usdtAmount);
        await approveTx.wait();
        console.log("  ✅ Router approved for USDT");
    }

    const sngnAllowance = await sngn.allowance(signer.address, ROUTER);
    if (sngnAllowance.lt(sngnAmount)) {
        const approveTx = await sngn.approve(ROUTER, sngnAmount);
        await approveTx.wait();
        console.log("  ✅ Router approved for sNGN");
    }

    // Step 2: Transfer tokens to DepositVault using ExchangeRouter.sendTokens
    console.log("\n📍 STEP 2: Transfer tokens to DepositVault");

    const multicallData = [];

    // Add USDT transfer
    const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        usdtAmount
    ]);
    multicallData.push(sendUsdtData);

    // Add sNGN transfer
    const sendSngnData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        sNGN,
        DEPOSIT_VAULT,
        sngnAmount
    ]);
    multicallData.push(sendSngnData);

    // Execute transfers via ExchangeRouter multicall
    const transferTx = await exchangeRouter.multicall(multicallData, { gasLimit: 500000 });
    await transferTx.wait();
    console.log("  ✅ Tokens transferred to DepositVault");

    // Step 3: Create deposit
    console.log("\n📍 STEP 3: Create deposit");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0, // 0 for first deposit
        callbackGasLimit: 0,
        dataList: []
    };

    try {
        const createDepositTx = await exchangeRouter.createDeposit(depositParams, { gasLimit: 2500000 });
        const receipt = await createDepositTx.wait();
        console.log("  ✅ Deposit created!");
    } catch (error) {
        console.log("  ❌ Create deposit failed:", error.message);
        // Transaction consistently fails here
    }
}

main().catch(console.error);
```

## Technical Analysis

### Contract Architecture Issues

1. **Reentrancy Guards Conflict**: The `PayableMulticall` uses `delegatecall` which maintains contract context, but both `sendTokens` and `createDeposit` have `nonReentrant` modifiers, making atomic operations impossible.

2. **recordTransferIn Design Flaw**: The function expects tokens to arrive between the last recorded balance and the current call. This creates a race condition and makes it impossible to reliably deposit when:
   - Tokens are already in the vault
   - Multiple users are trying to deposit
   - Any operation records the balance before deposit creation

3. **Missing Atomic Operation**: There's no single entry point that handles both token transfer and deposit creation atomically without reentrancy issues.

### Configuration Verified

✅ All contracts deployed successfully
✅ ExchangeRouter has CONTROLLER role
✅ Router has ROUTER_PLUGIN role
✅ DepositVault has BANK_KEEPER role
✅ Market is registered and enabled in DataStore
✅ Token configurations are correct
✅ Oracle system is configured
✅ Signer has CONTROLLER role

## Error Signatures

- `0x01af8c24`: EmptyDepositAmounts()
- Transaction status 0: Silent failure (usually reentrancy guard or revert without message)

## Impact

- **No liquidity can be added to any market**
- **Exchange is completely non-functional**
- **Blocks all trading operations**
- **Prevents protocol launch**

## Recommended Solutions

### Option 1: Fix Contract Code (Requires Redeployment)
- Remove reentrancy guards from either `sendTokens` or `createDeposit`
- OR create a new function that handles both operations internally
- OR fix the `recordTransferIn` mechanism to handle existing balances

### Option 2: Deploy Wrapper Contract
Create a new contract that:
1. Receives tokens from user
2. Transfers to DepositVault
3. Calls createDeposit
All in a single transaction without reentrancy issues

### Option 3: Investigate Original GMX Implementation
- Compare with original GMX V2 contracts
- Check if there are missing initialization steps
- Verify deployment scripts and configuration

### Option 4: Alternative Entry Point
- Check if there's a different function or contract meant to be used for deposits
- Review GMX documentation for the intended flow

## Test Transactions

Failed multicall attempt:
- TX: `0xed4869798232c6b46be897fd3edec7e1148b34b2f7e17bd0cf9ee97000a8a2b5`

Failed createDeposit after transfer:
- TX: `0x47f191464c1bef203883eff7342a7f15c068187d4b99d29bd8a99c814ac9b1d2`

## Environment Details

- Network: Arbitrum Sepolia
- Chain ID: 421614
- Node: Hardhat
- Signer: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

## Next Steps

1. **Immediate**: Review original GMX V2 deposit flow documentation
2. **Short-term**: Consider deploying a wrapper contract as a workaround
3. **Long-term**: Fix and redeploy the core contracts with proper deposit flow

## Conclusion

The deposit creation mechanism is fundamentally broken in the current deployment. The `recordTransferIn` pattern combined with reentrancy guards makes it impossible to create deposits through any of the attempted methods. This is a critical blocker that prevents the protocol from functioning.

The issue appears to be either:
- A deployment configuration problem
- Missing initialization steps
- Incompatible contract modifications
- Fundamental design flaw in how deposits are handled

Without fixing this issue, the exchange cannot accept liquidity and therefore cannot operate.