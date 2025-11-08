#!/usr/bin/env python3
"""
Test script for position enumeration functions
Tests the new LiquidationMonitor methods
"""

import asyncio
import os
from dotenv import load_dotenv
from order_keeper_v2 import OrderKeeper

# Load environment
load_dotenv()

async def test_enumeration():
    print("=== Testing Position Enumeration ===\n")

    # Initialize keeper
    keeper = OrderKeeper()
    liquidation_monitor = keeper.liquidation_monitor

    print("\n📝 Test 1: Get POSITION_LIST key")
    position_list_key = liquidation_monitor.get_position_list_key()
    print(f"   POSITION_LIST key: {position_list_key.hex()}\n")

    print("📝 Test 2: Fetch all position keys from DataStore")
    position_keys = liquidation_monitor.fetch_all_position_keys()
    print(f"   Total position keys fetched: {len(position_keys)}\n")

    if len(position_keys) == 0:
        print("❌ No positions found!")
        return

    print("📝 Test 3: Get position info for each key\n")
    active_positions = []

    for i, position_key in enumerate(position_keys):
        # First, let's get the raw position data to debug
        try:
            raw_position = keeper.reader.functions.getPosition(
                keeper.w3.to_checksum_address(keeper.DATA_STORE),
                position_key
            ).call()

            # Debug: print first few positions' structure to compare with JS
            if i < 5:
                print(f"   🔍 DEBUG - Position #{i+1} raw structure:")
                print(f"      Key: {position_key.hex()}")
                print(f"      Account: {raw_position[0][0]}")
                print(f"      Market: {raw_position[0][1]}")
                print(f"      Collateral: {raw_position[0][2]}")
                print(f"      flags tuple: {raw_position[2]}")
                print(f"      flags[0] (isLong): {raw_position[2][0]} (type: {type(raw_position[2][0])})")
                print()
        except:
            pass

        position_info = liquidation_monitor.get_position_info_from_key(position_key)

        if position_info:
            active_positions.append(position_info)

            market_name = "UNKNOWN"
            for market_addr, config in keeper.MARKETS.items():
                if market_addr.lower() == position_info['market'].lower():
                    market_name = config['name']
                    break

            print(f"   ✅ Active Position #{len(active_positions)}:")
            print(f"      Account: {position_info['account']}")
            print(f"      Market: {market_name}")
            print(f"      Side: {'LONG' if position_info['isLong'] else 'SHORT'}")
            print(f"      isLong value: {position_info['isLong']} (type: {type(position_info['isLong'])})")
            print(f"      Size USD: {position_info['sizeInUsd'] / 10**30:.2f}")
            print(f"      Collateral: {position_info['collateralAmount'] / 10**6:.2f} mUSD")
            print()

    # Summary
    print("=" * 80)
    print("\n📊 ENUMERATION TEST SUMMARY\n")
    print(f"Total position keys: {len(position_keys)}")
    print(f"Active positions (size > 0): {len(active_positions)}")
    print(f"Inactive/deleted positions: {len(position_keys) - len(active_positions)}")

    if active_positions:
        print("\n✅ Position enumeration is working correctly!")
        print("\nActive position accounts:")
        for i, p in enumerate(active_positions):
            market_name = "UNKNOWN"
            for market_addr, config in keeper.MARKETS.items():
                if market_addr.lower() == p['market'].lower():
                    market_name = config['name']
                    break
            print(f"{i+1}. {p['account']} - {'LONG' if p['isLong'] else 'SHORT'} in {market_name}")
    else:
        print("\n⚠️  No active positions found (all positions have size = 0)")

if __name__ == "__main__":
    asyncio.run(test_enumeration())
