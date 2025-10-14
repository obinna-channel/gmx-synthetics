# Position Size Display Discrepancy

**Date**: 2025-10-06
**Status**: 🔍 Investigation Required
**Severity**: Medium - Display accuracy issue

## Issue Description

Position sizes are being displayed incorrectly in the frontend, with discrepancies between:
1. OrderForm pre-calculation
2. On-chain actual values
3. Positions table display

## Observed Behavior

### Test Case: $1000 collateral at 10x leverage

| Location | Displayed Value | Expected Value | Discrepancy |
|----------|----------------|----------------|-------------|
| **On-chain (actual)** | $10,000.00 | $10,000.00 | ✅ Correct |
| **OrderForm (pre-creation)** | $9,975.00 | $10,000.00 | ❌ -$25.00 |
| **Positions Table (post-creation)** | $10,004.93 | $10,000.00 | ❌ +$4.93 |

### On-Chain Verification

```bash
npx hardhat run scripts/read-positions-via-reader.js --network arbitrumSepolia
```

**Results**:
```
Size in USD: $10000.0
Collateral: 997.5 mUSD
Leverage: ~10.02x
```

**Position with $99.5 collateral at 10x**:
```
Size in USD: $1000.0
Collateral: 99.5 mUSD
Leverage: ~10.05x
```

## Root Cause Analysis

### 1. OrderForm Calculation Error

**Location**: `client/src/utils/tradingCalculations.js:48`

**Current (Incorrect) Logic**:
```javascript
// calculatePositionMetrics()
const positionSizeUsd = collateral * leverage;              // $1000 × 10 = $10,000
const openingFeeUsd = positionSizeUsd * openingFeePercent; // $10,000 × 0.025% = $2.50
const netCollateralUsd = collateral - openingFeeUsd;       // $1000 - $2.50 = $997.50
const effectivePositionSize = netCollateralUsd * leverage; // $997.50 × 10 = $9,975 ❌
```

**Problem**: Frontend reduces position size by fees, but GMX protocol does NOT reduce position size - it only reduces collateral.

**How GMX Actually Works**:
```javascript
Initial deposit: $1000
Fee (0.025%): $1000 × 10 × 0.025% = $2.50
Collateral after fee: $997.50 ✓
Position size: $10,000.00 ✓ (NOT reduced)
Actual leverage: $10,000 / $997.50 = 10.025x
```

### 2. Positions Table Mysterious +$4.93

**Location**: Unknown - requires investigation

**Observations**:
- On-chain shows exactly $10,000.00
- Frontend positions table shows $10,004.93
- Difference: +$4.93 (0.0493%)

**Potential causes to investigate**:
- [ ] Price impact being added to size display
- [ ] Funding/borrowing fees being added
- [ ] Entry price calculation error in `usePositionReader.js`
- [ ] Data transformation error in position mapping
- [ ] PnL being incorrectly added to size

## Files Involved

### Frontend
- `client/src/utils/tradingCalculations.js` - Position size calculation (WRONG)
- `client/src/components/trading/OrderForm.js` - Pre-creation display
- `client/src/hooks/usePositionReader.js` - Reads positions from blockchain
- `client/src/hooks/usePositionReader.js:273` - Maps `position_size: sizeInUsd`
- Unknown positions table component - Displays $10,004.93

### Contracts (Reference)
- Reader contract correctly returns `sizeInUsd = 10000000000000000000000000000000000` (10,000 in 30 decimals)

## Expected Behavior

**OrderForm should display**:
```
Collateral: $1000
Leverage: 10x
Position Size: $10,000.00 (full size before fees)
Opening Fee: $2.50 (0.025%)
Net Collateral: $997.50
Actual Leverage: 10.025x
```

**Positions table should display**:
```
Position Size: $10,000.00 (exactly as on-chain)
```

## Reproduction Steps

1. Open trading page
2. Set collateral to $1000
3. Set leverage to 10x
4. **Before creation**: OrderForm shows "Estimated Size: $9,975" ❌
5. Create position
6. **After creation**: Positions table shows "Position Size: $10,004.93" ❌
7. **Verify on-chain**: Run reader script → Shows exactly $10,000.00 ✓

## Fix Required

### 1. Fix OrderForm Calculation

Update `calculatePositionMetrics()` to NOT reduce position size by fees:

```javascript
const positionSizeUsd = collateral * leverage;              // Full requested size
const openingFeeUsd = positionSizeUsd * openingFeePercent; // Fee on full size
const netCollateralUsd = collateral - openingFeeUsd;       // Collateral reduced by fee
const effectivePositionSize = positionSizeUsd;             // ✓ Size stays the same!
const actualLeverage = positionSizeUsd / netCollateralUsd; // Calculate actual leverage
```

### 2. Investigate Positions Table

**Action items**:
1. Identify which component renders the positions table
2. Add logging to see what `position_size` value is received
3. Trace data flow from `usePositionReader.js` → table component
4. Find where +$4.93 is being added
5. Fix the calculation/transformation

## Impact

**User Experience**:
- ⚠️ Users see incorrect position sizes before creating positions (off by ~0.25%)
- ⚠️ Users see incorrect position sizes after creating positions (off by ~0.05%)
- ✅ On-chain positions are correct (GMX contracts working properly)
- 📊 Display-only issue, no financial impact on actual positions

**Trust**:
- May confuse users about actual position sizes
- Discrepancies between OrderForm and Positions table erode confidence

## Next Steps

1. [ ] Fix `calculatePositionMetrics()` to not reduce position size by fees
2. [ ] Update OrderForm to display actual leverage after fees
3. [ ] Identify positions table component
4. [ ] Find source of +$4.93 discrepancy in positions table
5. [ ] Add unit tests for position size calculations
6. [ ] Verify fix matches on-chain values exactly

## Related Files

- `/client/src/utils/tradingCalculations.js:24-70` - Position metrics calculation
- `/client/src/components/trading/OrderForm.js:171` - Uses `metrics.effectivePositionSize`
- `/client/src/hooks/usePositionReader.js:203` - Reads `sizeInUsd` from blockchain
- `/client/src/hooks/usePositionReader.js:273` - Maps to `position_size` field
- `/scripts/read-positions-via-reader.js` - On-chain verification script

## Notes

- Market fees: 0.025% (configured in market config)
- GMX protocol behavior: Fees reduce collateral, NOT position size
- This matches standard perpetuals exchange behavior (e.g., dYdX, Binance Futures)
