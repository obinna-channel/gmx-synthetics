# Index Token Configuration Issue - Market #7

## Executive Summary

Market #7 (mUSD/mUSD/mNGN) has a fundamental configuration issue where GMX interprets the oracle price as USD rather than NGN, causing positions to be sized incorrectly and P&L calculations to be off by a factor of 1500.

## The Problem

### Current Configuration
- **Market #7:** mUSD/mUSD/mNGN
- **Index Token:** mUSD
- **Long Token:** mUSD (collateral for longs)
- **Short Token:** mNGN (collateral for shorts)
- **Oracle Price:** 1500 (intended as 1500 NGN per mUSD)

### The Issue

GMX interprets all prices in USD terms internally. When we set the mUSD price to 1500, GMX interprets this as **$1500 USD per mUSD** instead of **1500 NGN per mUSD**.

This causes several problems:

1. **Incorrect Position Sizing:**
   - For a $100 position, SIZE_IN_TOKENS = $100 / $1500 = 0.0667 mUSD
   - Should be: $100 = 150,000 NGN / 1500 NGN per mUSD = 100 mUSD
   - **Off by a factor of 1500!**

2. **Minimal P&L on Price Changes:**
   - When price moves from 1500 to 1600, the percentage change is minimal in USD terms
   - User gets $0.004 profit instead of expected $6.67
   - The system thinks mUSD went from $1500 to $1600 (6.67% move) but position only controls 0.0667 tokens

3. **Pool Value Confusion:**
   - Pool shows as $300M USD when it's actually 300M NGN (~$200k USD)
   - All USD calculations are inflated by 1500x

## Root Cause Analysis

### How SIZE_IN_TOKENS is Calculated

```
SIZE_IN_TOKENS = SIZE_IN_USD / Price_of_Index_Token
```

When the index token (mUSD) is priced at "1500":
- GMX interprets: 1 mUSD = $1500 USD
- Reality: 1 mUSD = 1500 NGN = $1 USD

This 1500x discrepancy cascades through all calculations.

### Evidence from Testing

1. **Position Data:**
   - $100 position showed SIZE_IN_TOKENS = 0.0667 mUSD (not 100 mUSD)
   - $420 position showed SIZE_IN_TOKENS = 0.28 mUSD (not 420 mUSD)

2. **P&L Results:**
   - Price change from 1500 to 1600: Expected profit $6.67
   - Actual profit: $0.004088
   - This suggests execution price was ~1500.06, not 1600

## Proposed Solution

### Option 1: Invert the Market Design

Configure the market with mNGN as the index token:

```javascript
{
  indexToken: "mNGN",    // Trade NGN price movements
  longToken: "mUSD",     // USD collateral for longs
  shortToken: "mNGN",    // NGN collateral for shorts
}
```

**Oracle Prices:**
- mNGN = 1 (GMX thinks $1, represents 1 NGN)
- mUSD = 1500 (GMX thinks $1500, represents 1500 NGN)

**Benefits:**
- $100 position = 100 mNGN tokens (correct!)
- Price movements work as expected
- Maintains 1:1500 FX rate relationship

### Option 2: Adjust Price Interpretation

Keep mUSD as index but set price to represent USD value:
- mUSD price = 1 (not 1500)
- This breaks the FX market concept

### Option 3: Custom Oracle Implementation

Build a wrapper that translates NGN prices to USD decimals:
- Input: 1500 NGN/mUSD
- Output to GMX: 1.0 USD/mUSD
- More complex but maintains semantic clarity

## Implications

### Current Market Positions

All existing positions in Market #7 are affected:
- Positions are 1500x smaller than intended
- P&L calculations are essentially broken
- Liquidation thresholds may be incorrect

### Going Forward

The new market configuration (Option 1) should:
1. Use mNGN as index token
2. Set appropriate oracle prices
3. Test thoroughly before live trading
4. Consider migration path for existing positions

## Verification Steps

To confirm the issue:

1. **Check position sizes:** SIZE_IN_TOKENS should equal the USD value in token units
2. **Test P&L:** A 6.67% price move should yield 6.67% profit (minus fees)
3. **Verify pool values:** Ensure they make sense in USD terms

## Conclusion

The core issue is a mismatch between the intended FX market design (NGN-denominated) and GMX's USD-centric price interpretation. The solution requires reconfiguring the market to align token roles with price semantics, making mNGN the index token so that "price = 1" makes sense to GMX while maintaining the FX rate relationship through the collateral token pricing.