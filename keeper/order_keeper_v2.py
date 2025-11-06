"""
Order Keeper V2 - Event Detection + Order Execution
This version detects orders, fetches details, and executes them

CONFIGURATION GUIDE:
====================

Adding New Stock Pairs:
-----------------------
1. Find line ~794: stock_tickers = ["TSLA"]
2. Add your stock symbol to the list: ["TSLA", "AAPL", "MSFT", "AMZN", "GOOG"]
3. Make sure your marks-server supports these symbols
4. Update MARKET_PAIR_MAPPING (line ~773) when you deploy markets for these stocks

Example:
    stock_tickers = ["TSLA", "AAPL", "MSFT"]  # Track 3 stocks

    MARKET_PAIR_MAPPING = {
        self.mUSDTNGN_MARKET: "USDTNGN",
        "0xYourTSLAMarket": "TSLA",
        "0xYourAAPLMarket": "AAPL",
        "0xYourMSFTMarket": "MSFT"
    }
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
import socketio
import aiohttp
from zoneinfo import ZoneInfo
from datetime import timedelta

# Load environment variables
load_dotenv()

# ============================================================================
# Market Hours Utilities
# ============================================================================

def is_market_open() -> bool:
    """Check if US stock market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)"""
    now_et = datetime.now(ZoneInfo("America/New_York"))

    # Check if weekend
    if now_et.weekday() >= 5:  # Saturday = 5, Sunday = 6
        return False

    # Check if within trading hours (9:30 AM - 4:00 PM)
    market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)

    return market_open <= now_et < market_close

def get_next_market_open() -> datetime:
    """Get the next market open time (9:30 AM ET)"""
    now_et = datetime.now(ZoneInfo("America/New_York"))

    # Start with today at 9:30 AM
    next_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)

    # If we're past today's open, move to next day
    if now_et >= next_open:
        next_open += timedelta(days=1)

    # Skip weekends
    while next_open.weekday() >= 5:  # Saturday or Sunday
        next_open += timedelta(days=1)

    return next_open

def seconds_until_market_open() -> float:
    """Get seconds until next market open"""
    next_open = get_next_market_open()
    now_et = datetime.now(ZoneInfo("America/New_York"))
    return (next_open - now_et).total_seconds()

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

class PriceFeedManager:
    """Manages Socket.IO connection to Marks price feed server"""

    def __init__(self, socket_url, pairs_to_watch, price_cache, price_update_queue):
        self.socket_url = socket_url
        self.pairs_to_watch = pairs_to_watch
        self.price_cache = price_cache  # Shared cache
        self.price_update_queue = price_update_queue  # Shared queue
        self.is_connected = False

        # Create async Socket.IO client
        # Enable logging to debug Heroku issues
        import logging
        logging.basicConfig(level=logging.INFO)

        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=5,
            reconnection_delay=2,
            logger=False,  # Enable Socket.IO logging for debugging
            engineio_logger=False,  # Enable Engine.IO logging
            ssl_verify=False
        )

        # Register event handlers
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('price_update', self.on_price_update)
        self.sio.on('connect_error', self.on_connect_error)

    async def on_connect(self):
        """Called when connected to price feed server"""
        print(f"\n✅ Price Feed Connected")
        print(f"   Socket ID: {self.sio.sid}")
        self.is_connected = True

        # Subscribe to all pairs
        await self.subscribe_to_pairs()

    async def on_disconnect(self):
        """Called when disconnected from server"""
        print(f"\n⚠️  Price Feed Disconnected")
        self.is_connected = False

    async def on_connect_error(self, data):
        """Called when connection error occurs"""
        print(f"\n❌ Price Feed Connection Error: {data}")

    async def on_price_update(self, data):
        """Called when price update is received"""
        pair = data.get('pair')
        price_data = data.get('data', {})
        timestamp = data.get('timestamp')

        if pair:
            price = price_data.get('price')

            # Update cache
            self.price_cache[pair] = {
                'price': price,
                'timestamp': timestamp,
                'data': price_data
            }

            # Notify via queue (non-blocking) - printing handled in monitor_conditional_orders
            await self.price_update_queue.put((pair, price))

    async def fetch_initial_price(self, pair, max_retries=3):
        """Fetch current price via HTTP API with retry logic"""
        # Construct API URL from socket URL
        base_url = self.socket_url.rstrip('/')
        api_url = f"{base_url}/api/v1/price/current/{pair}"

        for attempt in range(max_retries):
            try:
                # Create SSL context that doesn't verify certificates (for Heroku)
                connector = aiohttp.TCPConnector(ssl=False)
                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                        if response.status == 200:
                            data = await response.json()
                            return data
                        else:
                            if attempt < max_retries - 1:
                                wait_time = 2 ** attempt  # Exponential backoff
                                print(f"   ⚠️  HTTP {response.status} fetching price for {pair} (attempt {attempt + 1}/{max_retries})")
                                print(f"   Retrying in {wait_time}s...")
                                await asyncio.sleep(wait_time)
                            else:
                                print(f"   ❌ HTTP {response.status} fetching price for {pair} after {max_retries} attempts")
                                return None
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"   ⚠️  Error fetching price for {pair} (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"   Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"   ❌ Failed to fetch price for {pair} after {max_retries} attempts: {e}")
                    return None

        return None

    async def subscribe_to_pairs(self):
        """Subscribe to all pairs in watch list and fetch initial prices"""
        print(f"\n📡 Subscribing to price feeds...")

        for pair in self.pairs_to_watch:
            try:
                # Subscribe to Socket.IO updates
                response = await self.sio.call('subscribe', {'pair': pair}, timeout=10)
                print(f"   ✅ Subscribed to {pair}")

                # Fetch current price via HTTP API
                price_data = await self.fetch_initial_price(pair)

                if price_data and 'price' in price_data:
                    # Cache the initial price
                    self.price_cache[pair] = {
                        'price': price_data['price'],
                        'timestamp': price_data.get('timestamp'),
                        'data': price_data
                    }
                    print(f"   💰 Initial price: {price_data['price']}")
                else:
                    print(f"   ⚠️  Could not fetch initial price for {pair}")

            except Exception as e:
                print(f"   ❌ Failed to subscribe to {pair}: {e}")

        # Final check - if still no prices, wait for first Socket.IO update
        if not self.price_cache:
            print(f"\n⏳ Waiting for first Socket.IO price update...")
            max_wait = 10  # Wait up to 10 seconds
            waited = 0
            while not self.price_cache and waited < max_wait:
                await asyncio.sleep(0.5)
                waited += 0.5

            if self.price_cache:
                print(f"   ✅ Received price update")
            else:
                print(f"   ❌ No price data received. System will not operate until prices are available.")

    async def connect(self):
        """Connect to the Socket.IO server"""
        print(f"\n🔌 Connecting to price feed: {self.socket_url}")

        try:
            await self.sio.connect(
                self.socket_url,
                transports=['websocket'],
                wait_timeout=10,
                socketio_path='/socket.io',
                headers={'Origin': 'http://localhost:3000'}
            )
        except Exception as e:
            print(f"❌ Failed to connect to price feed: {e}")
            raise

    async def disconnect(self):
        """Disconnect from server"""
        if self.sio.connected:
            await self.sio.disconnect()

    def get_price(self, pair):
        """Get current price for a pair"""
        if pair in self.price_cache:
            return self.price_cache[pair]['price']
        return None

    def get_price_data(self, pair):
        """Get full price data for a pair"""
        return self.price_cache.get(pair)


class StockPriceFeedManager:
    """Manages Socket.IO connection to Marks server for real-time stock prices"""

    def __init__(self, socket_url, tickers_to_watch, price_cache, price_update_queue):
        self.socket_url = socket_url
        self.tickers_to_watch = tickers_to_watch  # e.g., ['TSLA', 'AAPL']
        self.price_cache = price_cache  # Shared cache with crypto feed
        self.price_update_queue = price_update_queue  # Shared queue
        self.is_connected = False

        # Create async Socket.IO client
        import logging
        logging.basicConfig(level=logging.INFO)

        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=5,
            reconnection_delay=2,
            logger=False,
            engineio_logger=False,
            ssl_verify=False  # For Heroku
        )

        # Register event handlers
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('stock_price_update', self.on_stock_price_update)
        self.sio.on('connect_error', self.on_connect_error)

    async def on_connect(self):
        """Called when connected to stock price feed server"""
        print(f"\n✅ Stock Price Feed Connected")
        print(f"   Socket ID: {self.sio.sid}")
        self.is_connected = True

        # Subscribe to all tickers
        await self.subscribe_to_tickers()

    async def on_disconnect(self):
        """Called when disconnected from server"""
        print(f"\n⚠️  Stock Price Feed Disconnected")
        self.is_connected = False

    async def on_connect_error(self, data):
        """Called when connection error occurs"""
        print(f"\n❌ Stock Price Feed Connection Error: {data}")

    async def on_stock_price_update(self, data):
        """Called when stock price update is received"""
        symbol = data.get('symbol')
        price_data = data.get('data', {})
        timestamp = data.get('timestamp')

        if symbol:
            price = price_data.get('price')

            # Update cache
            self.price_cache[symbol] = {
                'price': price,
                'timestamp': timestamp,
                'data': price_data
            }

            print(f"\n📈 Stock Price Update: {symbol} = ${price:.2f}")

            # Notify via queue (non-blocking)
            await self.price_update_queue.put((symbol, price))

    async def fetch_initial_price(self, ticker, max_retries=3):
        """Fetch current stock price via HTTP API with retry logic"""
        # Construct API URL from socket URL
        base_url = self.socket_url.rstrip('/')
        api_url = f"{base_url}/api/v1/price/current/{ticker}"

        for attempt in range(max_retries):
            try:
                # Create SSL context that doesn't verify certificates (for Heroku)
                connector = aiohttp.TCPConnector(ssl=False)
                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                        if response.status == 200:
                            data = await response.json()
                            return data
                        else:
                            if attempt < max_retries - 1:
                                wait_time = 2 ** attempt  # Exponential backoff
                                print(f"   ⚠️  HTTP {response.status} fetching price for {ticker} (attempt {attempt + 1}/{max_retries})")
                                print(f"   Retrying in {wait_time}s...")
                                await asyncio.sleep(wait_time)
                            else:
                                print(f"   ❌ HTTP {response.status} fetching price for {ticker} after {max_retries} attempts")
                                return None
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"   ⚠️  Error fetching price for {ticker} (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"   Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"   ❌ Failed to fetch price for {ticker} after {max_retries} attempts: {e}")
                    return None

        return None

    async def connect(self):
        """Connect to the Socket.IO server"""
        print(f"\n🔌 Connecting to stock price feed: {self.socket_url}")
        print(f"   Tickers: {', '.join(self.tickers_to_watch)}")

        try:
            await self.sio.connect(
                self.socket_url,
                transports=['websocket'],
                wait_timeout=10,
                socketio_path='/socket.io'
            )
            return True
        except Exception as e:
            print(f"❌ Failed to connect to stock price feed: {e}")
            return False

    async def subscribe_to_tickers(self):
        """Subscribe to all tickers and fetch initial prices"""
        print(f"\n📡 Subscribing to stock price feeds...")

        for ticker in self.tickers_to_watch:
            try:
                # Subscribe to Socket.IO updates
                response = await self.sio.call('subscribe', {'stock': ticker}, timeout=10)
                print(f"   ✅ Subscribed to {ticker}")

                # Fetch current price via HTTP API
                price_data = await self.fetch_initial_price(ticker)

                if price_data and 'price' in price_data:
                    # Cache the initial price
                    self.price_cache[ticker] = {
                        'price': price_data['price'],
                        'timestamp': price_data.get('timestamp'),
                        'data': price_data
                    }
                    print(f"   💰 Initial price: ${price_data['price']:.2f}")
                else:
                    print(f"   ⚠️  Could not fetch initial price for {ticker}")

            except Exception as e:
                print(f"   ❌ Failed to subscribe to {ticker}: {e}")

        # Final check - if still no prices, wait for first Socket.IO update
        if not any(ticker in self.price_cache for ticker in self.tickers_to_watch):
            print(f"\n⏳ Waiting for first Socket.IO price update...")
            max_wait = 10  # Wait up to 10 seconds
            waited = 0
            while not any(ticker in self.price_cache for ticker in self.tickers_to_watch) and waited < max_wait:
                await asyncio.sleep(0.5)
                waited += 0.5

            if any(ticker in self.price_cache for ticker in self.tickers_to_watch):
                print(f"   ✅ Received price update")
            else:
                print(f"   ⚠️  No price data received for stocks, will wait for updates")

    async def log_prices_periodically(self):
        """Log stock prices every 60 seconds"""
        print(f"   📊 Stock Price logging: every 60 seconds\n")

        while True:
            try:
                # Wait 60 seconds
                await asyncio.sleep(60)

                # Log all tracked tickers
                print(f"\n📈 Stock Prices Update ({datetime.now().strftime('%H:%M:%S')})")
                for ticker in self.tickers_to_watch:
                    price_data = self.price_cache.get(ticker)
                    if price_data:
                        print(f"   {ticker}: ${price_data['price']:.2f}")
                    else:
                        print(f"   {ticker}: No data yet")

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ Error in price logger: {e}")

    async def disconnect(self):
        """Disconnect from server"""
        if self.sio.connected:
            await self.sio.disconnect()
            self.is_connected = False

    def get_price(self, ticker):
        """Get current price for a ticker"""
        if ticker in self.price_cache:
            return self.price_cache[ticker]['price']
        return None


# ============================================================================
# Liquidation Monitor
# ============================================================================

class LiquidationMonitor:
    """Monitors positions and executes liquidations when positions become undercollateralized"""

    def __init__(self, keeper):
        """Initialize liquidation monitor with reference to main keeper"""
        self.keeper = keeper
        self.w3 = keeper.w3
        self.account = keeper.account

        # Configuration (can be moved to env variables later)
        self.SCAN_INTERVAL = int(os.getenv("LIQUIDATION_SCAN_INTERVAL", "30"))  # seconds
        self.PRICE_TRIGGER_THRESHOLD = float(os.getenv("LIQUIDATION_PRICE_TRIGGER", "0.01"))  # 1%
        self.ENABLED = os.getenv("ENABLE_LIQUIDATIONS", "true").lower() == "true"
        self.MAX_GAS_PRICE_GWEI = int(os.getenv("LIQUIDATION_MAX_GAS_PRICE", "50"))

        # Markets to monitor - all markets from MARKETS registry (8 markets, excluding dual-token USDTNGN)
        self.markets = list(keeper.MARKETS.keys())

        # State tracking
        self.last_scan_time = 0
        self.last_price = {}
        self.executing_liquidations = set()  # Track ongoing liquidations to prevent duplicates
        self.failed_liquidations = {}  # Track failed attempts: {position_key: {'attempts': int, 'last_attempt': timestamp, 'error': str}}

        # Position cache for enumeration
        self.position_cache = []  # List of position keys
        self.cache_updated_at = 0
        self.CACHE_REFRESH_INTERVAL = int(os.getenv("POSITION_CACHE_REFRESH", "600"))  # 10 minutes

        # Retry configuration
        self.MAX_RETRY_ATTEMPTS = int(os.getenv("LIQUIDATION_MAX_RETRIES", "3"))
        self.RETRY_BACKOFF_BASE = int(os.getenv("LIQUIDATION_RETRY_BACKOFF", "60"))  # Base backoff in seconds

        print(f"💀 Liquidation Monitor initialized")
        print(f"   Enabled: {self.ENABLED}")
        print(f"   Scan interval: {self.SCAN_INTERVAL}s")
        print(f"   Price trigger: {self.PRICE_TRIGGER_THRESHOLD*100}%")
        print(f"   Markets: {len(self.markets)}")
        print(f"   Cache refresh: {self.CACHE_REFRESH_INTERVAL}s")

        # NOTE: Initial cache load happens in async_init() (can't await in __init__)

    async def async_init(self):
        """
        Async initialization - loads position cache before monitoring begins
        Called from OrderKeeper.run() before starting monitor loop
        """
        print(f"🔄 [Liquidation] Loading initial position cache...")
        await self.refresh_position_cache()
        print(f"✅ [Liquidation] Initial cache loaded: {len(self.position_cache)} positions")

    def get_position_list_key(self):
        """
        Get the DataStore key for POSITION_LIST
        Matches: keccak256(abi.encode(["string"], ["POSITION_LIST"]))
        """
        from eth_abi import encode
        position_list_bytes = encode(['string'], ['POSITION_LIST'])
        position_list_key = Web3.keccak(position_list_bytes)
        return position_list_key

    async def fetch_all_position_keys(self, batch_size=1000):
        """
        Fetch all position keys from DataStore (non-blocking)
        Returns list of position keys (bytes32)
        """
        try:
            position_list_key = self.get_position_list_key()

            # Get total count of positions (non-blocking)
            position_count = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.keeper.datastore.functions.getBytes32Count(
                    position_list_key
                ).call()
            )

            if position_count == 0:
                print(f"   No positions found in POSITION_LIST")
                return []

            # Fetch position keys in batches (non-blocking)
            total_to_fetch = min(position_count, batch_size)
            position_keys = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.keeper.datastore.functions.getBytes32ValuesAt(
                    position_list_key,
                    0,
                    total_to_fetch
                ).call()
            )

            print(f"   Fetched {len(position_keys)} position keys from DataStore")
            return position_keys

        except Exception as e:
            print(f"   ❌ Error fetching position keys: {e}")
            return []

    async def get_position_info_from_key(self, position_key):
        """
        Get position details from position key using Reader contract (non-blocking)
        Returns dict with account, market, collateralToken, isLong, sizeInUsd, etc.
        Returns None if position is inactive (sizeInUsd == 0)
        """
        try:
            # Call Reader.getPosition() (non-blocking)
            position = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.keeper.reader.functions.getPosition(
                    Web3.to_checksum_address(self.keeper.DATA_STORE),
                    position_key
                ).call()
            )

            # Position structure: (addresses, numbers, flags)
            # addresses: (account, market, collateralToken)
            # numbers: (sizeInUsd, sizeInTokens, collateralAmount, ...)
            # flags: (isLong,)

            account = position[0][0]  # addresses.account
            market = position[0][1]   # addresses.market
            collateral_token = position[0][2]  # addresses.collateralToken

            size_in_usd = position[1][0]  # numbers.sizeInUsd
            size_in_tokens = position[1][1]  # numbers.sizeInTokens
            collateral_amount = position[1][2]  # numbers.collateralAmount

            is_long = position[2][0]  # flags.isLong

            # Filter out inactive positions (size == 0)
            if size_in_usd == 0:
                return None

            # Convert position_key to hex string if it's not already
            if isinstance(position_key, bytes):
                key_hex = '0x' + position_key.hex()
            elif hasattr(position_key, 'hex'):
                key_hex = '0x' + position_key.hex()
            else:
                key_hex = position_key if position_key.startswith('0x') else '0x' + position_key

            return {
                'key': key_hex,
                'account': account,
                'market': market,
                'collateralToken': collateral_token,
                'isLong': is_long,
                'sizeInUsd': size_in_usd,
                'sizeInTokens': size_in_tokens,
                'collateralAmount': collateral_amount
            }

        except Exception as e:
            # Position might be deleted or invalid
            return None

    async def refresh_position_cache(self):
        """
        Refresh the position cache by fetching all position keys and their details (non-blocking)
        This should be called periodically (every 10 minutes by default)
        """
        import time

        print(f"🔄 [Liquidation] Refreshing position cache...")

        try:
            # Fetch all position keys from DataStore (non-blocking)
            position_keys = await self.fetch_all_position_keys()

            if len(position_keys) == 0:
                print(f"   No positions found in DataStore")
                self.position_cache = []
                self.cache_updated_at = time.time()
                return

            # Get details for each position and filter active ones (non-blocking)
            active_positions = []
            for position_key in position_keys:
                position_info = await self.get_position_info_from_key(position_key)
                if position_info:
                    active_positions.append(position_info)

            # Update cache
            self.position_cache = active_positions
            self.cache_updated_at = time.time()

            print(f"   ✅ Cache updated: {len(active_positions)} active positions")

        except Exception as e:
            print(f"   ❌ Error refreshing cache: {e}")
            # Keep old cache if refresh fails
            pass

    async def get_cached_positions(self):
        """
        Get cached positions, refreshing if cache is stale (non-blocking)
        Returns list of active position info dicts
        """
        import time

        # Check if cache needs refresh
        cache_age = time.time() - self.cache_updated_at
        if cache_age > self.CACHE_REFRESH_INTERVAL:
            print(f"   Cache is stale ({cache_age:.0f}s old), refreshing...")
            await self.refresh_position_cache()

        return self.position_cache

    def should_retry_liquidation(self, position_key):
        """
        Check if we should retry liquidating a position based on previous failures and backoff
        Returns (should_retry: bool, reason: str)
        """
        import time

        if position_key not in self.failed_liquidations:
            return (True, "First attempt")

        failure_info = self.failed_liquidations[position_key]
        attempts = failure_info['attempts']
        last_attempt = failure_info['last_attempt']
        last_error = failure_info.get('error', '')

        # Check if we've exceeded max retries
        if attempts >= self.MAX_RETRY_ATTEMPTS:
            return (False, f"Max retries ({self.MAX_RETRY_ATTEMPTS}) exceeded")

        # Check if error is permanent (don't retry)
        permanent_errors = [
            "not liquidatable",
            "position not found",
            "unauthorized"
        ]
        if any(err in last_error.lower() for err in permanent_errors):
            return (False, f"Permanent error: {last_error}")

        # Calculate exponential backoff: base * (2 ^ attempts)
        backoff_seconds = self.RETRY_BACKOFF_BASE * (2 ** attempts)
        time_since_last = time.time() - last_attempt

        if time_since_last < backoff_seconds:
            wait_more = backoff_seconds - time_since_last
            return (False, f"Backoff: wait {wait_more:.0f}s more")

        return (True, f"Retry attempt #{attempts + 1}")

    def record_liquidation_failure(self, position_key, error):
        """Record a failed liquidation attempt"""
        import time

        if position_key not in self.failed_liquidations:
            self.failed_liquidations[position_key] = {
                'attempts': 1,
                'last_attempt': time.time(),
                'error': str(error)
            }
        else:
            self.failed_liquidations[position_key]['attempts'] += 1
            self.failed_liquidations[position_key]['last_attempt'] = time.time()
            self.failed_liquidations[position_key]['error'] = str(error)

    def record_liquidation_success(self, position_key):
        """Clear failure tracking for successfully liquidated position"""
        if position_key in self.failed_liquidations:
            del self.failed_liquidations[position_key]

    def get_market_prices_for_reader(self, market):
        """
        Build market prices struct for Reader contract calls (market-aware)
        Returns tuple of (indexTokenPrice, longTokenPrice, shortTokenPrice)
        Each price is a tuple of (min, max)
        """
        # Get prices for this specific market
        prices = self.keeper.get_current_prices(market)

        # Get market config to know which tokens to use
        market_config = self.keeper.MARKETS.get(market)
        if not market_config:
            # Fallback to default market
            market = self.keeper.mUSDTNGN_MARKET
            market_config = self.keeper.MARKETS[market]
            prices = self.keeper.get_current_prices(market)

        # Market prices struct for Reader
        # Structure: ((minIndex, maxIndex), (minLong, maxLong), (minShort, maxShort))
        return (
            (prices[market_config["indexToken"]], prices[market_config["indexToken"]]),  # indexTokenPrice (min, max)
            (prices[market_config["longToken"]], prices[market_config["longToken"]]),     # longTokenPrice (min, max)
            (prices[market_config["shortToken"]], prices[market_config["shortToken"]])    # shortTokenPrice (min, max)
        )

    async def scan_positions(self):
        """Scan all positions for liquidation opportunities using cached positions"""

        print(f"\n🔍 [Liquidation] Scanning positions...")

        liquidation_count = 0
        positions_checked = 0

        try:
            # Get cached positions (auto-refreshes if stale, non-blocking)
            cached_positions = await self.get_cached_positions()

            if len(cached_positions) == 0:
                print(f"   No active positions to scan")
                return

            print(f"   Checking {len(cached_positions)} active positions...")

            # Check each cached position for liquidation
            for position_info in cached_positions:
                positions_checked += 1
                position_key = None

                try:
                    # Extract position details from cache
                    position_key = position_info['key']
                    account = position_info['account']
                    market = position_info['market']
                    is_long = position_info['isLong']

                    # Check if we should retry this position
                    should_retry, retry_reason = self.should_retry_liquidation(position_key)

                    if not should_retry:
                        # Skip this position - already tried and failed
                        continue

                    # Check if liquidatable and execute if needed
                    was_liquidated = await self.check_and_liquidate(
                        position_key,
                        market,
                        account,
                        is_long
                    )

                    if was_liquidated:
                        liquidation_count += 1
                        # Clear failure tracking on success
                        self.record_liquidation_success(position_key)

                except Exception as e:
                    # Error checking this position - log and continue
                    key_str = position_key[:16] + "..." if position_key else "unknown"
                    print(f"   ⚠️  Error checking position {key_str}: {e}")
                    if position_key:
                        self.record_liquidation_failure(position_key, str(e))
                    pass

            # Summary
            if liquidation_count > 0:
                print(f"   ✅ Executed {liquidation_count} liquidation(s) out of {positions_checked} positions")
            else:
                print(f"   ✓ No liquidations needed ({positions_checked} positions checked)")

        except Exception as e:
            print(f"   ❌ Error scanning positions: {e}")

    async def check_and_liquidate(self, position_key, market, account, is_long):
        """Check if a position is liquidatable and execute if needed"""

        # Skip if already executing
        if position_key in self.executing_liquidations:
            return False

        try:
            # Get current prices
            market_prices = self.get_market_prices_for_reader(market)

            # Get market configuration for token addresses
            market_config = self.keeper.MARKETS.get(market)
            if not market_config:
                # Fallback to default market
                market = self.keeper.mUSDTNGN_MARKET
                market_config = self.keeper.MARKETS[market]
                market_prices = self.get_market_prices_for_reader(market)

            # Check if position is liquidatable via Reader contract (market-aware)
            is_liquidatable, reason, info = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.keeper.reader.functions.isPositionLiquidatable(
                    Web3.to_checksum_address(self.keeper.DATA_STORE),
                    Web3.to_checksum_address(self.keeper.REFERRAL_STORAGE),
                    bytes.fromhex(position_key[2:]),
                    (
                        Web3.to_checksum_address(market),
                        Web3.to_checksum_address(market_config["indexToken"]),  # indexToken (e.g., mUSDTNGN or mTSLA)
                        Web3.to_checksum_address(market_config["longToken"]),   # longToken (e.g., mUSD or USDT)
                        Web3.to_checksum_address(market_config["shortToken"])   # shortToken (e.g., mNGN or USDT)
                    ),
                    market_prices,
                    True,  # shouldValidateMinCollateralUsd
                    True   # forLiquidation
                ).call()
            )

            if is_liquidatable:
                print(f"\n💀 LIQUIDATABLE POSITION FOUND!")
                print(f"   Account: {account}")
                print(f"   Position: {'LONG' if is_long else 'SHORT'}")
                print(f"   Reason: {reason}")
                print(f"   Position Key: {position_key}")

                # Execute liquidation and return success status
                success = await self.execute_liquidation(market, account, is_long)

                if not success:
                    # Execution failed - record the failure
                    self.record_liquidation_failure(position_key, "Liquidation execution failed")

                return success
            else:
                # Position is not liquidatable - not an error, just not ready yet
                # Don't record as failure, don't retry aggressively
                return False

        except Exception as e:
            # Position likely doesn't exist or error checking
            # Don't record as permanent failure - let scan_positions handle it
            pass

        return False

    async def execute_liquidation(self, market, account, is_long, retry_count=0, max_retries=3):
        """Execute a liquidation transaction with retry logic. Returns True if successful, False otherwise."""

        try:
            # Check gas price
            current_gas_price = self.w3.eth.gas_price
            max_gas_price = self.MAX_GAS_PRICE_GWEI * 10**9

            if current_gas_price > max_gas_price:
                print(f"   ⚠️  Gas price too high ({current_gas_price/10**9:.2f} gwei > {self.MAX_GAS_PRICE_GWEI} gwei)")
                print(f"   Skipping liquidation")
                return False

            print(f"\n⚡ Executing liquidation (Attempt {retry_count + 1}/{max_retries})...")
            print(f"   Account: {account}")
            print(f"   Market: {market}")
            print(f"   Side: {'LONG' if is_long else 'SHORT'}")

            # Update MockOracleProvider prices first (market-aware)
            await self.keeper.update_mock_provider_prices(market)

            # Build oracle params (market-aware)
            oracle_params = self.build_oracle_params(market)

            # Build transaction with 'pending' nonce to avoid conflicts
            nonce = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.w3.eth.get_transaction_count(self.account.address, 'pending')
            )

            # Add 20% gas price buffer
            gas_price_with_buffer = int(current_gas_price * 1.2)

            tx = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.keeper.liquidation_handler.functions.executeLiquidation(
                    Web3.to_checksum_address(account),
                    Web3.to_checksum_address(market),
                    Web3.to_checksum_address(self.keeper.mUSD),  # collateralToken
                    is_long,
                    oracle_params
                ).build_transaction({
                    'from': self.account.address,
                    'gas': 5_000_000,
                    'gasPrice': gas_price_with_buffer,
                    'nonce': nonce
                })
            )

            # Sign and send
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)

            print(f"   📤 TX submitted: {tx_hash.hex()}")
            print(f"   Nonce: {nonce}")

            # Wait for receipt (non-blocking)
            receipt = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            )

            if receipt.status == 1:
                print(f"   ✅ Liquidation successful!")
                print(f"   Gas used: {receipt.gasUsed:,}")
                print(f"   View on Arbiscan: https://sepolia.arbiscan.io/tx/{tx_hash.hex()}")
                return True
            else:
                print(f"   ❌ Liquidation transaction failed")
                print(f"   Transaction hash: {tx_hash.hex()}")
                print(f"   View on Arbiscan: https://sepolia.arbiscan.io/tx/{tx_hash.hex()}")
                # Try to get revert reason by replaying transaction
                try:
                    # Get the transaction details
                    tx_details = self.w3.eth.get_transaction(tx_hash)
                    # Replay the transaction to get the revert reason
                    self.w3.eth.call({
                        'to': tx_details['to'],
                        'from': tx_details['from'],
                        'data': tx_details['input'],
                        'value': tx_details.get('value', 0)
                    }, receipt['blockNumber'] - 1)
                except Exception as revert_error:
                    error_msg = str(revert_error)
                    print(f"   Revert reason: {error_msg}")
                    # Try to extract readable error from the message
                    if "execution reverted:" in error_msg:
                        print(f"   Error detail: {error_msg.split('execution reverted:')[1].strip()}")
                return False

        except Exception as e:
            error_str = str(e)
            print(f"   ❌ Error executing liquidation: {error_str}")

            # Check if this is a nonce error
            is_nonce_error = 'nonce too low' in error_str.lower() or 'nonce too high' in error_str.lower()

            # Retry logic with exponential backoff
            if retry_count < max_retries - 1:
                wait_time = 2 ** (retry_count + 1)  # 2s, 4s, 8s
                if is_nonce_error:
                    print(f"   🔄 Nonce error detected - retrying in {wait_time} seconds...")
                else:
                    print(f"   ⏳ Retrying in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                return await self.execute_liquidation(market, account, is_long, retry_count + 1, max_retries)
            else:
                print(f"   ❌ Max retries ({max_retries}) reached for liquidation")
                import traceback
                traceback.print_exc()
                return False

    def build_oracle_params(self, market):
        """
        Build oracle params for liquidation execution (market-aware)

        Args:
            market: Market token address
        """
        # Get prices for this specific market
        prices = self.keeper.get_current_prices(market)

        # Get market configuration
        market_config = self.keeper.MARKETS.get(market)
        if not market_config:
            # Fallback to default market
            market = self.keeper.mUSDTNGN_MARKET
            market_config = self.keeper.MARKETS[market]
            prices = self.keeper.get_current_prices(market)

        # Build tokens array from market config
        tokens = [
            Web3.to_checksum_address(market_config["indexToken"]),
            Web3.to_checksum_address(market_config["longToken"]),
            Web3.to_checksum_address(market_config["shortToken"])
        ]

        # Deduplicate tokens (important for single-token markets where long == short)
        # Oracle doesn't allow setting the same token price twice in one call
        seen = set()
        unique_tokens = []
        for token in tokens:
            token_lower = token.lower()
            if token_lower not in seen:
                seen.add(token_lower)
                unique_tokens.append(token)

        # Providers array (use MockOracleProvider)
        providers = [Web3.to_checksum_address(self.keeper.MOCK_PROVIDER)] * len(unique_tokens)

        # Data array - encode prices as (uint256 min, uint256 max) for each token
        data = []
        for token in unique_tokens:
            price = prices[token]
            # Encode as (minPrice, maxPrice) - both same for spot price
            encoded = encode(['uint256', 'uint256'], [price, price])
            data.append(encoded)

        return (unique_tokens, providers, data)

    async def on_price_update(self, pair, price):
        """Handle price updates from price feed - trigger scan if significant move"""

        if pair in self.last_price:
            old_price = self.last_price[pair]
            price_change = abs(price - old_price) / old_price

            if price_change >= self.PRICE_TRIGGER_THRESHOLD:
                print(f"\n📈 [Liquidation] Price moved {price_change*100:.2f}% - triggering scan")
                await self.scan_positions()

        self.last_price[pair] = price

    async def monitor_loop(self):
        """Main monitoring loop"""

        if not self.ENABLED:
            print("⚠️  Liquidation monitoring is DISABLED")
            return

        print(f"\n👁️  Starting liquidation monitor...")

        while True:
            try:
                current_time = asyncio.get_event_loop().time()

                # Periodic scan based on interval
                if current_time - self.last_scan_time >= self.SCAN_INTERVAL:
                    await self.scan_positions()
                    self.last_scan_time = current_time

                # Sleep for 5 seconds before checking again
                await asyncio.sleep(5)

            except Exception as e:
                print(f"❌ [Liquidation] Error in monitor loop: {e}")
                await asyncio.sleep(10)


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

        # Contract addresses (from marks-arbitrumSepolia-deployments.md)
        self.EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"
        self.DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
        self.ORDER_HANDLER = "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7"
        self.READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8"
        self.REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547"
        self.LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B"  # Deployed via hardhat deploy

        # Token addresses
        self.mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"  # mUSD (6 decimals)
        self.mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827"  # mNGN (18 decimals)
        self.mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"  # mUSDTNGN index token (18 decimals)
        self.mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4"  # mTSLA index token (18 decimals)
        self.mAAPL = "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e"  # mAAPL index token (18 decimals)
        self.mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325"  # mNVDA index token (18 decimals)
        self.mMETA = "0xE2f8B015D23bB0EFdD57D8C08a328180437D031D"  # mMETA index token (18 decimals)
        self.mUSDTARS = "0xed6890bE2409F0db06a00C809a298E2E06553BE1"  # mUSDTARS index token (18 decimals)
        self.mPKR = "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD"  # mPKR index token (18 decimals)
        self.mCOP = "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8"  # mCOP index token (18 decimals)
        self.USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6"  # USDT (6 decimals)

        # Market addresses
        self.mUSDTNGN_MARKET = "0x5E63276Caae0FF49b2762b98A1d37941AA50F804"  # Market 9: USDTNGN crypto market
        self.mUSDTNGN_SINGLE_MARKET = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb"  # Market 18: USDTNGN single-token crypto market
        self.mTSLA_MARKET = "0x8ae559448a1482faffC925eF6a233276588348Df"  # Market 11: TSLA stock market
        self.mAAPL_MARKET = "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449"  # Market 16: AAPL stock market
        self.mNVDA_MARKET = "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C"  # Market 13: NVDA stock market
        self.mMETA_MARKET = "0xafd908D358315efDBA493311AbE30648DEC4d2dE"  # Market 17: META stock market
        self.mUSDTARS_MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69"  # Market 12: USDTARS crypto market
        self.mPKR_MARKET = "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383"  # Market 14: PKR crypto market
        self.mCOP_MARKET = "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44"  # Market 15: COP crypto market

        # MockOracleProvider address (will be loaded from file if exists)
        self.MOCK_PROVIDER = self.load_mock_provider_address()

        # Price Feed Configuration
        self.PRICE_FEED_URL = "https://marks-server-a58cc19eb539.herokuapp.com/"

        # Shared price cache and update queue
        self.price_cache = {}  # pair/ticker -> {'price': float, 'timestamp': str, 'data': dict}
        self.price_update_queue = asyncio.Queue()  # Queue of (pair/ticker, price) tuples

        # ============================================================================
        # MARKET REGISTRY - Central configuration for all markets
        # ============================================================================
        # This registry maps market addresses to their configuration
        # All price fetching and oracle param building uses this registry
        #
        # To add a new market (e.g., AAPL):
        # 1. Define token addresses above (e.g., self.mAAPL, self.mAAPL_MARKET)
        # 2. Add entry to MARKETS dict below
        # 3. Add ticker to stock_tickers list (line ~850)
        # That's it! No other changes needed.
        self.MARKETS = {
            # Market 9 (dual-token USDTNGN with mUSD-mNGN) is NOT tracked
            # Only tracking Market 18 (single-token USDTNGN with mUSD-mUSD)
            self.mUSDTNGN_SINGLE_MARKET: {
                "name": "USDTNGN_SINGLE",
                "indexToken": self.mUSDTNGN,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "USDTNGN",
                "type": "crypto"
            },
            self.mTSLA_MARKET: {
                "name": "TSLA",
                "indexToken": self.mTSLA,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "TSLA",
                "type": "stock"
            },
            self.mAAPL_MARKET: {
                "name": "AAPL",
                "indexToken": self.mAAPL,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "AAPL",
                "type": "stock"
            },
            self.mNVDA_MARKET: {
                "name": "NVDA",
                "indexToken": self.mNVDA,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "NVDA",
                "type": "stock"
            },
            self.mMETA_MARKET: {
                "name": "META",
                "indexToken": self.mMETA,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "META",
                "type": "stock"
            },
            self.mUSDTARS_MARKET: {
                "name": "USDTARS",
                "indexToken": self.mUSDTARS,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "USDTARS",
                "type": "crypto"
            },
            self.mPKR_MARKET: {
                "name": "USDTPKR",
                "indexToken": self.mPKR,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "USDTPKR",
                "type": "crypto"
            },
            self.mCOP_MARKET: {
                "name": "USDTCOP",
                "indexToken": self.mCOP,
                "longToken": self.mUSD,
                "shortToken": self.mUSD,
                "pricePair": "USDTCOP",
                "type": "crypto"
            }
        }

        # Legacy mapping (derived from MARKETS for backward compatibility)
        self.MARKET_PAIR_MAPPING = {
            market_addr: config["pricePair"]
            for market_addr, config in self.MARKETS.items()
        }

        # Initialize crypto price feed manager
        crypto_pairs = ["USDTNGN", "USDTPKR", "USDTARS", "USDTCOP"]  # Crypto pairs to watch
        self.crypto_feed = PriceFeedManager(
            self.PRICE_FEED_URL,
            crypto_pairs,
            self.price_cache,
            self.price_update_queue
        )

        # Initialize stock price feed manager (marks-server)
        # CONFIGURATION: Add more stock tickers here as needed
        stock_tickers = ["TSLA", "AAPL", "NVDA","META"]  # Add more: ["TSLA", "AAPL", "MSFT", "AMZN", "GOOG"]

        # Use the same marks-server for stocks
        stock_server_url = os.getenv("STOCK_SERVER_URL", "https://marks-server-a58cc19eb539.herokuapp.com")

        self.stock_feed = StockPriceFeedManager(
            stock_server_url,
            stock_tickers,
            self.price_cache,
            self.price_update_queue
        )

        # Price configuration - will be updated dynamically from price feed
        # NO FALLBACK - system will error if prices are not available
        self.EXCHANGE_RATE = None  # Will be populated from price feeds

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
            },
            {
                "inputs": [{"name": "setKey", "type": "bytes32"}],
                "name": "getBytes32Count",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "setKey", "type": "bytes32"},
                    {"name": "start", "type": "uint256"},
                    {"name": "end", "type": "uint256"}
                ],
                "name": "getBytes32ValuesAt",
                "outputs": [{"name": "", "type": "bytes32[]"}],
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

        # Reader ABI for position queries
        self.reader_abi = [
            {
                "inputs": [
                    {"name": "dataStore", "type": "address"},
                    {"name": "key", "type": "bytes32"}
                ],
                "name": "getPosition",
                "outputs": [
                    {
                        "components": [
                            {
                                "components": [
                                    {"name": "account", "type": "address"},
                                    {"name": "market", "type": "address"},
                                    {"name": "collateralToken", "type": "address"}
                                ],
                                "name": "addresses",
                                "type": "tuple"
                            },
                            {
                                "components": [
                                    {"name": "sizeInUsd", "type": "uint256"},
                                    {"name": "sizeInTokens", "type": "uint256"},
                                    {"name": "collateralAmount", "type": "uint256"},
                                    {"name": "pendingImpactAmount", "type": "int256"},
                                    {"name": "borrowingFactor", "type": "uint256"},
                                    {"name": "fundingFeeAmountPerSize", "type": "uint256"},
                                    {"name": "longTokenClaimableFundingAmountPerSize", "type": "uint256"},
                                    {"name": "shortTokenClaimableFundingAmountPerSize", "type": "uint256"},
                                    {"name": "increasedAtTime", "type": "uint256"},
                                    {"name": "decreasedAtTime", "type": "uint256"}
                                ],
                                "name": "numbers",
                                "type": "tuple"
                            },
                            {
                                "components": [
                                    {"name": "isLong", "type": "bool"}
                                ],
                                "name": "flags",
                                "type": "tuple"
                            }
                        ],
                        "name": "",
                        "type": "tuple"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "dataStore", "type": "address"},
                    {"name": "referralStorage", "type": "address"},
                    {"name": "positionKey", "type": "bytes32"},
                    {
                        "components": [
                            {"name": "marketToken", "type": "address"},
                            {"name": "indexToken", "type": "address"},
                            {"name": "longToken", "type": "address"},
                            {"name": "shortToken", "type": "address"}
                        ],
                        "name": "market",
                        "type": "tuple"
                    },
                    {
                        "components": [
                            {
                                "components": [
                                    {"name": "min", "type": "uint256"},
                                    {"name": "max", "type": "uint256"}
                                ],
                                "name": "indexTokenPrice",
                                "type": "tuple"
                            },
                            {
                                "components": [
                                    {"name": "min", "type": "uint256"},
                                    {"name": "max", "type": "uint256"}
                                ],
                                "name": "longTokenPrice",
                                "type": "tuple"
                            },
                            {
                                "components": [
                                    {"name": "min", "type": "uint256"},
                                    {"name": "max", "type": "uint256"}
                                ],
                                "name": "shortTokenPrice",
                                "type": "tuple"
                            }
                        ],
                        "name": "prices",
                        "type": "tuple"
                    },
                    {"name": "shouldValidateMinCollateralUsd", "type": "bool"},
                    {"name": "forLiquidation", "type": "bool"}
                ],
                "name": "isPositionLiquidatable",
                "outputs": [
                    {"name": "", "type": "bool"},
                    {"name": "", "type": "string"},
                    {
                        "components": [
                            {"name": "remainingCollateralUsd", "type": "int256"},
                            {"name": "minCollateralUsd", "type": "int256"},
                            {"name": "minCollateralUsdForLeverage", "type": "int256"}
                        ],
                        "name": "",
                        "type": "tuple"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ]

        # LiquidationHandler ABI for executing liquidations
        self.liquidation_handler_abi = [
            {
                "inputs": [
                    {"name": "account", "type": "address"},
                    {"name": "market", "type": "address"},
                    {"name": "collateralToken", "type": "address"},
                    {"name": "isLong", "type": "bool"},
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
                "name": "executeLiquidation",
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

        self.reader = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.READER),
            abi=self.reader_abi
        )

        self.liquidation_handler = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.LIQUIDATION_HANDLER),
            abi=self.liquidation_handler_abi
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

        # Initialize liquidation monitor
        self.liquidation_monitor = LiquidationMonitor(self)

        print(f"📡 Order Keeper V2 initialized")
        print(f"   Account: {self.account.address}")
        print(f"   EventEmitter: {self.EVENT_EMITTER}")
        print(f"   DataStore: {self.DATA_STORE}")
        print(f"   OrderHandler: {self.ORDER_HANDLER}")
        print(f"   Reader: {self.READER}")
        print(f"   LiquidationHandler: {self.LIQUIDATION_HANDLER}")
        print(f"   MockProvider: {self.MOCK_PROVIDER if self.MOCK_PROVIDER else 'Not configured'}")

    def load_mock_provider_address(self):
        """Load MockOracleProvider address from deployment file"""
        # Using the deployed address directly
        return "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"

    def get_current_prices(self, market_address=None):
        """
        Get current prices for tokens in a specific market

        Args:
            market_address: Market token address. If None, defaults to mUSDTNGN market

        Returns:
            dict: {token_address -> price (with precision 30)}
        """
        # Default to mUSDTNGN market for backward compatibility
        if market_address is None:
            market_address = self.mUSDTNGN_MARKET

        # Get market configuration
        market_config = self.MARKETS.get(market_address)
        if not market_config:
            raise ValueError(f"Market {market_address} is not tracked by this keeper")

        # Get price pair for this market
        price_pair = market_config["pricePair"]

        # Fetch current price from cache
        price_data = self.price_cache.get(price_pair)
        current_price = price_data['price'] if price_data else None

        if not current_price:
            # NO FALLBACK - raise error if price is not available
            raise ValueError(f"No price available for {price_pair}. Price feeds may not be connected yet or the market is not being monitored.")

        # Build prices dict based on market type
        prices = {}

        if market_config["type"] == "crypto":
            # Crypto market: index token is exchange rate, collateral tokens are currencies
            exchange_rate = current_price

            # Check if this is a single-token market (long == short)
            if market_config["longToken"] == market_config["shortToken"]:
                # Single-token crypto market (e.g., USDTARS with mUSD/mUSD)
                prices = {
                    market_config["indexToken"]: int(exchange_rate * 10**12),  # Index token with precision 30-18=12
                    market_config["longToken"]: 1 * 10**24,                    # mUSD = $1 with precision 30-6=24
                    market_config["shortToken"]: 1 * 10**24,                   # mUSD = $1 (same token)
                }
            else:
                # Dual-token crypto market (e.g., USDTNGN with mUSD/mNGN)
                prices = {
                    market_config["indexToken"]: int(exchange_rate * 10**12),        # mUSDTNGN with precision 30-18=12
                    market_config["longToken"]: 1 * 10**24,                          # mUSD = $1 with precision 30-6=24
                    market_config["shortToken"]: int((1 / exchange_rate) * 10**12),  # mNGN with precision 30-18=12
                }

        elif market_config["type"] == "stock":
            # Stock market: index token is stock price, collateral is mUSD
            stock_price = current_price
            prices = {
                market_config["indexToken"]: int(stock_price * 10**12),  # mTSLA with precision 30-18=12
                market_config["longToken"]: 1 * 10**24,                  # mUSD = $1 with precision 30-6=24
                market_config["shortToken"]: 1 * 10**24,                 # mUSD = $1 (single token market)
            }

        return prices

    def generate_order_data_key(self, order_key, field):
        """Generate the storage key for order data in DataStore"""
        # First, get the field constant hash: keccak256(abi.encode(FIELD_NAME))
        field_hash = Web3.keccak(encode(['string'], [field]))
        # Then combine with order key: keccak256(abi.encode(order_key, field_hash))
        storage_key = Web3.keccak(
            encode(['bytes32', 'bytes32'], [bytes.fromhex(order_key[2:]), field_hash])
        )
        return storage_key

    async def fetch_order_details(self, order_key, silent=False):
        """Fetch complete order details from DataStore (parallelized for speed)"""

        if not silent:
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

            # Fetch all fields in parallel
            async def fetch_field(constant_name, field_name, method_name):
                """Fetch a single field value"""
                storage_key = self.generate_order_data_key(order_key, constant_name)

                # Call the appropriate getter method in executor (non-blocking)
                if method_name == 'getAddress':
                    value = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.datastore.functions.getAddress(storage_key).call()
                    )
                elif method_name == 'getUint':
                    value = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.datastore.functions.getUint(storage_key).call()
                    )
                elif method_name == 'getBool':
                    value = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.datastore.functions.getBool(storage_key).call()
                    )
                else:
                    value = None

                return field_name, value

            # Execute all fetches in parallel
            fetch_tasks = [
                fetch_field(constant_name, field_name, method_name)
                for constant_name, (field_name, method_name) in fields.items()
            ]

            results = await asyncio.gather(*fetch_tasks)

            # Build order dict from results
            for field_name, value in results:
                order[field_name] = value

            # Convert order type to enum
            order_type_int = order.get('orderType', 0)
            try:
                order['orderTypeName'] = OrderType(order_type_int).name
            except:
                order['orderTypeName'] = f"Unknown({order_type_int})"

            if not silent:
                print(f"  ✅ Fetched order details:")
                print(f"     Type: {order['orderTypeName']}")
                print(f"     Market: {order['market']}")
                print(f"     Account: {order['account']}")
                print(f"     Size Delta USD: {order['sizeDeltaUsd'] / 10**30:.2f}")
                print(f"     Collateral Token: {order['initialCollateralToken']}")
                print(f"     Collateral Amount: {order['initialCollateralDeltaAmount']}")
                print(f"     Is Long: {order['isLong']}")
                print(f"     Acceptable Price: {order['acceptablePrice'] / 10**12:.6f}")
                print(f"     Min Output Amount: {order['minOutputAmount']}")
                print(f"     Trigger Price: {order['triggerPrice'] / 10**12:.4f}" if order['triggerPrice'] > 0 else "     Trigger Price: N/A (Market Order)")
                print(f"     Is Frozen: {order['isFrozen']}")

            # OPTIMIZATION: Position validation removed for speed
            # The contract will validate position on execution
            # Saves ~300ms per MarketDecrease order

            return order

        except Exception as e:
            if not silent:
                print(f"  ❌ Error fetching order details: {e}")
            return None

    async def recover_orders(self):
        """
        Recover order state from blockchain on startup.
        Queries the DataStore ORDER_LIST to find all active orders and rebuilds order queues.
        Only recovers orders created on or after October 15, 2025.
        """
        # Date filter: Only recover orders from this date onwards
        from datetime import datetime
        CUTOFF_DATE = datetime(2025, 10, 17, 0, 0, 0)
        CUTOFF_TIMESTAMP = int(CUTOFF_DATE.timestamp())

        print("\n" + "=" * 60)
        print("🔄 STARTING ORDER RECOVERY FROM BLOCKCHAIN")
        print("=" * 60)
        print(f"\n📅 Date Filter: Only recovering orders from {CUTOFF_DATE.strftime('%B %d, %Y')} onwards")
        print(f"   Cutoff Unix Timestamp: {CUTOFF_TIMESTAMP}")

        try:
            # Calculate ORDER_LIST key
            ORDER_LIST = Web3.keccak(encode(['string'], ['ORDER_LIST']))

            print(f"\n📊 Querying DataStore for active orders...")
            print(f"   ORDER_LIST key: {ORDER_LIST.hex()}")

            # Get count of orders in the ORDER_LIST
            order_count = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.datastore.functions.getBytes32Count(ORDER_LIST).call()
            )

            print(f"   Total orders in system: {order_count}")

            if order_count == 0:
                print(f"\n✅ No pending orders to recover")
                print("=" * 60 + "\n")
                return

            print(f"\n📥 Recovering {order_count} order(s)...\n")

            # Fetch all order keys in parallel (batch by 10 to avoid RPC limits)
            BATCH_SIZE = 10
            all_order_keys = []

            for i in range(0, order_count, BATCH_SIZE):
                end_index = min(i + BATCH_SIZE, order_count)

                # Fetch batch of order keys
                order_keys = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda start=i, end=end_index: self.datastore.functions.getBytes32ValuesAt(
                        ORDER_LIST, start, end
                    ).call()
                )

                all_order_keys.extend(order_keys)
                print(f"   Fetched order keys {i+1}-{end_index}")

            print(f"\n🔍 Processing {len(all_order_keys)} orders silently in background...\n")

            # Track recovery stats
            recovered_market = 0
            recovered_conditional = 0
            skipped_frozen = 0
            skipped_executing = 0
            skipped_invalid = 0
            skipped_old = 0
            failed_fetch = 0

            # Fetch and classify each order in parallel
            async def process_order(order_key_bytes):
                """Process a single recovered order"""
                nonlocal recovered_market, recovered_conditional, skipped_frozen
                nonlocal skipped_executing, skipped_invalid, skipped_old, failed_fetch

                # Convert bytes32 to hex string
                order_key = order_key_bytes.hex() if isinstance(order_key_bytes, bytes) else order_key_bytes
                if not order_key.startswith('0x'):
                    order_key = '0x' + order_key

                # Check if already being tracked (deduplication)
                if order_key in self.market_orders or order_key in self.conditional_orders or order_key in self.executing_orders:
                    skipped_executing += 1
                    return

                # Fetch order details (SILENT mode - no logs)
                order = await self.fetch_order_details(order_key, silent=True)

                if not order:
                    failed_fetch += 1
                    return

                # Skip orders from untracked markets (silently)
                market_address = order.get('market')
                if market_address not in self.MARKETS:
                    return

                # Skip orders created before cutoff date
                order_timestamp = order.get('updatedAtTime', 0)
                if order_timestamp < CUTOFF_TIMESTAMP:
                    skipped_old += 1
                    return

                # Skip frozen orders (silent)
                if order.get('isFrozen', False):
                    skipped_frozen += 1
                    return

                # Classify and queue the order (silent)
                order_class = self.classify_order(order)

                if order_class == 'MARKET':
                    self.market_orders[order_key] = order
                    recovered_market += 1

                elif order_class == 'CONDITIONAL':
                    self.conditional_orders[order_key] = order
                    recovered_conditional += 1

                elif order_class == 'INVALID':
                    skipped_invalid += 1

            # Process all orders in parallel (with rate limiting)
            CONCURRENT_LIMIT = 5  # Process 5 orders at a time to avoid overwhelming RPC

            for i in range(0, len(all_order_keys), CONCURRENT_LIMIT):
                batch = all_order_keys[i:i+CONCURRENT_LIMIT]
                await asyncio.gather(*[process_order(order_key) for order_key in batch])

            # Print recovery summary
            print("\n" + "=" * 60)
            print("📊 RECOVERY SUMMARY")
            print("=" * 60)
            print(f"   ⚡ Market orders recovered: {recovered_market}")
            print(f"   ⏱️  Conditional orders recovered: {recovered_conditional}")
            print(f"   📅 Old orders skipped (before {CUTOFF_DATE.strftime('%b %d, %Y')}): {skipped_old}")
            print(f"   ⏸️  Frozen orders skipped: {skipped_frozen}")
            print(f"   🔄 Already executing orders skipped: {skipped_executing}")
            print(f"   ⚠️  Invalid orders skipped: {skipped_invalid}")
            print(f"   ❌ Failed to fetch: {failed_fetch}")
            print(f"   ✅ Total recovered: {recovered_market + recovered_conditional}")
            print("=" * 60 + "\n")

            # If we recovered market orders, process them
            if recovered_market > 0:
                print(f"⚡ Processing {recovered_market} recovered market order(s)...\n")
                await self.process_market_orders()

        except Exception as e:
            print(f"\n❌ Error during order recovery: {e}")
            import traceback
            traceback.print_exc()
            print("\n⚠️  Continuing without recovery - will rely on WebSocket events\n")

    def classify_order(self, order):
        """Classify order as market (immediate execution) or conditional (wait for trigger)"""

        order_type = order.get('orderType', 0)

        # Skip orders with invalid market address (malformed liquidation swap orders)
        market_address = order.get('market', '0x0000000000000000000000000000000000000000')
        if market_address == '0x0000000000000000000000000000000000000000':
            print(f"   ⚠️  Skipping order with invalid market address (likely malformed liquidation swap)")
            return 'INVALID'

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

    def check_trigger_condition(self, order, current_price):
        """
        Check if a conditional order's trigger condition is met

        Returns: True if order should execute, False otherwise
        """
        if current_price is None:
            return False

        order_type = order.get('orderType')
        trigger_price = order.get('triggerPrice', 0)
        is_long = order.get('isLong', False)

        if trigger_price == 0:
            return False

        # Convert prices to same precision for comparison
        trigger_price_float = trigger_price / 10**12
        current_price_float = current_price

        # Limit Increase: Enter position when price is favorable
        if order_type == OrderType.LimitIncrease.value:
            if is_long:
                # Long: Execute when price drops to or below trigger (buy the dip)
                return current_price_float <= trigger_price_float
            else:
                # Short: Execute when price rises to or above trigger (short the top)
                return current_price_float >= trigger_price_float

        # Limit Decrease (Take Profit): Close position when price target hit
        elif order_type == OrderType.LimitDecrease.value:
            if is_long:
                # Long TP: Execute when price rises to or above trigger (take profits)
                return current_price_float >= trigger_price_float
            else:
                # Short TP: Execute when price drops to or below trigger (take profits)
                return current_price_float <= trigger_price_float

        # Stop Loss Decrease: Close position to limit losses
        elif order_type == OrderType.StopLossDecrease.value:
            if is_long:
                # Long SL: Execute when price drops to or below trigger (stop losses)
                return current_price_float <= trigger_price_float
            else:
                # Short SL: Execute when price rises to or above trigger (stop losses)
                return current_price_float >= trigger_price_float

        # Stop Increase: Enter position when momentum confirms (breakout strategy)
        elif order_type == OrderType.StopIncrease.value:
            if is_long:
                # Long: Execute when price rises to or above trigger (buy breakout)
                return current_price_float >= trigger_price_float
            else:
                # Short: Execute when price drops to or below trigger (short breakdown)
                return current_price_float <= trigger_price_float

        # Limit Swap: Token swap at favorable price
        elif order_type == OrderType.LimitSwap.value:
            # Swap when price hits target (direction depends on swap type)
            # For now, use same logic as limit increase
            if is_long:
                return current_price_float <= trigger_price_float
            else:
                return current_price_float >= trigger_price_float

        return False

    async def update_mock_provider_prices(self, market_address=None):
        """
        Update prices on MockOracleProvider using live price feed data

        Args:
            market_address: Market token address. If None, defaults to mUSDTNGN market
        """
        if not self.mock_provider:
            print("  ⚠️  MockProvider not configured, skipping price update")
            return False

        print("\n📊 Updating MockOracleProvider prices...")

        # Get current prices from live feed (market-aware)
        prices = self.get_current_prices(market_address)

        try:
            # Get initial nonce once for all transactions (including pending to avoid conflicts)
            nonce = self.w3.eth.get_transaction_count(self.account.address, 'pending')

            # Get current gas price once
            current_gas_price = self.w3.eth.gas_price
            gas_price_with_buffer = int(current_gas_price * 1.2)  # 20% buffer

            # Track all transactions
            transactions = []

            for token_address, price in prices.items():
                # Build transaction with sequential nonce
                tx = self.mock_provider.functions.setPriceWithPrecision(
                    Web3.to_checksum_address(token_address),
                    price
                ).build_transaction({
                    'from': self.account.address,
                    'nonce': nonce,  # Use tracked nonce
                    'gas': 100000,
                    'gasPrice': gas_price_with_buffer
                })

                # Sign and send
                signed_tx = self.account.sign_transaction(tx)
                tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)

                # Store transaction info
                token_name = 'mUSD' if token_address.lower() == self.mUSD.lower() else \
                             'mNGN' if token_address.lower() == self.mNGN.lower() else \
                             'mUSDTNGN' if token_address.lower() == self.mUSDTNGN.lower() else \
                             'mTSLA' if token_address.lower() == self.mTSLA.lower() else \
                             'mAAPL' if token_address.lower() == self.mAAPL.lower() else \
                             'mNVDA' if token_address.lower() == self.mNVDA.lower() else \
                             'mUSDTARS' if token_address.lower() == self.mUSDTARS.lower() else \
                             'mPKR' if token_address.lower() == self.mPKR.lower() else 'Unknown'
                transactions.append((tx_hash, token_name, price, token_address))

                # Increment nonce for next transaction
                nonce += 1

            # Now wait for all confirmations IN PARALLEL
            async def wait_for_receipt(tx_hash, token_name, price, token_address):
                """Wait for a single transaction receipt"""
                try:
                    # Use asyncio to run the blocking call in executor
                    receipt = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
                    )

                    if receipt.status == 1:
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
                        elif token_name == 'mTSLA':
                            stock_price = price / (10**12)  # Convert to USD
                            print(f"  ✅ {token_name} price updated: ${stock_price:.2f}")
                        else:
                            print(f"  ✅ {token_name} price updated: {price}")
                        return True
                    else:
                        print(f"  ❌ Failed to update price for {token_address}")
                        return False

                except Exception as e:
                    print(f"  ❌ Error waiting for price update confirmation for {token_name}: {e}")
                    return False

            # Wait for all receipts in parallel
            results = await asyncio.gather(*[
                wait_for_receipt(tx_hash, token_name, price, token_address)
                for tx_hash, token_name, price, token_address in transactions
            ])

            # Check if all succeeded
            if not all(results):
                return False

            return True

        except Exception as e:
            print(f"  ❌ Error updating prices: {e}")
            return False

    def build_oracle_params(self, order):
        """
        Build oracle parameters for order execution (market-aware)

        Extracts market from order and uses MARKETS registry to get correct tokens
        """
        # Extract market address from order
        market_address = order.get('market')

        # Get market configuration
        market_config = self.MARKETS.get(market_address)
        if not market_config:
            raise ValueError(f"Market {market_address} is not tracked by this keeper")

        # Build tokens list from market config
        tokens = [
            market_config["indexToken"],   # Index token (e.g., mUSDTNGN or mTSLA)
            market_config["longToken"],    # Long token (e.g., mUSD or USDT)
            market_config["shortToken"]    # Short token (e.g., mNGN or USDT)
        ]

        # Deduplicate tokens (important for single-token markets where long == short)
        # Oracle doesn't allow setting the same token price twice in one call
        seen = set()
        unique_tokens = []
        for token in tokens:
            token_lower = token.lower()
            if token_lower not in seen:
                seen.add(token_lower)
                unique_tokens.append(token)

        # Add collateral token if different and not already in list
        collateral_token = order.get('initialCollateralToken')
        if collateral_token:
            collateral_lower = collateral_token.lower()
            if collateral_lower not in seen:
                unique_tokens.append(collateral_token)

        # Build oracle params with deduplicated tokens
        providers = [self.MOCK_PROVIDER] * len(unique_tokens)
        data = ['0x'] * len(unique_tokens)  # Empty data for mock provider

        return {
            'tokens': unique_tokens,
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
            # Step 1: Update prices on MockProvider (market-aware)
            market_address = order.get('market')
            if not await self.update_mock_provider_prices(market_address):
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
            nonce = self.w3.eth.get_transaction_count(self.account.address, 'pending')

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

    async def monitor_conditional_orders(self):
        """
        Monitor conditional orders and execute when triggers are met
        Processes price updates from queue (both crypto and stocks)
        """
        print("\n🔍 Starting conditional order monitor (queue-based)...")

        while True:
            try:
                # Wait for next price update from queue
                pair, price = await self.price_update_queue.get()

                # Notify liquidation monitor of price update
                await self.liquidation_monitor.on_price_update(pair, price)

                # Debug: Show price update and conditional orders
                print(f"\n💰 Price Update: {pair} = {price:.4f}")
                print(f"   Conditional orders count: {len(self.conditional_orders)}")

                # Skip if no conditional orders to check
                if not self.conditional_orders:
                    continue

                # Find all orders that use this pair
                orders_to_check = []
                for order_key, order in list(self.conditional_orders.items()):
                    order_market = order['market']
                    # Normalize address to lowercase for comparison
                    order_market_lower = order_market.lower() if order_market else None

                    # Try to find matching market (case-insensitive)
                    order_pair = None
                    for market_addr, pair_name in self.MARKET_PAIR_MAPPING.items():
                        if market_addr.lower() == order_market_lower:
                            order_pair = pair_name
                            break

                    # Only check orders for the updated pair
                    if order_pair == pair:
                        # Debug: Show market mapping lookup for relevant orders only
                        print(f"   🔍 Order {order_key[:10]}... market={order_market}")
                        print(f"      Mapped to pair: {order_pair}")
                        print(f"      Trigger price: {order.get('triggerPrice', 0) / 10**12:.4f}")
                        print(f"      Is long: {order.get('isLong')}")
                        orders_to_check.append((order_key, order))

                # Skip if no orders for this pair
                if not orders_to_check:
                    continue

                # Check trigger conditions for relevant orders
                orders_to_execute = []

                for order_key, order in orders_to_check:
                    # For stocks: only trigger during market hours
                    if pair in ["TSLA", "AMZN", "GOOG", "META", "MSFT", "NVDA", "AAPL"]:
                        if not is_market_open():
                            continue  # Skip stock orders outside market hours

                    # Check if trigger condition is met
                    if self.check_trigger_condition(order, price):
                        orders_to_execute.append((order_key, order))

                # Execute triggered orders
                for order_key, order in orders_to_execute:
                    print(f"\n🎯 Conditional order triggered!")
                    print(f"   Pair: {pair}")
                    print(f"   Order Key: {order_key}")
                    print(f"   Type: {order['orderTypeName']}")
                    print(f"   Trigger Price: {order['triggerPrice'] / 10**12:.4f}")
                    print(f"   Current Price: {price:.4f}")

                    # Remove from conditional orders
                    if order_key in self.conditional_orders:
                        del self.conditional_orders[order_key]

                    # Execute the order
                    await self.execute_order(order_key, order)

            except asyncio.CancelledError:
                # Task was cancelled (shutdown)
                print("\n🛑 Conditional order monitor stopped")
                break
            except Exception as e:
                print(f"\n❌ Error in conditional order monitor: {e}")
                await asyncio.sleep(2)  # Brief pause before continuing

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

        # Deduplication: Check if order is already being tracked
        if order_key in self.market_orders or order_key in self.conditional_orders or order_key in self.executing_orders:
            print(f"   ℹ️  Order already being tracked (recovered from blockchain)")
            print("-" * 60)
            return

        # Fetch full order details from DataStore
        order = await self.fetch_order_details(order_key)

        if order:
            # Check if market is tracked - silently ignore untracked markets
            market_address = order.get('market')
            if market_address not in self.MARKETS:
                # Silently ignore orders from untracked markets
                return

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
                        print(f"   📈 Will execute when price <= {order['triggerPrice'] / 10**12:.4f}")
                    else:
                        print(f"   📉 Will execute when price >= {order['triggerPrice'] / 10**12:.4f}")
                elif order['orderType'] == OrderType.StopLossDecrease.value:
                    if order['isLong']:
                        print(f"   🛑 Stop loss will trigger when price <= {order['triggerPrice'] / 10**12:.4f}")
                    else:
                        print(f"   🛑 Stop loss will trigger when price >= {order['triggerPrice'] / 10**12:.4f}")

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
        """Main entry point for the keeper - true non-blocking approach"""

        print("=" * 60)
        print("       ORDER KEEPER V2 - CRYPTO + STOCKS")
        print("=" * 60)

        # STEP 1: Connect to price feeds FIRST (critical dependency)
        print("\n🔌 Connecting to price feeds...")

        async def connect_crypto_feed():
            try:
                await self.crypto_feed.connect()
                print("   ✅ Crypto price feed connected")
            except Exception as e:
                print(f"   ❌ Crypto price feed failed: {e}")

        async def connect_stock_feed():
            try:
                await self.stock_feed.connect()
                asyncio.create_task(self.stock_feed.log_prices_periodically())
                print("   ✅ Stock price feed connected")
            except Exception as e:
                print(f"   ❌ Stock price feed failed: {e}")

        # Connect both feeds in parallel
        await asyncio.gather(
            connect_crypto_feed(),
            connect_stock_feed()
        )

        print("\n🚀 Starting keeper services...")

        # STEP 2: Initialize liquidation monitor cache (loads all positions)
        await self.liquidation_monitor.async_init()

        # STEP 3: Start all background services in parallel (truly non-blocking)
        async def run_recovery():
            """Background order recovery"""
            try:
                await self.recover_orders()
            except Exception as e:
                print(f"❌ Recovery error: {e}")

        async def run_websocket():
            """Main WebSocket listener with reconnection"""
            while True:
                try:
                    await self.connect_and_subscribe()
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    print(f"❌ WebSocket error: {e}")
                    print("⏳ Reconnecting in 5 seconds...")
                    await asyncio.sleep(5)

        # Create all tasks
        recovery_task = asyncio.create_task(run_recovery())
        monitor_task = asyncio.create_task(self.monitor_conditional_orders())
        liquidation_task = asyncio.create_task(self.liquidation_monitor.monitor_loop())
        websocket_task = asyncio.create_task(run_websocket())

        print("   ✅ Order recovery (background)")
        print("   ✅ Conditional order monitor")
        print("   ✅ Liquidation monitor")
        print("   ✅ WebSocket event listener")
        print("\n👂 Keeper is ready - listening for orders...\n")

        # Wait for all tasks (or until interrupted)
        try:
            await asyncio.gather(
                recovery_task,
                monitor_task,
                liquidation_task,
                websocket_task
            )
        except KeyboardInterrupt:
            print("\n👋 Shutting down...")
            # Cancel all tasks
            recovery_task.cancel()
            monitor_task.cancel()
            liquidation_task.cancel()
            websocket_task.cancel()
            # Disconnect price feeds
            await self.crypto_feed.disconnect()
            await self.stock_feed.disconnect()


async def main():
    """Run the order keeper"""
    keeper = OrderKeeper()
    await keeper.run()


if __name__ == "__main__":
    print("\n🚀 Starting Order Keeper V2\n")
    asyncio.run(main())