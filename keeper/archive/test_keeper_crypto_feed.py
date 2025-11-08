"""
Test just the crypto price feed connection (same as keeper uses)
"""

import asyncio
import socketio
from datetime import datetime

PRICE_FEED_URL = "https://marks-server-a58cc19eb539.herokuapp.com/"
PAIR = "USDTNGN"

# Shared cache (like in keeper)
price_cache = {}
price_update_queue = asyncio.Queue()

async def test():
    print(f"Testing crypto feed connection (as used by keeper)")
    print(f"URL: {PRICE_FEED_URL}")
    print(f"Pair: {PAIR}")
    print("="*60)

    # Create client exactly as keeper does
    sio = socketio.AsyncClient(
        reconnection=True,
        reconnection_attempts=5,
        reconnection_delay=2,
        logger=False,
        engineio_logger=False,
        ssl_verify=False
    )

    update_count = 0

    @sio.on('connect')
    async def on_connect():
        print(f"\n✅ Connected - Socket ID: {sio.sid}")

    @sio.on('disconnect')
    async def on_disconnect():
        print(f"\n⚠️  Disconnected")

    @sio.on('price_update')
    async def on_price_update(data):
        nonlocal update_count
        update_count += 1

        pair = data.get('pair')
        price_data = data.get('data', {})
        timestamp = data.get('timestamp')
        price = price_data.get('price')

        # Update cache (like keeper does)
        price_cache[pair] = {
            'price': price,
            'timestamp': timestamp,
            'data': price_data
        }

        time_str = datetime.now().strftime('%H:%M:%S')
        print(f"[{time_str}] Update #{update_count}: {pair} = {price}")

        # Put in queue (like keeper does)
        await price_update_queue.put((pair, price))

    @sio.on('connect_error')
    async def on_connect_error(data):
        print(f"\n❌ Connection Error: {data}")

    try:
        # Connect (exactly as keeper does)
        print(f"\n🔌 Connecting...")
        await sio.connect(
            PRICE_FEED_URL,
            transports=['websocket'],
            wait_timeout=10,
            socketio_path='/socket.io',
            headers={'Origin': 'http://localhost:3000'}
        )

        await asyncio.sleep(1)

        # Subscribe (exactly as keeper does)
        print(f"\n📡 Subscribing to {PAIR}...")
        response = await sio.call('subscribe', {'pair': PAIR}, timeout=10)
        print(f"   Response: {response}")

        print(f"\n👂 Listening for 3 minutes...\n")

        # Wait 3 minutes
        await asyncio.sleep(180)

        await sio.disconnect()

        print(f"\n{'='*60}")
        print(f"Total updates received: {update_count}")
        print(f"Expected: ~3 updates (one per minute)")

        if update_count < 2:
            print(f"\n⚠️  WARNING: Very few updates!")
            print(f"   This could explain why keeper isn't logging often")
        else:
            print(f"\n✅ Updates are working as expected")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
