# From Market Config to Trader Fees: Detailed Calculation Guide

This document explains **exactly** how GMX v2 market configuration parameters translate into the per-second rates stored on-chain, and then into actual fees paid by traders.

---

## Table of Contents

1. [Borrowing Fees: Complete Calculation Flow](#borrowing-fees-complete-calculation-flow)
2. [Funding Fees: Complete Calculation Flow](#funding-fees-complete-calculation-flow)
3. [Worked Examples with Real Numbers](#worked-examples-with-real-numbers)

---

## Borrowing Fees: Complete Calculation Flow

### Step 1: Configuration Parameters

From `/contracts/gmx-synthetics/config/borrowingRates.ts`:

```typescript
borrowingRateConfig_LowMax_WithLowerBase: {
  optimalUsageFactor: decimalToFloat(75, 2),           // 0.75 (75%)
  baseBorrowingFactor: decimalToFloat(45, 2),          // 0.45 (45% APR)
  aboveOptimalUsageBorrowingFactor: decimalToFloat(100, 2), // 1.00 (100% APR)
}
```

These are stored on-chain in the DataStore with 30 decimal precision:

- `optimalUsageFactor` = 750000000000000000000000000000 (75%)
- `baseBorrowingFactor` = 450000000000000000000000000000 (45%)
- `aboveOptimalUsageBorrowingFactor` = 1000000000000000000000000000000 (100%)

### Step 2: Calculate Current Utilization

**Contract**: `MarketUtils.sol::getBorrowingFactorPerSecond()` (line 2622)

**Inputs**:
- `reservedUsd` - Total USD value locked in all positions (for that side)
- `poolUsd` - Total pool liquidity available (for that side)

**Calculation**:
```solidity
usageFactor = reservedUsd * FLOAT_PRECISION / poolUsd
```

Where `FLOAT_PRECISION` = 10^30

**Example**:
- `reservedUsd` = 50,000 USD (in positions)
- `poolUsd` = 100,000 USD (total liquidity)
- `usageFactor` = 50,000 * 10^30 / 100,000 = 0.5 * 10^30 = 500000000000000000000000000000 (50%)

### Step 3: Kink Model Calculation

**Contract**: `MarketUtils.sol::getKinkBorrowingFactor()` (line 2686)

The borrowing rate follows a **two-tier model**:

#### If usageFactor ≤ optimalUsageFactor (Below the "kink"):

```solidity
borrowingFactorPerSecond = (usageFactor * baseBorrowingFactor) / FLOAT_PRECISION
```

**Example** (50% utilization < 75% optimal):
```
borrowingFactorPerSecond = (0.5 * 10^30 * 0.45 * 10^30) / 10^30
                         = 0.225 * 10^30
                         = 225000000000000000000000000000
```

This represents **22.5% APR** at 50% utilization.

#### If usageFactor > optimalUsageFactor (Above the "kink"):

```solidity
// Base portion (at optimal)
basePortion = (usageFactor * baseBorrowingFactor) / FLOAT_PRECISION

// Additional portion (linear increase from optimal to 100%)
diff = usageFactor - optimalUsageFactor
additionalRate = aboveOptimalUsageBorrowingFactor - baseBorrowingFactor
divisor = FLOAT_PRECISION - optimalUsageFactor
additionalPortion = (additionalRate * diff) / divisor

borrowingFactorPerSecond = basePortion + additionalPortion
```

**Example** (90% utilization > 75% optimal):
```
// Base portion
basePortion = (0.90 * 10^30 * 0.45 * 10^30) / 10^30
            = 0.405 * 10^30

// Additional portion
diff = 0.90 * 10^30 - 0.75 * 10^30 = 0.15 * 10^30
additionalRate = 1.00 * 10^30 - 0.45 * 10^30 = 0.55 * 10^30
divisor = 1.00 * 10^30 - 0.75 * 10^30 = 0.25 * 10^30

additionalPortion = (0.55 * 10^30 * 0.15 * 10^30) / 0.25 * 10^30
                  = 0.33 * 10^30

borrowingFactorPerSecond = 0.405 * 10^30 + 0.33 * 10^30
                         = 0.735 * 10^30
                         = 735000000000000000000000000000
```

This represents **73.5% APR** at 90% utilization.

**Visual Representation**:
```
APR
100% |                    ________
     |                   /
     |                  /
 45% |_________________/
     |                ^
     |                |
   0%|________________|____________
     0%              75%          100%
                  (kink)       Utilization
```

### Step 4: Convert to Per-Second Rate

The `borrowingFactorPerSecond` calculated above already represents a **per-second rate** because:

```solidity
borrowingFactorPerSecond = annualRate / secondsPerYear
```

But actually, GMX stores it as the **annual rate** and then applies it per-second during accrual:

**The value stored is actually the ANNUAL rate** (e.g., 0.735 * 10^30 for 73.5% APR)

### Step 5: Accrue Borrowing Over Time

**Contract**: `MarketUtils.sol::getNextCumulativeBorrowingFactor()` (line 2596)

**Every time a position is updated** (open/close/etc), GMX calculates:

```solidity
durationInSeconds = currentTimestamp - lastUpdateTimestamp
borrowingFactorPerSecond = getBorrowingFactorPerSecond(...)  // From Step 3

delta = durationInSeconds * borrowingFactorPerSecond
nextCumulativeBorrowingFactor = cumulativeBorrowingFactor + delta
```

**Example** (1 day = 86,400 seconds):
```
borrowingFactorPerSecond = 735000000000000000000000000000 (73.5% annual)
durationInSeconds = 86,400

delta = 86,400 * 735000000000000000000000000000
      = 63,504,000,000,000,000,000,000,000,000,000,000
      = 6.35 * 10^34

nextCumulativeBorrowingFactor = prevCumulativeBorrowingFactor + 6.35 * 10^34
```

### Step 6: Calculate Per-Position Borrowing Fee

**Contract**: `MarketUtils.sol::getBorrowingFees()` (line 1952)

**For each position**:

```solidity
diffFactor = currentCumulativeBorrowingFactor - positionBorrowingFactor
borrowingFeeUsd = (positionSizeInUsd * diffFactor) / FLOAT_PRECISION
```

**Example**:
```
positionSizeInUsd = 10,000 * 10^30 (10k USD position)
positionBorrowingFactor = 100 * 10^34 (when position opened)
currentCumulativeBorrowingFactor = 106.35 * 10^34 (after 1 day)

diffFactor = 106.35 * 10^34 - 100 * 10^34
           = 6.35 * 10^34

borrowingFeeUsd = (10,000 * 10^30 * 6.35 * 10^34) / 10^30
                = 6.35 * 10^34
                = 63,500,000,000,000,000,000,000,000,000,000,000

// Convert to USD (divide by 10^30)
borrowingFeeUsd = 63.5 USD
```

**Verification** (should be ~73.5% APR for 1 day):
```
Daily rate = 73.5% / 365 = 0.201% per day
Expected fee = 10,000 * 0.00201 = 20.1 USD

Wait, that doesn't match! Let me recalculate...
```

**Actually**, the borrowingFactorPerSecond needs to be converted to per-second:

### CORRECTION: Actual Per-Second Rate

Looking at the contract more carefully, the `borrowingFactorPerSecond` is NOT the annual rate. It's calculated as:

```solidity
borrowingFactorPerSecond = Precision.applyFactor(usageFactor, baseBorrowingFactor)
```

Where `baseBorrowingFactor` is stored as **per-second** rate:

```
baseBorrowingFactor (45% APR) = 0.45 / 31,536,000 (seconds per year)
                               ≈ 1.426 * 10^-8 per second
                               = 14260000000000000000 (in 30 decimals)
```

**Corrected Example** (90% utilization):
```
usageFactor = 0.90 * 10^30
baseBorrowingFactorPerSecond = 14260000000000000000 (0.45/year / 31,536,000)

borrowingFactorPerSecond = (0.90 * 10^30 * 14260000000000000000) / 10^30
                         = 12,834,000,000,000,000,000 per second
```

After 1 day (86,400 seconds):
```
delta = 86,400 * 12,834,000,000,000,000,000
      = 1,108,857,600,000,000,000,000,000

borrowingFeeUsd = (10,000 * 10^30 * 1,108,857,600,000,000,000,000,000) / 10^30
                = 11,088,576,000,000,000,000,000,000,000,000,000,000

// Convert to USD (30 decimals)
                = 11.09 USD
```

**Verification**:
```
Expected (40.5% APR for 1 day at 90% util with base 45%):
40.5% / 365 = 0.111% per day
10,000 * 0.00111 = 11.1 USD ✓
```

---

## Funding Fees: Complete Calculation Flow

### Step 1: Configuration Parameters

From `/contracts/gmx-synthetics/config/fundingRates.ts`:

```typescript
fundingRateConfig_LowMax: {
  fundingIncreaseFactorPerSecond: decimalToFloat(16, 13),      // 1.6 * 10^-11
  fundingDecreaseFactorPerSecond: decimalToFloat(0),           // 0 (no decrease)
  minFundingFactorPerSecond: decimalToFloat(3, 10),            // 3 * 10^-7
  maxFundingFactorPerSecond: decimalToFloat(17, 9),            // 1.7 * 10^-8
  thresholdForStableFunding: decimalToFloat(5, 2),             // 5%
  thresholdForDecreaseFunding: decimalToFloat(0),              // 0%
}
```

Stored on-chain (30 decimals):
- `fundingIncreaseFactorPerSecond` = 160000000000000000000 (1.6 * 10^-11)
- `minFundingFactorPerSecond` = 300000000000000000000000 (3 * 10^-7)
- `maxFundingFactorPerSecond` = 17000000000000000000000 (1.7 * 10^-8)
- `thresholdForStableFunding` = 50000000000000000000000000000 (5%)
- `thresholdForDecreaseFunding` = 0

### Step 2: Calculate Open Interest Imbalance

**Contract**: `MarketUtils.sol::getNextFundingFactorPerSecond()` (line 1497)

**Inputs**:
- `longOpenInterest` - Total USD in all long positions
- `shortOpenInterest` - Total USD in all short positions
- `durationInSeconds` - Time since last update

**Calculation**:
```solidity
diffUsd = |longOpenInterest - shortOpenInterest|
totalOpenInterest = longOpenInterest + shortOpenInterest
diffUsdToOpenInterestFactor = (diffUsd * FLOAT_PRECISION) / totalOpenInterest
```

**Example**:
- `longOpenInterest` = 80,000 USD
- `shortOpenInterest` = 30,000 USD
- `totalOpenInterest` = 110,000 USD
- `diffUsd` = 50,000 USD

```
diffUsdToOpenInterestFactor = (50,000 * 10^30) / 110,000
                            = 0.4545 * 10^30
                            = 454500000000000000000000000000 (45.45%)
```

### Step 3: Determine Funding Rate Change

**Contract**: `MarketUtils.sol::getNextFundingFactorPerSecond()` (lines 1559-1585)

The contract uses a **state machine** approach:

```
Current saved funding rate (savedFundingFactorPerSecond)
   |
   v
Check: Is imbalance in same direction as current funding?
   |
   +-- YES --> Check imbalance threshold:
   |             |
   |             +-- > 5% (thresholdForStableFunding) --> INCREASE funding
   |             +-- < 0% (thresholdForDecreaseFunding) --> DECREASE funding
   |             +-- Between 0% and 5% --> NO CHANGE
   |
   +-- NO (skew flipped) --> INCREASE funding (in opposite direction)
```

#### Case 1: Increase Funding

**When**: Imbalance > 5% threshold

```solidity
increaseValue = (diffUsdToOpenInterestFactor * fundingIncreaseFactorPerSecond) / FLOAT_PRECISION
                * durationInSeconds

// If longs > shorts, funding increases positively (longs pay)
// If shorts > longs, funding increases negatively (shorts pay)
if (longOpenInterest < shortOpenInterest) {
    increaseValue = -increaseValue
}

nextSavedFundingFactorPerSecond = savedFundingFactorPerSecond + increaseValue
```

**Example** (longs > shorts, 45.45% imbalance, 1 hour = 3600 seconds):
```
savedFundingFactorPerSecond = 10,000,000,000,000,000,000,000 (1 * 10^-8, existing rate)
fundingIncreaseFactorPerSecond = 160,000,000,000,000,000,000 (1.6 * 10^-11)
diffUsdToOpenInterestFactor = 454,500,000,000,000,000,000,000,000,000 (45.45%)
durationInSeconds = 3,600

increaseValue = (454,500,000,000,000,000,000,000,000,000 * 160,000,000,000,000,000,000) / 10^30
                * 3,600
              = 72,720,000,000,000,000,000 * 3,600
              = 261,792,000,000,000,000,000,000

nextSavedFundingFactorPerSecond = 10,000,000,000,000,000,000,000
                                 + 261,792,000,000,000,000,000,000
                                 = 271,792,000,000,000,000,000,000
                                 = 2.72 * 10^-7 per second
```

#### Case 2: Decrease Funding

**When**: Imbalance < 0% threshold (and `fundingDecreaseFactorPerSecond` > 0)

```solidity
decreaseValue = fundingDecreaseFactorPerSecond * durationInSeconds

if (savedFundingFactorPerSecondMagnitude <= decreaseValue) {
    nextSavedFundingFactorPerSecond = sign(savedFundingFactorPerSecond) * 1
} else {
    nextSavedFundingFactorPerSecond = savedFundingFactorPerSecondMagnitude - decreaseValue
}
```

**In our config**: `fundingDecreaseFactorPerSecond` = 0, so funding **never decreases**, only increases or stays stable.

#### Case 3: No Change

**When**: Imbalance between 0% and 5%

```solidity
nextSavedFundingFactorPerSecond = savedFundingFactorPerSecond  // No change
```

### Step 4: Apply Min/Max Bounds

**Contract**: `MarketUtils.sol::getNextFundingFactorPerSecond()` (lines 1601-1620)

```solidity
// Bound between 0 and max
nextSavedFundingFactorPerSecond = bound(
    nextSavedFundingFactorPerSecond,
    0,
    maxFundingFactorPerSecond  // 1.7 * 10^-8
)

// Apply min bound for final returned value
nextSavedFundingFactorPerSecondWithMinBound = bound(
    nextSavedFundingFactorPerSecond,
    minFundingFactorPerSecond,  // 3 * 10^-7
    maxFundingFactorPerSecond   // 1.7 * 10^-8
)

return (
    abs(nextSavedFundingFactorPerSecondWithMinBound),  // Magnitude
    nextSavedFundingFactorPerSecondWithMinBound > 0,   // longsPayShorts
    nextSavedFundingFactorPerSecond                    // Saved value (without min bound)
)
```

**Example** (continuing from Case 1):
```
nextSavedFundingFactorPerSecond = 2.72 * 10^-7

// Check against max
maxFundingFactorPerSecond = 1.7 * 10^-8
2.72 * 10^-7 > 1.7 * 10^-8, so cap it:
nextSavedFundingFactorPerSecond = 1.7 * 10^-8

// Apply min bound for return value
minFundingFactorPerSecond = 3 * 10^-7
1.7 * 10^-8 < 3 * 10^-7, so apply min:
nextSavedFundingFactorPerSecondWithMinBound = 3 * 10^-7

Return:
- fundingFactorPerSecond = 3 * 10^-7 (300,000,000,000,000,000,000,000)
- longsPayShorts = true (positive)
- savedValue = 1.7 * 10^-8 (stored for next iteration)
```

**Key Insight**: The `minFundingFactorPerSecond` creates a **floor** - even with small imbalances, funding won't drop below this minimum rate.

### Step 5: Calculate Funding USD Per Period

**Contract**: `MarketUtils.sol::getNextFundingAmountPerSize()` (lines 1300-1486)

**For each update period** (e.g., when positions open/close):

```solidity
durationInSeconds = currentTimestamp - lastFundingUpdateTimestamp
fundingUsd = (fundingFactorPerSecond * durationInSeconds * diffUsd) / FLOAT_PRECISION
```

Where `diffUsd` is the OI imbalance from Step 2.

**Example** (1 hour update, continuing from above):
```
fundingFactorPerSecond = 300,000,000,000,000,000,000,000 (3 * 10^-7)
durationInSeconds = 3,600
diffUsd = 50,000 USD

fundingUsd = (300,000,000,000,000,000,000,000 * 3,600 * 50,000 * 10^30) / 10^30
           = 300,000,000,000,000,000,000,000 * 3,600 * 50,000
           = 54,000,000,000,000,000,000,000,000,000,000,000
           = 54 * 10^30 USD
```

**Convert to actual USD**:
```
fundingUsd = 54 USD total (to be distributed over 1 hour period)
```

### Step 6: Split Funding by Collateral Token

**Contract**: `MarketUtils.sol::getNextFundingAmountPerSize()` (lines 1404-1410)

**For single-token markets** (both long and short token = mUSD):

```solidity
if (longsPayShorts) {
    fundingUsdForLongCollateral = (fundingUsd * openInterest.long.longToken) / longOpenInterest
    fundingUsdForShortCollateral = (fundingUsd * openInterest.long.shortToken) / longOpenInterest
}
```

**Example** (all positions use mUSD as collateral):
```
fundingUsd = 54 USD
longOpenInterest = 80,000 USD (all using mUSD)
openInterest.long.longToken = 80,000 USD (all in mUSD)
openInterest.long.shortToken = 0 (none using other token)

fundingUsdForLongCollateral = (54 * 80,000) / 80,000 = 54 USD
fundingUsdForShortCollateral = 0 USD
```

### Step 7: Calculate Per-Size Deltas

**Contract**: `MarketUtils.sol::getFundingAmountPerSizeDelta()` (line 1624)

**For paying side** (e.g., longs if longsPayShorts):
```solidity
fundingFeeAmountPerSizeDelta = (fundingUsdForCollateral * FLOAT_PRECISION * FLOAT_PRECISION_SQRT)
                              / (openInterestForCollateral * tokenPrice)
```

Where `FLOAT_PRECISION_SQRT` = 10^15

**For receiving side** (e.g., shorts if longsPayShorts):
```solidity
claimableFundingAmountPerSizeDelta = (fundingUsdForCollateral * FLOAT_PRECISION * FLOAT_PRECISION_SQRT)
                                    / (shortOpenInterest * tokenPrice)
```

**Example** (longs pay, shorts receive, mUSD token @ $1):
```
// Longs pay (fundingFee)
fundingUsdForLongCollateral = 54 USD
longOpenInterest = 80,000 USD
longTokenPrice = 1 USD (mUSD)

fundingFeeAmountPerSizeDelta.long.longToken = (54 * 10^30 * 10^15) / (80,000 * 10^30 * 1)
                                            = (54 * 10^45) / (80,000 * 10^30)
                                            = 675,000,000,000,000,000 per USD of position
                                            = 6.75 * 10^-7 mUSD per USD of position

// Shorts receive (claimable)
shortOpenInterest = 30,000 USD

claimableFundingAmountPerSizeDelta.short.longToken = (54 * 10^30 * 10^15) / (30,000 * 10^30 * 1)
                                                   = 1,800,000,000,000,000,000 per USD of position
                                                   = 1.8 * 10^-6 mUSD per USD of position
```

### Step 8: Calculate Per-Position Funding

**Contract**: `PositionPricingUtils.sol::getFundingFees()` (line 420)

**For each position**:

```solidity
// Cost (if on paying side)
fundingFeeAmount = (latestFundingFeeAmountPerSize - positionFundingFeeAmountPerSize)
                   * positionSizeInUsd / (FLOAT_PRECISION * FLOAT_PRECISION_SQRT)

// Income (if on receiving side)
claimableAmount = (latestClaimableFundingAmountPerSize - positionClaimableFundingAmountPerSize)
                  * positionSizeInUsd / (FLOAT_PRECISION * FLOAT_PRECISION_SQRT)
```

**Example** (10k LONG position, opened 1 hour ago):
```
positionSizeInUsd = 10,000 USD

// Funding fee (cost)
latestFundingFeeAmountPerSize = 675,000,000,000,000,000 (from Step 7)
positionFundingFeeAmountPerSize = 0 (just opened)

fundingFeeAmount = (675,000,000,000,000,000 - 0) * 10,000 * 10^30 / (10^30 * 10^15)
                 = 675,000,000,000,000,000 * 10,000 / 10^15
                 = 6,750,000,000,000,000,000,000 / 10^15
                 = 6,750,000,000 (in token amount, 6 decimals for mUSD)
                 = 6.75 mUSD
                 = 6.75 USD

// Claimable funding (income)
This position is LONG, so it pays, doesn't receive.
claimableAmount = 0 USD
```

**Example** (5k SHORT position, opened 1 hour ago):
```
positionSizeInUsd = 5,000 USD

// Funding fee (cost)
fundingFeeAmount = 0 (shorts don't pay when longs pay)

// Claimable funding (income)
latestClaimableFundingAmountPerSize = 1,800,000,000,000,000,000 (from Step 7)
positionClaimableFundingAmountPerSize = 0 (just opened)

claimableAmount = (1,800,000,000,000,000,000 - 0) * 5,000 * 10^30 / (10^30 * 10^15)
                = 1,800,000,000,000,000,000 * 5,000 / 10^15
                = 9,000,000,000 (6 decimals for mUSD)
                = 9.00 mUSD
                = 9.00 USD
```

**Verification**:
```
Total paid by longs (80k OI): 80,000 / 10,000 * 6.75 = 54 USD ✓
Total received by shorts (30k OI): 30,000 / 5,000 * 9.00 = 54 USD ✓
```

---

## Worked Examples with Real Numbers

### Example 1: USDTNGN Market - Borrowing Fee

**Config**:
- `optimalUsageFactor` = 75%
- `baseBorrowingFactor` = 45% APR
- `aboveOptimalUsageBorrowingFactor` = 100% APR

**Market State**:
- Pool liquidity: 200,000 USD
- Long OI: 80,000 USD (40% utilization)
- Short OI: 30,000 USD (15% utilization)

**Calculate borrowing rate for LONGS**:

Step 1: Utilization
```
reservedUsd = 80,000 USD
poolUsd = 200,000 USD
usageFactor = 80,000 / 200,000 = 0.40 (40%)
```

Step 2: Apply kink model
```
40% < 75% (below kink)
borrowingRate = 40% * 45% = 18% APR
```

Step 3: Convert to per-second
```
borrowingFactorPerSecond = 18% / 31,536,000
                         = 5.71 * 10^-9 per second
                         = 5,710,000,000,000,000,000,000 (30 decimals)
```

Step 4: Calculate fee for 10k position over 7 days
```
durationInSeconds = 7 * 86,400 = 604,800
delta = 604,800 * 5,710,000,000,000,000,000,000
      = 3,453,408,000,000,000,000,000,000,000

borrowingFeeUsd = (10,000 * 10^30 * 3,453,408,000,000,000,000,000,000,000) / 10^30
                = 34.53 USD
```

Verification:
```
Expected: 18% APR for 7 days = 18% * (7/365) = 0.345%
10,000 * 0.00345 = 34.5 USD ✓
```

### Example 2: USDTNGN Market - Funding Fee

**Config**:
- `fundingIncreaseFactorPerSecond` = 1.6 * 10^-11
- `minFundingFactorPerSecond` = 3 * 10^-7
- `maxFundingFactorPerSecond` = 1.7 * 10^-8
- `thresholdForStableFunding` = 5%

**Market State**:
- Long OI: 80,000 USD
- Short OI: 30,000 USD
- Current `savedFundingFactorPerSecond`: 1.2 * 10^-8
- Time since last update: 1 hour (3,600 seconds)

**Calculate next funding rate**:

Step 1: OI imbalance
```
diffUsd = 80,000 - 30,000 = 50,000 USD
totalOI = 110,000 USD
imbalance = 50,000 / 110,000 = 45.45%
```

Step 2: Check threshold
```
45.45% > 5% threshold
→ INCREASE funding
```

Step 3: Calculate increase
```
increaseValue = (45.45% * 1.6 * 10^-11) * 3,600
              = (0.4545 * 10^30 * 1.6 * 10^-11) * 3,600
              = 7.272 * 10^18 * 3,600
              = 2.618 * 10^22

nextSavedFundingFactorPerSecond = 1.2 * 10^-8 + 2.618 * 10^22
```

Wait, units are wrong. Let me recalculate:

```
fundingIncreaseFactorPerSecond = 1.6 * 10^-11 (stored as 16 with 13 decimals)
                               = 160,000,000,000,000,000,000 in 30-decimal format

imbalance factor = 0.4545 * 10^30

increaseValue = (0.4545 * 10^30 * 160,000,000,000,000,000,000) / 10^30 * 3,600
              = 72,720,000,000,000,000,000 * 3,600
              = 261,792,000,000,000,000,000,000

savedFundingFactorPerSecond = 12,000,000,000,000,000,000,000 (1.2 * 10^-8)
nextSavedFundingFactorPerSecond = 12,000,000,000,000,000,000,000
                                + 261,792,000,000,000,000,000,000
                                = 273,792,000,000,000,000,000,000
                                = 2.74 * 10^-7
```

Step 4: Apply bounds
```
max = 1.7 * 10^-8 = 17,000,000,000,000,000,000,000
2.74 * 10^-7 > 1.7 * 10^-8
→ Cap at max: 17,000,000,000,000,000,000,000

min = 3 * 10^-7 = 300,000,000,000,000,000,000,000
1.7 * 10^-8 < 3 * 10^-7
→ Return min: 300,000,000,000,000,000,000,000
```

Step 5: Calculate funding USD
```
fundingFactorPerSecond = 3 * 10^-7
durationInSeconds = 3,600
diffUsd = 50,000 USD

fundingUsd = (3 * 10^-7 * 3,600 * 50,000)
           = 0.000000300 * 3,600 * 50,000
           = 54 USD per hour
```

Step 6: Calculate per-position funding (10k LONG)
```
longOI = 80,000 USD
fundingFeePerSize = 54 / 80,000 = 0.000675 USD per USD of position

10k position pays: 10,000 * 0.000675 = 6.75 USD per hour
```

Annual rate check:
```
6.75 USD per hour * 8,760 hours = 59,130 USD per year
59,130 / 10,000 = 591% APR at current imbalance
```

This is why funding is so powerful - with 45% imbalance and min funding floor, it creates massive incentive to balance the market!

---

## Summary

### Borrowing Flow
```
Config (APR %) → Per-Second Rate → Cumulative Factor → Position Fee
    ↓                  ↓                  ↓                  ↓
  45-100%        5.7 * 10^-9      Accrues over time     $34.53/week
```

### Funding Flow
```
Config (increase rate) → OI Imbalance → Saved Rate → Bounded Rate → Funding USD → Position Fee
         ↓                     ↓            ↓            ↓              ↓             ↓
    1.6 * 10^-11           45.45%      2.74 * 10^-7   3 * 10^-7      $54/hour    $6.75/hour
```

**Key Differences**:
- **Borrowing**: Static kink model, predictable based on utilization
- **Funding**: Dynamic state machine, adapts to market imbalance over time
- **Borrowing**: Always a cost
- **Funding**: Can be income or cost depending on which side you're on

---

*End of Document*
