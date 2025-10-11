"""
Test script for new stock price API
Tests both REST API and WebSocket subscription
"""

import asyncio
import aiohttp
import socketio

# Configuration
MARKS_SERVER_URL = "https://marks-server-a58cc19eb539.herokuapp.com"
TEST_STOCK = "TSLA"

async def test_rest_api():
    """Test REST API for fetching current stock price"""
    print("\n" + "="*60)
    print("TEST 1: REST API - Fetch Current Price")
    print("="*60)

    url = f"{MARKS_SERVER_URL}/api/v1/price/current/{TEST_STOCK}"
    print(f"\n📡 Fetching from: {url}")

    try:
        # Disable SSL verification for Heroku
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                print(f"   Status: {response.status}")

                if response.status == 200:
                    data = await response.json()
                    print(f"\n✅ SUCCESS!")
                    print(f"   Response data:")
                    print(f"   {data}")

                    # Check for expected fields
                    if 'symbol' in data:
                        print(f"\n   Symbol: {data['symbol']}")
                    if 'price' in data:
                        print(f"   Price: ${data['price']}")
                    if 'timestamp' in data:
                        print(f"   Timestamp: {data['timestamp']}")

                    return True
                else:
                    print(f"\n❌ FAILED - HTTP {response.status}")
                    text = await response.text()
                    print(f"   Response: {text}")
                    return False

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_websocket():
    """Test WebSocket subscription for real-time price updates"""
    print("\n" + "="*60)
    print("TEST 2: WebSocket - Real-time Price Updates")
    print("="*60)

    print(f"\n🔌 Connecting to: {MARKS_SERVER_URL}")

    # Track results
    subscription_success = False
    received_update = False
    update_data = None

    # Create Socket.IO client (disable SSL verification for Heroku)
    sio = socketio.AsyncClient(
        reconnection=False,
        logger=False,
        engineio_logger=False,
        ssl_verify=False
    )

    @sio.on('connect')
    async def on_connect():
        print(f"✅ Connected to server")
        print(f"   Socket ID: {sio.sid}")

    @sio.on('disconnect')
    async def on_disconnect():
        print(f"\n⚠️  Disconnected from server")

    @sio.on('stock_price_update')
    async def on_stock_price_update(data):
        nonlocal received_update, update_data
        received_update = True
        update_data = data
        print(f"\n💰 Received stock price update:")
        print(f"   Data: {data}")

        # Parse the data structure
        if 'symbol' in data:
            print(f"\n   Symbol: {data['symbol']}")
        if 'timestamp' in data:
            print(f"   Timestamp: {data['timestamp']}")
        if 'data' in data:
            price_data = data['data']
            print(f"\n   Price Data:")
            for key, value in price_data.items():
                print(f"      {key}: {value}")

    try:
        # Connect
        await sio.connect(
            MARKS_SERVER_URL,
            transports=['websocket'],
            wait_timeout=10
        )

        # Wait a bit for connection to stabilize
        await asyncio.sleep(1)

        # Subscribe to stock updates
        print(f"\n📡 Subscribing to {TEST_STOCK}...")

        response = await sio.call(
            'subscribe',
            {'stock': TEST_STOCK},
            timeout=10
        )

        print(f"✅ Subscription response:")
        print(f"   {response}")

        if response and response.get('status') == 'subscribed':
            subscription_success = True
            print(f"\n✅ Successfully subscribed to {TEST_STOCK}")
        else:
            print(f"\n⚠️  Unexpected subscription response")

        # Wait for price updates (30 seconds)
        print(f"\n⏳ Waiting for price updates (30 seconds)...")
        await asyncio.sleep(30)

        # Disconnect
        await sio.disconnect()

        # Report results
        print(f"\n" + "="*60)
        print("WebSocket Test Results:")
        print("="*60)
        print(f"   Subscription: {'✅ SUCCESS' if subscription_success else '❌ FAILED'}")
        print(f"   Received Update: {'✅ YES' if received_update else '❌ NO'}")

        if received_update and update_data:
            print(f"\n   Final update data received:")
            print(f"   {update_data}")

        return subscription_success and received_update

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if sio.connected:
            await sio.disconnect()

async def main():
    """Run all tests"""
    print("\n🧪 Testing Stock Price API")
    print("="*60)
    print(f"Server: {MARKS_SERVER_URL}")
    print(f"Test Stock: {TEST_STOCK}")

    # Test REST API
    rest_success = await test_rest_api()

    # Test WebSocket
    ws_success = await test_websocket()

    # Final summary
    print("\n" + "="*60)
    print("FINAL RESULTS")
    print("="*60)
    print(f"REST API:   {'✅ PASS' if rest_success else '❌ FAIL'}")
    print(f"WebSocket:  {'✅ PASS' if ws_success else '❌ FAIL'}")
    print("="*60)

    if rest_success and ws_success:
        print("\n🎉 All tests passed! API is working correctly.")
        print("\nReady to integrate into keeper!")
    else:
        print("\n⚠️  Some tests failed. Check the errors above.")

if __name__ == "__main__":
    asyncio.run(main())
