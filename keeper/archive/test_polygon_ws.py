"""
Test Polygon.io WebSocket Connection for Real-Time Stock Trades
This script validates the connection to Polygon.io and subscribes to TSLA trades
"""

import asyncio
import json
import websockets
import ssl
import certifi
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

class PolygonStockFeed:
    def __init__(self, api_key, ticker):
        self.api_key = api_key
        self.ticker = ticker
        self.ws_url = "wss://socket.polygon.io/stocks"
        self.is_authenticated = False
        self.trade_count = 0

    async def connect_and_subscribe(self):
        """Connect to Polygon.io WebSocket and subscribe to ticker"""

        print(f"🔌 Connecting to Polygon.io WebSocket...")
        print(f"   Ticker: {self.ticker}")
        print(f"   URL: {self.ws_url}")
        print("-" * 60)

        # Create SSL context for secure connection
        ssl_context = ssl.create_default_context(cafile=certifi.where())

        async with websockets.connect(self.ws_url, ssl=ssl_context) as ws:
            print("✅ Connected to WebSocket")

            # Step 1: Wait for connection confirmation
            response = await ws.recv()
            conn_data = json.loads(response)
            print(f"📥 Connection response: {json.dumps(conn_data, indent=2)}")

            # Step 2: Authenticate
            auth_message = {
                "action": "auth",
                "params": self.api_key
            }

            print(f"\n🔐 Sending authentication...")
            await ws.send(json.dumps(auth_message))

            # Wait for auth response
            response = await ws.recv()
            auth_data = json.loads(response)
            print(f"📥 Auth response: {json.dumps(auth_data, indent=2)}")

            # Check for auth success
            if auth_data[0].get('status') == 'auth_success':
                print("✅ Authentication successful")
                self.is_authenticated = True
            else:
                print(f"❌ Authentication failed: {auth_data}")
                return

            # Step 3: Subscribe to ticker trades
            subscribe_message = {
                "action": "subscribe",
                "params": f"T.{self.ticker}"  # T = Trades
            }

            print(f"\n📡 Subscribing to {self.ticker} trades...")
            await ws.send(json.dumps(subscribe_message))

            # Wait for subscription confirmation
            response = await ws.recv()
            sub_data = json.loads(response)
            print(f"📥 Subscription response: {json.dumps(sub_data, indent=2)}")

            print(f"\n👂 Listening for {self.ticker} trade updates...")
            print("-" * 60)

            # Step 4: Listen for trade messages
            while True:
                try:
                    message = await ws.recv()
                    data = json.loads(message)

                    # Handle trade messages
                    for item in data:
                        if item.get('ev') == 'T':  # Trade event
                            self.handle_trade(item)
                        elif item.get('ev') == 'status':
                            print(f"📊 Status update: {item.get('message')}")
                        else:
                            print(f"📨 Other message: {item}")

                except websockets.exceptions.ConnectionClosed:
                    print("\n❌ WebSocket connection closed")
                    break
                except Exception as e:
                    print(f"\n❌ Error: {e}")
                    break

    def handle_trade(self, trade_data):
        """Handle incoming trade data"""
        self.trade_count += 1

        # Extract trade details
        symbol = trade_data.get('sym')  # Symbol
        price = trade_data.get('p')      # Price
        size = trade_data.get('s')       # Size
        timestamp_ns = trade_data.get('t')  # Timestamp in nanoseconds
        exchange = trade_data.get('x', 'N/A')  # Exchange ID
        conditions = trade_data.get('c', [])   # Trade conditions

        # Convert timestamp to readable format
        timestamp_ms = timestamp_ns / 1_000_000
        trade_time = datetime.fromtimestamp(timestamp_ms / 1000)

        # Print trade info
        print(f"\n💰 Trade #{self.trade_count}")
        print(f"   Symbol: {symbol}")
        print(f"   Price: ${price:.2f}")
        print(f"   Size: {size} shares")
        print(f"   Time: {trade_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
        print(f"   Exchange: {exchange}")
        if conditions:
            print(f"   Conditions: {conditions}")
        print(f"   Raw data: {json.dumps(trade_data, indent=2)}")


async def main():
    """Run the test"""

    # Get API key from environment
    api_key = os.getenv("POLYGON_API_KEY")

    if not api_key:
        print("❌ Error: POLYGON_API_KEY not found in .env file")
        print("   Please add your Polygon.io API key to .env:")
        print("   POLYGON_API_KEY=your_key_here")
        return

    print("=" * 60)
    print("   POLYGON.IO WEBSOCKET TEST - TSLA TRADES")
    print("=" * 60)
    print()

    # Create feed and connect
    feed = PolygonStockFeed(api_key, "TSLA")

    try:
        await feed.connect_and_subscribe()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
