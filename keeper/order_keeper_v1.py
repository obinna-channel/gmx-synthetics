"""
Order Keeper V1 - Event Detection + Order Details Fetching
This version detects orders and fetches their full details from DataStore
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

        # Contract addresses
        self.EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"
        self.DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
        self.ORDER_HANDLER = "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7"

        # Event signatures
        self.EVENT_LOG2_SIGNATURE = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5"
        self.ORDER_CREATED_HASH = Web3.keccak(text="OrderCreated").hex()

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
            }
        ]

        # Setup DataStore contract
        self.datastore = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.DATA_STORE),
            abi=self.datastore_abi
        )

        # Track orders
        self.market_orders = {}  # Orders to execute immediately
        self.conditional_orders = {}  # Orders to watch for triggers

        print(f"📡 Order Keeper V1 initialized")
        print(f"   EventEmitter: {self.EVENT_EMITTER}")
        print(f"   DataStore: {self.DATA_STORE}")
        print(f"   OrderHandler: {self.ORDER_HANDLER}")

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
            print(f"     Is Long: {order['isLong']}")
            print(f"     Trigger Price: {order['triggerPrice'] / 10**30:.4f}" if order['triggerPrice'] > 0 else "     Trigger Price: N/A (Market Order)")
            print(f"     Is Frozen: {order['isFrozen']}")

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
                print("   ⚡ This is a MARKET order - should be executed immediately!")
                self.market_orders[order_key] = order

                # In the real implementation, we would:
                # 1. Build oracle params
                # 2. Call OrderHandler.executeOrder()
                print("   📝 Added to market orders queue for execution")

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
        print(f"   Market Orders (pending execution): {len(self.market_orders)}")
        print(f"   Conditional Orders (watching): {len(self.conditional_orders)}")

    async def connect_and_subscribe(self):
        """Connect to WebSocket and subscribe to events"""

        print(f"\n🔌 Connecting to WebSocket...")

        ssl_context = ssl.create_default_context(cafile=certifi.where())

        async with websockets.connect(self.WS_URL, ssl=ssl_context) as ws:
            print("✅ Connected to WebSocket")

            # Subscribe to OrderCreated events
            subscription_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_subscribe",
                "params": [
                    "logs",
                    {
                        "address": self.EVENT_EMITTER,
                        "topics": [
                            self.EVENT_LOG2_SIGNATURE,
                            self.ORDER_CREATED_HASH,
                            None,  # Any order key
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
                print(f"✅ Subscribed to OrderCreated events")
                print(f"   Subscription ID: {subscription_id}")
            else:
                print(f"❌ Subscription failed: {response_data}")
                return

            print(f"\n👂 Listening for orders...")
            print("   Market orders will be queued for immediate execution")
            print("   Conditional orders will be added to watch list")
            print("-" * 60)

            # Listen for events
            while True:
                try:
                    message = await ws.recv()
                    data = json.loads(message)

                    if 'params' in data and 'result' in data['params']:
                        await self.handle_order_created(data['params']['result'])

                except websockets.exceptions.ConnectionClosed:
                    print("❌ WebSocket connection closed")
                    break
                except Exception as e:
                    print(f"❌ Error handling message: {e}")

    async def run(self):
        """Main entry point for the keeper"""

        print("=" * 60)
        print("      ORDER KEEPER V1 - DETECTION & CLASSIFICATION")
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
    print("\n🚀 Starting Order Keeper V1\n")
    asyncio.run(main())