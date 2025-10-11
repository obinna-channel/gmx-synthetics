"""
Test script to measure NGN/USDTNGN price update frequency
"""

import asyncio
import socketio
from datetime import datetime
import statistics

# Configuration
MARKS_SERVER_URL = "https://marks-server-a58cc19eb539.herokuapp.com/"
TEST_PAIR = "USDTNGN"
TEST_DURATION = 180  # Run for 3 minutes

# Track updates
updates = []
last_update_time = None

async def test_update_frequency():
    """Test how frequently we receive price updates"""
    global last_update_time

    print("\n" + "="*60)
    print("NGN Price Feed Frequency Test")
    print("="*60)
    print(f"Server: {MARKS_SERVER_URL}")
    print(f"Pair: {TEST_PAIR}")
    print(f"Duration: {TEST_DURATION} seconds")
    print("="*60)

    # Create Socket.IO client
    sio = socketio.AsyncClient(
        reconnection=False,
        logger=False,
        engineio_logger=False,
        ssl_verify=False
    )

    @sio.on('connect')
    async def on_connect():
        print(f"\n✅ Connected to server")
        print(f"   Socket ID: {sio.sid}")
        print(f"   Time: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")

    @sio.on('disconnect')
    async def on_disconnect():
        print(f"\n⚠️  Disconnected from server")

    @sio.on('price_update')
    async def on_price_update(data):
        global last_update_time

        current_time = datetime.now()
        pair = data.get('pair')
        price_data = data.get('data', {})
        price = price_data.get('price')

        # Calculate time since last update
        time_delta = None
        if last_update_time:
            time_delta = (current_time - last_update_time).total_seconds()

        last_update_time = current_time

        # Store update info
        updates.append({
            'time': current_time,
            'price': price,
            'delta': time_delta
        })

        # Log the update
        time_str = current_time.strftime('%H:%M:%S.%f')[:-3]
        delta_str = f"(+{time_delta:.2f}s)" if time_delta else "(first)"

        print(f"[{time_str}] {delta_str:12} {pair}: {price:.4f}")

    try:
        # Connect
        print(f"\n🔌 Connecting...")
        await sio.connect(
            MARKS_SERVER_URL,
            transports=['websocket'],
            wait_timeout=10,
            socketio_path='/socket.io'
        )

        # Wait for connection
        await asyncio.sleep(1)

        # Subscribe
        print(f"\n📡 Subscribing to {TEST_PAIR}...")
        response = await sio.call('subscribe', {'pair': TEST_PAIR}, timeout=10)
        print(f"   Response: {response}")

        if response and response.get('status') == 'subscribed':
            print(f"\n✅ Subscribed successfully")
        else:
            print(f"\n⚠️  Unexpected subscription response")

        print(f"\n👂 Listening for price updates...\n")
        print(f"{'Time':^15} {'Interval':^12} {'Pair':^10} {'Price':>10}")
        print("-" * 60)

        # Wait for test duration
        await asyncio.sleep(TEST_DURATION)

        # Disconnect
        await sio.disconnect()

        # Calculate statistics
        print("\n" + "="*60)
        print("RESULTS")
        print("="*60)

        if len(updates) > 1:
            deltas = [u['delta'] for u in updates if u['delta'] is not None]

            print(f"\nTotal Updates: {len(updates)}")
            print(f"Test Duration: {TEST_DURATION} seconds")
            print(f"Average Update Rate: {len(updates) / TEST_DURATION * 60:.2f} updates/minute")

            if deltas:
                print(f"\nTime Between Updates:")
                print(f"  Min:     {min(deltas):.2f}s")
                print(f"  Max:     {max(deltas):.2f}s")
                print(f"  Average: {statistics.mean(deltas):.2f}s")
                print(f"  Median:  {statistics.median(deltas):.2f}s")

                # Price statistics
                prices = [u['price'] for u in updates]
                print(f"\nPrice Range:")
                print(f"  Min:  {min(prices):.4f}")
                print(f"  Max:  {max(prices):.4f}")
                print(f"  Diff: {max(prices) - min(prices):.4f}")

                # Show update distribution
                print(f"\nUpdate Distribution:")
                if deltas:
                    fast_updates = len([d for d in deltas if d < 5])
                    medium_updates = len([d for d in deltas if 5 <= d < 15])
                    slow_updates = len([d for d in deltas if d >= 15])

                    print(f"  < 5s:    {fast_updates:3d} updates ({fast_updates/len(deltas)*100:.1f}%)")
                    print(f"  5-15s:   {medium_updates:3d} updates ({medium_updates/len(deltas)*100:.1f}%)")
                    print(f"  > 15s:   {slow_updates:3d} updates ({slow_updates/len(deltas)*100:.1f}%)")
        else:
            print(f"\n⚠️  No updates received!")
            print(f"   Total updates: {len(updates)}")

        print("\n" + "="*60)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if sio.connected:
            await sio.disconnect()

if __name__ == "__main__":
    asyncio.run(test_update_frequency())
