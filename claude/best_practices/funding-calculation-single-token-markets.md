# GMX V2 Funding Calculation for Single-Token Markets

## Overview

This document explains how GMX V2 handles funding calculations for single-token markets (where `longToken == shortToken`, e.g., mUSD/mUSD) and why the apparent "double-counting" is actually intentional and correctly compensated.

---

## The Question

When you have a **LONG position** in an **mUSD/mUSD** market, and you see:
- `claimableLongTokenAmount: 20.20 mUSD`
- `claimableShortTokenAmount: 20.20 mUSD`

**Why are both values the same, and does the user actually receive 40.40 mUSD?**

**Short Answer: YES, the user receives 40.40 mUSD total, and this is CORRECT by design.**

---

## How It Works

### 1. The Divisor System

GMX uses a `poolDivisor` to handle single-token markets:

**Code Location:** `contracts/market/MarketUtils.sol:2156`

```solidity
function getPoolDivisor(address longToken, address shortToken) internal pure returns (uint256) {
    return longToken == shortToken ? 2 : 1;
}
```

- **Dual-token markets** (e.g., ETH/USDC): divisor = 1
- **Single-token markets** (e.g., mUSD/mUSD): divisor = 2

---

### 2. Open Interest Division

When calculating open interest for single-token markets, GMX divides by the divisor:

**Code Location:** `contracts/market/MarketUtils.sol:2150`

```solidity
function getOpenInterest(
    DataStore dataStore,
    address market,
    address collateralToken,
    bool isLong,
    uint256 divisor
) internal view returns (uint256) {
    return dataStore.getUint(Keys.openInterestKey(market, collateralToken, isLong)) / divisor;
}
```

**Example:**
- Actual long OI using mUSD as collateral: $200,000
- Returned by `getOpenInterest()`: $200,000 / 2 = **$100,000**

---

### 3. Funding Amount Division

The total funding amount is also divided by the divisor:

**Code Location:** `contracts/market/MarketUtils.sol:1396-1397`

```solidity
cache.fundingUsd = Precision.applyFactor(cache.sizeOfPayingSide, cache.durationInSeconds * result.fundingFactorPerSecond);
cache.fundingUsd = cache.fundingUsd / divisor;
```

**Example:**
- Base funding calculation: $8
- After division for single-token market: $8 / 2 = **$4**

---

### 4. Distribution to Long and Short Tokens

The $4 funding is split between long and short tokens:

**Code Location:** `contracts/market/MarketUtils.sol:1405-1410`

```solidity
if (result.longsPayShorts) {
    cache.fundingUsdForLongCollateral = Precision.mulDiv(cache.fundingUsd, cache.openInterest.long.longToken, cache.longOpenInterest);
    cache.fundingUsdForShortCollateral = Precision.mulDiv(cache.fundingUsd, cache.openInterest.long.shortToken, cache.longOpenInterest);
}
```

In a single-token market where long OI = short OI:
- `fundingUsdForLongCollateral`: $4 × (100k / 200k) = **$2**
- `fundingUsdForShortCollateral`: $4 × (100k / 200k) = **$2**

---

### 5. Per-Size Calculation

The funding per size is calculated separately for each token:

**Code Location:** `contracts/market/MarketUtils.sol:1421-1426`

```solidity
result.fundingFeeAmountPerSizeDelta.long.longToken = getFundingAmountPerSizeDelta(
    cache.fundingUsdForLongCollateral,  // $2
    cache.openInterest.long.longToken,   // $100k (already divided by 2!)
    prices.longTokenPrice.max,
    true // roundUpMagnitude
);
```

**Calculation:**
- Funding per size for longToken: $2 / $100,000 = **0.00002 per $1 of OI**
- Funding per size for shortToken: $2 / $100,000 = **0.00002 per $1 of OI**

---

### 6. Storage Updates (The "Double Counting")

GMX updates four separate storage slots:

**Code Location:** `contracts/market/MarketUtils.sol:1274-1308`

```solidity
// For LONG positions paying in longToken
applyDeltaToClaimableFundingAmountPerSize(..., market.longToken, true, ...);

// For SHORT positions receiving in longToken
applyDeltaToClaimableFundingAmountPerSize(..., market.longToken, false, ...);

// For LONG positions paying in shortToken
applyDeltaToClaimableFundingAmountPerSize(..., market.shortToken, true, ...);

// For SHORT positions receiving in shortToken
applyDeltaToClaimableFundingAmountPerSize(..., market.shortToken, false, ...);
```

For **single-token markets** where `longToken == shortToken == mUSD`:
- Storage key `(market, mUSD, isLong=true)` is updated **TWICE**:
  - Once with `result.claimableFundingAmountPerSizeDelta.short.longToken` (+0.00002)
  - Once with `result.claimableFundingAmountPerSizeDelta.short.shortToken` (+0.00002)
- **Total increment**: 0.00002 + 0.00002 = **0.00004 per $1 of OI**

---

## Example: Complete Calculation

### Market Setup
- Market: mUSD/mUSD (single token)
- Actual long OI: $200,000
- Actual short OI: $100,000
- Base funding rate: $8
- You have: SHORT position with $100,000 size

### Step-by-Step

1. **Divisor Calculation:**
   ```
   divisor = longToken == shortToken ? 2 : 1
   divisor = 2
   ```

2. **Adjusted Open Interest:**
   ```
   Adjusted long OI = $200,000 / 2 = $100,000
   Adjusted short OI = $100,000 / 2 = $50,000
   ```

3. **Funding Amount:**
   ```
   Base funding = $8
   Adjusted funding = $8 / 2 = $4
   ```

4. **Distribution:**
   ```
   fundingUsdForLongCollateral = $4 × (100k / 200k) = $2
   fundingUsdForShortCollateral = $4 × (100k / 200k) = $2
   ```

5. **Per-Size Delta:**
   ```
   longToken per size = $2 / $100k = 0.00002
   shortToken per size = $2 / $100k = 0.00002
   ```

6. **Storage Update (same key twice for single-token):**
   ```
   claimableFundingAmountPerSize(market, mUSD, false) += 0.00002  (first update)
   claimableFundingAmountPerSize(market, mUSD, false) += 0.00002  (second update)
   Total = 0.00004 per $1 of OI
   ```

7. **Your Claimable Amount:**
   ```
   Position size: $100,000

   claimableLongTokenAmount = 0.00004 × $100,000 = $4 (but this is in "divided" terms)
   claimableShortTokenAmount = 0.00004 × $100,000 = $4 (same value!)

   BUT: Since your actual position size is $100,000 (not divided),
   and the per-size rate was calculated against divided OI,
   the math works out correctly!
   ```

8. **Final Claim:**
   ```
   When you claim, both amounts credit to the same storage key:
   Balance = $4 + $4 = $8

   This $8 represents the correct share of the original $8 funding
   for your $100,000 short position against $200,000 long OI.
   ```

---

## Why Both Values Are The Same

When you fetch funding fees for a position:

**Code Location:** `contracts/pricing/PositionPricingUtils.sol:365-377`

```solidity
fees.funding.latestLongTokenClaimableFundingAmountPerSize = MarketUtils.getClaimableFundingAmountPerSize(
    params.dataStore,
    params.position.market(),
    params.longToken,           // mUSD for single-token market
    params.position.isLong()    // Your position direction
);

fees.funding.latestShortTokenClaimableFundingAmountPerSize = MarketUtils.getClaimableFundingAmountPerSize(
    params.dataStore,
    params.position.market(),
    params.shortToken,          // ALSO mUSD for single-token market!
    params.position.isLong()    // SAME position direction
);
```

**For a LONG position in mUSD/mUSD:**
- Both calls fetch `claimableFundingAmountPerSize(market, mUSD, true)`
- They return THE SAME VALUE because it's the SAME storage key
- Both return (for example) 0.00004 per $1

**For a SHORT position in mUSD/mUSD:**
- Both calls fetch `claimableFundingAmountPerSize(market, mUSD, false)`
- They return THE SAME VALUE
- Both return (for example) 0.00004 per $1

---

## The Increment Logic

When incrementing claimable amounts:

**Code Location:** `contracts/position/PositionUtils.sol:571-591`

```solidity
if (fees.funding.claimableLongTokenAmount > 0) {
    MarketUtils.incrementClaimableFundingAmount(
        ...,
        params.market.longToken,    // mUSD
        ...,
        fees.funding.claimableLongTokenAmount  // e.g., $20.20
    );
}

if (fees.funding.claimableShortTokenAmount > 0) {
    MarketUtils.incrementClaimableFundingAmount(
        ...,
        params.market.shortToken,   // ALSO mUSD (same token!)
        ...,
        fees.funding.claimableShortTokenAmount  // ALSO $20.20 (same value!)
    );
}
```

**Storage Key:** `keccak256(abi.encode(CLAIMABLE_FUNDING_AMOUNT, market, token, account))`

For single-token markets:
- First call: increments `(market, mUSD, account)` by $20.20 → Balance: $20.20
- Second call: increments `(market, mUSD, account)` by $20.20 → Balance: $40.40

**Final claimable balance: $40.40** ✅

---

## Why This Is Correct

The GMX team explicitly designed this behavior. From the comments in `MarketUtils.sol:1368-1395`:

```solidity
// for single token markets, if there is $200,000 long open interest
// and $100,000 short open interest and if the fundingUsd is $8:
// fundingUsdForLongCollateral: $4
// fundingUsdForShortCollateral: $4
// ...
// when the fundingFeeAmountPerSize value is incremented, it would be incremented twice:
// 4 / 100,000 + 4 / 100,000 = 8 / 100,000
//
// since the actual long open interest is $200,000, this would result in a total of
// 8 / 100,000 * 200,000 = $16 being charged
//
// when the claimableFundingAmountPerSize value is incremented, it would similarly be
// incremented twice:
// 4 / 100,000 + 4 / 100,000 = 8 / 100,000
//
// when calculating the amount to be claimed, the longTokenClaimableFundingAmountPerSize
// and shortTokenClaimableFundingAmountPerSize are compared against the market's
// claimableFundingAmountPerSize for the longToken and claimableFundingAmountPerSize
// for the shortToken
//
// since both these values will be duplicated, the amount claimable would be:
// (8 / 100,000 + 8 / 100,000) * 100,000 = $16
//
// due to these, the fundingUsd should be divided by the divisor
```

**The system is designed so that:**
1. Base funding is divided by 2 (the divisor)
2. Open interest is divided by 2 (the divisor)
3. Storage updates happen twice (once for "long token", once for "short token")
4. Claim calculations fetch both values (which are the same in single-token markets)
5. **The math balances out to the correct total!**

---

## Reconciliation Implications

**For your reconciliation scripts:**

When you see:
```
claimableLongTokenAmount: 20.20 mUSD
claimableShortTokenAmount: 20.20 mUSD
```

**DO NOT treat this as duplication!** The user will receive:
- 20.20 + 20.20 = **40.40 mUSD total**

This is the correct amount based on:
- The base funding rate
- The position size
- The open interest imbalance
- The division by 2 for single-token markets

---

## Summary

1. **Single-token markets use divisor = 2**
2. **All funding calculations are divided by this divisor**
3. **Storage updates happen twice (once for longToken, once for shortToken)**
4. **When tokens are the same, both updates go to the same storage slot**
5. **The final claimable amount = claimableLongTokenAmount + claimableShortTokenAmount**
6. **This is NOT double-counting - it's intentional design to handle both funding streams**

**For reconciliation:** Sum both claimable amounts when longToken == shortToken. The total represents the actual claimable balance.

---

## Market Configuration

**You asked about adjusting market params to fix double-counting:**

**NO ADJUSTMENT NEEDED!** The system already handles this correctly through:
- `getPoolDivisor()` returning 2 for single-token markets
- Division of `fundingUsd` by the divisor
- Division of open interest by the divisor

The funding rates you configure in the market params are already applied correctly. The "doubling" you observe in the claimable amounts is compensated by the halving of the base funding calculation.

**If you were to halve the funding rates in the config, you would end up with HALF the intended funding!**

---

## Code References

Key functions to understand:
- `MarketUtils.getPoolDivisor()` - Returns 2 for single-token markets (line 2156)
- `MarketUtils.getNextFundingAmountPerSize()` - Main funding calculation (line 1327)
- `MarketUtils.getOpenInterest()` - Divides OI by divisor (line 2150)
- `PositionPricingUtils.getPositionFees()` - Fetches both long/short claimable amounts (line 365, 372)
- `PositionUtils.incrementClaimableFundingAmount()` - Credits both amounts (line 571, 582)
