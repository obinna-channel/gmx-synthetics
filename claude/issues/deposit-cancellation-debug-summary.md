# GMX V2 Fork - Deposit Cancellation Issue Debug Summary

## High-Level Context

### Project Overview
- **Fork**: GMX V2 (Marks Exchange) deployed on Arbitrum Sepolia
- **Goal**: Add initial liquidity to perpetual markets
- **Issue**: Deposits are being cancelled during execution, preventing market initialization

### The Two-Step Deposit Process
1. **Create Deposit**: User sends tokens to DepositVault, creates deposit request
2. **Execute Deposit**: Keeper (or user) executes with oracle prices, mints market tokens

### The Problem
- Deposit creation succeeds ✅
- Deposit execution transaction succeeds ✅
- BUT: Deposit is cancelled internally (tokens refunded, no market tokens minted) ❌

## Market Configurations Tested

### Original Market (sNGN-indexed)
- **Address**: `0x53b49A28054D108d7050B0E5C317001bE984EB2D`
- **Index Token**: sNGN
- **Long Token**: USDT
- **Short Token**: sNGN
- **Result**: Deposits cancelled

### New Test Market (USDT-indexed)
- **Address**: `0x8E4C5f3296A100d4135187C3181258cb8a223bb1`
- **Index Token**: USDT
- **Long Token**: USDT
- **Short Token**: sNGN
- **Result**: Deposits still cancelled

## The Try-Catch Mechanism

```solidity
// In DepositHandler.sol
try this._executeDeposit{ gas: executionGas }(
    key,
    deposit,
    msg.sender
) {
    // Success - deposit executed
} catch (bytes memory reasonBytes) {
    _handleDepositError(
        key,
        startingGas,
        reasonBytes
    );
    // This calls cancelDeposit - refunds tokens
}
```

Any revert in `ExecuteDepositUtils.executeDeposit()` triggers the catch block, cancelling the deposit.

## All Possible Revert Conditions

### 1. EmptyDeposit (Line 88)
```solidity
if (deposit.account() == address(0)) {
    revert Errors.EmptyDeposit();
}
```
**Status**: ✅ RULED OUT
- Verified account is not address(0)
- Account: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

### 2. OracleTimestampsAreSmallerThanRequired (Line 92)
```solidity
if (params.oracle.minTimestamp() < deposit.updatedAtTime()) {
    revert Errors.OracleTimestampsAreSmallerThanRequired(
        params.oracle.minTimestamp(),
        deposit.updatedAtTime()
    );
}
```
**Status**: ✅ RULED OUT
- Added timestamp logging
- Confirmed: Oracle minTimestamp (1758738386) > deposit updatedAtTime (1758738347)
- Fixed by using current block timestamp instead of past timestamp

### 3. OracleTimestampsAreLargerThanRequestExpirationTime (Line 103)
```solidity
if (cache.maxOracleTimestamp > deposit.updatedAtTime() + cache.requestExpirationTime) {
    revert Errors.OracleTimestampsAreLargerThanRequestExpirationTime(...);
}
```
**Status**: ✅ RULED OUT
- REQUEST_EXPIRATION_TIME = 300 seconds
- Verified deposits executed within time window
- Oracle maxTimestamp < deposit updatedAtTime + 300

### 4. EmptyDepositAmountsAfterSwap (Line 164)
```solidity
if (cache.longTokenAmount == 0 && cache.shortTokenAmount == 0) {
    revert Errors.EmptyDepositAmountsAfterSwap();
}
```
**Status**: ✅ RULED OUT
- Verified deposit amounts: 1 USDT, 1500 sNGN
- Both amounts non-zero
- No swaps occurring (tokens match market requirements)

### 5. MinMarketTokens (Line 221)
```solidity
if (cache.receivedMarketTokens < deposit.minMarketTokens()) {
    revert Errors.MinMarketTokens(cache.receivedMarketTokens, deposit.minMarketTokens());
}
```
**Status**: ⚠️ LIKELY CAUSE
- minMarketTokens set to 0 ✅
- BUT: No market tokens minted (supply stayed 0)
- Suggests receivedMarketTokens = 0
- Would trigger error even with minMarketTokens = 0

### 6. InvalidPoolValueForDeposit - Negative (Line 356)
```solidity
if (poolValueInfo.poolValue < 0) {
    revert Errors.InvalidPoolValueForDeposit(poolValueInfo.poolValue);
}
```
**Status**: ❓ POSSIBLE
- Checked empty pool state:
  - Pool amounts: 0 USDT, 0 sNGN
  - Impact pools: 0
  - Open interest: 0
  - Net PNL: 0
- Empty pool value should = 0
- BUT: This check happens DURING execution with incoming tokens

### 7. InvalidPoolValueForDeposit - Zero with Supply (Line 364)
```solidity
if (poolValueInfo.poolValue == 0 && marketTokensSupply > 0) {
    revert Errors.InvalidPoolValueForDeposit(poolValueInfo.poolValue);
}
```
**Status**: ✅ UNLIKELY
- Market token supply confirmed = 0
- This condition requires supply > 0

### 8. InvalidReceiverForFirstDeposit (Line 584)
```solidity
if (marketTokensSupply == 0 && deposit.receiver() != RECEIVER_FOR_FIRST_DEPOSIT) {
    revert Errors.InvalidReceiverForFirstDeposit(...);
}
```
**Status**: ✅ RULED OUT
- Receiver correctly set to address(1)
- RECEIVER_FOR_FIRST_DEPOSIT = address(1)

### 9. InvalidMinMarketTokensForFirstDeposit (Line 588)
```solidity
if (marketTokensSupply == 0 && deposit.minMarketTokens() != 0) {
    revert Errors.InvalidMinMarketTokensForFirstDeposit(...);
}
```
**Status**: ✅ RULED OUT
- minMarketTokens correctly set to 0 for first deposit

## Pool Value Calculation

### Formula
```
poolValue = (longTokenAmount * longTokenPrice + shortTokenAmount * shortTokenPrice)
          + (totalBorrowingFees * borrowingFeePoolFactor)
          - netPnl
          - impactPoolAmount
          + lentImpactPoolAmount
```

### For Empty Pool
- Token amounts = 0
- Borrowing fees = 0
- PNL should = 0 (no positions)
- Impact pool = 0 (verified)
- Result: poolValue = 0

### Market Configuration Check Results
```javascript
// From check-market-impact-pool.js
Position Impact Pool Amount: 0
Swap Impact Pool Amount: 0
Lent Impact Pool Amount: 0
USDT Pool Amount: 0.0
sNGN Pool Amount: 0.0
Long Open Interest: 0
Short Open Interest: 0
MAX_PNL_FACTOR_FOR_DEPOSITS:
  For Longs: 500000000000000000000000000000
  For Shorts: 500000000000000000000000000000
```

## Debugging Scripts Created

### 1. check-market-oracle-config.js
- Checks oracle signers and MIN_ORACLE_SIGNERS
- Verifies market enabled status
- Checks oracle timestamps

### 2. create-deposit-new-market.js
- Creates deposit with 1 USDT + 1500 sNGN
- Uses multicall pattern: sendWnt → sendTokens → createDeposit
- Sets receiver to address(1) for first deposit

### 3. execute-new-market-deposit.js
- Enhanced with extensive logging:
  - Deposit amounts verification
  - Timestamp validation
  - MinMarketTokens check
  - Receiver validation
  - Market token supply check

### 4. check-execution-result-details.js
- Analyzes transaction receipts
- Detects token refunds (cancellation indicator)
- Checks final market state

### 5. check-market-impact-pool.js
- Reads impact pool amounts
- Checks open interest
- Verifies MAX_PNL_FACTOR settings

## Key Code Sections

### Deposit Creation Parameters
```javascript
const depositParams = {
    addresses: {
        receiver: "0x0000000000000000000000000000000000000001", // Required for first deposit
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: MARKET,
        initialLongToken: USDT,
        initialShortToken: sNGN,
        longTokenSwapPath: [],
        shortTokenSwapPath: []
    },
    minMarketTokens: 0, // Must be 0 for first deposit
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: []
};
```

### Oracle Price Setting
```javascript
// USDT: $1.00 with 30 decimals precision, 6 token decimals
const usdtPrice = ethers.BigNumber.from(10).pow(24);

// sNGN: $1/1500 with 30 decimals precision, 18 token decimals
const sngnPrice = ethers.BigNumber.from(10).pow(30).mul(2).div(3000);

// Set timestamps to current block time
const currentBlock = await ethers.provider.getBlock("latest");
const blockTimestamp = currentBlock.timestamp;
await oracle.setTimestamps(blockTimestamp, blockTimestamp + 60);
```

## Current Status

### What We Know
1. All basic validation checks pass
2. Market configuration appears correct
3. Oracle prices and timestamps are properly set
4. Deposit parameters meet first deposit requirements
5. No impact pool issues
6. MAX_PNL_FACTOR is set correctly

### Most Likely Issue
**receivedMarketTokens = 0** triggering MinMarketTokens error

This suggests the mint amount calculation is returning 0, possibly due to:
1. Something specific about USDT-indexed perpetual market calculations
2. Pool value calculation issues during execution
3. Price impact calculations resulting in 0 mint amount

### Next Steps
1. Add logging to track the actual mint amount calculation
2. Investigate differences between USDT-indexed vs standard market calculations
3. Check if there are additional market parameters needed for perpetual markets
4. Consider if the 1 USDT + 1500 sNGN ratio is causing calculation issues

## Contract Addresses

### Core Contracts
- DataStore: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`
- Oracle: `0xE89d94669f49D278cCD094A084139eB6639C0a93`
- OracleStore: `0x659A3D114f45b970FdeBD05d19Ef3c697b75963B`
- DepositHandler: `0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00`
- DepositVault: `0x8672091de3AF3a02bE48cFB753810A736D9F6379`
- ExchangeRouter: `0x3B33708e9b8242999459EB9b4756C24c846e5936`
- Router: `0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc`

### Token Contracts
- USDT: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`
- sNGN: `0xd66e60AA5b6982649a116e6944Daec22b15468Ad`
- WETH: `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73`

### Market Contracts
- Original sNGN Market: `0x53b49A28054D108d7050B0E5C317001bE984EB2D`
- New USDT Market: `0x8E4C5f3296A100d4135187C3181258cb8a223bb1`