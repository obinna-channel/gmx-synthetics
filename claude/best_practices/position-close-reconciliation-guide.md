# GMX V2 Position Close Reconciliation Guide

## Table of Contents
1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Understanding the Components](#understanding-the-components)
5. [How to Use the Scripts](#how-to-use-the-scripts)
6. [Complete Payout Formula](#complete-payout-formula)
7. [Common Pitfalls](#common-pitfalls)

---

## Overview

This guide documents how to reconcile position close payouts in GMX V2 Synthetics. When a user closes a position, the actual amount transferred to their account must equal:

```
Net Payout = Collateral Delta + Base PnL + Total Impact - Total Fees
```

Understanding each component and how to extract them from events is critical for accurate reconciliation.

---

## The Problem

When users close positions in GMX V2, there can be discrepancies between:
- **Expected payout** (from UI or off-chain calculations)
- **Actual payout** (the mUSD transferred to user's wallet)

These discrepancies arise from incomplete understanding of:
1. What `totalImpactUsd` actually includes
2. What `totalCostAmount` actually includes
3. The correct decimal formats for each value
4. Which values are in USD (30 decimals) vs tokens (6 decimals)

---

## The Solution

### Script: `find-position-closes-correct.js`

This script queries the EventEmitter contract to extract all PositionDecrease and PositionFeesCollected events, then calculates the complete breakdown.

**Key Features:**
- Queries historical events using correct topic filters
- Extracts ALL components of Total Impact and Total Fees
- Verifies calculations match actual transfers
- Shows detailed breakdowns for debugging

**Location:** `claude/scripts/find-position-closes-correct.js`

### Usage

```bash
npx hardhat run claude/scripts/find-position-closes-correct.js --network arbitrumSepolia
```

---

## Understanding the Components

### 1. Collateral Delta
**What it is:** The collateral amount released from the position.

**Source:** `PositionDecrease` event → `uintItems[14]` (collateralDeltaAmount)

**Format:** Token units (6 decimals for mUSD)

**Sign:** Always positive (+)

**Example:** +993.79 mUSD

---

### 2. Base PnL
**What it is:** The profit or loss from the position based on entry price vs exit price.

**Source:** `PositionDecrease` event → `intItems[1]` (basePnlUsd)

**Format:** USD (30 decimals)

**Sign:** Can be positive or negative

**Formula:**
```solidity
// For LONG positions
basePnlUsd = (exitPrice - entryPrice) * sizeInTokens

// For SHORT positions
basePnlUsd = (entryPrice - exitPrice) * sizeInTokens
```

**Example:** +185.86 USD (profit on a long position)

---

### 3. Total Impact

**What it is:** The combined market impact from price impact and pending impact.

**Components:**
1. **Price Impact** (`priceImpactUsd`)
2. **Pending Impact** (`proportionalPendingImpactUsd`)

#### 3a. Price Impact

**Purpose:** Incentivizes balanced pools and prevents price manipulation.

**Source:** `PositionDecrease` event → `intItems[0]` (priceImpactUsd)

**Format:** USD (30 decimals)

**Sign:** Can be positive (rebate) or negative (charge)

**How it's calculated:**
```solidity
// Step 1: Calculate pool imbalance before and after trade
initialDiffUsd = |longOpenInterest - shortOpenInterest|
nextDiffUsd = |nextLongOpenInterest - nextShortOpenInterest|

// Step 2: Apply impact factor with exponent
function applyImpactFactor(diffUsd, impactFactor, impactExponent) {
    exponentValue = diffUsd ^ impactExponent
    return exponentValue * impactFactor
}

// Step 3: Calculate impact
priceImpactUsd = applyImpactFactor(initialDiffUsd) - applyImpactFactor(nextDiffUsd)
```

**When positive:** Trade helps balance the pool → you get rebated
**When negative:** Trade imbalances the pool → you pay

**Example:** -23.98 USD (trade imbalanced the pool)

**Code location:** `contracts/pricing/PositionPricingUtils.sol:159` (getPriceImpactUsd)

#### 3b. Pending Impact

**Purpose:** Distributes pending impact from previous position actions proportionally when closing.

**Source:** `PositionDecrease` event → `intItems[3]` (proportionalPendingImpactUsd)

**Format:** USD (30 decimals)

**Sign:** Can be positive or negative

**How it's calculated:**
```solidity
// Step 1: Calculate proportional amount based on close size
proportionalPendingImpactAmount = (positionPendingImpactAmount * sizeDeltaUsd) / sizeInUsd

// Step 2: Convert to USD (conservative pricing)
if (proportionalPendingImpactAmount > 0) {
    // Minimize positive impact (use lower price)
    proportionalPendingImpactUsd = proportionalPendingImpactAmount * indexTokenPrice.min
} else {
    // Maximize negative impact (use higher price)
    proportionalPendingImpactUsd = proportionalPendingImpactAmount * indexTokenPrice.max
}
```

**Example:** -14.23 USD (deferred negative impact from previous actions)

**Code location:** `contracts/position/DecreasePositionCollateralUtils.sol:739`

#### Total Impact Formula

```solidity
totalImpactUsd = priceImpactUsd + proportionalPendingImpactUsd
```

**Source:** `PositionDecrease` event → `intItems[4]` (totalImpactUsd)

**Example:** -23.98 + (-14.23) = **-38.21 USD**

---

### 4. Total Fees

**What it is:** All fees charged for closing the position.

**Components:**
1. **Position Fee**
2. **Borrowing Fee**
3. **Funding Fee**
4. **UI Fee**
5. **Liquidation Fee**
6. **Minus: Total Discount**

#### 4a. Position Fee

**Purpose:** Fee for opening/closing a position (protocol revenue).

**Source:** `PositionFeesCollected` event → uintItems with key `positionFeeAmount`

**Format:** Token units (6 decimals for mUSD)

**How it's calculated:**
```solidity
// Step 1: Get fee factor (varies by whether balance improved)
positionFeeFactor = dataStore.getUint(Keys.positionFeeFactorKey(market, balanceWasImproved))

// Step 2: Apply to trade size and convert to tokens
positionFeeUsd = sizeDeltaUsd * positionFeeFactor
positionFeeAmount = positionFeeUsd / collateralTokenPrice.min
```

**Example:** 6.21 mUSD (for closing $24,843.75 position)

**Code location:** `contracts/pricing/PositionPricingUtils.sol:504`

#### 4b. Borrowing Fee

**Purpose:** Interest on borrowed funds (like margin interest).

**Source:** `PositionFeesCollected` event → uintItems with key `borrowingFeeAmount`

**Format:** Token units (6 decimals for mUSD)

**How it's calculated:**
```solidity
borrowingFeeUsd = positionSizeInUsd * cumulativeBorrowingFactor
borrowingFeeAmount = borrowingFeeUsd / collateralTokenPrice.min
```

**Example:** 1.98 mUSD

#### 4c. Funding Fee

**Purpose:** Funding rate payment between longs and shorts.

**Source:** `PositionFeesCollected` event → uintItems with key `fundingFeeAmount`

**Format:** ⚠️ **IMPORTANT: Token units (6 decimals), NOT USD (30 decimals)!**

**Common mistake:** Formatting as 30 decimals makes it appear as ~0.00 instead of actual amount.

**How it's calculated:**
```solidity
fundingFeeAmount = positionSizeInUsd * (latestFundingFeeAmountPerSize - position.fundingFeeAmountPerSize) / collateralTokenPrice.min
```

**Example:** 18.57 mUSD (this was the "missing" component in our investigation!)

#### 4d. UI Fee

**Purpose:** Fee for the frontend interface (if configured).

**Source:** `PositionFeesCollected` event → uintItems with key `uiFeeAmount`

**Format:** Token units (6 decimals)

**Example:** 0.00 mUSD (not configured in our markets)

#### 4e. Liquidation Fee

**Purpose:** Penalty for liquidated positions.

**Source:** `PositionFeesCollected` event → uintItems with key `liquidationFeeAmount`

**Format:** Token units (6 decimals)

**Example:** 0.00 mUSD (position was not liquidated)

#### Total Fees Formula

```solidity
totalCostAmount = positionFeeAmount
                + borrowingFeeAmount
                + fundingFeeAmount
                + uiFeeAmount
                + liquidationFeeAmount
                - totalDiscountAmount
```

**Source:** `PositionFeesCollected` event → uintItems with key `totalCostAmount`

**Format:** Token units (6 decimals for mUSD)

**Example:** 6.21 + 1.98 + 18.57 + 0 + 0 - 0 = **26.76 mUSD**

**Code location:** `contracts/pricing/PositionPricingUtils.sol:398`

---

### 5. Claimable Funding

**What it is:** Funding fees that are POSITIVE for the user (claimable separately).

**Source:** `PositionFeesCollected` event → uintItems with keys:
- `claimableLongTokenAmount`
- `claimableShortTokenAmount`

**Format:** Token units (6 decimals)

**Important:** Claimable funding is **NOT included in net payout** because it's claimed in a separate transaction.

**Example:** +4.02 Long (can be claimed separately)

---

## Complete Payout Formula

```
Net Payout = Collateral Delta
           + Base PnL
           + Total Impact
           - Total Fees
```

**Expanded:**
```
Net Payout = collateralDeltaAmount
           + basePnlUsd
           + (priceImpactUsd + proportionalPendingImpactUsd)
           - (positionFee + borrowingFee + fundingFee + uiFee + liquidationFee - discounts)
```

**Example (Position 3 - mCOP LONG):**
```
Net Payout = 993.79 mUSD          (Collateral)
           + 185.86 USD           (Base PnL - profit!)
           + (-23.98 USD)         (Price Impact - negative)
           + (-14.23 USD)         (Pending Impact - negative)
           - 26.76 mUSD           (Total Fees)

         = 993.79 + 185.86 - 23.98 - 14.23 - 26.76
         = 1114.68 mUSD ✅
```

**Actual transfer:** 1114.676069 mUSD ✅ (matches within rounding!)

---

## How to Use the Scripts

### 1. Find Position Closes

**Script:** `claude/scripts/find-position-closes-correct.js`

**What it does:**
- Queries EventEmitter for PositionDecrease events filtered by account
- Queries PositionFeesCollected events and matches by orderKey
- Displays summary table + detailed breakdown for each position

**Output:**
1. **Summary Table:** High-level view of all positions
2. **Detailed Breakdown:** Complete component breakdown for each position
3. **Verification:** Checks that formulas match event data

**Example output:**
```
| Pos    | Market   | Side  | Collateral | Base PnL | Total Impact | Total Fees | Net Payout | Claimable  |
|--------|----------|-------|------------|----------|--------------|------------|------------|------------|
| Pos 3  | mCOP     | LONG  |   +993.79  |  +185.86 |      -38.21  |    -26.76  |  +1114.68  | +4.02 Long |

DETAILED BREAKDOWN:

TOTAL IMPACT BREAKDOWN (-38.21 USD):
  Price Impact:            -23.978101 USD
  Pending Impact:          -14.231678 USD
  ────────────────────────────────────────
  = Total Impact:          -38.209778 USD

TOTAL FEES BREAKDOWN (26.76 mUSD):
  Position Fee:            +6.210937 mUSD
  Borrowing Fee:           +1.981207 mUSD
  Funding Fee:             +18.567318 mUSD
  UI Fee:                  +0.000000 mUSD
  Liquidation Fee:         +0.000000 mUSD
  ────────────────────────────────────────
  = Total Fees:            26.759462 mUSD
  Verification: 26.759462 ✅
```

### 2. Deep Dive Reconciliation

**Script:** `claude/scripts/reconcile-from-events.js`

**What it does:**
- Analyzes a specific transaction hash
- Extracts ALL events (PositionDecrease, PositionFeesCollected, Transfer)
- Compares expected vs actual payout
- Identifies discrepancies

**Usage:**
```javascript
// Edit the TX_HASH at the top of the file
const TX_HASH = "0x1420d06b...";

// Run
npx hardhat run claude/scripts/reconcile-from-events.js --network arbitrumSepolia
```

### 3. Complete Breakdown

**Script:** `claude/scripts/breakdown-position-close.js`

**What it does:**
- Shows the complete mathematical breakdown
- Verifies each formula
- Helps understand where each component comes from

---

## Common Pitfalls

### 1. ❌ Using `priceImpactUsd` instead of `totalImpactUsd`

**Wrong:**
```javascript
const netPayout = collateral + pnl + priceImpact - fees
```

**Correct:**
```javascript
const netPayout = collateral + pnl + totalImpact - fees
```

**Why:** `totalImpactUsd` includes BOTH price impact AND pending impact. Using only `priceImpactUsd` will result in missing the pending impact component.

### 2. ❌ Formatting `fundingFeeAmount` as 30 decimals

**Wrong:**
```javascript
const fundingFee = ethers.utils.formatUnits(fees.fundingFeeAmount, 30); // Shows ~0.000000
```

**Correct:**
```javascript
const fundingFee = ethers.utils.formatUnits(fees.fundingFeeAmount, 6); // Shows actual value
```

**Why:** Despite being called "fundingFeeAmount", it's stored in token units (6 decimals), not USD (30 decimals). This was the source of the "missing 18.57 mUSD" in our investigation.

### 3. ❌ Including claimable funding in net payout

**Wrong:**
```javascript
const netPayout = collateral + pnl + totalImpact - fees + claimableFunding
```

**Correct:**
```javascript
const netPayout = collateral + pnl + totalImpact - fees
// claimableFunding is claimed separately!
```

**Why:** Claimable funding is claimed in a separate transaction and should NOT be added to the position close payout.

### 4. ❌ Using wrong EventEmitter address

**Wrong:**
```javascript
const EVENT_EMITTER = "0xa973c2692C1556E1a3d478e745e9a75624AEDc73"; // Old/wrong address
```

**Correct:**
```javascript
const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"; // Check deployment docs!
```

**Why:** Using the wrong contract address will return 0 events. Always verify against `claude/deployments/marks-arbitrumSepolia-deployments.md`.

### 5. ❌ Accessing parsed event args by name instead of index

**Wrong:**
```javascript
const eventName = parsed.args.eventName; // Returns undefined
```

**Correct:**
```javascript
const eventName = parsed.args[1]; // Works!
```

**Why:** ethers.js doesn't provide named access for complex nested struct parameters in EventLog1. Must use numeric indices:
- `args[0]` = msgSender
- `args[1]` = eventName
- `args[4]` = eventData

### 6. ❌ Not using hardcoded EventLog1 signature

**Wrong:**
```javascript
const sig = ethers.utils.id("EventLog1(...)"); // Doesn't work
```

**Correct:**
```javascript
const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
```

**Why:** The full EventLog1 signature is extremely complex. Use the hardcoded topic0 value that's been verified to work.

### 7. ❌ Filtering PositionFeesCollected by account in topics

**Wrong:**
```javascript
const filter = {
    topics: [EVENT_LOG1_SIG, feesHash, accountBytes32] // Won't find fees!
};
```

**Correct:**
```javascript
const filter = {
    topics: [EVENT_LOG1_SIG, feesHash] // Get all, match by orderKey in code
};
```

**Why:** PositionFeesCollected events don't have account in topic2. You must query all fee events and match by orderKey.

---

## Key Learnings

1. **Always use `totalImpactUsd`**, not just `priceImpactUsd`
2. **`fundingFeeAmount` is in token units (6 decimals)**, not USD (30 decimals)
3. **Claimable funding is separate** from net payout
4. **Event args must be accessed by numeric index**, not by name
5. **Use hardcoded EventLog1 signature** (`0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160`)
6. **Match PositionFeesCollected by orderKey**, not by filtering topics

---

## Summary

The complete payout reconciliation formula is:

```
Net Payout = Collateral Delta + Base PnL + Total Impact - Total Fees

Where:
  Total Impact = Price Impact + Pending Impact
  Total Fees = Position Fee + Borrowing Fee + Funding Fee + UI Fee + Liquidation Fee - Discounts
```

All components can be extracted from `PositionDecrease` and `PositionFeesCollected` events when queried correctly. The scripts in `claude/scripts/` demonstrate the correct approach and verify calculations match actual transfers.

**Most common reconciliation issue:** Not including `proportionalPendingImpactUsd` in the calculation, or formatting `fundingFeeAmount` with wrong decimals.
