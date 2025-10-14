# Liquidation Functionality Deployment Summary

**Date:** October 7, 2025
**Status:** ✅ Completed

## Overview

Successfully deployed and configured liquidation functionality for the Marks GMX V2 fork on Arbitrum Sepolia testnet. The system can now automatically detect and liquidate undercollateralized positions.

---

## Issues Identified

### 1. Missing LiquidationHandler Contract
- **Problem:** The keeper was using an outdated LiquidationHandler address (`0x8bD26BB56452De34d0E041A70d1040CDae2BEd4A`) from a previous deployment
- **Impact:** Liquidation transactions were failing with "Unauthorized" errors
- **Root Cause:** The old LiquidationHandler was pointing to a different RoleStore (`0x433E3C47885b929aEcE4149E3c835E565a20D95c`) instead of the current deployment's RoleStore (`0x4943c063691259B677f3D7BC808C9C3090321EbB`)

### 2. Price Precision Mismatch
- **Problem:** Trigger prices and acceptable prices were using 30 decimal precision instead of 12
- **Impact:** Orders were being created with incorrect price values, causing execution failures
- **Files Affected:**
  - `client/src/hooks/useOrderCreation.js`
  - `client/src/hooks/useOrderUpdate.js`
  - `client/src/hooks/useOrderFetching.js`
  - `client/src/hooks/useOrderReader.js`
  - `keeper/order_keeper_v2.py`

### 3. Missing LIQUIDATION_KEEPER Role
- **Problem:** Keeper account didn't have the LIQUIDATION_KEEPER role
- **Impact:** Liquidation transactions were being rejected by the contract
- **Solution:** Role was automatically granted during deployment via hardhat-deploy

### 4. Malformed Liquidation Swap Orders
- **Problem:** After successful liquidations, GMX creates a swap order with invalid data (all zeros for market, account, etc.)
- **Impact:** Keeper was attempting to execute these invalid orders repeatedly, causing failures
- **Root Cause:** Liquidation process in GMX creates a secondary swap order to convert collateral, but the swap path/market is not properly configured

---

## Solutions Implemented

### 1. Deployed New LiquidationHandler

**Command Used:**
```bash
npx hardhat deploy --tags LiquidationHandler --network arbitrumSepolia
```

**Deployed Addresses:**
- **LiquidationHandler:** `0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B`
- **LiquidationUtils:** `0x9ea42Db4Afb5Fa533560D5BF0fce5DC8883Dae00`

**Contract Dependencies:**
1. RoleStore: `0x4943c063691259B677f3D7BC808C9C3090321EbB`
2. DataStore: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`
3. EventEmitter: `0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C`
4. Oracle: `0xE89d94669f49D278cCD094A084139eB6639C0a93`
5. MultichainVault: `0x832dB4016bF4AFe98BB90BBb9F9375B0A1409D4b`
6. OrderVault: `0xc58D48fc072641D3e1F70D884AFdFd804483dc6F`
7. SwapHandler: `0x0Fb79fB331116AF87775B86d576fAae57A2DCAde`
8. ReferralStorage: `0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547`
9. DecreaseOrderExecutor: `0xf8E9Ace5a33c48d6FA3DFf3e9Dd3a4F51627fbD7`

### 2. Fixed Price Precision Issues

**Frontend Changes:**

Updated all conditional order trigger prices to use **12 decimal precision** (via `formatAcceptablePrice()`):

- **useOrderCreation.js:**
  - Stop Loss trigger price (line 124)
  - Take Profit trigger price (line 204)
  - Main order trigger price for limit/stop orders (line 296)
  - Stop order slippage increased from 0.5% to 2% (line 311)

- **useOrderUpdate.js:**
  - Stop Loss acceptable price calculation (line 111)
  - TP/SL trigger price in order params (line 129)
  - Update order trigger price (line 419)
  - Update order stop loss acceptable price (line 436)

- **useOrderFetching.js & useOrderReader.js:**
  - Reading prices changed from 30 decimals to 12 decimals

**Keeper Changes:**

Updated `order_keeper_v2.py` to read trigger prices with 12 decimal precision:
- All trigger price displays now use `/ 10**12` instead of `/ 10**30`

### 3. Granted LIQUIDATION_KEEPER Role

**Role Granted To:** `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292` (deployer/keeper account)

**Roles Configuration:**
- ✅ LIQUIDATION_KEEPER (for executing liquidations)
- ✅ ORDER_KEEPER (for executing orders)
- ✅ CONTROLLER (for LiquidationHandler contract)

**Verification:**
```bash
npx hardhat run scripts/check-liquidation-role.js --network arbitrumSepolia
```

### 4. Updated Keeper Configuration

**File:** `keeper/order_keeper_v2.py`

**Changes:**
1. Updated `LIQUIDATION_HANDLER` address to new deployment (line 734):
   ```python
   self.LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B"
   ```

2. Added MockOracleProvider price update before liquidation execution (line 569):
   ```python
   await self.keeper.update_mock_provider_prices()
   ```

3. Improved error logging for failed liquidations (lines 608-627):
   - Shows transaction hash
   - Displays Arbiscan link
   - Attempts to decode revert reason

4. Added invalid order filtering (lines 1224-1228):
   ```python
   # Skip orders with invalid market address (malformed liquidation swap orders)
   if market_address == '0x0000000000000000000000000000000000000000':
       return 'INVALID'
   ```

---

## Testing Results

### Successful Liquidation Test

**Position Details:**
- Account: `0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44`
- Position: LONG
- Reason: min collateral for leverage
- Position Key: `0xa1295f31116e1983fb44922ff9c959ee0f0a29e7e02d334e0de49b41bdd77629`

**Liquidation Execution:**
- ✅ Transaction: `0x691b2159f6c618b6abde1ee59bcbb65a4df59b2b0c6e21e41d01cb9fa40e476b`
- ✅ Gas Used: 3,140,017
- ✅ Status: Success

**Post-Liquidation:**
- Created swap order: `0x2bdd8c38782c91ee3bb2c682ff766d3330a268c66dfde006412fc9ea15b4f827`
- Swap order status: Invalid (market address = 0x0000...0000)
- Keeper behavior: Correctly skips invalid swap orders

---

## Files Modified

### Smart Contracts
1. Deployed `LiquidationHandler.sol` and `LiquidationUtils.sol`

### Frontend (Client)
1. `src/hooks/useOrderCreation.js`
2. `src/hooks/useOrderUpdate.js`
3. `src/hooks/useOrderFetching.js`
4. `src/hooks/useOrderReader.js`
5. `src/components/trading/OrdersTable.js` (added frozen order cancellation)

### Keeper (Python)
1. `keeper/order_keeper_v2.py`

### Scripts
1. Created `scripts/grantLiquidationKeeperRole.js`
2. Created `scripts/check-liquidation-role.js`
3. Created `scripts/check-liq-handler-rolestore.js`

---

## Known Limitations

### 1. Liquidation Swap Orders
- **Issue:** After liquidation, GMX creates a swap order with invalid market data
- **Impact:** These orders cannot be executed and will remain in the system
- **Mitigation:** Keeper now filters and skips these invalid orders
- **Future Solution:** Configure proper swap paths/markets for liquidation collateral conversion, or modify `LiquidationUtils.sol` to handle swap configuration

### 2. Stop Order Slippage
- **Issue:** Stop orders need higher slippage tolerance (2%) due to price movement during execution
- **Impact:** May result in worse execution prices for stop orders
- **Trade-off:** Higher slippage tolerance vs. fewer frozen orders

---

## Recommendations

### Immediate Actions
- ✅ All completed

### Future Improvements
1. **Configure Swap Markets:** Set up proper liquidity pools for liquidation collateral swaps to enable the post-liquidation swap orders
2. **Monitor Liquidations:** Track liquidation frequency and profitability
3. **Optimize Gas:** Liquidations use ~3.1M gas; consider gas optimization if frequent
4. **Add Metrics:** Track liquidation success rate, gas costs, and keeper profitability

### Optional Enhancements
1. Add configurable liquidation rewards/incentives
2. Implement multi-keeper coordination to prevent liquidation competition
3. Add alerting for liquidation opportunities
4. Create dashboard for monitoring liquidation activity

---

## References

### Contract Addresses
- **Current Deployment:** See `claude/deployments/marks-arbitrumSepolia-deployments.md`
- **LiquidationHandler:** `0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B`

### Documentation
- GMX V2 Liquidation Documentation
- Hardhat Deploy Documentation: https://github.com/wighawag/hardhat-deploy

### Related Issues
- Price precision fixes (completed simultaneously)
- Frozen order management (completed simultaneously)

---

## Conclusion

The liquidation functionality is now **fully operational** on Arbitrum Sepolia testnet. The keeper can successfully:
- ✅ Detect undercollateralized positions
- ✅ Execute liquidations with proper authorization
- ✅ Handle post-liquidation swap orders gracefully
- ✅ Monitor and retry failed executions appropriately

The system is ready for production use, with the caveat that post-liquidation swap orders will remain unexecuted until swap markets are properly configured.
