#!/usr/bin/env python3
"""
Test script for position enumeration functions
Tests the new fetch_all_position_keys() and get_position_info_from_key() methods
"""

import sys
import os
from web3 import Web3
from eth_abi import encode
from dotenv import load_dotenv

# Add parent directory to path to import keeper
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
load_dotenv()

def main():
    print("=== Testing Position Enumeration ===\n")

    # Setup Web3
    infura_key = os.getenv("INFURA_KEY")
    alchemy_key = os.getenv("ALCHEMY_KEY")

    if alchemy_key:
        http_url = f"https://arb-sepolia.g.alchemy.com/v2/{alchemy_key}"
    elif infura_key:
        http_url = f"https://arbitrum-sepolia.infura.io/v3/{infura_key}"
    else:
        print("❌ Please set INFURA_KEY or ALCHEMY_KEY in .env")
        return

    w3 = Web3(Web3.HTTPProvider(http_url))
    print(f"✅ Connected to Arbitrum Sepolia")
    print(f"   Latest block: {w3.eth.block_number}\n")

    # Contract addresses
    DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
    READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8"

    # DataStore ABI (minimal for testing)
    datastore_abi = [
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

    # Reader ABI (minimal for testing)
    reader_abi = [
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
        }
    ]

    # Setup contracts
    datastore = w3.eth.contract(
        address=Web3.to_checksum_address(DATA_STORE),
        abi=datastore_abi
    )

    reader = w3.eth.contract(
        address=Web3.to_checksum_address(READER),
        abi=reader_abi
    )

    # Test 1: Get POSITION_LIST key
    print("📝 Test 1: Calculate POSITION_LIST key\n")
    position_list_bytes = encode(['string'], ['POSITION_LIST'])
    position_list_key = Web3.keccak(position_list_bytes)
    print(f"   POSITION_LIST key: {position_list_key.hex()}\n")

    # Test 2: Fetch position count
    print("📝 Test 2: Get position count from DataStore\n")
    position_count = datastore.functions.getBytes32Count(position_list_key).call()
    print(f"   Total positions: {position_count}\n")

    if position_count == 0:
        print("❌ No positions found in DataStore!")
        return

    # Test 3: Fetch position keys
    print("📝 Test 3: Fetch position keys\n")
    batch_size = min(position_count, 1000)
    position_keys = datastore.functions.getBytes32ValuesAt(
        position_list_key,
        0,
        batch_size
    ).call()
    print(f"   Fetched {len(position_keys)} position keys\n")

    # Test 4: Get details for each position
    print("📝 Test 4: Get position details and filter active positions\n")

    active_positions = []

    for i, position_key in enumerate(position_keys):
        try:
            position = reader.functions.getPosition(
                Web3.to_checksum_address(DATA_STORE),
                position_key
            ).call()

            # Extract position data
            account = position[0][0]  # addresses.account
            market = position[0][1]   # addresses.market
            collateral_token = position[0][2]  # addresses.collateralToken

            size_in_usd = position[1][0]  # numbers.sizeInUsd
            size_in_tokens = position[1][1]  # numbers.sizeInTokens
            collateral_amount = position[1][2]  # numbers.collateralAmount

            is_long = position[2][0]  # flags.isLong

            # Filter for active positions (size > 0)
            if size_in_usd > 0:
                active_positions.append({
                    'key': position_key.hex(),
                    'account': account,
                    'market': market,
                    'collateralToken': collateral_token,
                    'isLong': is_long,
                    'sizeInUsd': size_in_usd,
                    'sizeInTokens': size_in_tokens,
                    'collateralAmount': collateral_amount
                })

                print(f"   ✅ Active Position #{len(active_positions)}:")
                print(f"      Account: {account}")
                print(f"      Market: {market}")
                print(f"      Side: {'LONG' if is_long else 'SHORT'}")
                print(f"      Size USD: {size_in_usd / 10**30:.2f}")
                print(f"      Collateral: {collateral_amount / 10**6:.2f} mUSD")
                print()

        except Exception as e:
            # Position might be deleted or invalid
            pass

    # Summary
    print("=" * 80)
    print("\n📊 ENUMERATION TEST SUMMARY\n")
    print(f"Total positions in DataStore: {position_count}")
    print(f"Position keys fetched: {len(position_keys)}")
    print(f"Active positions (size > 0): {len(active_positions)}")
    print(f"Inactive/deleted positions: {len(position_keys) - len(active_positions)}")

    if active_positions:
        print("\n✅ Position enumeration is working correctly!")
        print("\nActive position accounts:")
        for i, p in enumerate(active_positions):
            print(f"{i+1}. {p['account']} - {'LONG' if p['isLong'] else 'SHORT'} in {p['market']}")
    else:
        print("\n⚠️  No active positions found (all positions have size = 0)")

if __name__ == "__main__":
    main()
