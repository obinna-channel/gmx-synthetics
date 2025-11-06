const { ethers } = require("hardhat");
const axios = require("axios");

// Market Registry - Maps market addresses to their price pairs
const MARKETS = {
    "0x8ae559448a1482faffC925eF6a233276588348Df": { name: "TSLA", pricePair: "TSLA", type: "stock" },        // Market 11: mTSLA
    "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": { name: "USDTARS", pricePair: "USDTARS", type: "crypto" }, // Market 12: mUSDTARS
    "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": { name: "NVDA", pricePair: "NVDA", type: "stock" },        // Market 13: mNVDA
    "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": { name: "USDTPKR", pricePair: "USDTPKR", type: "crypto" }, // Market 14: mPKR
    "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": { name: "USDTCOP", pricePair: "USDTCOP", type: "crypto" }, // Market 15: mCOP
    "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": { name: "AAPL", pricePair: "AAPL", type: "stock" },        // Market 16: mAAPL
    "0xafd908D358315efDBA493311AbE30648DEC4d2dE": { name: "META", pricePair: "META", type: "stock" },        // Market 17: mMETA
    "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": { name: "USDTNGN", pricePair: "USDTNGN", type: "crypto" },  // Market 18: mUSDTNGN
};

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
    const mUSD = ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf");
    const DATA_STORE = ethers.utils.getAddress("0xD70154A2e4BEF0485Bb6d90265a4F878A4556111");
    const READER = ethers.utils.getAddress("0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8");
    const REFERRAL_STORAGE = ethers.utils.getAddress("0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547");

    console.log("=== Scanning ALL Positions for Liquidation (Real-Time Prices) ===\n");
    console.log("Data Store:", DATA_STORE);
    console.log("Reader:", READER);
    console.log("Price Server: https://marks-server-a58cc19eb539.herokuapp.com\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Step 1: Get ALL position keys from DataStore
    console.log("📋 Step 1: Fetching all position keys from DataStore...\n");

    const POSITION_LIST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionCount = await dataStore.getBytes32Count(POSITION_LIST_KEY);
    console.log(`   Total positions in POSITION_LIST: ${positionCount.toString()}`);

    if (positionCount.eq(0)) {
        console.log("\n❌ No positions found in DataStore!");
        return;
    }

    const batchSize = 1000;
    const totalToFetch = Math.min(positionCount.toNumber(), batchSize);

    console.log(`   Fetching ${totalToFetch} position keys...\n`);

    const positionKeys = await dataStore.getBytes32ValuesAt(
        POSITION_LIST_KEY,
        0,
        totalToFetch
    );

    console.log(`   ✅ Fetched ${positionKeys.length} position keys\n`);
    console.log("=".repeat(80));

    // Step 2: For each position key, get position details and check if active
    console.log("\n📊 Step 2: Checking which positions are active...\n");

    const activePositions = [];

    for (let i = 0; i < positionKeys.length; i++) {
        const positionKey = positionKeys[i];

        try {
            const position = await reader.getPosition(DATA_STORE, positionKey);

            if (position.numbers.sizeInUsd.gt(0)) {
                activePositions.push({
                    key: positionKey,
                    position: position,
                    account: position.addresses.account,
                    market: position.addresses.market,
                    collateralToken: position.addresses.collateralToken,
                    isLong: position.flags.isLong
                });

                const marketInfo = MARKETS[position.addresses.market.toLowerCase()] ||
                                  MARKETS[position.addresses.market] ||
                                  { name: "UNKNOWN", pricePair: "UNKNOWN" };

                console.log(`   ✅ Active Position #${activePositions.length}:`);
                console.log(`      Account: ${position.addresses.account}`);
                console.log(`      Market: ${position.addresses.market} (${marketInfo.name})`);
                console.log(`      Side: ${position.flags.isLong ? 'LONG' : 'SHORT'}`);
                console.log(`      Size: ${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)} USD`);
                console.log(`      Collateral: ${ethers.utils.formatUnits(position.numbers.collateralAmount, 6)} mUSD`);
                console.log();
            }
        } catch (e) {
            // Position might be deleted or invalid, skip
        }
    }

    console.log("=".repeat(80));
    console.log(`\n📈 Found ${activePositions.length} active positions\n`);

    if (activePositions.length === 0) {
        console.log("❌ No active positions to check for liquidation!");
        return;
    }

    // Step 3: Fetch real-time prices for all markets
    console.log("=".repeat(80));
    console.log("\n💰 Step 3: Fetching real-time prices for all markets...\n");

    const priceCache = {};
    const uniqueMarkets = [...new Set(activePositions.map(p => p.market))];

    for (const marketAddr of uniqueMarkets) {
        const marketInfo = MARKETS[marketAddr.toLowerCase()] || MARKETS[marketAddr];

        if (!marketInfo) {
            console.log(`   ⚠️  Unknown market: ${marketAddr}`);
            continue;
        }

        console.log(`   Fetching ${marketInfo.pricePair}...`);
        const price = await fetchCurrentPrice(marketInfo.pricePair);

        if (price) {
            priceCache[marketAddr] = price;
            console.log(`   ✅ ${marketInfo.name}: $${price}`);
        } else {
            console.log(`   ❌ Failed to fetch price for ${marketInfo.name}`);
        }
    }

    console.log();

    // Step 4: Check liquidation status for each active position with real prices
    console.log("=".repeat(80));
    console.log("\n💀 Step 4: Checking liquidation status with REAL-TIME prices...\n");

    // Use correct price precision matching frontend:
    // indexTokenPrice: 12 decimals
    // longTokenPrice: 24 decimals
    // shortTokenPrice: 24 decimals (for single-token markets like USDTARS)
    const stablePrice = ethers.utils.parseUnits("1", 24);

    let liquidatableCount = 0;
    const liquidatablePositions = [];

    for (const positionData of activePositions) {
        try {
            const marketAddr = positionData.market;
            const marketInfo = MARKETS[marketAddr.toLowerCase()] || MARKETS[marketAddr];

            if (!marketInfo) {
                console.log(`🔍 Skipping position in unknown market: ${marketAddr}\n`);
                continue;
            }

            const currentPrice = priceCache[marketAddr];

            if (!currentPrice) {
                console.log(`🔍 Skipping position - no price data for ${marketInfo.name}\n`);
                continue;
            }

            console.log(`🔍 Checking: ${positionData.account.slice(0, 10)}... (${positionData.isLong ? 'LONG' : 'SHORT'}) in ${marketInfo.name}`);
            console.log(`   Using price: $${currentPrice}`);

            // Convert price using correct precision (12 decimals for index token)
            const indexPrice = ethers.utils.parseUnits(currentPrice.toFixed(12), 12);

            const marketPrices = {
                indexTokenPrice: { min: indexPrice, max: indexPrice },
                longTokenPrice: { min: stablePrice, max: stablePrice },
                shortTokenPrice: { min: stablePrice, max: stablePrice }
            };

            // Get index token address from market config
            const indexToken = await getIndexToken(marketAddr);

            const marketStruct = {
                marketToken: marketAddr,
                indexToken: indexToken,
                longToken: mUSD,
                shortToken: mUSD
            };

            const [isLiquidatable, reason, info] = await reader.isPositionLiquidatable(
                DATA_STORE,
                REFERRAL_STORAGE,
                positionData.key,
                marketStruct,
                marketPrices,
                true,  // shouldValidateMinCollateralUsd
                true   // forLiquidation
            );

            if (isLiquidatable) {
                liquidatableCount++;
                liquidatablePositions.push({
                    ...positionData,
                    marketName: marketInfo.name,
                    currentPrice: currentPrice
                });

                console.log(`   ❌ LIQUIDATABLE!`);
                console.log(`      Reason: ${reason}`);
                console.log(`      Remaining Collateral USD: ${ethers.utils.formatUnits(info.remainingCollateralUsd, 30)}`);
                console.log(`      Min Collateral USD: ${ethers.utils.formatUnits(info.minCollateralUsd, 30)}`);
            } else {
                console.log(`   ✅ Not liquidatable`);
                console.log(`      Remaining Collateral USD: ${ethers.utils.formatUnits(info.remainingCollateralUsd, 30)}`);
            }

            console.log();

        } catch (e) {
            console.log(`   ⚠️  Error checking liquidation: ${e.message}\n`);
        }
    }

    // Summary
    console.log("=".repeat(80));
    console.log("\n📊 LIQUIDATION SCAN SUMMARY (REAL-TIME PRICES)\n");
    console.log(`Total Positions in DataStore: ${positionCount.toString()}`);
    console.log(`Active Positions (size > 0): ${activePositions.length}`);
    console.log(`Liquidatable Positions: ${liquidatableCount}`);
    console.log(`Healthy Positions: ${activePositions.length - liquidatableCount}`);

    if (liquidatableCount > 0) {
        console.log("\n💀 LIQUIDATABLE POSITIONS:\n");
        for (let i = 0; i < liquidatablePositions.length; i++) {
            const p = liquidatablePositions[i];
            console.log(`${i + 1}. ${p.account} - ${p.isLong ? 'LONG' : 'SHORT'} in ${p.marketName}`);
            console.log(`   Current Price: $${p.currentPrice}`);
            console.log(`   Size: ${ethers.utils.formatUnits(p.position.numbers.sizeInUsd, 30)} USD`);
            console.log(`   Collateral: ${ethers.utils.formatUnits(p.position.numbers.collateralAmount, 6)} mUSD`);
            console.log(`   Key: ${p.key}`);
            console.log();
        }

        console.log("💡 These positions should be liquidated by the keeper!");
    } else {
        console.log("\n✅ All positions are healthy at current prices!");
    }
}

// Helper to get index token from market address
// Based on marks-arbitrumSepolia-deployments.md
async function getIndexToken(marketAddr) {
    // Map of market address -> index token address
    const INDEX_TOKENS = {
        "0x8ae559448a1482faffC925eF6a233276588348Df": ethers.utils.getAddress("0x77d4DdD2E847592fb7710e342C0492A4b85655f4"), // Market 11: mTSLA
        "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": ethers.utils.getAddress("0xed6890bE2409F0db06a00C809a298E2E06553BE1"), // Market 12: mUSDTARS
        "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": ethers.utils.getAddress("0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325"), // Market 13: mNVDA
        "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": ethers.utils.getAddress("0xDC7e9F5a3D337161880d084131BC16214f2F8EBD"), // Market 14: mPKR
        "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": ethers.utils.getAddress("0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8"), // Market 15: mCOP
        "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": ethers.utils.getAddress("0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e"), // Market 16: mAAPL
        "0xafd908D358315efDBA493311AbE30648DEC4d2dE": ethers.utils.getAddress("0xE2f8B015D23bB0EFdD57D8C08a328180437D031D"), // Market 17: mMETA
        "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": ethers.utils.getAddress("0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"), // Market 18: mUSDTNGN
    };

    const indexToken = INDEX_TOKENS[marketAddr.toLowerCase()] || INDEX_TOKENS[marketAddr];
    return indexToken || ethers.utils.getAddress("0x0000000000000000000000000000000000000000");
}

main().catch(console.error);
