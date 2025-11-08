"""
Cancel All Orders Script
Cancels all pending orders in the DataStore by calling OrderHandler.cancelOrder()

Usage:
    python cancel_all_orders.py              # Prompts for confirmation
    python cancel_all_orders.py --yes        # Auto-confirm (no prompt)
"""

import asyncio
from web3 import Web3
from eth_abi import encode
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# DATE FILTER: Only cancel orders created on or after this date
CUTOFF_DATE = datetime(2025, 10, 11, 0, 0, 0)  # October 11, 2025, 00:00:00
CUTOFF_TIMESTAMP = int(CUTOFF_DATE.timestamp())

async def main():
    print("\n" + "=" * 60)
    print("       CANCEL ALL PENDING ORDERS")
    print("=" * 60)

    # Setup Web3
    alchemy_key = os.getenv("ALCHEMY_KEY")
    infura_key = os.getenv("INFURA_KEY")
    private_key = os.getenv("UPDATER_PRIVATE_KEY")

    if not private_key:
        raise ValueError("Please set UPDATER_PRIVATE_KEY in .env")

    if alchemy_key:
        HTTP_URL = f"https://arb-sepolia.g.alchemy.com/v2/{alchemy_key}"
    elif infura_key:
        HTTP_URL = f"https://arbitrum-sepolia.infura.io/v3/{infura_key}"
    else:
        raise ValueError("Please set INFURA_KEY or ALCHEMY_KEY in .env")

    # Setup Web3
    w3 = Web3(Web3.HTTPProvider(HTTP_URL))
    account = w3.eth.account.from_key(private_key)

    print(f"\n📋 Account: {account.address}")
    print(f"   Balance: {w3.eth.get_balance(account.address) / 10**18:.4f} ETH")

    # Contract addresses
    DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
    ORDER_HANDLER = "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7"

    # DataStore ABI
    datastore_abi = [
        {
            "inputs": [{"name": "key", "type": "bytes32"}],
            "name": "getAddress",
            "outputs": [{"name": "", "type": "address"}],
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

    # OrderHandler ABI
    order_handler_abi = [
        {
            "inputs": [{"name": "key", "type": "bytes32"}],
            "name": "cancelOrder",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        }
    ]

    # Setup contracts
    datastore = w3.eth.contract(
        address=Web3.to_checksum_address(DATA_STORE),
        abi=datastore_abi
    )

    order_handler = w3.eth.contract(
        address=Web3.to_checksum_address(ORDER_HANDLER),
        abi=order_handler_abi
    )

    # Get ORDER_LIST
    ORDER_LIST = Web3.keccak(encode(['string'], ['ORDER_LIST']))
    print(f"\n📊 Querying ORDER_LIST...")
    print(f"   Key: {ORDER_LIST.hex()}")

    # Get order count
    order_count = datastore.functions.getBytes32Count(ORDER_LIST).call()
    print(f"   Total pending orders: {order_count}")

    if order_count == 0:
        print(f"\n✅ No orders to cancel")
        return

    # Check for --yes flag
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv

    # Confirm with user
    print(f"\n⚠️  WARNING: This will cancel {order_count} order(s)!")

    if auto_confirm:
        print("   Auto-confirmed via --yes flag")
    else:
        response = input("   Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("\n❌ Cancelled by user")
            return

    # Fetch all order keys
    print(f"\n📥 Fetching order keys...")
    all_order_keys = []

    BATCH_SIZE = 10
    for i in range(0, order_count, BATCH_SIZE):
        end_index = min(i + BATCH_SIZE, order_count)
        order_keys = datastore.functions.getBytes32ValuesAt(ORDER_LIST, i, end_index).call()
        all_order_keys.extend(order_keys)
        print(f"   Fetched {i+1}-{end_index}")

    print(f"\n🗑️  Cancelling {len(all_order_keys)} orders...\n")

    # Get initial nonce
    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price
    gas_price_with_buffer = int(gas_price * 1.2)

    # Track results
    cancelled = 0
    failed = 0
    tx_hashes = []

    # Cancel each order
    for idx, order_key in enumerate(all_order_keys):
        try:
            print(f"[{idx+1}/{len(all_order_keys)}] Cancelling order: {order_key.hex()[:16]}...")

            # Build transaction
            tx = order_handler.functions.cancelOrder(
                order_key
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 500000,  # Gas limit for cancellation
                'gasPrice': gas_price_with_buffer,
                'value': 0
            })

            # Sign and send
            signed_tx = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hashes.append(tx_hash)

            print(f"   📤 TX: {tx_hash.hex()}")

            # Increment nonce
            nonce += 1
            cancelled += 1

            # Small delay to avoid overwhelming RPC
            await asyncio.sleep(0.5)

        except Exception as e:
            print(f"   ❌ Failed: {e}")
            failed += 1
            # Continue with next order

    # Wait for confirmations
    print(f"\n⏳ Waiting for confirmations...")

    confirmed = 0
    reverted = 0

    for idx, tx_hash in enumerate(tx_hashes):
        try:
            print(f"[{idx+1}/{len(tx_hashes)}] Confirming {tx_hash.hex()[:16]}...")

            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt.status == 1:
                print(f"   ✅ Confirmed")
                confirmed += 1
            else:
                print(f"   ❌ Reverted")
                reverted += 1

        except Exception as e:
            print(f"   ⚠️  Timeout: {e}")
            reverted += 1

    # Print summary
    print("\n" + "=" * 60)
    print("📊 CANCELLATION SUMMARY")
    print("=" * 60)
    print(f"   Total orders: {order_count}")
    print(f"   Submitted: {cancelled}")
    print(f"   Failed to submit: {failed}")
    print(f"   Confirmed: {confirmed}")
    print(f"   Reverted/Timeout: {reverted}")
    print("=" * 60)

    # Check remaining orders
    remaining = datastore.functions.getBytes32Count(ORDER_LIST).call()
    print(f"\n📊 Remaining orders in DataStore: {remaining}")

    if remaining == 0:
        print("   ✅ All orders cancelled successfully!")
    else:
        print(f"   ⚠️  {remaining} orders still pending (may need manual review)")

if __name__ == "__main__":
    asyncio.run(main())
