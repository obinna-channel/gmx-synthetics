# Issue: InsufficientGasForAutoCancellation When Closing Positions

**Date:** 2024-11-26
**Status:** Resolved
**Affected Markets:** All markets (discovered in TSLA)

## Summary

Users were unable to close their positions. Orders would appear to execute successfully but then get cancelled immediately in the same transaction.

## Symptoms

- User creates MarketDecrease order to close position
- Keeper executes the order
- Transaction succeeds but order is cancelled
- Error in cancellation reason bytes: `0xe73a05d5` (InsufficientGasForAutoCancellation)

## Root Cause

When a position is fully closed (size → 0), the system automatically cancels any pending orders (stop-loss, take-profit, limit orders) associated with that position. This auto-cancellation happens in `ExecuteOrderUtils.sol:119-133`:

```solidity
if (Order.isDecreaseOrder(params.order.orderType())) {
    if (sizeInUsd == 0) {
        OrderUtils.clearAutoCancelOrders(...);
    }
}
```

The auto-cancel phase requires `MIN_HANDLE_EXECUTION_ERROR_GAS` (1,200,000 gas) to be remaining. The keeper was using a 20% gas buffer on the estimate, which wasn't leaving enough gas for this phase.

**Error details:**
- Gas available at auto-cancel: 1,084,842
- Gas required: 1,200,000
- Shortfall: ~115,000 gas

## Investigation Steps

1. Decoded the cancellation event reason bytes using error selector `0xe73a05d5`
2. Found it maps to `InsufficientGasForAutoCancellation(uint256 gas, uint256 minHandleExecutionErrorGas)`
3. Checked `MIN_HANDLE_EXECUTION_ERROR_GAS` in DataStore: 1,200,000
4. Reviewed keeper gas estimation logic in `keeper/order_keeper_v2.py`

## Solution

Updated `keeper/order_keeper_v2.py` to increase gas buffer:

**Before:**
```python
async def estimate_execution_gas(self, order_key, oracle_params):
    try:
        estimated = self.order_handler.functions.executeOrder(...).estimate_gas(...)
        # Add 20% buffer
        return int(estimated * 1.2)
    except Exception as e:
        return 3000000  # Default fallback
```

**After:**
```python
async def estimate_execution_gas(self, order_key, oracle_params):
    try:
        estimated = self.order_handler.functions.executeOrder(...).estimate_gas(...)
        # Add 50% buffer (increased from 20%)
        # Extra buffer needed for auto-cancel of pending orders when positions fully close
        # The auto-cancel phase requires MIN_HANDLE_EXECUTION_ERROR_GAS (1.2M) remaining
        return int(estimated * 1.5)
    except Exception as e:
        # Return default gas limit (increased from 3M to 5M for safety)
        return 5000000
```

## Commit

```
5bf3b9b7 - Increase keeper gas buffer to fix position close failures
```

## Key Files

- `keeper/order_keeper_v2.py` - Gas estimation logic (line ~2477)
- `contracts/order/OrderUtils.sol:245-249` - Where the error is thrown
- `contracts/order/ExecuteOrderUtils.sol:119-133` - Auto-cancel trigger
- `contracts/gas/GasUtils.sol:47-48` - MIN_HANDLE_EXECUTION_ERROR_GAS lookup

## Related Configuration

DataStore values:
- `MIN_HANDLE_EXECUTION_ERROR_GAS`: 1,200,000
- `MIN_HANDLE_EXECUTION_ERROR_GAS_TO_FORWARD`: 1,000,000
- `MIN_ADDITIONAL_GAS_FOR_EXECUTION`: 1,000,000

## Prevention

The `estimate_gas()` call simulates the transaction but doesn't account for conditional logic that runs based on state changes during execution (like auto-cancellation when position size becomes 0). Always use generous gas buffers for complex transactions.

## Useful Debug Scripts

Created during investigation:
- `claude/scripts/decode-tsla-cancel-error.js` - Decodes order cancellation events
- `claude/scripts/find-error-selector.js` - Maps error selectors to error names
- `claude/scripts/check-gas-config.js` - Checks gas configuration in DataStore
