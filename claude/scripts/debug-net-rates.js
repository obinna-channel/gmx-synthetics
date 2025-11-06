const hre = require("hardhat");
const { ethers } = require("ethers");
const axios = require("axios");

// Contract addresses
const ADDRESSES = {
  DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
  READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
  USDTNGN_SINGLE_TOKEN: "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb", // Market 18: mUSDTNGN [mUSD-mUSD]
  META_SINGLE_TOKEN: "0xafd908D358315efDBA493311AbE30648DEC4d2dE", // META market [mUSD-mUSD]
  USDTARS_SINGLE_TOKEN: "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69", // USDTARS market [mUSD-mUSD]
  mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
};

// Helper to convert from 30 decimals to percentage
function factorToPercentage(factor) {
  if (!factor) return 0;
  return Number(ethers.utils.formatUnits(factor, 30)) * 100;
}

// Helper for borrowing calculation (matching frontend logic)
function getBorrowingFactorPerPeriod(factorPerSecond, periodInSeconds) {
  const factor = BigInt(factorPerSecond.toString());
  if (factor === 0n) return 0n;

  const BORROWING_PRECISION_ADJUSTMENT = 10n ** 10n; // This is what frontend uses
  const period = BigInt(periodInSeconds);

  return (factor * period) / BORROWING_PRECISION_ADJUSTMENT;
}

// Helper for funding calculation (matching frontend logic)
function getFundingFactorPerPeriod(
  fundingFactorPerSecond,
  longsPayShorts,
  longInterestUsd,
  shortInterestUsd,
  isLong,
  periodInSeconds
) {
  // Convert to BigInt
  const fundingFactor = BigInt(fundingFactorPerSecond.toString());
  if (fundingFactor === 0n) return 0n;

  const period = BigInt(periodInSeconds);
  const longOI = BigInt(longInterestUsd.toString());
  const shortOI = BigInt(shortInterestUsd.toString());

  const payingInterestUsd = longsPayShorts ? longOI : shortOI;
  const receivingInterestUsd = longsPayShorts ? shortOI : longOI;

  const fundingForPayingSide = fundingFactor * period;

  let fundingForReceivingSide = 0n;
  if (receivingInterestUsd !== 0n) {
    fundingForReceivingSide = (fundingForPayingSide * payingInterestUsd) / receivingInterestUsd;
  }

  const isPayingSide = (longsPayShorts && isLong) || (!longsPayShorts && !isLong);

  return isPayingSide ? -fundingForPayingSide : fundingForReceivingSide;
}

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
  console.log("\n=== USDTARS Net Rate Debug Script ===\n");

  const [signer] = await hre.ethers.getSigners();

  // Get contract instances
  const dataStore = await hre.ethers.getContractAt(
    "DataStore",
    ADDRESSES.DATA_STORE,
    signer
  );

  const reader = await hre.ethers.getContractAt(
    "Reader",
    ADDRESSES.READER,
    signer
  );

  // Choose which market to debug
  const marketAddress = ADDRESSES.USDTARS_SINGLE_TOKEN; // USDTARS / mUSD / mUSD
  console.log("Market:", marketAddress);
  console.log("(This is the USDTARS / mUSD / mUSD single-token market)\n");

  // Fetch real-time price from marks-server
  console.log("💰 Fetching current USDTARS price from marks-server...\n");
  const currentPrice = await fetchCurrentPrice("USDTARS");

  if (!currentPrice) {
    console.log("❌ Failed to fetch price from marks-server. Exiting.");
    return;
  }

  console.log(`✅ Current USDTARS price: ${currentPrice}\n`);

  // Use correct precision matching frontend (from scan-all-liquidatable-positions-realtime.js):
  // indexTokenPrice: 12 decimals
  // longTokenPrice: 24 decimals
  // shortTokenPrice: 24 decimals
  const indexPrice = ethers.utils.parseUnits(currentPrice.toFixed(12), 12);
  const stablePrice = ethers.utils.parseUnits("1", 24); // mUSD = $1

  const marketPrices = {
    indexTokenPrice: { min: indexPrice, max: indexPrice },
    longTokenPrice: { min: stablePrice, max: stablePrice },
    shortTokenPrice: { min: stablePrice, max: stablePrice }, // Same as long for single-token
  };

  // Get market info from Reader
  console.log("📊 Fetching market info from Reader...\n");
  const marketInfo = await reader.getMarketInfo(
    ADDRESSES.DATA_STORE,
    marketPrices,
    marketAddress
  );

  // Extract the key values
  const {
    borrowingFactorPerSecondForLongs,
    borrowingFactorPerSecondForShorts,
    nextFunding,
  } = marketInfo;

  const { longsPayShorts, fundingFactorPerSecond } = nextFunding;

  console.log("=== RAW BLOCKCHAIN DATA ===\n");
  console.log("Borrowing Factor Per Second (Longs):", borrowingFactorPerSecondForLongs.toString());
  console.log("Borrowing Factor Per Second (Shorts):", borrowingFactorPerSecondForShorts.toString());
  console.log("Funding Factor Per Second:", fundingFactorPerSecond.toString());
  console.log("Longs Pay Shorts:", longsPayShorts);

  // Get Open Interest
  // Use hashData pattern: keccak256(abi.encode(...))
  // OPEN_INTEREST constant is hashData(["string"], ["OPEN_INTEREST"])
  const OPEN_INTEREST_HASH = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
  );

  const longOIKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "bool"],
      [
        OPEN_INTEREST_HASH,
        marketAddress,
        ADDRESSES.mUSD,
        true // isLong
      ]
    )
  );

  const shortOIKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "bool"],
      [
        OPEN_INTEREST_HASH,
        marketAddress,
        ADDRESSES.mUSD,
        false // isLong
      ]
    )
  );

  const longInterestUsd = await dataStore.getUint(longOIKey);
  const shortInterestUsd = await dataStore.getUint(shortOIKey);

  console.log("\nOpen Interest (Long):", ethers.utils.formatUnits(longInterestUsd, 30), "USD");
  console.log("Open Interest (Short):", ethers.utils.formatUnits(shortInterestUsd, 30), "USD");

  // Calculate for different timeframes
  const timeframes = {
    '1h': 3600,
    '8h': 8 * 3600,
    '24h': 24 * 3600,
    '1y': 360 * 24 * 3600,
  };

  console.log("\n=== CALCULATED NET RATES ===\n");

  for (const [label, seconds] of Object.entries(timeframes)) {
    console.log(`\n--- ${label} (${seconds.toLocaleString()} seconds) ---`);

    // Calculate borrowing
    const borrowingLong = getBorrowingFactorPerPeriod(borrowingFactorPerSecondForLongs, seconds);
    const borrowingShort = getBorrowingFactorPerPeriod(borrowingFactorPerSecondForShorts, seconds);

    console.log(`Borrowing Long (raw factor): ${borrowingLong.toString()}`);
    console.log(`Borrowing Short (raw factor): ${borrowingShort.toString()}`);
    console.log(`Borrowing Long: ${factorToPercentage(borrowingLong).toFixed(6)}%`);
    console.log(`Borrowing Short: ${factorToPercentage(borrowingShort).toFixed(6)}%`);

    // Calculate funding
    const fundingLong = getFundingFactorPerPeriod(
      fundingFactorPerSecond,
      longsPayShorts,
      longInterestUsd,
      shortInterestUsd,
      true, // isLong
      seconds
    );

    const fundingShort = getFundingFactorPerPeriod(
      fundingFactorPerSecond,
      longsPayShorts,
      longInterestUsd,
      shortInterestUsd,
      false, // isLong
      seconds
    );

    console.log(`Funding Long (raw factor): ${fundingLong.toString()}`);
    console.log(`Funding Short (raw factor): ${fundingShort.toString()}`);
    console.log(`Funding Long: ${factorToPercentage(fundingLong).toFixed(6)}%`);
    console.log(`Funding Short: ${factorToPercentage(fundingShort).toFixed(6)}%`);

    // Calculate net (funding - borrowing, since borrowing is a cost)
    const netLong = fundingLong - borrowingLong;
    const netShort = fundingShort - borrowingShort;

    console.log(`\n✅ NET RATE Long (raw factor): ${netLong.toString()}`);
    console.log(`✅ NET RATE Short (raw factor): ${netShort.toString()}`);
    console.log(`✅ NET RATE Long: ${factorToPercentage(netLong).toFixed(6)}%`);
    console.log(`✅ NET RATE Short: ${factorToPercentage(netShort).toFixed(6)}%`);
  }

  console.log("\n=== EXPECTED FRONTEND DISPLAY ===\n");

  // What should show for 1 year
  const oneYearSeconds = 360 * 24 * 3600;
  const borrowingLong1y = getBorrowingFactorPerPeriod(borrowingFactorPerSecondForLongs, oneYearSeconds);
  const borrowingShort1y = getBorrowingFactorPerPeriod(borrowingFactorPerSecondForShorts, oneYearSeconds);
  const fundingLong1y = getFundingFactorPerPeriod(
    fundingFactorPerSecond,
    longsPayShorts,
    longInterestUsd,
    shortInterestUsd,
    true,
    oneYearSeconds
  );
  const fundingShort1y = getFundingFactorPerPeriod(
    fundingFactorPerSecond,
    longsPayShorts,
    longInterestUsd,
    shortInterestUsd,
    false,
    oneYearSeconds
  );

  const netLong1y = fundingLong1y - borrowingLong1y;
  const netShort1y = fundingShort1y - borrowingShort1y;

  const displayLong = factorToPercentage(netLong1y).toFixed(4);
  const displayShort = factorToPercentage(netShort1y).toFixed(4);

  console.log(`For timeframe "1y", the frontend should display:`);
  console.log(`  Long Net Rate: ${displayLong}%`);
  console.log(`  Short Net Rate: ${displayShort}%`);

  // Check for potential issues
  console.log("\n=== DIAGNOSTIC CHECKS ===\n");

  const longOIBigInt = BigInt(longInterestUsd.toString());
  const shortOIBigInt = BigInt(shortInterestUsd.toString());

  if (shortOIBigInt === 0n) {
    console.log("⚠️  WARNING: Short Open Interest is ZERO!");
    console.log("   This will cause division by zero or massive numbers in funding calculation.");
  }

  if (longOIBigInt === 0n) {
    console.log("⚠️  WARNING: Long Open Interest is ZERO!");
    console.log("   This will cause division by zero or massive numbers in funding calculation.");
  }

  const oiRatio = longOIBigInt > 0n && shortOIBigInt > 0n
    ? Number(longOIBigInt * 10000n / shortOIBigInt) / 100
    : 0;

  if (oiRatio > 0) {
    console.log(`ℹ️  OI Ratio (Long/Short): ${oiRatio.toFixed(2)}%`);
    if (oiRatio > 1000 || oiRatio < 1) {
      console.log("⚠️  WARNING: OI is highly imbalanced! This can cause extreme funding rates.");
    }
  }

  console.log("\n=== END ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
