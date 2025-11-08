"""
Test Event Listener for OrderCreated Events
This is a proof of concept to verify we can receive events from EventEmitter
"""

import asyncio
import json
import websockets
from web3 import Web3
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class OrderEventListener:
    def __init__(self, ws_url=None):
        """Initialize the event listener"""

        # Contract addresses
        self.EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"

        # WebSocket URL - you'll need to add your Infura/Alchemy key
        if ws_url:
            self.WS_URL = ws_url
        else:
            # Try to get from environment
            infura_key = os.getenv("INFURA_KEY")
            alchemy_key = os.getenv("ALCHEMY_KEY")

            if infura_key:
                self.WS_URL = f"wss://arbitrum-sepolia.infura.io/ws/v3/{infura_key}"
            elif alchemy_key:
                self.WS_URL = f"wss://arb-sepolia.g.alchemy.com/v2/{alchemy_key}"
            else:
                raise ValueError("Please provide WS_URL or set INFURA_KEY/ALCHEMY_KEY in .env")

        # Event signatures
        # EventLog2(address,string,string indexed,bytes32 indexed,bytes32 indexed,EventLogData)
        self.EVENT_LOG2_SIGNATURE = Web3.keccak(
            text="EventLog2(address,string,string,bytes32,bytes32,(address[],uint256[],int256[],bool[],bytes32[],bytes[],string[]))"
        ).hex()

        # Hash of "OrderCreated" string for filtering
        self.ORDER_CREATED_HASH = Web3.keccak(text="OrderCreated").hex()

        # Order type mappings
        self.ORDER_TYPES = {
            0: "MarketSwap",
            1: "LimitSwap",
            2: "MarketIncrease",
            3: "LimitIncrease",
            4: "MarketDecrease",
            5: "LimitDecrease",
            6: "StopLossDecrease",
            7: "Liquidation"
        }

        print(f"📡 Event Listener initialized")
        print(f"   EventEmitter: {self.EVENT_EMITTER}")
        print(f"   WebSocket URL: {self.WS_URL[:50]}...")
        print(f"   EventLog2 Signature: {self.EVENT_LOG2_SIGNATURE}")
        print(f"   OrderCreated Hash: {self.ORDER_CREATED_HASH}")

    async def connect_and_subscribe(self):
        """Connect to WebSocket and subscribe to events"""

        print(f"\n🔌 Connecting to WebSocket...")

        try:
            async with websockets.connect(self.WS_URL) as ws:
                print("✅ Connected to WebSocket")

                # Build subscription request
                subscription_request = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "eth_subscribe",
                    "params": [
                        "logs",
                        {
                            "address": self.EVENT_EMITTER,
                            "topics": [
                                self.EVENT_LOG2_SIGNATURE,  # EventLog2 signature
                                self.ORDER_CREATED_HASH,     # "OrderCreated" hash
                                None,                        # Any order key
                                None                         # Any account
                            ]
                        }
                    ]
                }

                print(f"📤 Sending subscription request...")
                print(f"   Filter: EventLog2 with eventName='OrderCreated'")

                # Send subscription
                await ws.send(json.dumps(subscription_request))

                # Get subscription response
                response = await ws.recv()
                response_data = json.loads(response)

                if 'result' in response_data:
                    subscription_id = response_data['result']
                    print(f"✅ Subscribed successfully!")
                    print(f"   Subscription ID: {subscription_id}")
                else:
                    print(f"❌ Subscription failed: {response_data}")
                    return

                print(f"\n👂 Listening for OrderCreated events...")
                print("   (Create an order on the exchange to see events)")
                print("-" * 60)

                # Listen for events
                while True:
                    try:
                        message = await ws.recv()
                        data = json.loads(message)

                        # Check if it's a subscription notification
                        if 'params' in data and 'result' in data['params']:
                            await self.handle_event(data['params']['result'])
                        else:
                            # Could be other messages like errors
                            print(f"📨 Other message: {data}")

                    except websockets.exceptions.ConnectionClosed:
                        print("❌ WebSocket connection closed")
                        break
                    except Exception as e:
                        print(f"❌ Error handling message: {e}")

        except Exception as e:
            print(f"❌ Connection error: {e}")
            print(f"   Make sure your WebSocket URL is correct")
            print(f"   Current URL: {self.WS_URL}")

    async def handle_event(self, event_data):
        """Parse and display OrderCreated event"""

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n🆕 ORDER CREATED EVENT at {timestamp}")
        print("=" * 60)

        # Parse event topics
        # topics[0] = EventLog2 signature (already filtered)
        # topics[1] = "OrderCreated" hash (already filtered)
        # topics[2] = order key (bytes32)
        # topics[3] = account (bytes32 - padded address)

        order_key = event_data['topics'][2]
        account_bytes32 = event_data['topics'][3]

        # Extract address from bytes32 (last 20 bytes)
        account = '0x' + account_bytes32[-40:]

        # Event metadata
        block_number = int(event_data['blockNumber'], 16)
        tx_hash = event_data['transactionHash']
        log_index = int(event_data['logIndex'], 16)

        print(f"📋 Order Details:")
        print(f"   Order Key: {order_key}")
        print(f"   Account: {account}")
        print(f"   Block: {block_number}")
        print(f"   TX Hash: {tx_hash}")
        print(f"   Log Index: {log_index}")

        # The 'data' field contains the EventLogData struct
        # This includes detailed order information but requires ABI decoding
        # For now, we'll just show we received it
        data_length = len(event_data['data'])
        print(f"   Data Length: {data_length} bytes")

        print(f"\n🔗 View on Arbiscan:")
        print(f"   https://sepolia.arbiscan.io/tx/{tx_hash}")

        print("-" * 60)

        # TODO: In the real keeper, we would:
        # 1. Decode the full order data from the 'data' field
        # 2. Fetch additional order details from DataStore
        # 3. Determine if it's a market order (execute immediately)
        # 4. Or if it's conditional (add to watch list)

        return {
            'order_key': order_key,
            'account': account,
            'block': block_number,
            'tx_hash': tx_hash
        }

    async def run(self):
        """Main entry point"""

        print("=" * 60)
        print("      ORDER EVENT LISTENER - TEST")
        print("=" * 60)

        # Run the listener with automatic reconnection
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
    """Run the test listener"""

    # Create listener
    listener = OrderEventListener()

    # Run it
    await listener.run()


if __name__ == "__main__":
    print("\n🚀 Starting Order Event Listener Test\n")

    # Check for required environment variables
    if not os.getenv("INFURA_KEY") and not os.getenv("ALCHEMY_KEY"):
        print("⚠️  No INFURA_KEY or ALCHEMY_KEY found in environment")
        print("   Please add one to your .env file:")
        print("   INFURA_KEY=your-key-here")
        print("   or")
        print("   ALCHEMY_KEY=your-key-here")
        print("")
        ws_url = input("Or enter WebSocket URL manually: ")
        if ws_url:
            listener = OrderEventListener(ws_url)
            asyncio.run(listener.run())
    else:
        asyncio.run(main())