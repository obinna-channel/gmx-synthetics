# Liquidation Monitor: Analysis & Improvement Suggestions

## Current Implementation Review

The current `LiquidationMonitor` class in `order_keeper_v2.py` provides basic liquidation functionality but has several limitations that could lead to missed liquidations, inefficiencies, and reliability issues.

---

## Critical Issues (High Priority)

### 1. **Hardcoded Account List - Major Limitation**
**Current Issue:**
```python
accounts_to_check = [
    "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44",
    "0xB880CBFE2fb746838719805CEcE154b58D03A79b",
    "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292",
    self.account.address
]
```

**Problems:**
- Only checks 4 hardcoded accounts
- Misses all other positions in the system
- TODO comment indicates this was known: "In production, enumerate all position keys from DataStore"
- No way to discover new positions dynamically

**Solutions:**

**Option A: Enumerate All Position Keys from DataStore (RECOMMENDED)**
```python
async def get_all_position_keys(self, market):
    """Fetch all position keys from DataStore for a given market"""
    # Use DataStore.getBytes32Count(Keys.POSITION_LIST)
    position_list_key = self.get_position_list_key()
    position_count = self.keeper.data_store.functions.getBytes32Count(position_list_key).call()

    # Batch fetch position keys
    BATCH_SIZE = 100
    all_keys = []

    for start in range(0, position_count, BATCH_SIZE):
        end = min(start + BATCH_SIZE, position_count)
        batch = self.keeper.data_store.functions.getBytes32ValuesAt(
            position_list_key,
            start,
            end
        ).call()
        all_keys.extend(batch)

    return all_keys
```

**Option B: Listen to Position Events (Event-Driven)**
```python
async def listen_to_position_events(self):
    """Subscribe to PositionIncrease/PositionDecrease events to track positions"""
    # Track active positions via events
    position_filter = self.keeper.event_emitter.events.PositionIncrease.create_filter(
        from_block='latest'
    )

    # Maintain a set of active position keys
    self.active_positions = set()

    # Process events to add/remove positions
```

**Option C: Hybrid Approach**
- Initial full scan using DataStore enumeration
- Then maintain state via event listening
- Periodic full re-sync (e.g., every hour) to catch any missed events

---

### 2. **Only Monitors One Market**
**Current Issue:**
```python
self.markets = [keeper.mUSDTNGN_MARKET]
```

**Problems:**
- Hardcoded to only USDTNGN market
- Ignores TSLA, AAPL, NVDA, META, USDTARS, PKR, COP markets
- We just liquidated 2 positions in USDTARS that weren't being monitored!

**Solution:**
```python
# Initialize with all active markets
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

# Or better: dynamically discover markets from MarketFactory/DataStore
async def get_all_markets(self):
    """Fetch all active markets from the protocol"""
    market_count = self.keeper.data_store.functions.getAddressCount(
        self.get_market_list_key()
    ).call()

    markets = []
    for i in range(market_count):
        market = self.keeper.data_store.functions.getAddressValueAt(
            self.get_market_list_key(),
            i
        ).call()
        markets.append(market)

    return markets
```

---

### 3. **No Retry Logic on Failed Liquidations**
**Current Issue:**
```python
if receipt.status == 1:
    print(f"   ✅ Liquidation successful!")
    return True
else:
    print(f"   ❌ Liquidation transaction failed")
    return False  # Gives up immediately
```

**Problems:**
- If liquidation fails (e.g., gas price spike, RPC issue), position is never retried
- Transient failures mean missed liquidations
- No exponential backoff or retry queue

**Solution:**
```python
class LiquidationMonitor:
    def __init__(self, keeper):
        # Add retry tracking
        self.failed_liquidations = {}  # position_key -> {attempts, last_attempt, reason}
        self.MAX_RETRY_ATTEMPTS = 3
        self.RETRY_DELAY = [60, 300, 900]  # 1min, 5min, 15min

    async def execute_liquidation_with_retry(self, position_key, market, account, is_long):
        """Execute liquidation with retry logic"""
        attempts = self.failed_liquidations.get(position_key, {}).get('attempts', 0)

        if attempts >= self.MAX_RETRY_ATTEMPTS:
            print(f"   ⚠️  Max retry attempts reached for {position_key}")
            return False

        success = await self.execute_liquidation(market, account, is_long)

        if not success:
            # Track failure
            self.failed_liquidations[position_key] = {
                'attempts': attempts + 1,
                'last_attempt': time.time(),
                'market': market,
                'account': account,
                'is_long': is_long
            }
        else:
            # Clear failure tracking on success
            if position_key in self.failed_liquidations:
                del self.failed_liquidations[position_key]

        return success

    async def retry_failed_liquidations(self):
        """Periodically retry failed liquidations"""
        current_time = time.time()

        for position_key, failure_info in list(self.failed_liquidations.items()):
            attempts = failure_info['attempts']
            last_attempt = failure_info['last_attempt']

            # Check if enough time has passed for retry
            if current_time - last_attempt >= self.RETRY_DELAY[min(attempts-1, len(self.RETRY_DELAY)-1)]:
                print(f"   🔄 Retrying liquidation (attempt {attempts + 1})")
                await self.execute_liquidation_with_retry(
                    position_key,
                    failure_info['market'],
                    failure_info['account'],
                    failure_info['is_long']
                )
```

---

### 4. **Silent Position Checking Failures**
**Current Issue:**
```python
try:
    # Check if liquidatable
    was_liquidated = await self.check_and_liquidate(...)
except Exception as e:
    # Position doesn't exist or error checking - normal, continue
    pass  # Silently swallows ALL errors!
```

**Problems:**
- Catches and ignores ALL exceptions
- RPC failures, contract errors, timeout issues all silently ignored
- No distinction between "position doesn't exist" vs "RPC error"
- Impossible to debug issues

**Solution:**
```python
async def scan_positions(self):
    liquidation_count = 0
    error_count = 0
    position_not_found = 0

    for account in accounts_to_check:
        for is_long in [True, False]:
            try:
                was_liquidated = await self.check_and_liquidate(...)
                if was_liquidated:
                    liquidation_count += 1

            except PositionNotFoundError:
                position_not_found += 1
                # Expected - position doesn't exist

            except RPCError as e:
                error_count += 1
                print(f"   ⚠️  RPC error checking {account}: {e}")
                # Could retry or track for later

            except Exception as e:
                error_count += 1
                print(f"   ❌ Unexpected error checking {account}: {e}")
                traceback.print_exc()

    # Log summary
    print(f"   Scanned {len(accounts_to_check)*2} position slots")
    print(f"   Liquidations: {liquidation_count}, Errors: {error_count}, Not found: {position_not_found}")
```

---

## Medium Priority Improvements

### 5. **Inefficient Position Scanning**
**Current Issue:**
- Checks every account × 2 sides (long/short) every scan
- For 4 accounts × 2 = 8 position checks
- Each check calls `reader.isPositionLiquidatable()` which is expensive
- If we enumerate ALL positions, could be hundreds of RPC calls

**Solution: Smart Scanning with Health Factor Caching**
```python
class LiquidationMonitor:
    def __init__(self, keeper):
        # Cache position health
        self.position_health_cache = {}  # position_key -> {health_factor, last_check}
        self.HEALTH_CHECK_INTERVAL_HEALTHY = 60  # Check healthy positions every 60s
        self.HEALTH_CHECK_INTERVAL_AT_RISK = 10   # Check at-risk positions every 10s

    async def scan_positions_smart(self):
        """Smart scanning with priority queue"""
        current_time = time.time()

        for position_key, position_info in self.active_positions.items():
            cached_health = self.position_health_cache.get(position_key)

            # Determine if we need to check this position
            should_check = False

            if not cached_health:
                should_check = True  # Never checked before
            elif cached_health['health_factor'] < 1.5:  # At risk
                if current_time - cached_health['last_check'] >= self.HEALTH_CHECK_INTERVAL_AT_RISK:
                    should_check = True
            else:  # Healthy
                if current_time - cached_health['last_check'] >= self.HEALTH_CHECK_INTERVAL_HEALTHY:
                    should_check = True

            if should_check:
                await self.check_and_liquidate(position_key, ...)
```

---

### 6. **No Profitability Check**
**Current Issue:**
- Executes liquidations regardless of profitability
- Gas costs could exceed liquidation rewards
- No check for minimum profit threshold

**Solution:**
```python
async def is_liquidation_profitable(self, position_info, market):
    """Check if liquidation will be profitable"""
    # Estimate gas cost
    gas_limit = 3_000_000  # Average from our tests
    current_gas_price = self.w3.eth.gas_price
    gas_cost_wei = gas_limit * current_gas_price
    gas_cost_usd = gas_cost_wei / 10**18 * self.get_eth_price_usd()

    # Estimate liquidation reward (typically 1-5% of position size)
    position_size_usd = position_info['sizeInUsd'] / 10**30
    liquidation_fee_percent = 0.02  # 2% (check DataStore for actual value)
    estimated_reward = position_size_usd * liquidation_fee_percent

    net_profit = estimated_reward - gas_cost_usd

    print(f"   💰 Profitability: Reward ${estimated_reward:.2f}, Gas ${gas_cost_usd:.2f}, Net ${net_profit:.2f}")

    MIN_PROFIT_USD = float(os.getenv("MIN_LIQUIDATION_PROFIT", "5"))
    return net_profit >= MIN_PROFIT_USD
```

---

### 7. **Race Condition with Other Keepers**
**Current Issue:**
- No check if another keeper already liquidated the position
- Could submit failed transactions wasting gas
- No coordination between multiple keepers

**Solution:**
```python
async def check_position_still_exists(self, position_key):
    """Verify position still exists before liquidating"""
    position = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: self.keeper.reader.functions.getPosition(
            self.keeper.DATA_STORE,
            bytes.fromhex(position_key[2:])
        ).call()
    )

    # Check if position has size
    size_in_usd = position[2][0]  # position.numbers.sizeInUsd
    return size_in_usd > 0

async def execute_liquidation(self, market, account, is_long):
    # Double-check position still exists RIGHT before executing
    position_key = self.calculate_position_key(account, market, is_long)

    if not await self.check_position_still_exists(position_key):
        print(f"   ⚠️  Position no longer exists (likely liquidated by another keeper)")
        return False

    # Continue with liquidation...
```

---

### 8. **Limited Observability**
**Current Issue:**
- Basic print statements only
- No metrics, alerts, or dashboards
- Hard to monitor keeper health
- No historical data on liquidations

**Solution:**
```python
class LiquidationMetrics:
    def __init__(self):
        self.total_liquidations = 0
        self.total_profit_usd = 0
        self.failed_attempts = 0
        self.positions_checked = 0
        self.average_check_time_ms = 0
        self.liquidations_by_market = {}
        self.start_time = time.time()

    def record_liquidation(self, market, profit_usd, gas_used):
        self.total_liquidations += 1
        self.total_profit_usd += profit_usd
        self.liquidations_by_market[market] = self.liquidations_by_market.get(market, 0) + 1

        # Could send to monitoring service
        self.send_metric("liquidation.executed", 1, {"market": market})
        self.send_metric("liquidation.profit", profit_usd)
        self.send_metric("liquidation.gas", gas_used)

    def get_summary(self):
        uptime = time.time() - self.start_time
        return {
            'uptime_hours': uptime / 3600,
            'total_liquidations': self.total_liquidations,
            'total_profit_usd': self.total_profit_usd,
            'success_rate': self.total_liquidations / max(self.total_liquidations + self.failed_attempts, 1),
            'liquidations_per_hour': self.total_liquidations / (uptime / 3600),
            'by_market': self.liquidations_by_market
        }
```

---

### 9. **No Nonce Management for Concurrent Liquidations**
**Current Issue:**
```python
'nonce': self.w3.eth.get_transaction_count(self.account.address)
```

**Problems:**
- If multiple liquidations happen simultaneously, nonce conflicts
- Could lead to stuck transactions
- No nonce tracking or queue

**Solution:**
```python
class LiquidationMonitor:
    def __init__(self, keeper):
        self.nonce_lock = asyncio.Lock()
        self.pending_nonce = None

    async def get_next_nonce(self):
        """Thread-safe nonce management"""
        async with self.nonce_lock:
            if self.pending_nonce is None:
                self.pending_nonce = self.w3.eth.get_transaction_count(
                    self.account.address,
                    'pending'
                )

            nonce = self.pending_nonce
            self.pending_nonce += 1
            return nonce

    async def execute_liquidation(self, ...):
        nonce = await self.get_next_nonce()

        tx = self.keeper.liquidation_handler.functions.executeLiquidation(
            ...
        ).build_transaction({
            'from': self.account.address,
            'gas': 5_000_000,
            'gasPrice': current_gas_price,
            'nonce': nonce
        })
        # ...
```

---

### 10. **Fixed Gas Limit**
**Current Issue:**
```python
'gas': 5_000_000,  # Always uses 5M gas
```

**Problems:**
- Overpays for gas on simple liquidations
- Might not be enough for complex positions
- No dynamic estimation

**Solution:**
```python
async def estimate_liquidation_gas(self, account, market, is_long, oracle_params):
    """Estimate gas for liquidation"""
    try:
        estimated = self.keeper.liquidation_handler.functions.executeLiquidation(
            Web3.to_checksum_address(account),
            Web3.to_checksum_address(market),
            Web3.to_checksum_address(self.keeper.mUSD),
            is_long,
            oracle_params
        ).estimate_gas({
            'from': self.account.address
        })

        # Add 20% buffer
        return int(estimated * 1.2)

    except Exception as e:
        print(f"   ⚠️  Gas estimation failed: {e}")
        return 5_000_000  # Fallback
```

---

## Low Priority / Nice to Have

### 11. **No Health Dashboard**
Add a simple web dashboard showing:
- Positions being monitored
- Recent liquidations
- Keeper status
- Profitability metrics

### 12. **No Alerting**
Send alerts for:
- Missed liquidations (position was liquidatable but we didn't execute)
- Failed liquidations
- Keeper offline/errors
- Low profitability

### 13. **No Market-Specific Collateral Token Handling**
Currently assumes all positions use mUSD as collateral. Should check actual collateral token from position data.

### 14. **No Multi-Collateral Support**
Some positions might use different collateral tokens (USDT, mNGN, etc.). Need to handle these.

### 15. **No Liquidation Queue Priority**
All positions treated equally. Should prioritize by:
- Profitability
- How underwater the position is
- Market volatility

---

## Recommended Implementation Priority

### Phase 1 (Critical - Do First):
1. ✅ Fix position discovery (enumerate from DataStore)
2. ✅ Monitor all markets (not just USDTNGN)
3. ✅ Add proper error handling and logging
4. ✅ Add retry logic for failed liquidations

### Phase 2 (Important):
5. Add profitability checks
6. Implement smart scanning with health caching
7. Add race condition protection
8. Fix nonce management

### Phase 3 (Optimization):
9. Add metrics and observability
10. Dynamic gas estimation
11. Multi-collateral support

### Phase 4 (Polish):
12. Web dashboard
13. Alerting system
14. Priority queue

---

## Estimated Impact

**Current System:**
- Monitors: 4 accounts × 1 market = 4 positions max
- Missed: The 2 USDTARS positions we just liquidated manually
- Efficiency: Low (checks non-existent positions repeatedly)

**After Phase 1:**
- Monitors: All positions across all 9 markets (could be 100s)
- Missed: Near zero with proper retry logic
- Efficiency: High (only checks active positions)

**ROI of Improvements:**
- Current: Maybe $10-50/day in liquidation fees
- After improvements: Potentially $500-2000/day depending on market conditions
- Implementation time: ~2-3 days for Phase 1, ~1 week total for Phases 1-2
