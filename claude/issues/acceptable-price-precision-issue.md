# Acceptable Price Precision Issue - Technical Analysis

**Date:** December 2024
**Issue:** Short position orders fail validation due to incorrect acceptable price precision
**Status:** Fix implemented, pending testing

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Description](#problem-description)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Code Comparison](#code-comparison)
5. [Mathematical Breakdown](#mathematical-breakdown)
6. [The Solution](#the-solution)
7. [Testing & Validation](#testing--validation)
8. [Rollback Instructions](#rollback-instructions)

---

## Executive Summary

**The Issue:**
Short position orders created from our frontend are being cancelled because the `acceptablePrice` parameter fails GMX's validation check.

**Root Cause:**
We were using 30 decimal precision for all acceptable prices, but GMX's oracle stores prices with precision `30 - tokenDecimals`. For our mUSDTNGN index token (18 decimals), this means precision should be **12**, not **30**.

**Impact:**
- ❌ Short opens: FAIL (acceptablePrice is 10^18 times too large)
- ✅ Long opens: WORK (by coincidence, the validation is backwards-compatible)
- ❌ Short closes: FAIL (when using fixed values)
- ✅ Long closes: WORK (using 0 as acceptable price)

---

## Problem Description

### Symptom

When creating a short position order with the following parameters:
- Market: USDTNGN (Market #9)
- Side: Short
- Current price: 5000 NGN per USDT
- Acceptable price (with 0.5% slippage): 4975 NGN per USDT

The order is **cancelled** by the GMX keeper with an "OrderNotFulfillableAtAcceptablePrice" error.

### Market #9 Configuration

```javascript
// From claude/deployments/marks-arbitrumSepolia-deployments.md
Market 9: mUSDTNGN [mUSD-mNGN]
├── Index Token:  mUSDTNGN (0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73) - 18 decimals
├── Long Token:   mUSD     (0x85bf04B07A6df0172372b959C1C73F3e90F73faf) - 6 decimals
└── Short Token:  mNGN     (0x2e08218698339AFdba205312cc23dAe8c3690827) - 18 decimals
```

**Key Point:** The index token `mUSDTNGN` is a virtual token that tracks the USDT/NGN exchange rate. Its price represents how many NGN it takes to buy 1 USDT.

### Oracle Price Storage

```javascript
// From contracts/gmx-synthetics/scripts/set-musdtngn-prices.js
const EXCHANGE_RATE = 5000; // 1 USDT = 5000 NGN

// Oracle stores prices with precision: 30 - tokenDecimals
const musdtNgnPrice = ethers.utils.parseUnits("5000", 12); // 30 - 18 = 12
// Result: 5000 * 10^12 = 5,000,000,000,000,000
```

---

## Root Cause Analysis

### GMX Price Precision Formula

GMX stores oracle prices using this formula:

```
price_precision = 30 - token_decimals
```

For different tokens:
- **mUSD (6 decimals):**  precision = 30 - 6 = **24**
- **mNGN (18 decimals):** precision = 30 - 18 = **12**
- **mUSDTNGN (18 decimals):** precision = 30 - 18 = **12**

### How GMX Calculates Execution Price

From `PositionUtils.sol:707` (for short positions):

```solidity
// Step 1: Calculate position size in tokens
baseSizeDeltaInTokens = sizeDeltaUsd / indexTokenPrice.min

// Step 2: Calculate execution price
executionPrice = sizeDeltaUsd / sizeDeltaInTokens
```

**Example calculation for $100 short position:**

```javascript
sizeDeltaUsd = 100 * 10^30
indexTokenPrice.min = 5000 * 10^12  // From oracle (precision 12)

// Step 1:
baseSizeDeltaInTokens = (100 * 10^30) / (5000 * 10^12)
                      = 2 * 10^16

// Step 2:
executionPrice = (100 * 10^30) / (2 * 10^16)
              = 5 * 10^15
              = 5000 * 10^12  ✓ Same precision as oracle!
```

**Result:** `executionPrice = 5000 * 10^12`

### How GMX Validates Acceptable Price

From `BaseOrderUtils.sol:224-226` (for increase short):

```solidity
if (!isLong) {
    // For shorts: execution price must be >= acceptable price
    if (executionPrice < acceptablePrice) {
        revert OrderNotFulfillableAtAcceptablePrice(executionPrice, acceptablePrice);
    }
}
```

### The Bug in Our Code

**What we were doing:**

```javascript
// client/src/hooks/useOrderCreation.js (OLD CODE - line 281)
const acceptablePrice = basePrice * (1 - slippagePercent);
// acceptablePrice = 5000 * 0.995 = 4975

const acceptablePriceWei = parseUnits(acceptablePrice.toFixed(6), 30);
// acceptablePriceWei = 4975 * 10^30 = 4,975,000,000,000,000,000,000,000,000,000,000
```

**The validation check:**

```javascript
executionPrice = 5000 * 10^12 = 5,000,000,000,000,000
acceptablePrice = 4975 * 10^30 = 4,975,000,000,000,000,000,000,000,000,000,000

// GMX checks: executionPrice >= acceptablePrice?
// 5,000,000,000,000,000 >= 4,975,000,000,000,000,000,000,000,000,000,000?
// NO! ❌
```

**The magnitude difference:**

```
acceptablePrice / executionPrice = (4975 * 10^30) / (5000 * 10^12)
                                 = 9.95 * 10^17
                                 = 995,000,000,000,000,000
```

Our acceptable price was **995 quadrillion times too large!**

---

## Code Comparison

### Test Script (Working) vs Client (Broken)

#### Test Script: `test-market-orders.js`

```javascript
// Lines 448-458 - SHORT OPEN
if (isLong) {
    acceptablePrice = ethers.utils.parseUnits("5000", 24);
} else {
    acceptablePrice = 0;  // ✓ Works because 0 always passes validation
}
```

#### Client: `useOrderCreation.js` (BEFORE FIX)

```javascript
// Lines 273-281 - SHORT OPEN
const basePrice = liveMarketPrice; // 5000
const slippagePercent = 0.005;

let acceptablePrice;
if (side === 'long') {
    acceptablePrice = basePrice * (1 + slippagePercent);
} else {
    acceptablePrice = basePrice * (1 - slippagePercent); // 4975
}
const acceptablePriceWei = parseUnits(acceptablePrice.toFixed(6), 30); // ❌ WRONG PRECISION!
```

**The issue:** We used precision **30** instead of **12**.

### GMX Contract Code

#### Oracle Price Storage

```solidity
// contracts/gmx-synthetics/scripts/set-musdtngn-prices.js
// mUSDTNGN: 18 decimals, precision 30 => 30 - 18 = 12
const musdtNgnPrice = ethers.utils.parseUnits(EXCHANGE_RATE.toString(), 12);

// mUSD: 6 decimals, precision 30 => 30 - 6 = 24
const musdPrice = ethers.utils.parseUnits("1", 24);

// mNGN: 18 decimals, precision 30 => 30 - 18 = 12
const mngnPriceInUsd = (1 / EXCHANGE_RATE).toFixed(9);
const mngnPrice = ethers.utils.parseUnits(mngnPriceInUsd, 12);
```

#### Execution Price Calculation

```solidity
// contracts/position/PositionUtils.sol:707
function getExecutionPrice(
    uint256 sizeDeltaUsd,
    uint256 sizeDeltaInTokens,
    uint256 indexTokenPrice,
    bool isLong
) internal pure returns (uint256) {
    // For shorts:
    // baseSizeDeltaInTokens = sizeDeltaUsd / indexTokenPrice.min
    // executionPrice = sizeDeltaUsd / sizeDeltaInTokens

    return sizeDeltaUsd / sizeDeltaInTokens;
}
```

#### Acceptable Price Validation

```solidity
// contracts/order/BaseOrderUtils.sol:218-226
uint256 executionPrice = sizeDeltaUsd / sizeDeltaInTokens;

if (isIncrease) {
    if (isLong) {
        if (executionPrice > acceptablePrice) revert(...);
    } else {
        if (executionPrice < acceptablePrice) revert(...);  // ← SHORT VALIDATION
    }
}
```

### Keeper Price Configuration

```python
# contracts/gmx-synthetics/keeper/order_keeper_v2.py:616-644
def get_current_prices(self):
    exchange_rate = current_price  # e.g., 5000 from price feed

    prices = {
        self.mUSDTNGN: int(exchange_rate * 10**12),     # 5000 * 10^12 ✓
        self.mUSD: 1 * 10**24,                          # 1 * 10^24
        self.mNGN: int((1 / exchange_rate) * 10**12),   # (1/5000) * 10^12
    }

    return prices
```

**Note:** The keeper correctly uses precision 12 for mUSDTNGN.

---

## Mathematical Breakdown

### Example: $100 Short Position at 5000 NGN/USDT

#### Given:
- Position size: $100 USD
- Exchange rate: 5000 NGN per USDT
- Slippage: 0.5% (willing to accept worse price)
- Index token: mUSDTNGN (18 decimals)

#### Calculation:

**1. Oracle Price (from keeper):**
```javascript
indexTokenPrice = 5000 * 10^12 = 5,000,000,000,000,000
```

**2. Size Delta USD (GMX standard):**
```javascript
sizeDeltaUsd = 100 * 10^30 = 100,000,000,000,000,000,000,000,000,000,000
```

**3. Size Delta in Tokens (from PositionUtils.sol):**
```javascript
baseSizeDeltaInTokens = sizeDeltaUsd / indexTokenPrice.min
                      = (100 * 10^30) / (5000 * 10^12)
                      = 0.02 * 10^18
                      = 2 * 10^16 base units
```

**4. Execution Price (from PositionUtils.sol):**
```javascript
executionPrice = sizeDeltaUsd / sizeDeltaInTokens
              = (100 * 10^30) / (2 * 10^16)
              = 50 * 10^14
              = 5000 * 10^12 ✓
```

**5. Acceptable Price Calculation:**

**WRONG (before fix):**
```javascript
acceptablePrice = 5000 * 0.995 = 4975
acceptablePriceWei = parseUnits("4975", 30) = 4975 * 10^30

// Validation: executionPrice >= acceptablePrice?
// 5000 * 10^12 >= 4975 * 10^30?
// 5,000,000,000,000,000 >= 4,975,000,000,000,000,000,000,000,000,000,000?
// NO! ❌
```

**CORRECT (after fix):**
```javascript
acceptablePrice = 5000 * 0.995 = 4975
acceptablePriceWei = parseUnits("4975", 12) = 4975 * 10^12

// Validation: executionPrice >= acceptablePrice?
// 5000 * 10^12 >= 4975 * 10^12?
// 5,000,000,000,000,000 >= 4,975,000,000,000,000?
// YES! ✓
```

### Precision Table

| Token | Decimals | GMX Precision | Example Price | Wei Value |
|-------|----------|---------------|---------------|-----------|
| mUSDTNGN | 18 | 30 - 18 = **12** | 5000 | 5000 × 10^12 |
| mUSD | 6 | 30 - 6 = **24** | 1 | 1 × 10^24 |
| mNGN | 18 | 30 - 18 = **12** | 0.0002 | 2 × 10^8 |

---

## The Solution

### New Utility: `priceUtils.js`

```javascript
import { ethers } from 'ethers';
import { TOKEN_DECIMALS, MARKETS } from '../contracts/addresses';

const { parseUnits } = ethers.utils;

/**
 * Calculate correct precision for acceptable price
 * Formula: 30 - token_decimals
 */
export function getAcceptablePricePrecision(marketSymbol) {
  const market = MARKETS[marketSymbol];
  const indexToken = market.indexToken;
  const indexTokenDecimals = TOKEN_DECIMALS[indexToken];

  return 30 - indexTokenDecimals;
}

/**
 * Format acceptable price with correct precision
 */
export function formatAcceptablePrice(priceValue, marketSymbol) {
  const precision = getAcceptablePricePrecision(marketSymbol);
  const formattedValue = Number(priceValue).toFixed(6);
  return parseUnits(formattedValue, precision);
}
```

### Updated addresses.js

```javascript
// Added mUSDTNGN token
const ARBITRUM_SEPOLIA_ADDRESSES = {
  // ... other addresses ...
  mUSD: '0x85bf04B07A6df0172372b959C1C73F3e90F73faf',      // 6 decimals
  mNGN: '0x2e08218698339AFdba205312cc23dAe8c3690827',      // 18 decimals
  mUSDTNGN: '0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73',  // 18 decimals
};

// Token decimals lookup
const TOKEN_DECIMALS = {
  [ARBITRUM_SEPOLIA_ADDRESSES.mUSD]: 6,
  [ARBITRUM_SEPOLIA_ADDRESSES.mNGN]: 18,
  [ARBITRUM_SEPOLIA_ADDRESSES.mUSDTNGN]: 18,
};

// Fixed market config
const MARKETS = {
  USDTNGN: {
    marketToken: ARBITRUM_SEPOLIA_ADDRESSES.USDTNGN_MARKET,
    indexToken: ARBITRUM_SEPOLIA_ADDRESSES.mUSDTNGN,  // ✓ FIXED: was mNGN
    longToken: ARBITRUM_SEPOLIA_ADDRESSES.mUSD,
    shortToken: ARBITRUM_SEPOLIA_ADDRESSES.mNGN,
    symbol: 'USDTNGN',
  },
};
```

### Updated useOrderCreation.js

**BEFORE:**
```javascript
const acceptablePrice = basePrice * (1 - slippagePercent);
const acceptablePriceWei = parseUnits(acceptablePrice.toFixed(6), 30); // ❌ WRONG
```

**AFTER:**
```javascript
const acceptablePrice = basePrice * (1 - slippagePercent);
const acceptablePriceWei = formatAcceptablePrice(acceptablePrice, selectedPair); // ✓ CORRECT
```

### Updated usePositionManagement.js

**BEFORE:**
```javascript
acceptablePrice: parseUnits(Number(acceptablePrice).toString(), 30), // ❌ WRONG
```

**AFTER:**
```javascript
acceptablePrice: formatAcceptablePrice(Number(acceptablePrice), position.pair), // ✓ CORRECT
```

---

## Testing & Validation

### Debug Logging

The fix includes debug logging to verify correct calculations:

```javascript
// From priceUtils.js
export function debugPriceComparison(orderType, isLong, acceptablePrice,
                                     estimatedExecutionPrice, marketSymbol) {
  const precision = getAcceptablePricePrecision(marketSymbol);
  const executionPriceWei = parseUnits(Number(estimatedExecutionPrice).toFixed(6), precision);

  console.log('\n=== PRICE DEBUG ===');
  console.log(`Order Type: ${orderType} ${isLong ? 'LONG' : 'SHORT'}`);
  console.log(`Market: ${marketSymbol}`);
  console.log(`Precision: ${precision}`);
  console.log(`Acceptable Price: ${acceptablePrice.toString()}`);
  console.log(`Est. Execution Price: ${executionPriceWei.toString()}`);

  if (orderType === 'increase' && !isLong) {
    console.log(`Validation: executionPrice >= acceptablePrice`);
    console.log(`Will Pass: ${executionPriceWei.gte(acceptablePrice)}`);
  }
  console.log('==================\n');
}
```

### Test Cases

#### Test Case 1: Short Open at 5000 NGN/USDT

**Expected Output:**
```
=== PRICE DEBUG ===
Order Type: increase SHORT
Market: USDTNGN
Precision: 12
Acceptable Price: 4975000000000000 (4975 * 10^12)
Est. Execution Price: 5000000000000000 (5000 * 10^12)
Validation: executionPrice >= acceptablePrice
Will Pass: true ✓
==================
```

#### Test Case 2: Long Open at 5000 NGN/USDT

**Expected Output:**
```
=== PRICE DEBUG ===
Order Type: increase LONG
Market: USDTNGN
Precision: 12
Acceptable Price: 5025000000000000 (5025 * 10^12)
Est. Execution Price: 5000000000000000 (5000 * 10^12)
Validation: executionPrice <= acceptablePrice
Will Pass: true ✓
==================
```

#### Test Case 3: Short Close

**Expected Output:**
```
=== PRICE DEBUG ===
Order Type: decrease SHORT
Market: USDTNGN
Precision: 12
Acceptable Price: 5000000000000000 (5000 * 10^12)
Est. Execution Price: 5000000000000000 (5000 * 10^12)
Validation: executionPrice <= acceptablePrice
Will Pass: true ✓
==================
```

### Verification Steps

1. **Open browser console** when creating orders
2. **Look for debug logs** showing:
   - Precision = 12 (not 30)
   - Acceptable price magnitude matches execution price
   - "Will Pass: true"
3. **Create a short position** and verify it doesn't get cancelled
4. **Check keeper logs** for successful execution

---

## Rollback Instructions

If the fix causes issues, here's how to revert:

### Step 1: Delete the new utility file

```bash
rm client/src/utils/priceUtils.js
```

### Step 2: Revert useOrderCreation.js

Search for `// PRECISION FIX` and uncomment the old lines:

```javascript
// Line ~98
const acceptablePriceWei = parseUnits(acceptablePrice.toString(), 30);

// Line ~170
const acceptablePriceWei = parseUnits(acceptablePrice.toString(), 30);

// Line ~289
const acceptablePriceWei = parseUnits(acceptablePrice.toFixed(6), 30);
```

Remove the import:
```javascript
// Delete this line
import { formatAcceptablePrice, debugPriceComparison } from '../utils/priceUtils';
```

### Step 3: Revert usePositionManagement.js

```javascript
// Line ~135
acceptablePrice: parseUnits(Number(acceptablePrice).toString(), 30),
```

Remove the import:
```javascript
// Delete this line
import { formatAcceptablePrice, debugPriceComparison } from '../utils/priceUtils';
```

### Step 4: Revert addresses.js (optional)

If needed, change the index token back:
```javascript
const MARKETS = {
  USDTNGN: {
    indexToken: ARBITRUM_SEPOLIA_ADDRESSES.mNGN,  // Revert to old value
    // ...
  },
};
```

And remove the TOKEN_DECIMALS export.

---

## Summary Comparison Table

| Aspect | Before Fix | After Fix |
|--------|-----------|-----------|
| **Precision Used** | 30 (hardcoded) | 12 (calculated: 30 - 18) |
| **Acceptable Price (Short)** | 4975 × 10^30 | 4975 × 10^12 |
| **Execution Price** | 5000 × 10^12 | 5000 × 10^12 |
| **Validation** | ❌ FAIL (too large) | ✅ PASS (correct scale) |
| **Short Opens** | ❌ Cancelled | ✅ Should work |
| **Long Opens** | ✅ Works | ✅ Works |
| **Index Token** | mNGN (wrong) | mUSDTNGN (correct) |

---

## References

### GMX Contract Files
- `contracts/gmx-synthetics/contracts/position/PositionUtils.sol:707` - Execution price calculation
- `contracts/gmx-synthetics/contracts/order/BaseOrderUtils.sol:218-226` - Acceptable price validation
- `contracts/gmx-synthetics/scripts/set-musdtngn-prices.js` - Oracle price configuration

### Our Files (Modified)
- `client/src/utils/priceUtils.js` - NEW: Precision calculation utility
- `client/src/contracts/addresses.js` - Added TOKEN_DECIMALS, fixed index token
- `client/src/hooks/useOrderCreation.js` - Updated acceptable price formatting
- `client/src/hooks/usePositionManagement.js` - Updated acceptable price formatting

### Test Files
- `contracts/gmx-synthetics/scripts/test-market-orders.js:448-458` - Working reference implementation

---

## Questions for Team Discussion

1. **Should we add automated tests** to verify acceptable price precision for all order types?
2. **Should we add validation** in the frontend to warn users if their order might fail?
3. **Do we need to handle other markets** with different index token decimals in the future?
4. **Should we remove debug logging** after confirming the fix works in production?

---

**Document Version:** 1.0
**Last Updated:** December 2024
**Authors:** Development Team
**Review Status:** Pending team review
