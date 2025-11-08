"""
  Price Keeper for GMX Oracle
  Updates FX prices on the GMX Oracle contract using setPrimaryPrice
"""

import os
import asyncio
import logging
from typing import Dict, List
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
import httpx
from datetime import datetime
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
ORACLE_ADDRESS = "0xE89d94669f49D278cCD094A084139eB6639C0a93"  # GMX Oracle (from new deployment)
ARBITRUM_TESTNET_RPC = "https://sepolia-rollup.arbitrum.io/rpc"

# Currency identifiers mapping
CURRENCY_IDENTIFIERS = {
    "USDTNGN": "0xd66e60AA5b6982649a116e6944Daec22b15468Ad",  # sNGN token address
}

'''
CURRENCY_IDENTIFIERS = {
    "USDTNGN": "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
    "USDTARS": "0x0000000000000000000000000000000000000002",
    "USDTPKR": "0x0000000000000000000000000000000000000003",
    "USDTGHS": "0x0000000000000000000000000000000000000004",
    "USDTCOP": "0x0000000000000000000000000000000000000008",
    
}
'''

# MarksSimplifiedOracle ABI - only the functions we need
ORACLE_ABI = [
      {
          "inputs": [
              {"internalType": "address", "name": "token", "type": "address"},
              {
                  "components": [
                      {"internalType": "uint256", "name": "min", "type": "uint256"},
                      {"internalType": "uint256", "name": "max", "type": "uint256"}
                  ],
                  "internalType": "struct Price.Props",
                  "name": "price",
                  "type": "tuple"
              }
          ],
          "name": "setPrimaryPrice",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "inputs": [],
          "name": "clearAllPrices",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
          "name": "getPrimaryPrice",
          "outputs": [
              {
                  "components": [
                      {"internalType": "uint256", "name": "min", "type": "uint256"},
                      {"internalType": "uint256", "name": "max", "type": "uint256"}
                  ],
                  "internalType": "struct Price.Props",
                  "name": "",
                  "type": "tuple"
              }
          ],
          "stateMutability": "view",
          "type": "function"
      }
  ]

class MarksOracleKeeper:
    def __init__(self, private_key: str, price_feed_url: str):
        # Setup Web3
        self.w3 = Web3(Web3.HTTPProvider(ARBITRUM_TESTNET_RPC))
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        
        # Setup account
        self.account = self.w3.eth.account.from_key(private_key)
        self.w3.eth.default_account = self.account.address
        
        # Setup contract
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(ORACLE_ADDRESS),
            abi=ORACLE_ABI
        )
        
        self.price_feed_url = price_feed_url
        self.client = httpx.AsyncClient(timeout=10.0)
        self.chain_id = 421614  # Arbitrum Sepolia
        
        logger.info(f"Keeper initialized")
        logger.info(f"Keeper address: {self.account.address}")
        logger.info(f"Oracle address: {ORACLE_ADDRESS}")
    
    async def fetch_price(self, pair: str) -> float:
        """Fetch price from marks-server API"""
        try:
            response = await self.client.get(
                f"{self.price_feed_url}/midpoint",
                params={"pair": pair}
            )
            response.raise_for_status()
            data = response.json()
            return float(data["midpoint"])
        except Exception as e:
            logger.error(f"Error fetching price for {pair}: {e}")
            raise
    
    async def fetch_all_prices(self) -> Dict[str, float]:
        """Fetch all prices from marks-server"""
        prices = {}
        for pair in CURRENCY_IDENTIFIERS.keys():
            try:
                price = await self.fetch_price(pair)
                prices[pair] = price
                logger.info(f"Fetched {pair}: {price}")
            except Exception as e:
                logger.error(f"Failed to fetch {pair}: {e}")
        return prices
    
    async def update_prices(self):
      """Fetch prices and update the Oracle"""
      try:
          logger.info("Fetching prices from marks-server...")
          prices = await self.fetch_all_prices()

          if not prices:
              logger.warning("No prices fetched, skipping update")
              return

          # Clear all existing prices first
          logger.info("Clearing existing prices...")
          try:
              clear_tx = self.contract.functions.clearAllPrices().build_transaction({
                  'from': self.account.address,
                  'gas': 500000,  # Estimate for clearing
                  'gasPrice': self.w3.eth.gas_price,
                  'nonce': self.w3.eth.get_transaction_count(self.account.address),
                  'chainId': self.chain_id
              })

              signed_clear_tx = self.account.sign_transaction(clear_tx)
              clear_tx_hash = self.w3.eth.send_raw_transaction(signed_clear_tx.raw_transaction)

              logger.info(f"Clear transaction sent: {clear_tx_hash.hex()}")
              clear_receipt = self.w3.eth.wait_for_transaction_receipt(clear_tx_hash)

              if clear_receipt['status'] == 1:
                  logger.info("✅ Prices cleared successfully")
              else:
                  logger.error("❌ Failed to clear prices")
                  return

          except Exception as e:
              logger.error(f"Error clearing prices: {e}")
              return

          logger.info(f"Updating {len(prices)} token prices...")

          # Get current nonce after clear transaction
          current_nonce = self.w3.eth.get_transaction_count(self.account.address)

          for pair, price in prices.items():
              if pair not in CURRENCY_IDENTIFIERS:
                  continue

              token = Web3.to_checksum_address(CURRENCY_IDENTIFIERS[pair])

              # Convert price to 30 decimals
              price_30_decimals = int(price * 10**30)

              logger.info(f"{pair}: {price} -> {price_30_decimals} (30 decimals)")

              # Create price tuple (min, max) - same value for both since no spread
              price_tuple = (price_30_decimals, price_30_decimals)

              try:
                  # Estimate gas for this specific price update
                  gas_estimate = self.contract.functions.setPrimaryPrice(
                      token,
                      price_tuple
                  ).estimate_gas({'from': self.account.address})

                  logger.info(f"Estimated gas for {pair}: {gas_estimate}")

                  # Build transaction
                  tx = self.contract.functions.setPrimaryPrice(
                      token,
                      price_tuple
                  ).build_transaction({
                      'from': self.account.address,
                      'gas': int(gas_estimate * 1.2),  # 20% buffer
                      'gasPrice': self.w3.eth.gas_price,
                      'nonce': current_nonce,
                      'chainId': self.chain_id
                  })

                  # Increment nonce for next transaction
                  current_nonce += 1

                  # Sign and send transaction
                  signed_tx = self.account.sign_transaction(tx)
                  tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)

                  logger.info(f"Transaction sent for {pair}: {tx_hash.hex()}")

                  # Wait for confirmation
                  receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

                  if receipt['status'] == 1:
                      logger.info(f"✅ {pair} price updated successfully! Gas used: {receipt['gasUsed']}")
                  else:
                      logger.error(f"❌ {pair} transaction failed!")

              except Exception as e:
                  logger.error(f"Error updating {pair}: {e}")
                  # Continue with next token even if one fails
                  continue

          # After all updates, verify prices
          await self.verify_prices()

      except Exception as e:
          logger.error(f"Error in update_prices: {e}")
          import traceback
          logger.error(traceback.format_exc())

    async def verify_prices(self):
      """Verify prices were set correctly in the Oracle"""
      logger.info("Verifying prices...")
      for pair, address in CURRENCY_IDENTIFIERS.items():
          try:
              result = self.contract.functions.getPrimaryPrice(
                  Web3.to_checksum_address(address)
              ).call()

              # Result is a tuple (min, max) 
              min_price = result[0] / 10**30
              max_price = result[1] / 10**30

              logger.info(f"✓ {pair}: {min_price:.2f} NGN per USDT")

          except Exception as e:
              # Handle EmptyPrimaryPrice error gracefully
              if "EmptyPrimaryPrice" in str(e):
                  logger.warning(f"✗ {pair}: No price set")
              else:
                  logger.error(f"Error verifying {pair}: {e}")

    
    async def run_keeper_loop(self, interval_seconds: int = 60):
        """Run the keeper in a loop, updating prices periodically"""
        logger.info(f"Starting keeper loop with {interval_seconds}s interval")
        
        while True:
            try:
                logger.info("=" * 50)
                logger.info(f"Update cycle started at {datetime.now()}")
                
                await self.update_prices()
                
                logger.info(f"Sleeping for {interval_seconds} seconds...")
                await asyncio.sleep(interval_seconds)
                
            except KeyboardInterrupt:
                logger.info("Keeper stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in keeper loop: {e}")
                logger.info(f"Retrying in {interval_seconds} seconds...")
                await asyncio.sleep(interval_seconds)
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()

async def main():
    # Load environment variables
    load_dotenv()
    
    UPDATER_PRIVATE_KEY = os.getenv("UPDATER_PRIVATE_KEY")
    PRICE_FEED_URL = os.getenv("PRICE_FEED_URL", "https://sr-server-1df31ed512f3.herokuapp.com")
    
    if not UPDATER_PRIVATE_KEY:
        logger.error("Please set UPDATER_PRIVATE_KEY in .env file")
        return
    
    keeper = MarksOracleKeeper(
        UPDATER_PRIVATE_KEY,
        PRICE_FEED_URL
    )
    
    try:
        # Run keeper loop (updates every 60 seconds)
        await keeper.run_keeper_loop(interval_seconds=60)
    finally:
        await keeper.close()

if __name__ == "__main__":
    asyncio.run(main())