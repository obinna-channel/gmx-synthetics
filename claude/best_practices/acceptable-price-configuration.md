# acceptablePrice Configuration for GMX Synthetics Orders

## Working Configuration (Discovered Through Trial and Error)

After extensive testing and debugging of order execution failures, we discovered the following acceptablePrice configuration that works for our USDT/sNGN market on Arbitrum Sepolia testnet.

**Important Note**: This configuration was arrived at through trial and error. We do not fully understand why this specific combination works while others fail. The behavior appears inconsistent with documentation and our understanding of the validation logic.

### Current Working Settings (Fully Tested)

```javascript
// Oracle price: 1/1500 USDT per NGN (0.000666666666666667 in 30 decimals)

// Long Positions ✅ All Tested and Working
Long Open:           acceptablePrice = 1/1500 (exact oracle price)
Long Increase:       acceptablePrice = 1/1500 (exact oracle price)
Long Decrease:       acceptablePrice = 0
Long Close:          acceptablePrice = 0

// Short Positions ✅ All Tested and Working
Short Open:          acceptablePrice = 0
Short Increase:      acceptablePrice = 0
Short Decrease:      acceptablePrice = 1/1500 (exact oracle price)
Short Close:         acceptablePrice = 1/1500 (exact oracle price)
```

### The Pattern

A clear pattern emerged from testing:
- **For LONG positions**: Increases need exact price (1/1500), decreases work with 0
- **For SHORT positions**: Increases work with 0, decreases need exact price (1/1500)

This is completely opposite behavior between longs and shorts!

## What We Expected vs What Actually Works

### Expected Behavior (Based on Contract Logic)
The validation checks in BaseOrderUtils.sol suggest:
- For increases: `executionPrice <= acceptablePrice` (longs) or `executionPrice >= acceptablePrice` (shorts)
- For decreases: `executionPrice >= acceptablePrice` (longs) or `executionPrice <= acceptablePrice` (shorts)
- acceptablePrice = 0 should fail validation for any positive price

### Actual Behavior Observed
- **acceptablePrice = 0 works inconsistently**: Some operations accept it, others fail
- **Long opens require exact price**: Must be set to current oracle price
- **Short closes require exact price**: Must be set to current oracle price
- **Long decreases work with 0**: Despite expectations, validation passes
- **Short opens work with 0**: Despite expectations, validation passes

## Failed Configurations We Tried

1. **All operations with acceptablePrice = 0**: Failed for long opens and short closes
2. **Using slippage tolerance (1/1490 or 1/1510)**: Sometimes worked, sometimes failed unpredictably
3. **All operations with exact price (1/1500)**: Should theoretically work but wasn't fully tested
4. **Following create-flexible-order.js pattern (all 0)**: Only worked for some operations

## Market Configuration Context

```javascript
// Market: USDT/sNGN Perpetual
{
  indexToken: "USDT",   // Price represents USDT/NGN rate
  longToken: "USDT",    // Long collateral token
  shortToken: "sNGN",   // Short collateral token
}
```

Key characteristics:
- Long positions: Collateral and PnL both in USDT (no token mismatch)
- Short positions: Collateral in USDT, PnL in sNGN (token mismatch)
- Current oracle prices: USDT = $1.00, sNGN = 1/1500 USD

## Theories on Why This Works

### Theory 1: Special Handling of Zero
acceptablePrice = 0 might have special handling in some code paths but not others, possibly:
- Skipping validation for certain operations
- Using current oracle price as default
- Different treatment in market vs limit orders

### Theory 2: Token Mismatch Impact
The collateral/PnL token mismatch for shorts might affect validation:
- Short positions require special handling due to USDT/sNGN conversion
- This might explain why shorts need exact price for decreases

### Theory 3: Order Type Specific Logic
Different order types (MarketIncrease vs MarketDecrease) might have different validation paths that treat acceptablePrice = 0 differently.

## Recommendations

1. **Use the working configuration above** - Don't deviate unless thoroughly tested
2. **Always test changes in testnet first** - The behavior is unpredictable
3. **Consider setting all to exact oracle price** - Most consistent approach if issues arise
4. **Monitor for contract updates** - This might be a bug that gets fixed
5. **Document any new findings** - The behavior is not well understood

## Implementation in Code

```javascript
// In test-market-orders.js or similar scripts

function getAcceptablePrice(orderType, isLong, currentOraclePrice) {
    const exactPrice = ethers.utils.parseUnits("0.000666666666666667", 30); // 1/1500

    if (orderType === "open" || orderType === "increase") {
        // Increases: Longs need exact price, shorts use 0
        return isLong ? exactPrice : 0;
    } else if (orderType === "decrease" || orderType === "close") {
        // Decreases: Longs use 0, shorts need exact price
        return isLong ? 0 : exactPrice;
    }

    // Default fallback
    return exactPrice;
}
```

## Open Questions

1. Why does acceptablePrice = 0 work for some operations but not others?
2. Is there undocumented special handling for 0 in the contracts?
3. Would setting all operations to exact oracle price be more reliable?
4. Is this behavior specific to testnet or our market configuration?
5. Could this be related to the MockOracleProvider implementation?

## Testing Checklist

When testing order execution, verify:
- [x] Long position open with 100% collateral ✅
- [x] Long position increase ✅
- [x] Long position partial decrease (50%) ✅
- [x] Long position full close ✅
- [x] Short position open with 100% collateral ✅
- [x] Short position increase ✅
- [x] Short position partial decrease (50%) ✅
- [x] Short position full close ✅

**All operations tested and confirmed working with the configuration above.**

## Last Updated

- Date: January 2025
- Network: Arbitrum Sepolia Testnet
- GMX Synthetics Fork Version: Unknown
- Status: Working but not fully understood

---

**WARNING**: This configuration is based on empirical testing, not theoretical understanding. The behavior may change with contract updates or different market conditions. Always verify in testnet before mainnet deployment.