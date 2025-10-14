# Stock Market Orders Created Outside Market Hours

## Issue Summary

When users create **market orders** for stock markets (e.g., TSLA) outside regular trading hours (9:30 AM - 4:00 PM ET, Mon-Fri), the order keeper currently executes them immediately regardless of market hours.

This is problematic because:
1. Stock prices are stale outside market hours
2. Oracle prices may not reflect true market conditions
3. Users may expect orders to wait until market opens

## Current Behavior (as of 2025-10-01)

### Market Orders
- **Crypto markets (e.g., USDTNGN):** Execute immediately 24/7 ✅
- **Stock markets (e.g., TSLA):** Execute immediately 24/7 ⚠️
  - This includes after-hours, pre-market, and weekends
  - No market hours enforcement

### Conditional Orders
- **Crypto markets:** Trigger 24/7 ✅
- **Stock markets:** Only trigger during market hours (9:30 AM - 4:00 PM ET) ✅
  - Prices update 24/7 for monitoring
  - Execution blocked outside hours

## Proposed Solutions

### Option 1: Ignore Stock Market Orders Outside Hours (No Tracking)
**Behavior:**
- Keeper sees the order but doesn't track it
- Order sits on-chain until user manually cancels
- Log warning: "Stock market order created outside hours - will not execute"

**Pros:**
- Simple implementation
- No unexpected behavior for users

**Cons:**
- Order sits on-chain (potential confusion)
- Another keeper could execute it
- User must manually cancel

**Implementation:**
```python
if order_class == 'MARKET':
    if is_stock and not is_market_open():
        print("⚠️  Stock market order created outside hours - ignoring")
        return  # Don't track or execute
```

---

### Option 2: Queue Stock Market Orders Until Market Open
**Behavior:**
- Stock market orders created outside hours are moved to conditional orders
- At market open (9:30 AM ET), execute all queued stock market orders
- Add special flag to distinguish "queued market orders" from true conditional orders

**Pros:**
- Orders execute at fair market price when market opens
- User-friendly behavior

**Cons:**
- More complex logic
- Need to track "pending market orders" separately
- Market open batch execution could be slow with many orders

**Implementation:**
```python
if order_class == 'MARKET':
    if is_stock and not is_market_open():
        print("⏸️  Stock market CLOSED - queuing until market opens")
        order['queued_market_order'] = True  # Special flag
        self.conditional_orders[order_key] = order
    else:
        await self.execute_order(order_key, order)

# In monitor_conditional_orders():
# Check for market open event and execute all queued_market_order=True orders
```

---

### Option 3: Auto-Cancel Stock Market Orders Outside Hours
**Behavior:**
- Keeper actively cancels stock market orders created outside hours
- Requires `CONTROLLER_ROLE` permission for keeper

**Pros:**
- Clean on-chain state
- Clear user feedback (order cancelled)

**Cons:**
- Requires additional permissions
- May surprise users
- Gas costs for cancellation

**Implementation:**
```python
if order_class == 'MARKET':
    if is_stock and not is_market_open():
        print("❌ Cancelling stock market order (market closed)")
        await self.cancel_order(order_key)
```

---

### Option 4: Frontend Enforcement Only (Current Decision)
**Behavior:**
- Frontend prevents users from creating stock market orders outside hours
- Keeper executes all market orders immediately (no backend enforcement)

**Pros:**
- Simplest keeper logic
- No special cases to maintain
- Clear UX (button disabled outside hours)

**Cons:**
- Doesn't prevent orders via direct contract calls
- Relies on frontend being correct

**Implementation:**
```typescript
// Frontend
if (orderType === 'MARKET' && isStockMarket && !isMarketOpen()) {
  throw new Error('Stock market is closed. Market orders are only available 9:30 AM - 4:00 PM ET.');
}
```

---

## Decision

**Currently using Option 4: Frontend enforcement only**

- Stock market orders created outside hours will execute immediately
- Frontend will prevent order creation outside market hours
- **TODO:** Revisit backend enforcement if needed

## Technical Context

### Market Hours Detection (Python)
```python
from zoneinfo import ZoneInfo
from datetime import datetime

def is_market_open() -> bool:
    """Check if US stock market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)"""
    now_et = datetime.now(ZoneInfo("America/New_York"))

    # Weekend check
    if now_et.weekday() >= 5:  # Saturday = 5, Sunday = 6
        return False

    # Market hours: 9:30 AM - 4:00 PM ET
    market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)

    return market_open <= now_et < market_close
```

### Order Classification
```python
def is_stock_order(order):
    """Check if order is for a stock market"""
    order_market = order.get('market')
    pair = MARKET_PAIR_MAPPING.get(order_market)

    stock_tickers = ["TSLA", "AMZN", "GOOG", "META", "MSFT", "NVDA", "AAPL"]
    return pair in stock_tickers
```

### Files Modified
- `keeper/order_keeper_v2.py` - Order keeper with stock integration
  - Lines 29-64: Market hours utilities
  - Lines 243-408: StockPriceFeedManager
  - Lines 1104-1169: Conditional order monitoring with market hours check

## Related Issues

- Stock conditional orders already enforce market hours (working correctly)
- After-hours trades are available from Polygon.io (working correctly)
- Price logging happens 24/7 for monitoring (working correctly)

## Next Steps

1. **Immediate:** Implement frontend validation to block stock market orders outside hours
2. **Future:** Monitor for any direct contract calls creating orders outside hours
3. **Future:** Consider implementing Option 1 or Option 2 if backend enforcement becomes necessary

## Questions to Resolve

- [ ] Should we handle US market holidays? (currently not implemented)
- [ ] Should pre-market (4:00 AM - 9:30 AM) and after-hours (4:00 PM - 8:00 PM) be allowed?
- [ ] What happens to queued orders if market doesn't open (e.g., market holiday)?
- [ ] Should the keeper log/alert when stock market orders are created outside hours?

## References

- Polygon.io provides after-hours data (4:00 PM - 8:00 PM ET)
- NYSE/NASDAQ regular hours: 9:30 AM - 4:00 PM ET
- Extended hours: Pre-market 4:00 AM - 9:30 AM, After-hours 4:00 PM - 8:00 PM
