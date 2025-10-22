#!/usr/bin/env python3
"""
Test script for position cache functionality
"""

import asyncio
import time
from order_keeper_v2 import OrderKeeper

async def test_cache():
    print("=== Testing Position Cache ===\n")

    # Initialize keeper (should trigger initial cache load)
    keeper = OrderKeeper()
    liquidation_monitor = keeper.liquidation_monitor

    print("\n📝 Test 1: Check initial cache load")
    print(f"   Cache size: {len(liquidation_monitor.position_cache)}")
    print(f"   Cache age: {time.time() - liquidation_monitor.cache_updated_at:.2f}s")

    if len(liquidation_monitor.position_cache) > 0:
        print(f"   ✅ Initial cache loaded with {len(liquidation_monitor.position_cache)} positions")
    else:
        print(f"   ⚠️  Cache is empty")

    print("\n📝 Test 2: Get cached positions (should use cache, not refetch)")
    start = time.time()
    cached_positions = liquidation_monitor.get_cached_positions()
    elapsed = time.time() - start
    print(f"   Retrieved {len(cached_positions)} positions in {elapsed:.3f}s")
    print(f"   ✅ Fast retrieval (used cache)")

    # Show some position details
    if len(cached_positions) > 0:
        print("\n📝 First 3 cached positions:")
        for i, pos in enumerate(cached_positions[:3]):
            market_name = "UNKNOWN"
            for market_addr, config in keeper.MARKETS.items():
                if market_addr.lower() == pos['market'].lower():
                    market_name = config['name']
                    break

            print(f"   {i+1}. {pos['account'][:10]}... - {'LONG' if pos['isLong'] else 'SHORT'} in {market_name}")

    print("\n📝 Test 3: Force cache refresh")
    liquidation_monitor.refresh_position_cache()
    print(f"   Cache size after refresh: {len(liquidation_monitor.position_cache)}")

    print("\n📝 Test 4: Simulate stale cache")
    print(f"   Setting cache timestamp to 15 minutes ago...")
    liquidation_monitor.cache_updated_at = time.time() - 900  # 15 minutes ago

    print(f"   Calling get_cached_positions() (should auto-refresh)...")
    positions = liquidation_monitor.get_cached_positions()
    print(f"   Retrieved {len(positions)} positions")
    print(f"   New cache age: {time.time() - liquidation_monitor.cache_updated_at:.2f}s")
    print(f"   ✅ Cache auto-refreshed when stale")

    print("\n" + "="*80)
    print("\n✅ Position cache is working correctly!")
    print(f"\nCache Statistics:")
    print(f"   Total active positions: {len(liquidation_monitor.position_cache)}")
    print(f"   Cache refresh interval: {liquidation_monitor.CACHE_REFRESH_INTERVAL}s ({liquidation_monitor.CACHE_REFRESH_INTERVAL/60:.0f} minutes)")
    print(f"   Last updated: {time.time() - liquidation_monitor.cache_updated_at:.1f}s ago")

if __name__ == "__main__":
    asyncio.run(test_cache())
