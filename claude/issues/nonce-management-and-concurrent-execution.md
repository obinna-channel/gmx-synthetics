# Nonce Management and Concurrent Order Execution

## Issue Summary

The order keeper currently executes orders **sequentially** (one at a time) to avoid nonce conflicts. This works correctly but limits throughput when multiple orders arrive in quick succession.

## Current Architecture

### Sequential Execution Flow

```python
# Order A arrives
await handle_order_created(order_A)  # Blocks until complete
  └─> await execute_order(order_A)
      ├─> nonce = get_transaction_count()  # e.g., nonce = 100
      ├─> update_mock_provider_prices()     # Uses nonces 100, 101, 102
      └─> execute_order()                   # Uses nonce 103

# Order B waits for Order A to complete
await handle_order_created(order_B)  # Now executes
  └─> await execute_order(order_B)
      ├─> nonce = get_transaction_count()  # e.g., nonce = 104
      ├─> update_mock_provider_prices()     # Uses nonces 104, 105, 106
      └─> execute_order()                   # Uses nonce 107
```

**Current execution time:**
- Single order: ~4 seconds
- Two orders arriving simultaneously: ~8 seconds (sequential)

### Why Sequential Execution?

The keeper uses the **deployer address** which also handles:
- Protocol deployments
- Market configurations
- Role grants
- Other admin operations

**Problem with shared address:**
External transactions from deployer advance the nonce unpredictably, making concurrent execution unsafe.

## The Nonce Conflict Problem

### Scenario: Concurrent Execution with Shared Address

```
Time 0s:   Order A starts
           └─> get_transaction_count() = 100
           └─> Reserves nonces 100-103

Time 0.5s: Deployer sends admin transaction
           └─> Uses nonce 100 ❌

Time 1s:   Order A tries to send transactions
           └─> Sends tx with nonce 100
           └─> ERROR: "nonce too low" (deployer already used it)
```

### Scenario: Concurrent Execution Between Orders

Even without external transactions, concurrent order execution has race conditions:

```
Time 0s:   Order A calls get_transaction_count() = 100
Time 0.1s: Order B calls get_transaction_count() = 100 (same!)
Time 1s:   Order A sends tx with nonce 100
Time 1.5s: Order B sends tx with nonce 100
Result:    One tx replaces the other, or one fails
```

## Attempted Solutions

### Solution 1: Nonce Manager (Implemented and Reverted)

**Approach:**
```python
class OrderKeeper:
    def __init__(self):
        self.nonce_lock = asyncio.Lock()
        self.current_nonce = None

    async def get_next_nonce(self):
        async with self.nonce_lock:
            if self.current_nonce is None:
                self.current_nonce = self.w3.eth.get_transaction_count(...)
            nonce = self.current_nonce
            self.current_nonce += 1
            return nonce
```

**Why it failed:**
- Works great for keeper's own transactions
- Breaks when external deployer transactions happen
- Example: Keeper thinks next nonce is 105, but deployer used 105-107
- Results in "nonce too low" errors

### Solution 2: Hybrid Approach (Considered but not implemented)

**Approach:**
```python
async def get_next_nonce(self):
    async with self.nonce_lock:
        blockchain_nonce = self.w3.eth.get_transaction_count(...)
        # Use whichever is higher
        self.current_nonce = max(blockchain_nonce, self.current_nonce or 0)
        nonce = self.current_nonce
        self.current_nonce += 1
        return nonce
```

**Analysis:**
- ✅ Handles external transactions (syncs from blockchain)
- ✅ Prevents going backwards
- ❌ Still has race conditions with concurrent execution
- ❌ Only works reliably with sequential execution
- **Conclusion:** If we're doing sequential anyway, just sync fresh each time (simpler)

### Solution 3: Current Approach (Fresh Sync)

**Approach:**
```python
# In update_mock_provider_prices()
nonce = self.w3.eth.get_transaction_count(self.account.address)
# Use nonce, nonce+1, nonce+2

# In execute_order()
nonce = self.w3.eth.get_transaction_count(self.account.address)
# Use nonce for executeOrder tx
```

**Pros:**
- ✅ Simple and reliable
- ✅ Handles external deployer transactions
- ✅ No race conditions (sequential execution)

**Cons:**
- ❌ Orders execute one at a time (slower with multiple orders)
- ❌ Extra blockchain RPC calls (2 per order)

## Recommended Long-Term Solution

### Option A: Dedicated Keeper Address (Recommended)

**Setup:**
1. Create new wallet specifically for keeper operations
2. Fund with ETH for gas fees
3. Grant `ORDER_KEEPER` and `FROZEN_ORDER_KEEPER` roles
4. Deploy new `MockOracleProvider` owned by keeper (or add `transferOwnership`)
5. Update keeper `.env` with new private key

**Benefits:**
- ✅ No external transactions interfering with nonces
- ✅ Safe concurrent order execution
- ✅ Cleaner separation of concerns (deployer vs keeper)
- ✅ Easier monitoring and debugging
- ✅ Can implement nonce manager for true concurrent execution

**Implementation with dedicated address:**
```python
class OrderKeeper:
    def __init__(self):
        self.nonce_lock = asyncio.Lock()
        self.current_nonce = None

    async def get_next_nonce(self):
        """Thread-safe nonce for concurrent execution"""
        async with self.nonce_lock:
            if self.current_nonce is None:
                self.current_nonce = self.w3.eth.get_transaction_count(...)
            nonce = self.current_nonce
            self.current_nonce += 1
            return nonce

    async def handle_order_created(self, event_data):
        # ... order processing ...
        if order_class == 'MARKET':
            # Execute in background (non-blocking)
            asyncio.create_task(self.execute_order(order_key, order))
```

**Concurrent execution with dedicated address:**
```
Time 0s:   Order A and Order B arrive simultaneously
Time 0s:   Order A gets nonce 100, advances to 101
Time 0s:   Order B gets nonce 101, advances to 102
Time 0s:   Both start executing in parallel
Time 4s:   Both complete (4s instead of 8s!)
```

### Option B: Keep Shared Address, Optimize Sequential

**If dedicated address is not feasible, optimize current approach:**

1. **Cache blockchain calls** (doesn't help with nonce, but reduces latency)
2. **Pipeline preparation** (fetch order details while previous order executes)
3. **Batch multiple orders** (execute all market orders from a block together)

**Implementation:**
```python
async def handle_order_created(self, event_data):
    # Prepare order in background while previous executes
    order = await self.fetch_order_details(order_key)
    order_class = self.classify_order(order)

    if order_class == 'MARKET':
        self.market_orders[order_key] = order
        # Trigger batch execution if not already running
        if not self.batch_execution_running:
            asyncio.create_task(self.process_market_orders_batch())
```

## Performance Comparison

### Current (Sequential)
- 1 order: ~4s
- 2 orders: ~8s
- 3 orders: ~12s
- 10 orders: ~40s

### With Concurrent Execution (Dedicated Address)
- 1 order: ~4s
- 2 orders: ~4s (parallel)
- 3 orders: ~4s (parallel)
- 10 orders: ~4-8s (limited by RPC rate limits)

## Implementation Steps for Dedicated Keeper Address

### 1. Create and Fund Keeper Address
```bash
# Generate new wallet
# Get address and private key
# Send 0.1 ETH to new address for gas
```

### 2. Grant Roles
```bash
npx hardhat run scripts/grant-keeper-roles.js --network arbitrumSepolia
```

Script already exists at: `scripts/grant-keeper-roles.js`
Already configured with keeper address: `0xB9438AeD3ff32E30737268ae0f835217E79a76F5`

### 3. Handle MockOracleProvider Ownership

**Current problem:** `MockOracleProvider` uses `onlyOwner` modifier for `setPriceWithPrecision()`

**Option A: Add transferOwnership to contract**
```solidity
// Add to MockOracleProvider.sol
function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "new owner is zero address");
    owner = newOwner;
}
```
Then deploy and transfer ownership to keeper.

**Option B: Deploy new MockOracleProvider from keeper address**
```bash
# Export keeper private key
export PRIVATE_KEY=<keeper_private_key>

# Deploy MockOracleProvider (keeper will be owner)
npx hardhat run scripts/deploy-mock-oracle.js --network arbitrumSepolia

# Configure in DataStore
npx hardhat run scripts/configure-oracle-provider.js --network arbitrumSepolia
```

**Option C: Keep deployer as MockOracleProvider owner**
- Keeper still gets "nonce too low" errors on price updates
- Not recommended

### 4. Update Keeper Configuration
```bash
# Edit keeper/.env
UPDATER_PRIVATE_KEY=<new_keeper_private_key>

# If using new MockOracleProvider, update keeper/order_keeper_v2.py
self.MOCK_PROVIDER = "0xNEW_MOCK_ORACLE_PROVIDER_ADDRESS"
```

### 5. Implement Concurrent Execution
```python
# In order_keeper_v2.py

# Add nonce manager back
def __init__(self):
    # ...
    self.nonce_lock = asyncio.Lock()
    self.current_nonce = None

async def get_next_nonce(self):
    async with self.nonce_lock:
        if self.current_nonce is None:
            self.current_nonce = self.w3.eth.get_transaction_count(...)
        nonce = self.current_nonce
        self.current_nonce += 1
        return nonce

# Enable concurrent execution
async def handle_order_created(self, event_data):
    # ...
    if order_class == 'MARKET':
        # Execute in background (non-blocking)
        asyncio.create_task(self.execute_order(order_key, order))
    # Listener continues immediately
```

### 6. Test Thoroughly
```bash
# Test 1: Single order execution
# Expected: Works as before (~4s)

# Test 2: Two orders quickly
# Expected: Both execute in ~4s total (concurrent)

# Test 3: Many orders
# Expected: Limited by RPC rate limits, not execution time

# Test 4: Conditional orders
# Expected: Trigger and execute concurrently
```

## Risk Assessment

### Risks with Concurrent Execution
1. **RPC rate limiting** - Too many parallel requests may be throttled
2. **Gas price volatility** - Concurrent txs may have different gas prices
3. **Nonce gaps** - If one tx fails, creates gap in nonces
4. **Debugging complexity** - Harder to trace issues with parallel execution

### Mitigations
1. **Rate limiting** - Implement semaphore to limit concurrent executions
2. **Unified gas pricing** - Use same gas price for all txs in a batch
3. **Retry logic** - Already implemented, handles nonce gaps
4. **Enhanced logging** - Add correlation IDs to track parallel executions

## Related Files

- `keeper/order_keeper_v2.py` - Main keeper implementation
- `scripts/grant-keeper-roles.js` - Role granting script (already configured)
- `contracts/oracle/MockOracleProvider.sol` - Needs transferOwnership for Option A
- `.env` - Keeper configuration

## Timeline

**Phase 1: Preparation** (1-2 hours)
- Create and fund dedicated keeper address
- Grant roles via existing script
- Deploy new MockOracleProvider or add transferOwnership

**Phase 2: Implementation** (2-3 hours)
- Re-implement nonce manager
- Enable concurrent execution
- Add enhanced logging

**Phase 3: Testing** (2-4 hours)
- Test single order execution
- Test concurrent execution
- Test under load
- Monitor for nonce issues

**Total estimated time:** 5-9 hours

## Decision Required

**Should we implement concurrent execution now or later?**

**Factors to consider:**
1. Current order volume (how often do multiple orders arrive?)
2. Urgency of sub-3s execution requirement
3. Availability of time for implementation and testing
4. Risk tolerance for added complexity

**Recommendation:** Implement when:
- Order volume increases (>10 orders/minute)
- Multiple users trading simultaneously
- Sub-3s execution becomes critical for user experience

Until then, sequential execution with shared deployer address is simpler and reliable.
