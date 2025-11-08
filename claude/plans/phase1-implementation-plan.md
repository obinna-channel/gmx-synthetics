# Phase 1 Implementation Plan - Liquidation Monitor Improvements

## Overview
Transform the liquidation monitor from checking 4 hardcoded accounts in 1 market to monitoring ALL positions across ALL 9 markets with retry logic and proper error handling.

---

## File to Modify
- `keeper/order_keeper_v2.py` - LiquidationMonitor class (lines 446-779)

---

## Implementation Steps

### Step 1: Add Position Enumeration from DataStore
**Goal**: Fetch all active position keys dynamically

**Add these helper functions to `LiquidationMonitor` class:**

```python
def get_position_list_key(self):
    """Get the DataStore key for POSITION_LIST"""
    # From Keys.sol: bytes32 public constant POSITION_LIST = keccak256(abi.encode("POSITION_LIST"));
    return Web3.keccak(text="POSITION_LIST")

async def fetch_all_position_keys(self):
    """Fetch all position keys from DataStore.POSITION_LIST"""
    position_list_key = self.get_position_list_key()

    # Get total count
    position_count = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: self.keeper.data_store.functions.getBytes32Count(
            position_list_key
        ).call()
    )

    print(f"   Found {position_count} total positions in DataStore")

    if position_count == 0:
        return []

    # Fetch all position keys in batches
    BATCH_SIZE = 50  # Adjust based on RPC limits
    all_keys = []

    for start in range(0, position_count, BATCH_SIZE):
        end = min(start + BATCH_SIZE, position_count)

        batch = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda s=start, e=end: self.keeper.data_store.functions.getBytes32ValuesAt(
                position_list_key,
                s,
                e
            ).call()
        )

        all_keys.extend(batch)
        print(f"   Fetched batch {start}-{end}: {len(batch)} keys")

    return all_keys

async def get_position_info_from_key(self, position_key):
    """Get position details from a position key"""
    position = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: self.keeper.reader.functions.getPosition(
            Web3.to_checksum_address(self.keeper.DATA_STORE),
            bytes.fromhex(position_key[2:]) if isinstance(position_key, str) else position_key
        ).call()
    )

    # Extract key fields from position struct
    # position[0] = addresses (account, market, collateralToken)
    # position[2] = numbers (sizeInUsd, sizeInTokens, collateralAmount, ...)

    return {
        'account': position[0][0],
        'market': position[0][1],
        'collateralToken': position[0][2],
        'sizeInUsd': position[2][0],
        'isLong': position[1][0]  # position[1] = flags
    }
```

**Estimated time**: 30 minutes

---

### Step 2: Implement Position Cache
**Goal**: Cache position keys and refresh periodically

**Add to `__init__` method:**

```python
def __init__(self, keeper):
    # ... existing code ...

    # Position cache
    self.position_cache = {}  # position_key -> {account, market, collateralToken, isLong, last_check}
    self.last_cache_refresh = 0
    self.CACHE_REFRESH_INTERVAL = 600  # 10 minutes

    # Add all markets (replace single market)
    self.markets = [
        keeper.mUSDTNGN_MARKET,
        keeper.mUSDTNGN_SINGLE_MARKET,
        keeper.mTSLA_MARKET,
        keeper.mAAPL_MARKET,
        keeper.mNVDA_MARKET,
        keeper.mMETA_MARKET,
        keeper.mUSDTARS_MARKET,
        keeper.mPKR_MARKET,
        keeper.mCOP_MARKET
    ]
```

**Add cache refresh function:**

```python
async def refresh_position_cache(self):
    """Refresh position cache from DataStore"""
    print(f"\n🔄 [Liquidation] Refreshing position cache...")
    start_time = time.time()

    try:
        # Fetch all position keys
        position_keys = await self.fetch_all_position_keys()

        # Build new cache
        new_cache = {}

        for position_key in position_keys:
            try:
                # Get position info
                position_info = await self.get_position_info_from_key(position_key)

                # Only cache if position has size (is active)
                if position_info['sizeInUsd'] > 0:
                    key_str = position_key.hex() if isinstance(position_key, bytes) else position_key
                    new_cache[key_str] = {
                        'account': position_info['account'],
                        'market': position_info['market'],
                        'collateralToken': position_info['collateralToken'],
                        'isLong': position_info['isLong'],
                        'last_check': 0
                    }

            except Exception as e:
                # Position might have been closed, skip
                pass

        # Update cache
        old_count = len(self.position_cache)
        self.position_cache = new_cache
        self.last_cache_refresh = time.time()

        elapsed = time.time() - start_time
        print(f"   ✅ Cache refreshed: {len(new_cache)} active positions (was {old_count})")
        print(f"   Took {elapsed:.2f}s")

        # Log positions by market
        by_market = {}
        for pos_info in new_cache.values():
            market = pos_info['market']
            by_market[market] = by_market.get(market, 0) + 1

        print(f"   Positions by market:")
        for market, count in by_market.items():
            market_name = self.get_market_name(market)
            print(f"      {market_name}: {count}")

        return True

    except Exception as e:
        print(f"   ❌ Error refreshing cache: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_market_name(self, market_address):
    """Get human-readable market name"""
    market_names = {
        self.keeper.mUSDTNGN_MARKET: "USDTNGN",
        self.keeper.mUSDTNGN_SINGLE_MARKET: "USDTNGN_SINGLE",
        self.keeper.mTSLA_MARKET: "TSLA",
        self.keeper.mAAPL_MARKET: "AAPL",
        self.keeper.mNVDA_MARKET: "NVDA",
        self.keeper.mMETA_MARKET: "META",
        self.keeper.mUSDTARS_MARKET: "USDTARS",
        self.keeper.mPKR_MARKET: "PKR",
        self.keeper.mCOP_MARKET: "COP"
    }
    return market_names.get(market_address, market_address[:10])
```

**Estimated time**: 45 minutes

---

### Step 3: Rewrite scan_positions to Use Cache
**Goal**: Replace hardcoded account list with cache-based scanning

**Replace entire `scan_positions` method:**

```python
async def scan_positions(self):
    """Scan all cached positions for liquidation opportunities"""

    print(f"\n🔍 [Liquidation] Scanning positions...")

    # Refresh cache if stale
    current_time = time.time()
    if current_time - self.last_cache_refresh > self.CACHE_REFRESH_INTERVAL:
        await self.refresh_position_cache()

    # If cache is empty, do initial refresh
    if not self.position_cache:
        print(f"   Position cache empty, doing initial refresh...")
        await self.refresh_position_cache()

        if not self.position_cache:
            print(f"   ⚠️  No positions found in DataStore")
            return

    print(f"   Checking {len(self.position_cache)} cached positions...")

    liquidation_count = 0
    error_count = 0
    checked_count = 0

    try:
        for position_key, position_info in self.position_cache.items():
            try:
                checked_count += 1
                was_liquidated = await self.check_and_liquidate(
                    position_key,
                    position_info['market'],
                    position_info['account'],
                    position_info['isLong']
                )

                if was_liquidated:
                    liquidation_count += 1
                    # Remove from cache since it's been liquidated
                    del self.position_cache[position_key]

            except Exception as e:
                error_count += 1
                print(f"   ⚠️  Error checking position {position_key[:10]}: {e}")
                # Don't let one error stop the whole scan
                continue

        # Summary
        if liquidation_count > 0:
            print(f"   ✅ Executed {liquidation_count} liquidation(s)")
        else:
            print(f"   ✓ No liquidations needed")

        if error_count > 0:
            print(f"   ⚠️  {error_count} errors during scan")

        print(f"   Checked {checked_count}/{len(self.position_cache)} positions")

    except Exception as e:
        print(f"   ❌ Error scanning positions: {e}")
        import traceback
        traceback.print_exc()
```

**Estimated time**: 30 minutes

---

### Step 4: Add Retry Logic for Failed Liquidations
**Goal**: Retry failed liquidations with exponential backoff

**Add to `__init__` method:**

```python
def __init__(self, keeper):
    # ... existing code ...

    # Retry tracking
    self.failed_liquidations = {}  # position_key -> {attempts, last_attempt, position_info}
    self.MAX_RETRY_ATTEMPTS = 3
    self.RETRY_DELAYS = [60, 300, 900]  # 1min, 5min, 15min
```

**Add retry functions:**

```python
async def retry_failed_liquidations(self):
    """Retry previously failed liquidations"""
    if not self.failed_liquidations:
        return

    print(f"\n🔄 [Liquidation] Checking {len(self.failed_liquidations)} failed liquidation(s) for retry...")

    current_time = time.time()
    retry_count = 0

    for position_key, failure_info in list(self.failed_liquidations.items()):
        attempts = failure_info['attempts']
        last_attempt = failure_info['last_attempt']

        # Calculate delay for this attempt
        delay_index = min(attempts - 1, len(self.RETRY_DELAYS) - 1)
        required_delay = self.RETRY_DELAYS[delay_index]

        # Check if enough time has passed
        if current_time - last_attempt >= required_delay:
            print(f"   🔄 Retrying liquidation (attempt {attempts + 1}/{self.MAX_RETRY_ATTEMPTS})")
            print(f"      Position: {position_key[:16]}...")

            success = await self.execute_liquidation(
                failure_info['market'],
                failure_info['account'],
                failure_info['is_long']
            )

            if success:
                print(f"   ✅ Retry successful!")
                del self.failed_liquidations[position_key]
                retry_count += 1
            else:
                # Increment attempt count
                self.failed_liquidations[position_key]['attempts'] += 1
                self.failed_liquidations[position_key]['last_attempt'] = current_time

                # Remove if max attempts reached
                if self.failed_liquidations[position_key]['attempts'] >= self.MAX_RETRY_ATTEMPTS:
                    print(f"   ❌ Max retry attempts reached, giving up")
                    del self.failed_liquidations[position_key]

    if retry_count > 0:
        print(f"   ✅ {retry_count} retry(ies) successful")

def record_failed_liquidation(self, position_key, market, account, is_long):
    """Record a failed liquidation for retry"""
    if position_key not in self.failed_liquidations:
        self.failed_liquidations[position_key] = {
            'attempts': 1,
            'last_attempt': time.time(),
            'market': market,
            'account': account,
            'is_long': is_long
        }
        print(f"   📝 Recorded for retry (attempt 1/{self.MAX_RETRY_ATTEMPTS})")
```

**Update `execute_liquidation` to record failures:**

```python
async def execute_liquidation(self, market, account, is_long):
    """Execute a liquidation transaction. Returns True if successful, False otherwise."""

    # Calculate position key for tracking
    position_key = Web3.keccak(
        encode(
            ['address', 'address', 'address', 'bool'],
            [
                Web3.to_checksum_address(account),
                Web3.to_checksum_address(market),
                Web3.to_checksum_address(self.keeper.mUSD),
                is_long
            ]
        )
    ).hex()

    try:
        # ... existing liquidation logic ...

        if receipt.status == 1:
            print(f"   ✅ Liquidation successful!")
            print(f"   Gas used: {receipt.gasUsed:,}")

            # Clear from failed list if it was there
            if position_key in self.failed_liquidations:
                del self.failed_liquidations[position_key]

            return True
        else:
            print(f"   ❌ Liquidation transaction failed")
            self.record_failed_liquidation(position_key, market, account, is_long)
            return False

    except Exception as e:
        print(f"   ❌ Error executing liquidation: {e}")
        self.record_failed_liquidation(position_key, market, account, is_long)
        return False
```

**Estimated time**: 45 minutes

---

### Step 5: Improve Error Handling
**Goal**: Categorize errors properly instead of silent swallowing

**Update `check_and_liquidate` method:**

```python
async def check_and_liquidate(self, position_key, market, account, is_long):
    """Check if a position is liquidatable and execute if needed"""

    # Skip if already executing
    if position_key in self.executing_liquidations:
        return False

    try:
        # Mark as executing
        self.executing_liquidations.add(position_key)

        # Get current prices
        market_prices = self.get_market_prices_for_reader(market)

        # Get market configuration
        market_config = self.keeper.MARKETS.get(market)
        if not market_config:
            print(f"   ⚠️  Unknown market {market}, skipping")
            return False

        # Check if position is liquidatable
        is_liquidatable, reason, info = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.keeper.reader.functions.isPositionLiquidatable(
                Web3.to_checksum_address(self.keeper.DATA_STORE),
                Web3.to_checksum_address(self.keeper.REFERRAL_STORAGE),
                bytes.fromhex(position_key[2:]) if isinstance(position_key, str) else position_key,
                (
                    Web3.to_checksum_address(market),
                    Web3.to_checksum_address(market_config["indexToken"]),
                    Web3.to_checksum_address(market_config["longToken"]),
                    Web3.to_checksum_address(market_config["shortToken"])
                ),
                market_prices,
                True,
                True
            ).call()
        )

        if is_liquidatable:
            print(f"\n💀 LIQUIDATABLE POSITION FOUND!")
            print(f"   Account: {account}")
            print(f"   Market: {self.get_market_name(market)}")
            print(f"   Position: {'LONG' if is_long else 'SHORT'}")
            print(f"   Reason: {reason}")

            # Execute liquidation
            success = await self.execute_liquidation(market, account, is_long)
            return success

        return False

    except ValueError as e:
        # Contract revert or invalid input
        error_msg = str(e)
        if "execution reverted" in error_msg.lower():
            # Position likely doesn't exist or was already liquidated
            pass
        else:
            print(f"   ⚠️  ValueError checking {account[:10]}: {e}")
        return False

    except Exception as e:
        # Unexpected error - log it
        print(f"   ❌ Unexpected error checking {account[:10]}: {e}")
        return False

    finally:
        # Always remove from executing set
        self.executing_liquidations.discard(position_key)
```

**Estimated time**: 30 minutes

---

### Step 6: Update Monitor Loop to Include Retries
**Goal**: Add retry checking to the main loop

**Update `monitor_loop` method:**

```python
async def monitor_loop(self):
    """Main monitoring loop"""

    if not self.ENABLED:
        print("⚠️  Liquidation monitoring is DISABLED")
        return

    print(f"\n👁️  Starting liquidation monitor...")
    print(f"   Monitoring {len(self.markets)} markets")

    # Do initial cache refresh
    await self.refresh_position_cache()

    while True:
        try:
            current_time = time.time()

            # Periodic position scan
            if current_time - self.last_scan_time >= self.SCAN_INTERVAL:
                await self.scan_positions()
                self.last_scan_time = current_time

            # Retry failed liquidations (check every 30 seconds)
            await self.retry_failed_liquidations()

            # Sleep before next check
            await asyncio.sleep(30)

        except Exception as e:
            print(f"❌ [Liquidation] Error in monitor loop: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(10)
```

**Estimated time**: 15 minutes

---

## Testing Plan

### Test 1: Cache Refresh
```python
# Manually trigger cache refresh
await liquidation_monitor.refresh_position_cache()
# Expected: See all active positions printed
```

### Test 2: Scan with Real Positions
```python
# Let monitor run for 1 scan cycle
# Expected:
# - Cache refreshes on first run
# - Scans all cached positions
# - No errors unless positions truly liquidatable
```

### Test 3: Retry Logic
```python
# Simulate a failed liquidation (disconnect RPC temporarily)
# Expected:
# - Failure recorded
# - Retry attempted after 60s
# - Max 3 attempts before giving up
```

### Test 4: Multi-Market Coverage
```python
# Check that all 9 markets are being monitored
# Expected: See positions from USDTARS, TSLA, NVDA, etc. in cache
```

---

## Total Estimated Time

| Step | Time |
|------|------|
| 1. Position enumeration | 30 min |
| 2. Position cache | 45 min |
| 3. Update scan logic | 30 min |
| 4. Retry logic | 45 min |
| 5. Error handling | 30 min |
| 6. Update monitor loop | 15 min |
| Testing | 30 min |
| **TOTAL** | **~3.5 hours** |

---

## Rollout Strategy

1. **Test in dev first** - Run with small position set
2. **Monitor logs carefully** - Watch for any errors during cache refresh
3. **Gradual enable** - Start with USDTARS market only, then add others
4. **Validate metrics** - Confirm we're seeing more positions than before

---

## Success Criteria

✅ Monitor discovers ALL active positions (not just 4)
✅ All 9 markets covered
✅ Failed liquidations retry up to 3 times
✅ Errors are logged (not silently swallowed)
✅ Cache refreshes every 10 minutes
✅ Scan completes in < 30 seconds

---

## Next Steps After Phase 1

Once Phase 1 is stable:
- Phase 2: Add profitability checks
- Phase 2: Implement smart scanning with health caching
- Phase 3: Add metrics and observability
