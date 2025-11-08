# Fallback Prices Removed - Safety Update

## Summary

**ALL fallback prices have been removed from the system.** The keeper will now only operate with real-time prices from the marks-server.

## Changes Made

### 1. Added HTTP Retry Logic (3 attempts with exponential backoff)

**File**: `order_keeper_v2.py`

**PriceFeedManager.fetch_initial_price()** - Lines 165-199
- Added `max_retries=3` parameter
- Exponential backoff: 1s, 2s, 4s between attempts
- Increased timeout from 5s to 10s
- Detailed retry logging

**StockPriceFeedManager.fetch_initial_price()** - Lines 342-376
- Same retry logic as crypto prices
- Handles both HTTP errors and connection failures

### 2. Removed ALL Fallback Price Logic

**get_current_prices()** - Lines 1577-1583
- ❌ **REMOVED**: Fallback prices (1500 for crypto, 250 for stocks)
- ✅ **NEW**: Raises `ValueError` if price not available
- Error message: "No price available for {pair}. Price feeds may not be connected yet..."

**Initialization** - Line 1243
- ❌ **REMOVED**: `self.EXCHANGE_RATE = 1500`
- ✅ **NEW**: `self.EXCHANGE_RATE = None`

**Warning Messages** - Line 240
- ❌ **REMOVED**: "will use fallback (1500) until first update"
- ✅ **NEW**: "System will not operate until prices are available"

## Behavior Changes

### Before (DANGEROUS):
```python
# If HTTP fails or price not in cache:
current_price = 1500  # ⚠️ STALE FALLBACK
print("using fallback: 1500")
# Proceeds with liquidation using wrong price!
```

### After (SAFE):
```python
# If HTTP fails:
# Retry 1: Wait 1s, retry
# Retry 2: Wait 2s, retry
# Retry 3: Wait 4s, retry
# After 3 failures: return None

# If price still not available:
raise ValueError("No price available for USDTARS")
# System stops - does NOT liquidate!
```

## Safety Guarantees

✅ **No liquidations with stale prices** - System will error instead of using fallback
✅ **HTTP failures are retried** - 3 attempts with exponential backoff
✅ **Clear error messages** - Users know why system stopped
✅ **Graceful degradation** - Keeper stops safely rather than operating with bad data

## Testing Recommendations

1. **Test price feed failure**: Disconnect marks-server and verify keeper stops
2. **Test HTTP retry**: Monitor logs to see retry attempts
3. **Test recovery**: Reconnect marks-server and verify keeper resumes
4. **Test partial outage**: Disable one price feed (e.g., TSLA) and verify only that market stops

## Configuration

No configuration needed - retry logic is automatic.

### Environment Variables (optional):
- Price feed connection is automatic via Socket.IO
- HTTP timeout: 10 seconds (hardcoded)
- Max retries: 3 (hardcoded)
- Backoff: Exponential 2^attempt seconds

## Rollback

To rollback these changes, revert to commit before this update. However, this is NOT recommended as fallback prices created a critical safety issue.
