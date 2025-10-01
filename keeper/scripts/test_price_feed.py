"""
Test script to verify Socket.IO connection to Marks price feed server
Run: python test_price_feed.py
"""

import asyncio
import socketio
from datetime import datetime

# Socket.IO connection URL
SOCKET_URL = "https://marks-server-a58cc19eb539.herokuapp.com/"

# Pairs to subscribe to
PAIRS_TO_WATCH = ["USDTNGN"]

class PriceFeedTester:
    def __init__(self):
        # Create async Socket.IO client with more permissive settings
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=3,
            reconnection_delay=1,
            logger=True,
            engineio_logger=True,
            ssl_verify=False  # Disable SSL verification for Heroku
        )

        self.is_connected = False
        self.price_updates_received = 0

        # Register event handlers
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('price_update', self.on_price_update)
        self.sio.on('connect_error', self.on_connect_error)

    async def on_connect(self):
        """Called when connected to server"""
        print(f"\n✅ Connected to {SOCKET_URL}")
        print(f"   Socket ID: {self.sio.sid}")
        self.is_connected = True

        # Subscribe to pairs
        await self.subscribe_to_pairs()

    async def on_disconnect(self):
        """Called when disconnected from server"""
        print(f"\n❌ Disconnected from server")
        self.is_connected = False

    async def on_connect_error(self, data):
        """Called when connection error occurs"""
        print(f"\n❌ Connection error: {data}")

    async def on_price_update(self, data):
        """Called when price update is received"""
        self.price_updates_received += 1

        pair = data.get('pair')
        price_data = data.get('data', {})
        timestamp = data.get('timestamp')

        print(f"\n📊 Price Update #{self.price_updates_received}")
        print(f"   Pair: {pair}")
        print(f"   Price: {price_data.get('price')}")
        print(f"   Timestamp: {timestamp}")
        print(f"   24h Change: {price_data.get('price_change_24h_pct')}%")
        print(f"   OI Long: {price_data.get('open_interest_long')}")
        print(f"   OI Short: {price_data.get('open_interest_short')}")
        print(f"   Funding Rate: {price_data.get('funding_rate_long')}")
        print(f"   Volume: {price_data.get('cumulative_volume')}")
        print(f"   Received at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    async def subscribe_to_pairs(self):
        """Subscribe to all pairs in watch list"""
        print(f"\n📡 Subscribing to pairs...")

        for pair in PAIRS_TO_WATCH:
            try:
                # Emit subscribe event with callback
                response = await self.sio.call('subscribe', {'pair': pair}, timeout=10)
                print(f"   ✅ Subscribed to {pair}: {response}")
            except Exception as e:
                print(f"   ❌ Failed to subscribe to {pair}: {e}")

    async def connect(self):
        """Connect to the Socket.IO server"""
        print(f"🔌 Connecting to {SOCKET_URL}...")

        try:
            await self.sio.connect(
                SOCKET_URL,
                transports=['websocket'],
                wait_timeout=10,
                # Use localhost:3000 origin to match CORS allowed origins
                socketio_path='/socket.io',
                headers={
                    'Origin': 'http://localhost:3000'
                }
            )
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            print(f"   Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            raise

    async def disconnect(self):
        """Disconnect from server"""
        await self.sio.disconnect()

    async def run(self, duration=60):
        """Run the test for specified duration (seconds)"""
        try:
            # Connect
            await self.connect()

            # Wait for specified duration
            print(f"\n👂 Listening for price updates for {duration} seconds...")
            print(f"   Press Ctrl+C to stop early\n")
            await asyncio.sleep(duration)

            # Disconnect
            print(f"\n✅ Test completed successfully!")
            print(f"   Total price updates received: {self.price_updates_received}")
            await self.disconnect()

        except KeyboardInterrupt:
            print(f"\n\n⚠️  Interrupted by user")
            print(f"   Total price updates received: {self.price_updates_received}")
            await self.disconnect()
        except Exception as e:
            print(f"\n❌ Error during test: {e}")
            raise

async def main():
    """Main entry point"""
    print("=" * 60)
    print("    SOCKET.IO PRICE FEED TEST")
    print("=" * 60)

    tester = PriceFeedTester()

    # Run for 60 seconds (or until interrupted)
    await tester.run(duration=60)

if __name__ == "__main__":
    asyncio.run(main())
