const { ethers } = require("hardhat");
const axios = require("axios");

async function main() {
    const ACCOUNT = "0x49e082bdda2865A36eD2294819d3C214709CdBAA";
    const POSITION_KEY = "0xb41ccbc0d873ab6cc39e34ae1c7ef595220e9eb0d40fea6e56a44f1deee61920";
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const INDEX_TOKEN = "0xed6890bE2409F0db06a00C809a298E2E06553BE1";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547";

    console.log("=== Simple PnL & Collateral Check ===\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Fetch current price
    const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
    const priceResponse = await axios.get(`${PRICE_SERVER}/api/v1/price/current/USDTARS`, { timeout: 5000 });
    const currentPrice = priceResponse.data.price;

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

    // Manual PnL calculation
    const sizeInUsd = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInUsd, 30));
    const sizeInTokens = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInTokens, 18));
    const collateralAmount = parseFloat(ethers.utils.formatUnits(position.numbers.collateralAmount, 6));
    const entryPrice = sizeInUsd / sizeInTokens;
    const isLong = position.flags.isLong;

    console.log("Position Details:");
    console.log("  Side:", isLong ? "LONG" : "SHORT");
    console.log("  Entry Price: $" + entryPrice.toFixed(2));
    console.log("  Current Price: $" + currentPrice);
    console.log("  Size:", sizeInTokens.toFixed(6), "tokens");
    console.log("  Size in USD: $" + sizeInUsd.toFixed(2));
    console.log("  Initial Collateral: $" + collateralAmount.toFixed(2));
    console.log();

    const priceDiff = isLong ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
    const rawPnl = sizeInTokens * priceDiff;
    console.log("Manual PnL Calculation:");
    console.log("  Price Difference: $" + priceDiff.toFixed(2));
    console.log("  Raw PnL: $" + rawPnl.toFixed(2));
    console.log();

    // Get liquidation info
    const [isLiquidatable, reason, info] = await reader.isPositionLiquidatable(
        DATA_STORE,
        REFERRAL_STORAGE,
        POSITION_KEY,
        marketStruct,
        marketPrices,
        true,
        true
    );

    const remainingCollateralUsd = parseFloat(ethers.utils.formatUnits(info.remainingCollateralUsd, 30));
    const minCollateralUsd = parseFloat(ethers.utils.formatUnits(info.minCollateralUsd, 30));

    console.log("Contract Liquidation Check:");
    console.log("  Is Liquidatable:", isLiquidatable);
    console.log("  Reason:", reason);
    console.log("  Remaining Collateral: $" + remainingCollateralUsd.toFixed(2));
    console.log("  Min Collateral Required: $" + minCollateralUsd.toFixed(2));
    console.log();

    // Work backwards to figure out what fees were charged
    // remainingCollateral = collateral + pnl + priceImpact - fees
    // fees = collateral + pnl + priceImpact - remainingCollateral
    const impliedFeesAndPriceImpact = collateralAmount + rawPnl - remainingCollateralUsd;

    console.log("Reverse Calculation:");
    console.log("  Initial Collateral: $" + collateralAmount.toFixed(2));
    console.log("  + Raw PnL: $" + rawPnl.toFixed(2));
    console.log("  - Fees & Negative Price Impact: $" + impliedFeesAndPriceImpact.toFixed(2));
    console.log("  = Remaining: $" + remainingCollateralUsd.toFixed(2));
    console.log();

    console.log("This means the position has been charged:");
    console.log("  $" + impliedFeesAndPriceImpact.toFixed(2) + " in total fees and/or negative price impact");
    console.log();

    const feePercentOfPnlLoss = (impliedFeesAndPriceImpact / Math.abs(rawPnl)) * 100;
    console.log("Analysis:");
    console.log("  The actual loss is LESS than the raw PnL suggests");
    console.log("  Fees/Price Impact offset: " + (Math.abs(rawPnl) - impliedFeesAndPriceImpact).toFixed(2) + " USD");
    console.log("  This suggests positive funding fees or favorable price impact");
}

main().catch(console.error);
