"""
Test key generation to match Solidity
"""

from web3 import Web3
from eth_abi import encode

# Order key from the test
order_key = "0x66c7ce2641db441c9b861263f5d6cbe33f8392f0bc229fb8858c0d6db196791f"

print("Testing Python key generation")
print("=" * 60)
print(f"Order Key: {order_key}")
print()

# Method 1: What the current code is doing
print("Method 1: Current Python code")
field_hash = Web3.solidity_keccak(['string'], ['ACCOUNT'])
print(f"Field hash: {field_hash.hex()}")
storage_key = Web3.solidity_keccak(['bytes32', 'bytes32'], [order_key, field_hash])
print(f"Storage key: {storage_key.hex()}")
print()

# Method 2: Try with encode directly
print("Method 2: Using eth_abi.encode")
field_hash_2 = Web3.keccak(encode(['string'], ['ACCOUNT']))
print(f"Field hash: {field_hash_2.hex()}")
storage_key_2 = Web3.keccak(encode(['bytes32', 'bytes32'], [bytes.fromhex(order_key[2:]), field_hash_2]))
print(f"Storage key: {storage_key_2.hex()}")
print()

# The working key from JavaScript
print("Expected values from JavaScript:")
print("ACCOUNT constant: 0xe0d9c892a68419aa57cc55f7955004fbe8b8a8d8b9fd17fdd1a2cb2d099c5039")
print("Storage key: 0x0e6edb9bdff607a93a63efda07c965c5b025e6bf2183a78dcb4d239d21612603")
print()

# Compare
print("Comparison:")
print(f"Field hash matches: {field_hash.hex() == '0xe0d9c892a68419aa57cc55f7955004fbe8b8a8d8b9fd17fdd1a2cb2d099c5039'}")
print(f"Storage key matches: {storage_key.hex() == '0x0e6edb9bdff607a93a63efda07c965c5b025e6bf2183a78dcb4d239d21612603'}")