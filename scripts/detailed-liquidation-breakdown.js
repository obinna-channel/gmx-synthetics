const { ethers } = require("hardhat");
const axios = require("axios");

async function main() {
    const ACCOUNT = "0x49e082bdda2865A36eD2294819d3C214709CdBAA";
    const POSITION_KEY = "0xb41ccbc0d873ab6cc39e34ae1c7ef595220e9eb0d40fea6e56a44f1deee61920";
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69"; // USDTARS
    const INDEX_TOKEN = "0xed6890bE2409F0db06a00C809a298E2E06553BE1"; // mUSDTARS
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547";

    console.log("=== Detailed Liquidation Breakdown ===\n");
    console.log("Account:", ACCOUNT);
    console.log("Position Key:", POSITION_KEY, "\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Fetch current price
    const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
    const priceResponse = await axios.get(`${PRICE_SERVER}/api/v1/price/current/USDTARS`);
    const currentPrice = priceResponse.data.price;

    // Get position
    const position = await reader.getPosition(DATA_STORE, POSITION_KEY);

    const priceIn6dp = ethers.utils.parseUnits(currentPrice.toString(), 6);
    const stablePrice = ethers.utils.parseUnits("1", 6);

    const marketPrices = {
        indexTokenPrice: { min: priceIn6dp, max: priceIn6dp },
        longTokenPrice: { min: stablePrice, max: stablePrice },
        shortTokenPrice: { min: stablePrice, max: stablePrice }
    };

    const marketStruct = {
        marketToken: MARKET,
        indexToken: INDEX_TOKEN,
        longToken: mUSD,
        shortToken: mUSD
    };

    // Get position info with fees breakdown
    const positionInfo = await reader.getPositionInfo(
        DATA_STORE,
        REFERRAL_STORAGE,
        POSITION_KEY,
        marketPrices,
        0, // sizeDeltaUsd
        ethers.constants.AddressZero, // uiFeeReceiver
        false // usePositionSizeAsSizeDeltaUsd
    );

    console.log("=== POSITION INFO ===\n");
    console.log("Current Price: $" + currentPrice);
    console.log("Position Side:", position.flags.isLong ? "LONG" : "SHORT");
    console.log("Size in USD:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30), "USD");
    console.log("Collateral Amount:", ethers.utils.formatUnits(position.numbers.collateralAmount, 6), "mUSD");
    console.log();

    // Calculate entry price
    const sizeInUsd = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInUsd, 30));
    const sizeInTokens = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInTokens, 18));
    const entryPrice = sizeInUsd / sizeInTokens;
    console.log("Entry Price: $" + entryPrice.toFixed(2));
    console.log("Size in Tokens:", sizeInTokens.toFixed(6));
    console.log();

    console.log("=== PNL & FEES BREAKDOWN ===\n");

    // Base PnL
    const basePnlUsd = ethers.utils.formatUnits(positionInfo.basePnlUsd, 30);
    console.log("1. Base PnL:", basePnlUsd, "USD");

    // Funding fees
    const fundingFeeAmount = ethers.utils.formatUnits(positionInfo.fees.funding.fundingFeeAmount, 6);
    const claimableLongTokenAmount = ethers.utils.formatUnits(positionInfo.fees.funding.claimableLongTokenAmount, 6);
    const claimableShortTokenAmount = ethers.utils.formatUnits(positionInfo.fees.funding.claimableShortTokenAmount, 6);

    console.log("\n2. Funding Fees:");
    console.log("   Funding Fee Amount:", fundingFeeAmount, "mUSD");
    console.log("   Claimable Long Token:", claimableLongTokenAmount, "mUSD");
    console.log("   Claimable Short Token:", claimableShortTokenAmount, "mUSD");

    // Borrowing fees
    const borrowingFeeUsd = ethers.utils.formatUnits(positionInfo.fees.borrowing.borrowingFeeUsd, 30);
    const borrowingFeeAmount = ethers.utils.formatUnits(positionInfo.fees.borrowing.borrowingFeeAmount, 6);

    console.log("\n3. Borrowing Fees:");
    console.log("   Borrowing Fee USD:", borrowingFeeUsd, "USD");
    console.log("   Borrowing Fee Amount:", borrowingFeeAmount, "mUSD");

    // Position fees
    const positionFeeAmount = ethers.utils.formatUnits(positionInfo.fees.positionFeeAmount, 6);
    console.log("\n4. Position Fee Amount:", positionFeeAmount, "mUSD");

    // Total costs
    const totalCostAmountExcludingFunding = ethers.utils.formatUnits(positionInfo.fees.totalCostAmountExcludingFunding, 6);
    const totalCostAmount = ethers.utils.formatUnits(positionInfo.fees.totalCostAmount, 6);

    console.log("\n5. Total Costs:");
    console.log("   Total Cost (excluding funding):", totalCostAmountExcludingFunding, "mUSD");
    console.log("   Total Cost (including funding):", totalCostAmount, "mUSD");

    // Collateral values
    const collateralUsd = parseFloat(ethers.utils.formatUnits(position.numbers.collateralAmount, 6));

    console.log("\n=== COLLATERAL CALCULATION ===\n");
    console.log("Initial Collateral:", collateralUsd.toFixed(2), "USD");
    console.log("+ Base PnL:", basePnlUsd, "USD");
    console.log("- Total Fees:", totalCostAmount, "mUSD");

    const estimatedRemaining = collateralUsd + parseFloat(basePnlUsd) - parseFloat(totalCostAmount);
    console.log("= Estimated Remaining:", estimatedRemaining.toFixed(2), "USD");

    // Get liquidation check
    const [isLiquidatable, reason, info] = await reader.isPositionLiquidatable(
        DATA_STORE,
        REFERRAL_STORAGE,
        POSITION_KEY,
        marketStruct,
        marketPrices,
        true,
        true
    );

    const actualRemaining = parseFloat(ethers.utils.formatUnits(info.remainingCollateralUsd, 30));
    console.log("Actual Remaining (from contract):", actualRemaining.toFixed(2), "USD");
    console.log("Difference:", (estimatedRemaining - actualRemaining).toFixed(2), "USD (likely price impact)");

    console.log("\n=== SUMMARY ===\n");
    console.log("Is Liquidatable:", isLiquidatable);
    console.log("Reason:", reason);
    console.log("Min Collateral Required:", ethers.utils.formatUnits(info.minCollateralUsd, 30), "USD");
    console.log("Min Collateral for Leverage:", ethers.utils.formatUnits(info.minCollateralUsdForLeverage, 30), "USD");
}

main().catch(console.error);
