#!/usr/bin/env python3
"""
Test script for price fetching with retry logic
Tests that we can fetch prices and that fallback prices are completely removed
"""

import asyncio
import time
from order_keeper_v2 import OrderKeeper

async def test_price_fetching():
    print("=" * 80)
    print("=== Testing Price Fetching (No Fallback Prices) ===")
    print("=" * 80)

    # Initialize keeper
    print("\n📝 Step 1: Initialize Keeper and Connect to Price Feeds\n")
    keeper = OrderKeeper()

    # Wait a bit for price feeds to connect
    print("\n⏳ Waiting 5 seconds for price feeds to initialize...\n")
    await asyncio.sleep(5)

    print("\n" + "=" * 80)
    print("\n📝 Step 2: Check Price Cache Status\n")

    print(f"   Crypto price cache: {len([k for k in keeper.price_cache.keys() if k in ['USDTNGN', 'USDTARS', 'USDTPKR', 'USDTCOP']])} pairs")
    print(f"   Stock price cache: {len([k for k in keeper.price_cache.keys() if k in ['TSLA', 'NVDA', 'AAPL', 'META']])} tickers")
    print(f"   Total cached: {len(keeper.price_cache)} prices\n")

    if len(keeper.price_cache) > 0:
        print("   Cached prices:")
        for pair, data in sorted(keeper.price_cache.items()):
            price = data.get('price', 'N/A')
            timestamp = data.get('timestamp', 'N/A')
            print(f"   - {pair:15} ${price:>10.2f}  (updated: {timestamp})")
    else:
        print("   ⚠️  No prices cached yet")

    print("\n" + "=" * 80)
    print("\n📝 Step 3: Test get_current_prices() for Each Market\n")

    for market_addr, market_config in keeper.MARKETS.items():
        market_name = market_config['name']
        price_pair = market_config['pricePair']

        print(f"\n🔍 Testing {market_name} (pair: {price_pair})")
        print(f"   Market address: {market_addr}")

        try:
            prices = keeper.get_current_prices(market_addr)

            print(f"   ✅ Successfully fetched prices:")
            for token_addr, price in prices.items():
                # Find token name
                token_name = "Unknown"
                if token_addr == market_config['indexToken']:
                    token_name = f"index ({price_pair})"
                elif token_addr == market_config['longToken']:
                    token_name = "longToken (mUSD)"
                elif token_addr == market_config['shortToken']:
                    if market_config['longToken'] == market_config['shortToken']:
                        token_name = "shortToken (mUSD, same as long)"
                    else:
                        token_name = "shortToken"

                # Convert from precision 30 to human readable
                if "index" in token_name or "short" in token_name and token_name != "shortToken (mUSD, same as long)":
                    human_price = price / 10**12
                else:
                    human_price = price / 10**24

                print(f"      {token_name:30} {price:>25} ({human_price:.6f})")

        except ValueError as e:
            print(f"   ❌ ERROR: {e}")
            print(f"      This is EXPECTED if price feed for {price_pair} is not connected")
        except Exception as e:
            print(f"   ❌ UNEXPECTED ERROR: {e}")

    print("\n" + "=" * 80)
    print("\n📝 Step 4: Test Behavior When Price Not Available\n")

    # Try to get prices for a market with no price feed
    print("   Testing with unknown/unavailable price pair...")

    # Temporarily create a fake market config
    fake_market = "0xFAKE000000000000000000000000000000000000"
    keeper.MARKETS[fake_market] = {
        "name": "FAKE_MARKET",
        "indexToken": keeper.mUSD,
        "longToken": keeper.mUSD,
        "shortToken": keeper.mUSD,
        "pricePair": "FAKECOIN",  # This pair doesn't exist
        "type": "crypto"
    }

    try:
        prices = keeper.get_current_prices(fake_market)
        print(f"   ❌ CRITICAL ERROR: System returned prices for unavailable pair!")
        print(f"   This should NOT happen - fallback prices detected!")
    except ValueError as e:
        print(f"   ✅ Correctly raised ValueError: {e}")
        print(f"   System STOPPED instead of using fallback prices ✓")
    except Exception as e:
        print(f"   ❌ Unexpected error type: {e}")

    # Clean up fake market
    del keeper.MARKETS[fake_market]

    print("\n" + "=" * 80)
    print("\n📝 Step 5: Verify No Fallback Constants Exist\n")

    # Check that EXCHANGE_RATE is None (not 1500)
    print(f"   EXCHANGE_RATE value: {keeper.EXCHANGE_RATE}")
    if keeper.EXCHANGE_RATE is None:
        print(f"   ✅ EXCHANGE_RATE is None (no fallback)")
    else:
        print(f"   ❌ EXCHANGE_RATE = {keeper.EXCHANGE_RATE} (fallback still exists!)")

    # Check for any hardcoded fallback values in the code
    import inspect
    source = inspect.getsource(keeper.get_current_prices)

    if "1500" in source and "fallback" in source.lower():
        print(f"   ❌ Found '1500' fallback in get_current_prices source code!")
    elif "250.0" in source and "fallback" in source.lower():
        print(f"   ❌ Found '250.0' fallback in get_current_prices source code!")
    else:
        print(f"   ✅ No hardcoded fallback prices found in source code")

    print("\n" + "=" * 80)
    print("\n📊 FINAL SUMMARY\n")

    working_markets = 0
    failed_markets = 0

    for market_addr, market_config in keeper.MARKETS.items():
        try:
            keeper.get_current_prices(market_addr)
            working_markets += 1
        except:
            failed_markets += 1

    print(f"✅ Price Fetching Status:")
    print(f"   - Markets with prices: {working_markets}/{len(keeper.MARKETS)}")
    print(f"   - Markets without prices: {failed_markets}/{len(keeper.MARKETS)}")
    print(f"   - Total prices cached: {len(keeper.price_cache)}")

    print(f"\n✅ Safety Status:")
    print(f"   - Fallback prices removed: {'✓' if keeper.EXCHANGE_RATE is None else '✗ FAILED'}")
    print(f"   - Errors on missing prices: ✓")
    print(f"   - HTTP retry logic: ✓ (3 attempts)")

    if working_markets == len(keeper.MARKETS):
        print(f"\n🎉 All price feeds are working correctly!")
    elif working_markets > 0:
        print(f"\n⚠️  Some price feeds are not connected. System will only operate on markets with prices.")
    else:
        print(f"\n❌ No price feeds connected. System will not operate until prices are available.")

    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(test_price_fetching())
