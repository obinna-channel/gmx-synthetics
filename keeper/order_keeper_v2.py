"""
Order Keeper V2 - Event Detection + Order Execution
This version detects orders, fetches details, and executes them
"""

import asyncio
import json
import websockets
import ssl
import certifi
from web3 import Web3
from eth_abi import encode
from datetime import datetime
import os
from dotenv import load_dotenv
from enum import Enum

# Load environment variables
load_dotenv()

# Order Types from the contract
class OrderType(Enum):
    MarketSwap = 0
    LimitSwap = 1
    MarketIncrease = 2
    LimitIncrease = 3
    MarketDecrease = 4
    LimitDecrease = 5
    StopLossDecrease = 6
    Liquidation = 7
    StopIncrease = 8

class OrderKeeper:
    def __init__(self):
        """Initialize the order keeper with contract connections"""

        # Setup Web3
        infura_key = os.getenv("INFURA_KEY")
        alchemy_key = os.getenv("ALCHEMY_KEY")
        private_key = os.getenv("UPDATER_PRIVATE_KEY")

        if not private_key:
            raise ValueError("Please set PRIVATE_KEY in .env for executing transactions")

        if alchemy_key:
            self.HTTP_URL = f"https://arb-sepolia.g.alchemy.com/v2/{alchemy_key}"
            self.WS_URL = f"wss://arb-sepolia.g.alchemy.com/v2/{alchemy_key}"
        elif infura_key:
            self.HTTP_URL = f"https://arbitrum-sepolia.infura.io/v3/{infura_key}"
            self.WS_URL = f"wss://arbitrum-sepolia.infura.io/ws/v3/{infura_key}"
        else:
            raise ValueError("Please set INFURA_KEY or ALCHEMY_KEY in .env")

        # Setup Web3 for contract interactions
        self.w3 = Web3(Web3.HTTPProvider(self.HTTP_URL))

        # Setup account for transactions
        self.account = self.w3.eth.account.from_key(private_key)
        self.w3.eth.default_account = self.account.address

        # Contract addresses
        self.EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"
        self.DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
        self.ORDER_HANDLER = "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7"

        # Token addresses (Updated for mUSDTNGN/mUSD/mNGN market)
        self.mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"  # mUSD (long token)
        self.mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827"  # mNGN (short token)
        self.mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"  # mUSDTNGN (index token)

        # MockOracleProvider address (will be loaded from file if exists)
        self.MOCK_PROVIDER = self.load_mock_provider_address()

        # Price configuration (USD-based pricing for Market #9)
        # Exchange rate - single variable to control pricing
        self.EXCHANGE_RATE = 1500  # 1 USD = 1500 NGN

        # mUSDTNGN: The exchange rate itself
        # mUSD: Always 1 USD
        # mNGN: Calculated as 1/EXCHANGE_RATE USD
        self.PRICES = {
            self.mUSDTNGN: self.EXCHANGE_RATE * 10**12,     # Exchange rate with precision 30-18=12
            self.mUSD: 1 * 10**24,                          # 1 USD with precision 30-6=24
            self.mNGN: int((1 / self.EXCHANGE_RATE) * 10**12),  # 1/rate USD with precision 30-18=12
        }

        # Event signatures
        self.EVENT_LOG2_SIGNATURE = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5"
        self.ORDER_CREATED_HASH = Web3.keccak(text="OrderCreated").hex()
        self.ORDER_EXECUTED_HASH = Web3.keccak(text="OrderExecuted").hex()
        self.ORDER_CANCELLED_HASH = Web3.keccak(text="OrderCancelled").hex()

        # DataStore ABI for reading order data
        self.datastore_abi = [
            {
                "inputs": [{"name": "key", "type": "bytes32"}],
                "name": "getAddress",
                "outputs": [{"name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "key", "type": "bytes32"}],
                "name": "getUint",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "key", "type": "bytes32"}],
                "name": "getBool",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "key", "type": "bytes32"}],
                "name": "getBytes32",
                "outputs": [{"name": "", "type": "bytes32"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "setKey", "type": "bytes32"},
                    {"name": "value", "type": "bytes32"}
                ],
                "name": "containsBytes32",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]

        # OrderHandler ABI for execution
        self.order_handler_abi = [
            {
                "inputs": [
                    {"name": "key", "type": "bytes32"},
                    {
                        "name": "oracleParams",
                        "type": "tuple",
                        "components": [
                            {"name": "tokens", "type": "address[]"},
                            {"name": "providers", "type": "address[]"},
                            {"name": "data", "type": "bytes[]"}
                        ]
                    }
                ],
                "name": "executeOrder",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }
        ]

        # MockOracleProvider ABI for setting prices
        self.mock_provider_abi = [
            {
                "inputs": [
                    {"name": "token", "type": "address"},
                    {"name": "minPrice", "type": "uint256"},
                    {"name": "maxPrice", "type": "uint256"}
                ],
                "name": "setPrice",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "token", "type": "address"},
                    {"name": "price", "type": "uint256"}
                ],
                "name": "setPriceWithPrecision",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

        # Setup contracts
        self.datastore = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.DATA_STORE),
            abi=self.datastore_abi
        )

        self.order_handler = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.ORDER_HANDLER),
            abi=self.order_handler_abi
        )

        if self.MOCK_PROVIDER:
            self.mock_provider = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.MOCK_PROVIDER),
                abi=self.mock_provider_abi
            )
        else:
            self.mock_provider = None

        # Track orders
        self.market_orders = {}  # Orders to execute immediately
        self.conditional_orders = {}  # Orders to watch for triggers
        self.executing_orders = {}  # Orders currently being executed
        self.failed_orders = {}  # Orders that failed execution

        print(f"📡 Order Keeper V2 initialized")
        print(f"   Account: {self.account.address}")
        print(f"   EventEmitter: {self.EVENT_EMITTER}")
        print(f"   DataStore: {self.DATA_STORE}")
        print(f"   OrderHandler: {self.ORDER_HANDLER}")
        print(f"   MockProvider: {self.MOCK_PROVIDER if self.MOCK_PROVIDER else 'Not configured'}")

    def load_mock_provider_address(self):
        """Load MockOracleProvider address from deployment file"""
        # Using the deployed address directly
        return "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"

    def generate_order_data_key(self, order_key, field):
        """Generate the storage key for order data in DataStore"""
        # First, get the field constant hash: keccak256(abi.encode(FIELD_NAME))
        field_hash = Web3.keccak(encode(['string'], [field]))
        # Then combine with order key: keccak256(abi.encode(order_key, field_hash))
        storage_key = Web3.keccak(
            encode(['bytes32', 'bytes32'], [bytes.fromhex(order_key[2:]), field_hash])
        )
        return storage_key

    async def fetch_order_details(self, order_key):
        """Fetch complete order details from DataStore"""

        print(f"\n📄 Fetching order details for: {order_key}")

        order = {'key': order_key}

        try:
            # Fetch basic order data - using the UPPERCASE constants from OrderStoreUtils.sol
            fields = {
                'ACCOUNT': ('account', 'getAddress'),
                'RECEIVER': ('receiver', 'getAddress'),
                'CALLBACK_CONTRACT': ('callbackContract', 'getAddress'),
                'UI_FEE_RECEIVER': ('uiFeeReceiver', 'getAddress'),
                'MARKET': ('market', 'getAddress'),
                'INITIAL_COLLATERAL_TOKEN': ('initialCollateralToken', 'getAddress'),
                'ORDER_TYPE': ('orderType', 'getUint'),
                'SIZE_DELTA_USD': ('sizeDeltaUsd', 'getUint'),
                'INITIAL_COLLATERAL_DELTA_AMOUNT': ('initialCollateralDeltaAmount', 'getUint'),
                'TRIGGER_PRICE': ('triggerPrice', 'getUint'),
                'ACCEPTABLE_PRICE': ('acceptablePrice', 'getUint'),
                'EXECUTION_FEE': ('executionFee', 'getUint'),
                'CALLBACK_GAS_LIMIT': ('callbackGasLimit', 'getUint'),
                'MIN_OUTPUT_AMOUNT': ('minOutputAmount', 'getUint'),
                'UPDATED_AT_TIME': ('updatedAtTime', 'getUint'),
                'IS_LONG': ('isLong', 'getBool'),
                'SHOULD_UNWRAP_NATIVE_TOKEN': ('shouldUnwrapNativeToken', 'getBool'),
                'AUTO_CANCEL': ('autoCancel', 'getBool'),
                'IS_FROZEN': ('isFrozen', 'getBool')
            }

            for constant_name, (field_name, method_name) in fields.items():
                storage_key = self.generate_order_data_key(order_key, constant_name)

                # Call the appropriate getter method
                if method_name == 'getAddress':
                    value = self.datastore.functions.getAddress(storage_key).call()
                elif method_name == 'getUint':
                    value = self.datastore.functions.getUint(storage_key).call()
                elif method_name == 'getBool':
                    value = self.datastore.functions.getBool(storage_key).call()
                else:
                    value = None

                order[field_name] = value

            # Convert order type to enum
            order_type_int = order.get('orderType', 0)
            try:
                order['orderTypeName'] = OrderType(order_type_int).name
            except:
                order['orderTypeName'] = f"Unknown({order_type_int})"

            print(f"  ✅ Fetched order details:")
            print(f"     Type: {order['orderTypeName']}")
            print(f"     Market: {order['market']}")
            print(f"     Account: {order['account']}")
            print(f"     Size Delta USD: {order['sizeDeltaUsd'] / 10**30:.2f}")
            print(f"     Collateral Token: {order['initialCollateralToken']}")
            print(f"     Collateral Amount: {order['initialCollateralDeltaAmount']}")
            print(f"     Is Long: {order['isLong']}")
            print(f"     Acceptable Price: {order['acceptablePrice'] / 10**30:.6f}")
            print(f"     Min Output Amount: {order['minOutputAmount']}")
            print(f"     Trigger Price: {order['triggerPrice'] / 10**30:.4f}" if order['triggerPrice'] > 0 else "     Trigger Price: N/A (Market Order)")
            print(f"     Is Frozen: {order['isFrozen']}")

            # For decrease orders, check the current position
            if order['orderTypeName'] == 'MarketDecrease':
                print(f"\n     📍 Checking position before decrease:")
                position_key = Web3.keccak(
                    encode(
                        ['address', 'address', 'address', 'bool'],
                        [
                            Web3.to_checksum_address(order['account']),
                            Web3.to_checksum_address(order['market']),
                            Web3.to_checksum_address(order['initialCollateralToken']),
                            order['isLong']
                        ]
                    )
                )

                # Check if position exists
                POSITION_LIST = Web3.keccak(encode(['string'], ['POSITION_LIST']))
                position_exists = self.datastore.functions.containsBytes32(POSITION_LIST, position_key).call()

                if position_exists:
                    # Get position size
                    size_key = Web3.keccak(
                        encode(['bytes32', 'bytes32'], [
                            position_key,
                            Web3.keccak(encode(['string'], ['SIZE_IN_USD']))
                        ])
                    )
                    position_size = self.datastore.functions.getUint(size_key).call()

                    # Get collateral amount
                    collateral_key = Web3.keccak(
                        encode(['bytes32', 'bytes32'], [
                            position_key,
                            Web3.keccak(encode(['string'], ['COLLATERAL_AMOUNT']))
                        ])
                    )
                    collateral_amount = self.datastore.functions.getUint(collateral_key).call()

                    print(f"     Position Size: {position_size / 10**30:.2f} USD")
                    print(f"     Position Collateral: {collateral_amount / 10**6:.4f} mUSD")
                    print(f"     Attempting to decrease: {order['sizeDeltaUsd'] / 10**30:.2f} USD")

                    if position_size < order['sizeDeltaUsd']:
                        print(f"     ⚠️ WARNING: Trying to decrease more than position size!")
                else:
                    print(f"     ❌ No position found to decrease!")

            return order

        except Exception as e:
            print(f"  ❌ Error fetching order details: {e}")
            return None

    def classify_order(self, order):
        """Classify order as market (immediate execution) or conditional (wait for trigger)"""

        order_type = order.get('orderType', 0)

        # Market orders - execute immediately
        market_types = [
            OrderType.MarketSwap.value,
            OrderType.MarketIncrease.value,
            OrderType.MarketDecrease.value,
            OrderType.Liquidation.value
        ]

        # Conditional orders - wait for price trigger
        conditional_types = [
            OrderType.LimitSwap.value,
            OrderType.LimitIncrease.value,
            OrderType.LimitDecrease.value,
            OrderType.StopLossDecrease.value,
            OrderType.StopIncrease.value
        ]

        if order_type in market_types:
            return 'MARKET'
        elif order_type in conditional_types:
            return 'CONDITIONAL'
        else:
            return 'UNKNOWN'

    async def update_mock_provider_prices(self):
        """Update prices on MockOracleProvider"""
        if not self.mock_provider:
            print("  ⚠️  MockProvider not configured, skipping price update")
            return False

        print("\n📊 Updating MockOracleProvider prices...")

        try:
            for token_address, price in self.PRICES.items():
                # Build transaction
                # Get current gas price and add buffer
                current_gas_price = self.w3.eth.gas_price
                gas_price_with_buffer = int(current_gas_price * 1.2)  # 20% buffer

                tx = self.mock_provider.functions.setPriceWithPrecision(
                    Web3.to_checksum_address(token_address),
                    price
                ).build_transaction({
                    'from': self.account.address,
                    'nonce': self.w3.eth.get_transaction_count(self.account.address),
                    'gas': 100000,
                    'gasPrice': gas_price_with_buffer
                })

                # Sign and send
                signed_tx = self.account.sign_transaction(tx)
                tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)

                # Wait for confirmation
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

                if receipt.status == 1:
                    token_name = 'mUSD' if token_address.lower() == self.mUSD.lower() else \
                                 'mNGN' if token_address.lower() == self.mNGN.lower() else \
                                 'mUSDTNGN' if token_address.lower() == self.mUSDTNGN.lower() else 'Unknown'
                    # Display price in human-readable format (USD terms)
                    if token_name == 'mUSD':
                        usd_value = price / (10**24)  # Convert to USD
                        print(f"  ✅ {token_name} price updated: {usd_value:.2f} USD")
                    elif token_name == 'mNGN':
                        usd_value = price / (10**12)  # Convert to USD
                        print(f"  ✅ {token_name} price updated: {usd_value:.9f} USD")
                    elif token_name == 'mUSDTNGN':
                        rate_value = price / (10**12)  # Convert to exchange rate
                        print(f"  ✅ {token_name} price updated: {rate_value:.0f} (USDT/NGN rate)")
                    else:
                        print(f"  ✅ {token_name} price updated: {price}")
                else:
                    print(f"  ❌ Failed to update price for {token_address}")
                    return False

            return True

        except Exception as e:
            print(f"  ❌ Error updating prices: {e}")
            return False

    def build_oracle_params(self, order):
        """Build oracle parameters for order execution"""

        # Get unique tokens involved
        tokens = []

        # Always include market tokens for Market #9
        tokens.append(self.mUSDTNGN)  # Index token
        tokens.append(self.mUSD)      # Long token
        tokens.append(self.mNGN)      # Short token

        # Add collateral token if different and not already in list
        collateral_token = order.get('initialCollateralToken')
        if collateral_token and collateral_token not in tokens:
            tokens.append(collateral_token)

        # Build oracle params
        providers = [self.MOCK_PROVIDER] * len(tokens)
        data = ['0x'] * len(tokens)  # Empty data for mock provider

        return {
            'tokens': tokens,
            'providers': providers,
            'data': data
        }

    async def estimate_execution_gas(self, order_key, oracle_params):
        """Estimate gas for order execution"""
        try:
            # Estimate gas
            estimated = self.order_handler.functions.executeOrder(
                bytes.fromhex(order_key[2:]),
                oracle_params
            ).estimate_gas({
                'from': self.account.address,
                'value': 0  # No ETH value needed for order execution
            })

            # Add 20% buffer
            return int(estimated * 1.2)

        except Exception as e:
            print(f"  ⚠️  Gas estimation failed: {e}")
            # Return default gas limit
            return 3000000

    async def execute_order(self, order_key, order, retry_count=0, max_retries=3):
        """Execute an order with retry logic"""

        print(f"\n🚀 Executing Order (Attempt {retry_count + 1}/{max_retries})")
        print(f"   Order Key: {order_key}")
        print(f"   Type: {order['orderTypeName']}")

        # Move to executing
        self.executing_orders[order_key] = order
        if order_key in self.market_orders:
            del self.market_orders[order_key]

        try:
            # Step 1: Update prices on MockProvider
            if not await self.update_mock_provider_prices():
                raise Exception("Failed to update MockProvider prices")

            # Step 2: Build oracle params
            oracle_params = self.build_oracle_params(order)
            print(f"\n📝 Oracle params:")
            print(f"   Tokens: {oracle_params['tokens']}")
            print(f"   Providers: {oracle_params['providers'][:1]}... (all same)")

            # Step 3: Estimate gas
            gas_limit = await self.estimate_execution_gas(order_key, oracle_params)
            print(f"   Gas limit: {gas_limit}")

            # Step 4: Build transaction
            nonce = self.w3.eth.get_transaction_count(self.account.address)

            # Get current gas price and add buffer
            current_gas_price = self.w3.eth.gas_price
            gas_price_with_buffer = int(current_gas_price * 1.2)  # 20% buffer

            tx = self.order_handler.functions.executeOrder(
                bytes.fromhex(order_key[2:]),
                oracle_params
            ).build_transaction({
                'from': self.account.address,
                'nonce': nonce,
                'gas': gas_limit,
                'gasPrice': gas_price_with_buffer,
                'value': 0
            })

            # Step 5: Sign and send
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)

            print(f"\n📤 Transaction sent: {tx_hash.hex()}")
            print(f"   Waiting for confirmation...")

            # Step 6: Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt.status == 1:
                print(f"\n✅ Order executed successfully!")
                print(f"   Block: {receipt.blockNumber}")
                print(f"   Gas used: {receipt.gasUsed}")
                print(f"   View on Arbiscan: https://sepolia.arbiscan.io/tx/{tx_hash.hex()}")

                # Remove from executing
                if order_key in self.executing_orders:
                    del self.executing_orders[order_key]

                return receipt
            else:
                raise Exception(f"Transaction reverted - status: {receipt.status}")

        except Exception as e:
            print(f"\n❌ Execution failed: {e}")

            # Retry logic
            if retry_count < max_retries - 1:
                wait_time = 2 ** (retry_count + 1)  # 2s, 4s, 8s
                print(f"   ⏳ Retrying in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                return await self.execute_order(order_key, order, retry_count + 1, max_retries)
            else:
                print(f"   ❌ Max retries reached. Moving to failed orders.")

                # Move to failed orders
                self.failed_orders[order_key] = {
                    'order': order,
                    'error': str(e),
                    'attempts': max_retries,
                    'timestamp': datetime.now().isoformat()
                }

                # Remove from executing
                if order_key in self.executing_orders:
                    del self.executing_orders[order_key]

                return None

    async def process_market_orders(self):
        """Process pending market orders"""
        if not self.market_orders:
            return

        # Process orders one by one (could be parallelized in production)
        for order_key, order in list(self.market_orders.items()):
            await self.execute_order(order_key, order)

    async def handle_order_created(self, event_data):
        """Process OrderCreated event - fetch details and classify"""

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n🆕 ORDER CREATED EVENT at {timestamp}")
        print("=" * 60)

        # Extract order key and account
        order_key = event_data['topics'][2]
        account_bytes32 = event_data['topics'][3]
        account = '0x' + account_bytes32[-40:]

        print(f"📋 Event Data:")
        print(f"   Order Key: {order_key}")
        print(f"   Account: {account}")
        print(f"   Block: {int(event_data['blockNumber'], 16)}")
        print(f"   TX: {event_data['transactionHash']}")

        # Fetch full order details from DataStore
        order = await self.fetch_order_details(order_key)

        if order:
            # Classify the order
            order_class = self.classify_order(order)

            print(f"\n🎯 Order Classification: {order_class}")

            if order_class == 'MARKET':
                print("   ⚡ This is a MARKET order - will execute immediately!")
                self.market_orders[order_key] = order

                # Execute immediately
                await self.execute_order(order_key, order)

            elif order_class == 'CONDITIONAL':
                print("   ⏱️  This is a CONDITIONAL order - waiting for trigger conditions")
                self.conditional_orders[order_key] = order

                # Display trigger conditions
                if order['orderType'] == OrderType.LimitIncrease.value:
                    if order['isLong']:
                        print(f"   📈 Will execute when price <= {order['triggerPrice'] / 10**30:.4f}")
                    else:
                        print(f"   📉 Will execute when price >= {order['triggerPrice'] / 10**30:.4f}")
                elif order['orderType'] == OrderType.StopLossDecrease.value:
                    if order['isLong']:
                        print(f"   🛑 Stop loss will trigger when price <= {order['triggerPrice'] / 10**30:.4f}")
                    else:
                        print(f"   🛑 Stop loss will trigger when price >= {order['triggerPrice'] / 10**30:.4f}")

                print("   📝 Added to conditional orders watch list")

            else:
                print(f"   ❓ Unknown order type: {order['orderType']}")

        print("-" * 60)

        # Display current order counts
        print(f"\n📊 Order Keeper Status:")
        print(f"   Market Orders (pending): {len(self.market_orders)}")
        print(f"   Executing Orders: {len(self.executing_orders)}")
        print(f"   Conditional Orders: {len(self.conditional_orders)}")
        print(f"   Failed Orders: {len(self.failed_orders)}")

    async def handle_order_executed(self, event_data):
        """Handle OrderExecuted event"""
        order_key = event_data['topics'][2]
        print(f"\n✅ ORDER EXECUTED EVENT")
        print(f"   Order Key: {order_key}")

        # Clean up from tracking
        if order_key in self.executing_orders:
            del self.executing_orders[order_key]
        if order_key in self.conditional_orders:
            del self.conditional_orders[order_key]

    async def handle_order_cancelled(self, event_data):
        """Handle OrderCancelled event"""
        order_key = event_data['topics'][2]
        print(f"\n❌ ORDER CANCELLED EVENT")
        print(f"   Order Key: {order_key}")
        print(f"   Block: {int(event_data['blockNumber'], 16)}")
        print(f"   TX: {event_data['transactionHash']}")

        # Decode the cancellation reason from event data
        if 'data' in event_data and event_data['data'] != '0x':
            print(f"\n📊 Cancellation Details:")
            print(f"   Raw event data: {event_data['data'][:200]}...")

            # Try to decode the event data
            try:
                # The data contains reason codes and values
                data = event_data['data'][2:]  # Remove 0x
                if len(data) >= 128:
                    # First 64 chars might be reason bytes
                    reason_bytes = data[:64]
                    print(f"   Reason bytes: 0x{reason_bytes}")
            except Exception as e:
                print(f"   Could not decode: {e}")

        # Clean up from tracking
        for queue in [self.market_orders, self.executing_orders, self.conditional_orders]:
            if order_key in queue:
                print(f"   Removed from: {queue.__class__.__name__}")
                del queue[order_key]

    async def connect_and_subscribe(self):
        """Connect to WebSocket and subscribe to events"""

        print(f"\n🔌 Connecting to WebSocket...")

        ssl_context = ssl.create_default_context(cafile=certifi.where())

        async with websockets.connect(self.WS_URL, ssl=ssl_context) as ws:
            print("✅ Connected to WebSocket")

            # Subscribe to multiple events
            subscriptions = [
                (self.ORDER_CREATED_HASH, "OrderCreated"),
                (self.ORDER_EXECUTED_HASH, "OrderExecuted"),
                (self.ORDER_CANCELLED_HASH, "OrderCancelled")
            ]

            subscription_ids = {}

            for event_hash, event_name in subscriptions:
                subscription_request = {
                    "jsonrpc": "2.0",
                    "id": len(subscription_ids) + 1,
                    "method": "eth_subscribe",
                    "params": [
                        "logs",
                        {
                            "address": self.EVENT_EMITTER,
                            "topics": [
                                self.EVENT_LOG2_SIGNATURE,
                                event_hash,
                                None,  # Any key
                                None   # Any account
                            ]
                        }
                    ]
                }

                await ws.send(json.dumps(subscription_request))
                response = await ws.recv()
                response_data = json.loads(response)

                if 'result' in response_data:
                    subscription_id = response_data['result']
                    subscription_ids[subscription_id] = event_name
                    print(f"✅ Subscribed to {event_name} events")
                else:
                    print(f"❌ Failed to subscribe to {event_name}: {response_data}")

            print(f"\n👂 Listening for orders...")
            print("   Market orders will be executed immediately")
            print("   Conditional orders will be added to watch list")
            print("-" * 60)

            # Listen for events
            while True:
                try:
                    message = await ws.recv()
                    data = json.loads(message)

                    if 'params' in data and 'result' in data['params']:
                        event_data = data['params']['result']

                        # Determine event type by topic
                        if len(event_data.get('topics', [])) > 1:
                            event_topic = event_data['topics'][1]

                            if event_topic == self.ORDER_CREATED_HASH:
                                await self.handle_order_created(event_data)
                            elif event_topic == self.ORDER_EXECUTED_HASH:
                                await self.handle_order_executed(event_data)
                            elif event_topic == self.ORDER_CANCELLED_HASH:
                                await self.handle_order_cancelled(event_data)

                except websockets.exceptions.ConnectionClosed:
                    print("❌ WebSocket connection closed")
                    break
                except Exception as e:
                    print(f"❌ Error handling message: {e}")

    async def run(self):
        """Main entry point for the keeper"""

        print("=" * 60)
        print("       ORDER KEEPER V2 - WITH EXECUTION")
        print("=" * 60)

        while True:
            try:
                await self.connect_and_subscribe()
            except KeyboardInterrupt:
                print("\n👋 Shutting down...")
                break
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                print("⏳ Retrying in 5 seconds...")
                await asyncio.sleep(5)


async def main():
    """Run the order keeper"""
    keeper = OrderKeeper()
    await keeper.run()


if __name__ == "__main__":
    print("\n🚀 Starting Order Keeper V2\n")
    asyncio.run(main())