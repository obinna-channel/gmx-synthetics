const hre = require("hardhat");
const { ethers } = require("ethers");
const axios = require("axios");

// Contract addresses
const ADDRESSES = {
  DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
  READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
  REFERRAL_STORAGE: "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547",
  mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
};

// All markets
const MARKETS = {
  "0x8ae559448a1482faffC925eF6a233276588348Df": { name: "TSLA", pricePair: "TSLA" },
  "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": { name: "USDTARS", pricePair: "USDTARS" },
  "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": { name: "NVDA", pricePair: "NVDA" },
  "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": { name: "USDTPKR", pricePair: "USDTPKR" },
  "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": { name: "USDTCOP", pricePair: "USDTCOP" },
  "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": { name: "AAPL", pricePair: "AAPL" },
  "0xafd908D358315efDBA493311AbE30648DEC4d2dE": { name: "META", pricePair: "META" },
  "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": { name: "USDTNGN", pricePair: "USDTNGN" },
};

// Fetch current price from marks-server
async function fetchCurrentPrice(pricePair) {
  const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
  const url = `${PRICE_SERVER}/api/v1/price/current/${pricePair}`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    if (response.status === 200 && response.data) {
      return response.data.price;
    }
  } catch (error) {
    console.log(`   ⚠️  Error fetching price for ${pricePair}: ${error.message}`);
  }
  return null;
}

async function main() {
  const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

  console.log("\n=== Position Fees Debug Script ===\n");
  console.log(`Account: ${ACCOUNT_ADDRESS}\n`);

  const [signer] = await hre.ethers.getSigners();

  // Get contract instances
  const reader = await hre.ethers.getContractAt(
    "Reader",
    ADDRESSES.READER,
    signer
  );

  // Fetch prices for all markets
  console.log("💰 Fetching current prices from marks-server...\n");
  const priceCache = {};

  for (const [marketAddr, marketInfo] of Object.entries(MARKETS)) {
    const price = await fetchCurrentPrice(marketInfo.pricePair);
    if (price) {
      priceCache[marketAddr] = price;
      console.log(`   ✅ ${marketInfo.name}: $${price}`);
    } else {
      console.log(`   ❌ Failed to fetch price for ${marketInfo.name}`);
    }
  }

  console.log("\n" + "=".repeat(80));

  // Build marketPrices array for all markets
  console.log("\n📊 Building price payloads for Reader contract...\n");

  const allMarkets = Object.keys(MARKETS);
  const marketPricesPayload = [];

  for (const marketAddr of allMarkets) {
    const currentPrice = priceCache[marketAddr];
    if (!currentPrice) {
      console.log(`   ⚠️  Skipping ${MARKETS[marketAddr].name} - no price data`);
      continue;
    }

    // Use correct precision matching frontend:
    // indexTokenPrice: 12 decimals
    // longTokenPrice: 24 decimals (mUSD = $1)
    // shortTokenPrice: 24 decimals (mUSD = $1 for single-token markets)
    const indexPrice = ethers.utils.parseUnits(currentPrice.toFixed(12), 12);
    const stablePrice = ethers.utils.parseUnits("1", 24);

    marketPricesPayload.push({
      indexTokenPrice: { min: indexPrice, max: indexPrice },
      longTokenPrice: { min: stablePrice, max: stablePrice },
      shortTokenPrice: { min: stablePrice, max: stablePrice },
    });

    console.log(`   ✅ ${MARKETS[marketAddr].name} price payload ready`);
  }

  console.log("\n" + "=".repeat(80));

  // Call getAccountPositionInfoList
  console.log("\n📋 Fetching position data from Reader contract...\n");

  try {
    const positionInfoList = await reader.getAccountPositionInfoList(
      ADDRESSES.DATA_STORE,
      ADDRESSES.REFERRAL_STORAGE,
      ACCOUNT_ADDRESS,
      allMarkets,
      marketPricesPayload,
      ethers.constants.AddressZero, // uiFeeReceiver
      0, // start
      1000 // limit
    );

    console.log(`   Found ${positionInfoList.length} positions\n`);
    console.log("=".repeat(80));

    // Process each position
    for (let i = 0; i < positionInfoList.length; i++) {
      const positionInfo = positionInfoList[i];
      const { position, fees, basePnlUsd } = positionInfo;
      const { addresses, numbers, flags } = position;

      // Skip empty positions
      if (numbers.sizeInUsd.eq(0)) {
        continue;
      }

      const marketInfo = MARKETS[addresses.market.toLowerCase()] || MARKETS[addresses.market];

      console.log(`\n📍 POSITION #${i + 1}: ${marketInfo?.name || 'UNKNOWN'} ${flags.isLong ? 'LONG' : 'SHORT'}\n`);
      console.log("=".repeat(80));

      // Position basics
      console.log("\n--- POSITION DETAILS ---\n");
      console.log(`Market: ${addresses.market} (${marketInfo?.name})`);
      console.log(`Account: ${addresses.account}`);
      console.log(`Collateral Token: ${addresses.collateralToken}`);
      console.log(`Direction: ${flags.isLong ? 'LONG' : 'SHORT'}`);
      console.log(`Size (USD): ${ethers.utils.formatUnits(numbers.sizeInUsd, 30)}`);
      console.log(`Collateral Amount: ${ethers.utils.formatUnits(numbers.collateralAmount, 6)} mUSD`);
      console.log(`Size (Tokens): ${ethers.utils.formatUnits(numbers.sizeInTokens, 18)}`);

      // Calculate entry price
      const sizeInUsd = Number(ethers.utils.formatUnits(numbers.sizeInUsd, 30));
      const sizeInTokens = Number(ethers.utils.formatUnits(numbers.sizeInTokens, 18));
      const rawEntryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : 0;
      const entryPrice = rawEntryPrice > 0 && rawEntryPrice < 1 ? 1 / rawEntryPrice : rawEntryPrice;

      console.log(`Entry Price: ${entryPrice.toFixed(6)}`);
      console.log(`Current Price: ${priceCache[addresses.market] || 'N/A'}`);

      // Base PnL
      console.log("\n--- PNL DATA ---\n");
      console.log(`Base PnL (USD): ${ethers.utils.formatUnits(basePnlUsd, 30)}`);

      // Borrowing Fees
      console.log("\n--- BORROWING FEES ---\n");
      console.log(`Raw borrowingFeeUsd: ${fees.borrowing.borrowingFeeUsd.toString()}`);
      console.log(`Borrowing Fee (USD): ${ethers.utils.formatUnits(fees.borrowing.borrowingFeeUsd, 30)}`);

      // Funding Fees
      console.log("\n--- FUNDING FEES ---\n");
      console.log(`Raw fundingFeeAmount: ${fees.funding.fundingFeeAmount.toString()}`);
      console.log(`Funding Fee Amount (USD): ${ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 30)}`);
      console.log(`\nClaimable Long Token Amount: ${fees.funding.claimableLongTokenAmount.toString()}`);
      console.log(`Claimable Long Token (mUSD): ${ethers.utils.formatUnits(fees.funding.claimableLongTokenAmount, 6)}`);
      console.log(`\nClaimable Short Token Amount: ${fees.funding.claimableShortTokenAmount.toString()}`);
      console.log(`Claimable Short Token (mUSD): ${ethers.utils.formatUnits(fees.funding.claimableShortTokenAmount, 6)}`);
      console.log(`\nLatest Funding Fee Per Size (Long): ${fees.funding.latestFundingFeeAmountPerSize.toString()}`);
      console.log(`Latest Long Claimable Per Size: ${fees.funding.latestLongTokenClaimableFundingAmountPerSize.toString()}`);
      console.log(`Latest Short Claimable Per Size: ${fees.funding.latestShortTokenClaimableFundingAmountPerSize.toString()}`);

      // Total Fees
      console.log("\n--- TOTAL FEES ---\n");
      console.log(`Position Fee Amount: ${fees.positionFeeAmount.toString()}`);
      console.log(`Position Fee (mUSD): ${ethers.utils.formatUnits(fees.positionFeeAmount, 6)}`);
      console.log(`\nTotal Cost Amount: ${fees.totalCostAmount.toString()}`);
      console.log(`Total Cost (USD): ${ethers.utils.formatUnits(fees.totalCostAmount, 30)}`);

      // UI/Referral Fees
      console.log("\n--- OTHER FEES ---\n");
      console.log(`UI Fee: ${fees.ui?.uiFeeAmount ? ethers.utils.formatUnits(fees.ui.uiFeeAmount, 6) : '0'} mUSD`);
      console.log(`Trader Discount: ${fees.referral?.traderDiscountAmount ? ethers.utils.formatUnits(fees.referral.traderDiscountAmount, 6) : '0'} mUSD`);

      // Frontend Display Calculation
      console.log("\n--- FRONTEND DISPLAY (matching PositionsList.js) ---\n");
      const fundingFeeUsd = Number(ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 30));
      const borrowingFeeUsd = Number(ethers.utils.formatUnits(fees.borrowing.borrowingFeeUsd, 30));
      const totalFeesDisplay = fundingFeeUsd + borrowingFeeUsd;

      console.log(`accrued_funding: ${fundingFeeUsd.toFixed(6)} USD`);
      console.log(`accrued_borrowing_fee: ${borrowingFeeUsd.toFixed(6)} USD`);
      console.log(`totalFees (Funding column): ${totalFeesDisplay.toFixed(6)} USD`);
      console.log(`\nDisplay: ${totalFeesDisplay > 0 ? '-' : '+'}${Math.abs(totalFeesDisplay).toFixed(3)}`);

      // Net PnL calculation
      const totalCostUsd = Number(ethers.utils.formatUnits(fees.totalCostAmount, 30));
      const basePnlUsdValue = Number(ethers.utils.formatUnits(basePnlUsd, 30));
      const netPnl = basePnlUsdValue - totalCostUsd;

      console.log("\n--- NET PNL ---\n");
      console.log(`Gross PnL: ${basePnlUsdValue.toFixed(6)} USD`);
      console.log(`Total Fees: ${totalCostUsd.toFixed(6)} USD`);
      console.log(`Net PnL: ${netPnl.toFixed(6)} USD`);

      console.log("\n" + "=".repeat(80));
    }

    console.log("\n✅ Position fees analysis complete!\n");

  } catch (error) {
    console.error("\n❌ Error fetching positions:", error.message);
    console.error(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
