# GMX V2 Deposit Flow - Complete Requirements Analysis

## Overview
This document provides a comprehensive analysis of all requirements for successfully depositing liquidity into a GMX V2 market, from USDT in wallet to receiving GM tokens.

## Token Flow
```
User Wallet → Router (via approval) → DepositVault → Market
```

## Step-by-Step Requirements

### 1. **User Wallet Preparation**
- **Token Balance**: User must have sufficient USDT balance (100 USDT in our case)
- **Token Approval**: User must approve Router contract (NOT ExchangeRouter)
  - Router: `0x200882043647295a21F9202f9C1535BfB2A2f127`
  - Amount: At least the deposit amount

### 2. **Create Deposit Phase**

#### Contract Addresses Required
- **ExchangeRouter**: `0x59b94d5B4686D59a4665d1679A8E27F71c544F40`
  - Entry point for createDeposit()
- **DepositHandler**: `0x3Bc412Ad515432cb3ddbD74bf1792971b156c827`
  - Processes deposit creation
- **DepositVault**: `0x9986771384aeA06185960C5CACA7AFcb47bCC47d`
  - Holds deposited tokens
- **DataStore**: `0x678FE2874cB82e6B44B7fF62C0f8638B86C462da`
  - Stores all configuration

#### Role Requirements
- ExchangeRouter must have `CONTROLLER` role on DepositHandler ✓
- Router must have `ROUTER_PLUGIN` role ✓
- DepositVault must have `BANK_KEEPER` role ✓

#### Market Configuration in DataStore
All keys use format: `keccak256(abi.encode(marketAddress, CONSTANT_NAME))`

- **Market Token**: `keccak256(abi.encode(market, "MARKET_TOKEN"))` → market address ✓
- **Index Token**: `keccak256(abi.encode(market, "INDEX_TOKEN"))` → sNGN address ✓
- **Long Token**: `keccak256(abi.encode(market, "LONG_TOKEN"))` → USDT address ✓
- **Short Token**: `keccak256(abi.encode(market, "SHORT_TOKEN"))` → USDT address ✓

#### Global Configuration in DataStore
- **WNT (Wrapped Native Token)**: `keccak256("WNT")` → WETH address ✓
- **FEE_RECEIVER**: `keccak256("FEE_RECEIVER")` → fee receiver address ❌ **MISSING**
- **SWAP_FEE_RECEIVER_FACTOR**: Controls fee split

### 3. **Execute Deposit Phase (Keeper)**

#### Oracle Requirements
- Oracle prices must be set for:
  - Index token (sNGN)
  - Long token (USDT)
  - Short token (USDT)
- Oracle timestamps must be:
  - Greater than deposit creation time
  - Within request expiration window

#### Keeper Requirements
- Keeper must have `ORDER_KEEPER` role
- Keeper pays gas for execution
- Must call `executeDeposit()` with oracle prices

#### Gas Configuration
- **ESTIMATED_GAS_FEE_BASE_AMOUNT**: Base gas fee ✓
- **ESTIMATED_GAS_FEE_MULTIPLIER**: Gas multiplier ✓
- **EXECUTE_DEPOSIT_GAS_LIMIT**: Gas limit for execution ✓

#### Fee Configuration
- **depositFeeFactorKey**: Deposit fee percentage
- **SWAP_FEE_RECEIVER_FACTOR**: Portion of fees to receiver
- **FEE_RECEIVER**: Address to receive fees ❌ **MISSING**

### 4. **Special Cases**

#### First Deposit
- **MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT**: Set to 0 (no special requirement) ✓
- If non-zero, first depositor gets special receiver address

#### Price Impact
- **MAX_PNL_FACTOR_FOR_DEPOSITS**: Maximum allowed PnL factor
- Positive/negative price impact factors per market

## Current Status

### ✅ Completed Configurations
1. Market registered in DataStore with correct key format
2. All tokens (market, index, long, short) configured
3. WNT address set
4. Role permissions configured correctly
5. Gas configuration parameters set
6. Market is enabled (not disabled)

### ❌ Missing Configurations
1. **FEE_RECEIVER not set** - This is causing the `Unauthorized(address(0))` error
   - When fees are calculated, the system tries to increment claimable fees
   - The fee receiver address is retrieved as address(0)
   - This triggers an authorization check that fails

## Error Analysis

The current error `Unauthorized(0x0000000000000000000000000000000000000000, 0x...)` occurs because:

1. During deposit execution, fees are calculated
2. `FeeUtils.incrementClaimableFeeAmount()` is called
3. The FEE_RECEIVER is retrieved from DataStore as address(0)
4. Some operation tries to validate roles for address(0)
5. Authorization fails with Unauthorized error

## Solution

Set the FEE_RECEIVER address in DataStore:
```javascript
const FEE_RECEIVER = ethers.utils.id("FEE_RECEIVER");
await dataStore.setAddress(FEE_RECEIVER, feeReceiverAddress);
```

The fee receiver should be an address that will collect protocol fees.

## Deposit Parameters Structure

```javascript
{
  receiver: userAddress,
  callbackContract: "0x0000000000000000000000000000000000000000",
  market: marketAddress,
  minMarketTokens: 0,
  shouldConvertETH: false,
  executionFee: 0,
  callbackGasLimit: 0,
  dataList: []
}
```

## Token Approval Flow
1. User approves Router (not ExchangeRouter)
2. Router transfers tokens to DepositVault
3. DepositVault holds tokens until execution
4. On execution, tokens are added to market
5. GM tokens are minted to receiver

## Next Steps
1. Set FEE_RECEIVER address
2. Optionally set deposit fee factors if fees are desired
3. Create deposit with proper parameters
4. Execute deposit with oracle prices (or let keeper do it)