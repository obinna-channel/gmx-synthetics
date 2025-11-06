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

    console.log("=== Investigating Position Details ===\n");
    console.log("Account:", ACCOUNT);
    console.log("Position Key:", POSITION_KEY);
    console.log("Market: USDTARS\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Fetch current price
    const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
    const priceResponse = await axios.get(`${PRICE_SERVER}/api/v1/price/current/USDTARS`);
    const currentPrice = priceResponse.data.price;
    console.log(`Current USDTARS Price: $${currentPrice}\n`);

    // Get full position data
    const position = await reader.getPosition(DATA_STORE, POSITION_KEY);

    console.log("=== POSITION DATA ===\n");
    console.log("Addresses:");
    console.log("  Account:", position.addresses.account);
    console.log("  Market:", position.addresses.market);
    console.log("  Collateral Token:", position.addresses.collateralToken);
    console.log();

    console.log("Flags:");
    console.log("  Is Long:", position.flags.isLong);
    console.log();

    console.log("Numbers (Raw):");
    console.log("  Size in USD:", position.numbers.sizeInUsd.toString());
    console.log("  Size in Tokens:", position.numbers.sizeInTokens.toString());
    console.log("  Collateral Amount:", position.numbers.collateralAmount.toString());
    console.log("  Borrowing Factor:", position.numbers.borrowingFactor.toString());
    console.log("  Funding Fee Amount Per Size:", position.numbers.fundingFeeAmountPerSize.toString());
    console.log("  Long Token Claimable Funding Amount Per Size:", position.numbers.longTokenClaimableFundingAmountPerSize.toString());
    console.log("  Short Token Claimable Funding Amount Per Size:", position.numbers.shortTokenClaimableFundingAmountPerSize.toString());
    console.log();

    console.log("Numbers (Formatted):");
    console.log("  Size in USD:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30), "USD");
    console.log("  Size in Tokens:", ethers.utils.formatUnits(position.numbers.sizeInTokens, 18), "tokens");
    console.log("  Collateral Amount:", ethers.utils.formatUnits(position.numbers.collateralAmount, 6), "mUSD");
    console.log();

    // Calculate entry price
    const sizeInUsd = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInUsd, 30));
    const sizeInTokens = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInTokens, 18));
    const entryPrice = sizeInUsd / sizeInTokens;

    console.log("=== CALCULATED VALUES ===\n");
    console.log("Entry Price: $" + entryPrice.toFixed(2));
    console.log("Current Price: $" + currentPrice);
    console.log("Price Change: $" + (currentPrice - entryPrice).toFixed(2));
    console.log("Price Change %:", ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2) + "%");
    console.log();

    // For SHORT position: PnL = sizeInTokens * (entryPrice - currentPrice)
    const isLong = position.flags.isLong;
    const priceDiff = isLong ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
    const pnl = sizeInTokens * priceDiff;

    console.log("=== PnL CALCULATION ===\n");
    console.log("Position Side:", isLong ? "LONG" : "SHORT");
    console.log("Size in Tokens:", sizeInTokens.toFixed(6));
    console.log("Price Difference:", priceDiff.toFixed(2), "USD per token");
    console.log("Calculated PnL:", pnl.toFixed(2), "USD");
    console.log();

    // Get liquidation info - use correct precision matching frontend
    // indexTokenPrice: 12 decimals
    // longTokenPrice: 24 decimals
    // shortTokenPrice: 24 decimals (for single-token markets)
    const indexPrice = ethers.utils.parseUnits(currentPrice.toFixed(12), 12);
    const longPrice = ethers.utils.parseUnits("1", 24);
    const shortPrice = ethers.utils.parseUnits("1", 24);

    const marketPrices = {
        indexTokenPrice: { min: indexPrice, max: indexPrice },
        longTokenPrice: { min: longPrice, max: longPrice },
        shortTokenPrice: { min: shortPrice, max: shortPrice }
    };

    const marketStruct = {
        marketToken: MARKET,
        indexToken: INDEX_TOKEN,
        longToken: mUSD,
        shortToken: mUSD
    };

    const [isLiquidatable, reason, info] = await reader.isPositionLiquidatable(
        DATA_STORE,
        REFERRAL_STORAGE,
        POSITION_KEY,
        marketStruct,
        marketPrices,
        true,
        true
    );

    console.log("=== LIQUIDATION CHECK ===\n");
    console.log("Is Liquidatable:", isLiquidatable);
    console.log("Reason:", reason);
    console.log();

    console.log("Liquidation Info (Raw):");
    console.log("  Remaining Collateral USD:", info.remainingCollateralUsd.toString());
    console.log("  Min Collateral USD:", info.minCollateralUsd.toString());
    console.log("  Min Collateral for Leverage:", info.minCollateralUsdForLeverage.toString());
    console.log();

    console.log("Liquidation Info (Formatted):");
    console.log("  Remaining Collateral USD:", ethers.utils.formatUnits(info.remainingCollateralUsd, 30));
    console.log("  Min Collateral USD:", ethers.utils.formatUnits(info.minCollateralUsd, 30));
    console.log("  Min Collateral for Leverage:", ethers.utils.formatUnits(info.minCollateralUsdForLeverage, 30));
    console.log();

    const collateralInUsd = parseFloat(ethers.utils.formatUnits(position.numbers.collateralAmount, 6));
    const remainingCollateral = parseFloat(ethers.utils.formatUnits(info.remainingCollateralUsd, 30));
    const totalFeesAndPnl = collateralInUsd - remainingCollateral;

    console.log("=== BREAKDOWN ===\n");
    console.log("Initial Collateral:", collateralInUsd.toFixed(2), "USD");
    console.log("Calculated PnL:", pnl.toFixed(2), "USD");
    console.log("Remaining Collateral (from contract):", remainingCollateral.toFixed(2), "USD");
    console.log("Total Fees + PnL Loss:", totalFeesAndPnl.toFixed(2), "USD");
    console.log("Difference (likely fees):", (totalFeesAndPnl - Math.abs(pnl)).toFixed(2), "USD");
}

main().catch(console.error);
