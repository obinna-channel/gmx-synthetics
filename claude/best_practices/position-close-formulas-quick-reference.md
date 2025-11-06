# Position Close Formulas - Quick Reference

## Net Payout Formula

```
Net Payout = Collateral Delta + Base PnL + Total Impact - Total Fees
```

---

## Component Extraction from Events

### From `PositionDecrease` Event

| Component | Event Location | Decimals | Type |
|-----------|---------------|----------|------|
| Collateral Delta | `uintItems[14]` | 6 (tokens) | uint256 |
| Base PnL | `intItems[1]` | 30 (USD) | int256 |
| Price Impact | `intItems[0]` | 30 (USD) | int256 |
| Pending Impact | `intItems[3]` | 30 (USD) | int256 |
| **Total Impact** | `intItems[4]` | 30 (USD) | int256 |

### From `PositionFeesCollected` Event

| Component | Event Key | Decimals | Type |
|-----------|-----------|----------|------|
| Position Fee | `positionFeeAmount` | 6 (tokens) | uint256 |
| Borrowing Fee | `borrowingFeeAmount` | 6 (tokens) | uint256 |
| **Funding Fee** | `fundingFeeAmount` | **6 (tokens)** ⚠️ | uint256 |
| UI Fee | `uiFeeAmount` | 6 (tokens) | uint256 |
| Liquidation Fee | `liquidationFeeAmount` | 6 (tokens) | uint256 |
| **Total Fees** | `totalCostAmount` | 6 (tokens) | uint256 |
| Claimable Long | `claimableLongTokenAmount` | 6 (tokens) | uint256 |
| Claimable Short | `claimableShortTokenAmount` | 6 (tokens) | uint256 |

⚠️ **Critical:** `fundingFeeAmount` is in token units (6 decimals), NOT USD (30 decimals)!

---

## Detailed Formulas

### 1. Total Impact

```
totalImpactUsd = priceImpactUsd + proportionalPendingImpactUsd
```

#### Price Impact Formula

```solidity
// Calculate pool imbalance
initialDiffUsd = |longOpenInterest - shortOpenInterest|
nextDiffUsd = |nextLongOpenInterest - nextShortOpenInterest|

// Apply impact factor
impactValue = (diffUsd ^ impactExponent) * impactFactor

// Calculate impact
priceImpactUsd = applyImpactFactor(initialDiffUsd) - applyImpactFactor(nextDiffUsd)
```

- **Positive:** Trade balances pool → rebate
- **Negative:** Trade imbalances pool → charge

#### Pending Impact Formula

```solidity
// Step 1: Proportional to close size
proportionalAmount = (positionPendingImpactAmount * sizeDeltaUsd) / sizeInUsd

// Step 2: Convert to USD (conservative pricing)
if (proportionalAmount > 0) {
    proportionalPendingImpactUsd = proportionalAmount * indexTokenPrice.min
} else {
    proportionalPendingImpactUsd = proportionalAmount * indexTokenPrice.max
}
```

### 2. Total Fees

```
totalCostAmount = positionFeeAmount
                + borrowingFeeAmount
                + fundingFeeAmount
                + uiFeeAmount
                + liquidationFeeAmount
                - totalDiscountAmount
```

#### Position Fee Formula

```solidity
// Get fee factor
positionFeeFactor = dataStore.getUint(Keys.positionFeeFactorKey(market, balanceWasImproved))

// Calculate fee
positionFeeUsd = sizeDeltaUsd * positionFeeFactor
positionFeeAmount = positionFeeUsd / collateralTokenPrice.min
```

#### Borrowing Fee Formula

```solidity
borrowingFeeUsd = positionSizeInUsd * cumulativeBorrowingFactor
borrowingFeeAmount = borrowingFeeUsd / collateralTokenPrice.min
```

#### Funding Fee Formula

```solidity
fundingFeeUsd = positionSizeInUsd * (latestFundingFeeAmountPerSize - position.fundingFeeAmountPerSize)
fundingFeeAmount = fundingFeeUsd / collateralTokenPrice.min
```

---

## Code Examples

### Extract PositionDecrease Data

```javascript
const parsed = eventEmitter.interface.parseLog(log);
const eventData = parsed.args[4]; // EventLogData

const positionDecreaseData = {
    collateralDeltaAmount: eventData.uintItems.items[14].value,
    basePnlUsd: eventData.intItems.items[1].value,
    priceImpactUsd: eventData.intItems.items[0].value,
    proportionalPendingImpactUsd: eventData.intItems.items[3].value,
    totalImpactUsd: eventData.intItems.items[4].value,
};
```

### Extract PositionFeesCollected Data (Key-Based)

```javascript
function getValueFromItems(items, key) {
    if (!items || !items.items) return null;
    for (const item of items.items) {
        if (item.key === key) return item.value;
    }
    return null;
}

const positionFeesData = {
    positionFeeAmount: getValueFromItems(eventData.uintItems, 'positionFeeAmount'),
    borrowingFeeAmount: getValueFromItems(eventData.uintItems, 'borrowingFeeAmount'),
    fundingFeeAmount: getValueFromItems(eventData.uintItems, 'fundingFeeAmount'), // 6 decimals!
    uiFeeAmount: getValueFromItems(eventData.uintItems, 'uiFeeAmount'),
    liquidationFeeAmount: getValueFromItems(eventData.uintItems, 'liquidationFeeAmount'),
    totalCostAmount: getValueFromItems(eventData.uintItems, 'totalCostAmount'),
    claimableLongTokenAmount: getValueFromItems(eventData.uintItems, 'claimableLongTokenAmount'),
    claimableShortTokenAmount: getValueFromItems(eventData.uintItems, 'claimableShortTokenAmount'),
};
```

### Calculate Net Payout

```javascript
// Format values
const collateralDelta = parseFloat(ethers.utils.formatUnits(positionDecreaseData.collateralDeltaAmount, 6));
const basePnl = parseFloat(ethers.utils.formatUnits(positionDecreaseData.basePnlUsd, 30));
const totalImpact = parseFloat(ethers.utils.formatUnits(positionDecreaseData.totalImpactUsd, 30));

// IMPORTANT: fundingFeeAmount uses 6 decimals, not 30!
const positionFee = parseFloat(ethers.utils.formatUnits(positionFeesData.positionFeeAmount, 6));
const borrowingFee = parseFloat(ethers.utils.formatUnits(positionFeesData.borrowingFeeAmount, 6));
const fundingFee = parseFloat(ethers.utils.formatUnits(positionFeesData.fundingFeeAmount, 6)); // 6 decimals!
const totalFees = parseFloat(ethers.utils.formatUnits(positionFeesData.totalCostAmount, 6));

// Calculate net payout (WITHOUT claimable funding)
const netPayout = collateralDelta + basePnl + totalImpact - totalFees;
```

---

## Query Event Filters

### Query PositionDecrease Events for Account

```javascript
const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
const positionDecreaseHash = ethers.utils.id("PositionDecrease");
const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

const filter = {
    address: EVENT_EMITTER,
    fromBlock: fromBlock,
    toBlock: toBlock,
    topics: [
        EVENT_LOG1_SIG,           // topic0: EventLog1 signature
        positionDecreaseHash,      // topic1: "PositionDecrease"
        accountBytes32             // topic2: account address
    ]
};

const logs = await ethers.provider.getLogs(filter);
```

### Query PositionFeesCollected Events (All, match by orderKey)

```javascript
const positionFeesHash = ethers.utils.id("PositionFeesCollected");

const filter = {
    address: EVENT_EMITTER,
    fromBlock: fromBlock,
    toBlock: toBlock,
    topics: [
        EVENT_LOG1_SIG,           // topic0: EventLog1 signature
        positionFeesHash          // topic1: "PositionFeesCollected"
        // NO topic2 filter - get all and match by orderKey
    ]
};

const feeLogs = await ethers.provider.getLogs(filter);
```

---

## Example Calculation

**Position 3 - mCOP LONG Close**

| Component | Value | Sign |
|-----------|-------|------|
| Collateral Delta | 993.79 mUSD | + |
| Base PnL | 185.86 USD | + |
| Price Impact | 23.98 USD | - |
| Pending Impact | 14.23 USD | - |
| **Total Impact** | **38.21 USD** | **-** |
| Position Fee | 6.21 mUSD | - |
| Borrowing Fee | 1.98 mUSD | - |
| Funding Fee | 18.57 mUSD | - |
| UI Fee | 0.00 mUSD | - |
| Liquidation Fee | 0.00 mUSD | - |
| **Total Fees** | **26.76 mUSD** | **-** |
| **Net Payout** | **1114.68 mUSD** | **+** |
| Claimable Funding (separate) | 4.02 Long | (not in payout) |

**Calculation:**
```
Net Payout = 993.79 + 185.86 + (-38.21) - 26.76
           = 1114.68 mUSD ✅
```

**Actual Transfer:** 1114.676069 mUSD ✅

---

## Contract Locations

| Formula | File | Function |
|---------|------|----------|
| Price Impact | `contracts/pricing/PositionPricingUtils.sol` | `getPriceImpactUsd` (line 159) |
| Pending Impact | `contracts/position/DecreasePositionCollateralUtils.sol` | `_getProportionalPendingImpactValues` (line 739) |
| Position Fee | `contracts/pricing/PositionPricingUtils.sol` | `getPositionFeesAfterReferral` (line 504) |
| Total Impact | `contracts/position/DecreasePositionCollateralUtils.sol` | Line 143 |
| Total Fees | `contracts/pricing/PositionPricingUtils.sol` | Lines 398-400 |

---

## Critical Constants

```javascript
// EventEmitter address (Arbitrum Sepolia)
const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

// EventLog1 signature (hardcoded - always use this)
const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

// Decimal places
const USD_DECIMALS = 30;
const TOKEN_DECIMALS = 6; // for mUSD and most collateral tokens
```

---

## Common Mistakes Checklist

- [ ] Using `priceImpactUsd` instead of `totalImpactUsd`
- [ ] Formatting `fundingFeeAmount` as 30 decimals instead of 6
- [ ] Including claimable funding in net payout calculation
- [ ] Accessing `parsed.args.eventName` instead of `parsed.args[1]`
- [ ] Using wrong EventEmitter address
- [ ] Filtering PositionFeesCollected by account in topics
- [ ] Not using hardcoded EventLog1 signature
