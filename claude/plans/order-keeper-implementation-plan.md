# Order Keeper Implementation Plan - Event-First Architecture

**Project**: GMX V2 Fork Order Keeper
**Date**: September 2025
**Approach**: Event-driven, WebSocket-based real-time order execution

## Executive Summary

This document outlines a comprehensive implementation plan for an event-driven order keeper bot for the GMX V2 fork on Arbitrum Sepolia. The keeper will monitor order creation events in real-time via WebSockets and execute orders when their conditions are met, handling market orders, limit orders, stop-losses, and take-profit orders.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technical Requirements](#technical-requirements)
3. [Implementation Phases](#implementation-phases)
4. [Core Components](#core-components)
5. [Event Flow](#event-flow)
6. [Order Types & Execution Logic](#order-types--execution-logic)
7. [State Management](#state-management)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Performance Optimization](#performance-optimization)
10. [Testing Strategy](#testing-strategy)
11. [Deployment & Operations](#deployment--operations)
12. [Success Metrics](#success-metrics)

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Blockchain (Arbitrum Sepolia)            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │EventEmitter  │  │OrderHandler  │  │MockProvider  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │ WebSocket        │ RPC              │ RPC
          │ Events           │ Execution        │ Prices
          ↓                  ↓                  ↓
┌─────────────────────────────────────────────────────────────┐
│                      Order Keeper Bot                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Event Listener│→ │State Manager │→ │Order Executor│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Price Monitor │  │Gas Manager   │  │Health Check  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Event-First**: All state changes are driven by blockchain events
2. **Real-Time**: WebSocket connections for sub-second latency
3. **Stateless Execution**: Each order execution is independent
4. **Fail-Safe**: Automatic recovery from disconnections and errors
5. **Observable**: Comprehensive logging and metrics

## Technical Requirements

### Contract Addresses (Arbitrum Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| EventEmitter | `0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C` | Emits all order events |
| OrderHandler | `0x[TBD]` | Executes orders |
| DataStore | `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111` | Stores order data |
| MockOracleProvider | `0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5` | Provides prices |
| ExchangeRouter | `0x3B33708e9b8242999459EB9b4756C24c846e5936` | Creates orders |

### Technology Stack

- **Language**: Python 3.9+ (asyncio for concurrent operations)
- **Web3 Library**: web3.py v6+ with WebSocket support
- **WebSocket Client**: websockets library
- **Database**: Redis (optional, for state persistence)
- **Monitoring**: Prometheus + Grafana
- **Logging**: structlog for structured logging

### Infrastructure Requirements

- **RPC Provider**: WebSocket endpoint (Infura/Alchemy)
- **Server**: 2+ CPU cores, 4GB RAM minimum
- **Network**: Low-latency connection to RPC
- **Storage**: 10GB for logs and state

## Implementation Phases

### Phase 1: Core MVP (Week 1)

**Goal**: Build event listener and execute market orders

#### Tasks

- [x] Set up WebSocket connection to Arbitrum Sepolia
- [x] Subscribe to OrderCreated events from EventEmitter
- [x] Parse event data and extract order details
- [x] Implement market order detection
- [x] Execute market orders immediately
- [x] Basic error handling and logging

#### Deliverables

```python
class OrderKeeperMVP:
    """Minimal viable keeper - market orders only"""

    async def run(self):
        await asyncio.gather(
            self.listen_for_events(),      # WebSocket listener
            self.execute_market_orders(),  # Immediate execution
            self.heartbeat()              # Health monitoring
        )
```

#### Success Criteria

- Detects OrderCreated events within 1 second
- Executes market orders successfully
- Handles basic errors without crashing

### Phase 2: Conditional Orders (Week 2)

**Goal**: Add support for limit orders and stop-losses

#### Tasks

- [ ] Implement price monitoring from MockOracleProvider
- [ ] Build trigger condition evaluation logic
- [ ] Add order watching for conditional orders
- [ ] Implement limit order execution
- [ ] Implement stop-loss order execution
- [ ] Add take-profit order support

#### Deliverables

```python
class OrderKeeperWithConditionals(OrderKeeperMVP):
    """Adds limit/stop order support"""

    async def monitor_conditional_orders(self):
        while True:
            current_prices = await self.fetch_prices()
            executable_orders = self.evaluate_triggers(current_prices)

            for order in executable_orders:
                await self.execute_order(order)
```

#### Success Criteria

- Correctly evaluates trigger conditions
- Executes orders when price targets are met
- Manages watched order list efficiently

### Phase 3: Production Hardening (Week 3)

**Goal**: Make the keeper production-ready

#### Tasks

- [ ] Implement WebSocket auto-reconnection
- [ ] Add transaction retry logic with backoff
- [ ] Implement gas price optimization
- [ ] Add comprehensive monitoring and metrics
- [ ] Build alerting system for failures
- [ ] Add order execution history tracking
- [ ] Implement graceful shutdown

#### Deliverables

- Robust error recovery system
- Monitoring dashboard
- Alert configuration
- Deployment documentation

#### Success Criteria

- 99.9% uptime
- Automatic recovery from failures
- Complete observability
- Gas-efficient execution

## Core Components

### 1. Event Listener

**Purpose**: Subscribe to and process blockchain events

```python
class EventListener:
    def __init__(self, event_emitter_address, ws_url):
        self.event_emitter = event_emitter_address
        self.ws_url = ws_url
        self.handlers = {}

    async def connect(self):
        """Establish WebSocket connection"""
        self.ws = await websockets.connect(self.ws_url)

    async def subscribe_to_orders(self):
        """Subscribe to OrderCreated, OrderExecuted, OrderCancelled"""
        subscription = {
            "jsonrpc": "2.0",
            "method": "eth_subscribe",
            "params": ["logs", {
                "address": self.event_emitter,
                "topics": [EVENT_LOG2_SIGNATURE, ORDER_CREATED_HASH]
            }]
        }
        await self.ws.send(json.dumps(subscription))

    async def listen(self):
        """Main event loop"""
        while True:
            message = await self.ws.recv()
            await self.dispatch_event(message)
```

### 2. State Manager

**Purpose**: Track active orders and their states

```python
class StateManager:
    def __init__(self):
        self.active_orders = {}      # order_key -> Order
        self.watched_orders = {}     # Conditional orders
        self.executed_orders = set() # Completed orders

    def add_order(self, order_key, order_data):
        """Add new order to tracking"""
        if self.is_market_order(order_data):
            self.active_orders[order_key] = order_data
        else:
            self.watched_orders[order_key] = order_data

    def remove_order(self, order_key):
        """Remove executed/cancelled order"""
        self.active_orders.pop(order_key, None)
        self.watched_orders.pop(order_key, None)
        self.executed_orders.add(order_key)
```

### 3. Order Executor

**Purpose**: Execute orders on-chain

```python
class OrderExecutor:
    def __init__(self, order_handler_address, mock_provider_address):
        self.order_handler = order_handler_address
        self.mock_provider = mock_provider_address

    async def execute_order(self, order_key, order_data):
        """Execute order with proper oracle params"""

        # Build oracle parameters
        oracle_params = self.build_oracle_params(order_data)

        # Estimate gas
        gas_estimate = await self.estimate_gas(order_key, oracle_params)

        # Build transaction
        tx = await self.build_transaction(
            order_key,
            oracle_params,
            gas_estimate
        )

        # Sign and send
        signed_tx = self.sign_transaction(tx)
        tx_hash = await self.send_transaction(signed_tx)

        # Wait for confirmation
        receipt = await self.wait_for_receipt(tx_hash)

        return receipt
```

### 4. Price Monitor

**Purpose**: Track prices for conditional order evaluation

```python
class PriceMonitor:
    def __init__(self, mock_provider_address):
        self.provider = mock_provider_address
        self.price_cache = {}

    async def get_current_price(self, token):
        """Fetch current price from MockOracleProvider"""
        price = await self.provider.functions.prices(token).call()
        return price['min']  # Use min price (same as max in mock)

    async def check_trigger_condition(self, order, current_price):
        """Evaluate if order should execute"""
        if order.type == OrderType.LimitIncrease:
            if order.is_long:
                return current_price <= order.trigger_price
            else:
                return current_price >= order.trigger_price
        # ... other order types
```

## Event Flow

### Order Creation Flow

```
User → ExchangeRouter.createOrder()
         ↓
    OrderUtils.createOrder()
         ↓
    EventEmitter.emitEventLog2("OrderCreated")
         ↓
    WebSocket Event
         ↓
    Order Keeper receives event
         ↓
    Parse order details
         ↓
    Is Market Order?
         ├─ Yes → Execute immediately
         └─ No → Add to watch list
```

### Order Execution Flow

```
Order Keeper detects executable order
         ↓
    Fetch oracle prices
         ↓
    Build oracle params
         ↓
    Call OrderHandler.executeOrder()
         ↓
    EventEmitter.emitEventLog2("OrderExecuted")
         ↓
    Order Keeper receives event
         ↓
    Remove from active orders
```

## Order Types & Execution Logic

### Market Orders

- **Detection**: `order.type == OrderType.MarketIncrease || OrderType.MarketDecrease`
- **Execution**: Immediate upon detection
- **Price**: Current oracle price

### Limit Orders

#### Limit Increase (Long)
- **Condition**: `current_price <= trigger_price`
- **Use Case**: Buy when price drops to target

#### Limit Increase (Short)
- **Condition**: `current_price >= trigger_price`
- **Use Case**: Short when price rises to target

#### Limit Decrease (Long)
- **Condition**: `current_price >= trigger_price`
- **Use Case**: Take profit when price rises

#### Limit Decrease (Short)
- **Condition**: `current_price <= trigger_price`
- **Use Case**: Take profit when price drops

### Stop-Loss Orders

#### Stop-Loss (Long)
- **Condition**: `current_price <= trigger_price`
- **Use Case**: Exit long when price drops

#### Stop-Loss (Short)
- **Condition**: `current_price >= trigger_price`
- **Use Case**: Exit short when price rises

## State Management

### Order States

```python
class OrderState(Enum):
    PENDING = "pending"           # Just created
    WATCHING = "watching"         # Conditional, monitoring
    EXECUTING = "executing"       # Currently executing
    EXECUTED = "executed"         # Successfully executed
    FAILED = "failed"            # Execution failed
    CANCELLED = "cancelled"       # User cancelled
```

### State Transitions

```
PENDING → WATCHING (conditional orders)
PENDING → EXECUTING (market orders)
WATCHING → EXECUTING (trigger met)
EXECUTING → EXECUTED (success)
EXECUTING → FAILED (error)
ANY → CANCELLED (user action)
```

### State Persistence (Optional)

```python
# Redis for state persistence across restarts
class RedisStateManager(StateManager):
    def __init__(self, redis_client):
        super().__init__()
        self.redis = redis_client

    async def save_order(self, order_key, order_data):
        await self.redis.hset(
            "orders",
            order_key,
            json.dumps(order_data)
        )

    async def load_orders(self):
        orders = await self.redis.hgetall("orders")
        for key, data in orders.items():
            self.add_order(key, json.loads(data))
```

## Error Handling & Recovery

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| WebSocket disconnection | Network issues | Auto-reconnect with exponential backoff |
| Order not found | Already executed | Remove from state, log |
| Insufficient gas | Gas estimate too low | Retry with 20% higher gas |
| Oracle price missing | Provider not updated | Wait and retry, alert if persistent |
| Transaction revert | Order conditions not met | Log and skip |
| Nonce too low | Previous tx pending | Wait for pending tx or replace |

### Recovery Strategy

```python
class ResilientOrderKeeper:
    async def run_with_recovery(self):
        while True:
            try:
                await self.run()
            except WebSocketException:
                await self.reconnect_websocket()
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                await asyncio.sleep(5)

    async def reconnect_websocket(self):
        """Reconnect with exponential backoff"""
        delay = 1
        while True:
            try:
                await self.connect()
                await self.resync_state()
                break
            except:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)
```

## Performance Optimization

### Latency Optimization

1. **Geographic Proximity**: Host near RPC endpoint
2. **Connection Pooling**: Reuse WebSocket connections
3. **Concurrent Execution**: Process independent orders in parallel
4. **Price Caching**: Cache prices for short duration (1-2 seconds)

### Resource Optimization

```python
# Efficient order evaluation
class OptimizedPriceMonitor:
    async def evaluate_orders(self):
        # Group orders by token to minimize price fetches
        orders_by_token = self.group_orders_by_token()

        for token, orders in orders_by_token.items():
            price = await self.get_price(token)

            # Evaluate all orders for this token
            for order in orders:
                if self.should_execute(order, price):
                    await self.queue_for_execution(order)
```

### Gas Optimization

```python
class GasManager:
    def __init__(self):
        self.base_gas_price = None
        self.max_gas_price = Web3.toWei(50, 'gwei')

    async def get_optimal_gas_price(self):
        """Dynamic gas pricing with cap"""
        current = await self.w3.eth.gas_price

        # Add small premium for faster inclusion
        optimal = int(current * 1.1)

        # Cap at maximum
        return min(optimal, self.max_gas_price)
```

## Testing Strategy

### Unit Tests

```python
# Test trigger evaluation
def test_limit_order_trigger():
    order = create_limit_order(
        trigger_price=1000,
        is_long=True
    )

    assert should_execute(order, current_price=999) == True
    assert should_execute(order, current_price=1001) == False
```

### Integration Tests

```python
# Test with local Arbitrum fork
async def test_order_execution():
    # Deploy contracts on fork
    contracts = await deploy_test_contracts()

    # Create keeper
    keeper = OrderKeeper(contracts)

    # Create test order
    order_key = await create_test_order()

    # Run keeper
    await keeper.process_order(order_key)

    # Verify execution
    assert await is_order_executed(order_key)
```

### End-to-End Tests

1. Deploy on testnet
2. Create various order types
3. Verify execution conditions
4. Test error scenarios
5. Validate recovery mechanisms

## Deployment & Operations

### Configuration

```yaml
# config.yaml
network:
  ws_url: "wss://arbitrum-sepolia.infura.io/ws/v3/${INFURA_KEY}"
  http_url: "https://arbitrum-sepolia.infura.io/v3/${INFURA_KEY}"
  chain_id: 421614

contracts:
  event_emitter: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"
  order_handler: "0x..."
  data_store: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
  mock_provider: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"

keeper:
  private_key: "${KEEPER_PRIVATE_KEY}"
  max_gas_price: 50000000000  # 50 gwei
  execution_interval: 1  # seconds

monitoring:
  prometheus_port: 9090
  log_level: "INFO"
```

### Deployment Steps

1. **Environment Setup**
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configuration**
   ```bash
   cp config.example.yaml config.yaml
   # Edit config.yaml with your values
   export KEEPER_PRIVATE_KEY="your-private-key"
   export INFURA_KEY="your-infura-key"
   ```

3. **Run Keeper**
   ```bash
   python order_keeper.py --config config.yaml
   ```

4. **Docker Deployment**
   ```dockerfile
   FROM python:3.9
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   CMD ["python", "order_keeper.py"]
   ```

### Monitoring

```python
# Prometheus metrics
class Metrics:
    orders_detected = Counter('orders_detected_total')
    orders_executed = Counter('orders_executed_total')
    orders_failed = Counter('orders_failed_total')
    execution_latency = Histogram('execution_latency_seconds')
    gas_used = Histogram('gas_used_wei')
```

### Alerting Rules

```yaml
# alerts.yaml
- alert: KeeperDown
  expr: up{job="order_keeper"} == 0
  for: 5m

- alert: HighFailureRate
  expr: rate(orders_failed_total[5m]) > 0.1
  for: 10m

- alert: LowBalance
  expr: keeper_wallet_balance < 0.1
  for: 5m
```

## Success Metrics

### Key Performance Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| Detection Latency | < 1 second | Time from event to detection |
| Execution Latency | < 5 seconds | Time from trigger to execution |
| Success Rate | > 95% | Successful executions / attempts |
| Uptime | > 99.9% | Keeper availability |
| Gas Efficiency | < 110% estimate | Actual gas / estimated gas |

### Monitoring Dashboard

```
┌──────────────────────────────────────┐
│         Order Keeper Dashboard        │
├──────────────────────────────────────┤
│ Orders Detected:     1,234           │
│ Orders Executed:     1,180           │
│ Success Rate:        95.6%           │
│ Avg Latency:         2.3s            │
│ Gas Spent:           0.45 ETH        │
│ Wallet Balance:      1.23 ETH        │
│ Uptime:              99.95%          │
│ Last Error:          2 hours ago     │
└──────────────────────────────────────┘
```

## Risk Management

### Operational Risks

1. **Private Key Security**: Use hardware wallet or KMS
2. **Gas Drain**: Implement spending limits
3. **Infinite Loops**: Add circuit breakers
4. **Malicious Orders**: Validate order parameters

### Financial Risks

1. **Gas Costs**: Monitor profitability
2. **MEV**: Consider private mempools
3. **Failed Transactions**: Track and minimize

## Conclusion

This event-driven order keeper implementation provides a robust, scalable solution for automated order execution on the GMX V2 fork. The phased approach allows for incremental development and testing, while the event-first architecture ensures low latency and clean state management.

### Next Steps

1. Implement Phase 1 MVP
2. Deploy to testnet
3. Run comprehensive tests
4. Monitor performance
5. Iterate based on results

### Resources

- [GMX V2 Documentation](https://docs.gmx.io)
- [Arbitrum Sepolia Explorer](https://sepolia.arbiscan.io)
- [Web3.py Documentation](https://web3py.readthedocs.io)
- [WebSocket API Specification](https://ethereum.org/en/developers/docs/apis/json-rpc/)

---

*This document is a living guide and will be updated as the implementation progresses.*

## Implementation Status Updates

### Update: September 25, 2025

#### Completed Items

**Phase 1: Core MVP ✅ COMPLETE**
- ✅ WebSocket connection to Arbitrum Sepolia established
  - `keeper/order_keeper_v2.py:672-751` - `connect_and_subscribe()` method
- ✅ OrderCreated event subscription working
  - `keeper/order_keeper_v2.py:683-719` - Event subscription setup
- ✅ Event parsing and order detail extraction from DataStore
  - `keeper/order_keeper_v2.py:223-340` - `fetch_order_details()` method
- ✅ Market order detection and classification
  - `keeper/order_keeper_v2.py:342-369` - `classify_order()` method
- ✅ Immediate market order execution with retry logic
  - `keeper/order_keeper_v2.py:462-556` - `execute_order()` method with retry
- ✅ Error handling with exponential backoff
  - `keeper/order_keeper_v2.py:535-539` - Exponential backoff implementation
- ✅ Transaction signing and gas estimation
  - `keeper/order_keeper_v2.py:442-509` - Gas estimation and transaction building

**Phase 2: Conditional Orders (Partial)**
- ✅ Order classification system (Market vs Conditional)
  - `keeper/order_keeper_v2.py:588-619` - Classification in `handle_order_created()`
- ✅ Conditional order detection and storage
  - `keeper/order_keeper_v2.py:196-197` - `conditional_orders` dictionary
  - `keeper/order_keeper_v2.py:600-616` - Storage logic
- ✅ Trigger condition identification for limits/stops
  - `keeper/order_keeper_v2.py:605-614` - Trigger condition display
- ⏳ Price monitoring loop - NOT IMPLEMENTED
- ⏳ Trigger evaluation - NOT IMPLEMENTED
- ⏳ Conditional order execution - NOT IMPLEMENTED

**Additional Achievements**
- ✅ OrderExecuted and OrderCancelled event handling
  - `keeper/order_keeper_v2.py:630-641` - `handle_order_executed()`
  - `keeper/order_keeper_v2.py:642-670` - `handle_order_cancelled()`
- ✅ MockOracleProvider price updates before execution
  - `keeper/order_keeper_v2.py:371-415` - `update_mock_provider_prices()`
- ✅ Failed order tracking and management
  - `keeper/order_keeper_v2.py:199` - `failed_orders` dictionary
  - `keeper/order_keeper_v2.py:544-553` - Failed order handling
- ✅ Heroku deployment configuration
  - `keeper/Procfile` - Worker process definition
  - `keeper/runtime.txt` - Python version specification
  - `keeper/requirements.txt` - Dependencies
- ✅ Successfully deployed to Heroku as worker dyno
  - `keeper/README_HEROKU.md` - Deployment instructions
- ✅ Running continuously in production environment

#### Current State

**order_keeper_v2.py Status:**
- Fully functional for market order execution
- Detects all order types correctly
- Stores conditional orders but doesn't execute them
- Hardcoded prices for USDT ($1.00) and sNGN ($1/1500)
- Running on Heroku as a worker process

**What Works:**
1. Real-time event detection via WebSocket
2. Market order immediate execution
3. Order detail fetching from DataStore
4. Transaction execution with MockOracleProvider
5. Error recovery and retry logic
6. Multiple event type handling (Created/Executed/Cancelled)

**What's Missing:**
1. Price monitoring loop for conditional orders
2. Dynamic price fetching from external sources
3. Conditional order trigger evaluation
4. Execution of limit/stop-loss orders
5. Database persistence for state recovery
6. Production monitoring/metrics

#### Next Priority Tasks

1. **Implement Conditional Order Loop** (High Priority)
   - Add periodic price checking
   - Evaluate trigger conditions
   - Execute when conditions met

2. **Dynamic Price Integration** (Medium Priority)
   - Integrate real price feeds
   - Remove hardcoded values
   - Add price update frequency control

3. **State Persistence** (Medium Priority)
   - Add Redis/database for order state
   - Implement recovery after restarts
   - Track execution history

4. **Production Monitoring** (Low Priority)
   - Add Prometheus metrics
   - Create monitoring dashboard
   - Set up alerting