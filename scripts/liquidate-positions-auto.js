const { ethers } = require("hardhat");
const axios = require("axios");

// Configuration
const EXECUTE_LIQUIDATIONS = process.env.EXECUTE_LIQUIDATIONS === "true";
const LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B";
const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

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

// Helper to get index token from market address
const INDEX_TOKENS = {
    "0x8ae559448a1482faffC925eF6a233276588348Df": "0x77d4DdD2E847592fb7710e342C0492A4b85655f4", // Market 11: mTSLA
    "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": "0xed6890bE2409F0db06a00C809a298E2E06553BE1", // Market 12: mUSDTARS
    "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325", // Market 13: mNVDA
    "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD", // Market 14: mPKR
    "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8", // Market 15: mCOP
    "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e", // Market 16: mAAPL
    "0xafd908D358315efDBA493311AbE30648DEC4d2dE": "0xE2f8B015D23bB0EFdD57D8C08a328180437D031D", // Market 17: mMETA
    "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73", // Market 18: mUSDTNGN
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

function getIndexToken(marketAddr) {
    const indexToken = INDEX_TOKENS[marketAddr.toLowerCase()] || INDEX_TOKENS[marketAddr];
    return indexToken ? ethers.utils.getAddress(indexToken) : ethers.utils.getAddress("0x0000000000000000000000000000000000000000");
}

async function updateOraclePricesForMarket(signer, marketAddr, currentPrice, retryCount = 0, maxRetries = 3) {
    const marketInfo = MARKETS[marketAddr.toLowerCase()] || MARKETS[marketAddr];
    const marketName = marketInfo?.name || 'UNKNOWN';

    console.log(`   📝 Updating prices for ${marketName} market... (Attempt ${retryCount + 1}/${maxRetries})`);

    const mockProviderAbi = [
        "function setPriceWithPrecision(address token, uint256 price) external"
    ];
    const mockProvider = new ethers.Contract(MOCK_ORACLE_PROVIDER, mockProviderAbi, signer);

    const mUSD = ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf");
    const stablePrice = ethers.BigNumber.from("1000000000000000000000000"); // 1 * 10^24
    const indexTokenAddr = getIndexToken(marketAddr);

    if (indexTokenAddr === ethers.utils.getAddress("0x0000000000000000000000000000000000000000")) {
        console.log(`   ⚠️  Unknown market, cannot update prices`);
        return false;
    }

    const indexPrice = ethers.utils.parseUnits(currentPrice.toFixed(12), 12);

    try {
        // Get initial nonce once (including pending transactions to avoid conflicts)
        let nonce = await signer.getTransactionCount("pending");

        // Get current gas price once
        const gasPrice = await signer.getGasPrice();
        const gasPriceWithBuffer = gasPrice.mul(120).div(100); // 20% buffer

        // Update mUSD price first
        console.log(`   ⏳ Updating mUSD to $1...`);
        const tx1 = await mockProvider.setPriceWithPrecision(mUSD, stablePrice, {
            nonce: nonce,
            gasLimit: 100000,
            gasPrice: gasPriceWithBuffer
        });
        nonce++; // Increment nonce for next transaction

        // Update market's index token price
        console.log(`   ⏳ Updating ${marketName} to $${currentPrice}...`);
        const tx2 = await mockProvider.setPriceWithPrecision(indexTokenAddr, indexPrice, {
            nonce: nonce,
            gasLimit: 100000,
            gasPrice: gasPriceWithBuffer
        });

        // Wait for both confirmations and CHECK STATUS
        const receipt1 = await tx1.wait();
        if (receipt1.status !== 1) {
            console.log(`   ❌ Failed to update mUSD price (tx failed)`);
            return false;
        }
        console.log(`   ✅ mUSD price confirmed`);

        const receipt2 = await tx2.wait();
        if (receipt2.status !== 1) {
            console.log(`   ❌ Failed to update ${marketName} price (tx failed)`);
            return false;
        }
        console.log(`   ✅ ${marketName} price confirmed`);

        return true;

    } catch (error) {
        const errorStr = error.message || error.toString();
        const isNonceError = errorStr.toLowerCase().includes('nonce too low') ||
                           errorStr.toLowerCase().includes('nonce too high') ||
                           errorStr.toLowerCase().includes('nonce has already been used');

        console.log(`   ❌ Error updating oracle prices: ${errorStr}`);

        // Retry logic with exponential backoff
        if (retryCount < maxRetries - 1) {
            const waitTime = Math.pow(2, retryCount + 1); // 2s, 4s, 8s
            if (isNonceError) {
                console.log(`   🔄 Nonce error detected - retrying in ${waitTime} seconds...`);
            } else {
                console.log(`   ⏳ Retrying in ${waitTime} seconds...`);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

            // Retry
            return await updateOraclePricesForMarket(signer, marketAddr, currentPrice, retryCount + 1, maxRetries);
        } else {
            console.log(`   ❌ Max retries (${maxRetries}) reached for oracle price updates`);
            return false;
        }
    }
}

async function executeLiquidation(signer, liquidationHandler, positionData, marketInfo, currentPrice) {
    const mUSD = ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf");
    const indexTokenAddr = getIndexToken(positionData.market);

    // Build oracle params following Python keeper pattern
    const indexPrice = ethers.utils.parseUnits(currentPrice.toFixed(12), 12);
    const stablePrice = ethers.BigNumber.from("1000000000000000000000000"); // 1 * 10^24

    // Build tokens array from market config (indexToken, longToken, shortToken)
    const tokens = [
        indexTokenAddr,  // indexToken
        mUSD,           // longToken
        mUSD            // shortToken (same as longToken for single-token markets)
    ];

    // Deduplicate tokens (important for single-token markets where long == short)
    // Oracle doesn't allow setting the same token price twice in one call
    const seen = new Set();
    const uniqueTokens = [];
    for (const token of tokens) {
        const tokenLower = token.toLowerCase();
        if (!seen.has(tokenLower)) {
            seen.add(tokenLower);
            uniqueTokens.push(token);
        }
    }

    // Build prices map for unique tokens
    const prices = {
        [indexTokenAddr.toLowerCase()]: indexPrice,
        [mUSD.toLowerCase()]: stablePrice
    };

    // Build oracle params with unique tokens only
    const providers = uniqueTokens.map(() => MOCK_ORACLE_PROVIDER);
    const data = uniqueTokens.map(token => {
        const price = prices[token.toLowerCase()];
        return ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [price, price]);
    });

    // Pass as tuple array to match Python keeper (not object)
    const oracleParams = [uniqueTokens, providers, data];

    console.log(`\n   🎯 Executing liquidation for ${positionData.account.slice(0, 10)}... (${positionData.isLong ? 'LONG' : 'SHORT'}) in ${marketInfo.name}`);

    try {
        const tx = await liquidationHandler.executeLiquidation(
            positionData.account,
            positionData.market,
            positionData.collateralToken,
            positionData.isLong,
            oracleParams,
            { gasLimit: 5000000 }
        );

        console.log(`   ⏳ Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`   ✅ Liquidation executed! Gas used: ${receipt.gasUsed.toString()}`);
        return true;
    } catch (error) {
        console.log(`   ❌ Liquidation failed: ${error.message}`);
        if (error.reason) {
            console.log(`   Reason: ${error.reason}`);
        }
        return false;
    }
}

async function main() {
    const mUSD = ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf");
    const DATA_STORE = ethers.utils.getAddress("0xD70154A2e4BEF0485Bb6d90265a4F878A4556111");
    const READER = ethers.utils.getAddress("0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8");
    const REFERRAL_STORAGE = ethers.utils.getAddress("0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547");

    const [signer] = await ethers.getSigners();

    console.log("=== Liquidation Bot ===\n");
    console.log(`Mode: ${EXECUTE_LIQUIDATIONS ? '⚡ EXECUTE LIQUIDATIONS' : '👀 SCAN ONLY'}`);
    console.log(`Account: ${signer.address}`);
    console.log("Data Store:", DATA_STORE);
    console.log("Reader:", READER);
    console.log("Price Server: https://marks-server-a58cc19eb539.herokuapp.com");

    if (EXECUTE_LIQUIDATIONS) {
        console.log("Liquidation Handler:", LIQUIDATION_HANDLER);
        console.log("Mock Oracle Provider:", MOCK_ORACLE_PROVIDER);
    }
    console.log();

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    const liquidationHandler = EXECUTE_LIQUIDATIONS
        ? await ethers.getContractAt("LiquidationHandler", LIQUIDATION_HANDLER)
        : null;

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
    console.log(`\n💀 Step 4: Checking liquidation status ${EXECUTE_LIQUIDATIONS ? 'and executing liquidations' : ''}...\n`);

    // Use correct price precision matching frontend:
    // indexTokenPrice: 12 decimals
    // longTokenPrice: 24 decimals
    // shortTokenPrice: 24 decimals (for single-token markets like USDTARS)
    const stablePrice = ethers.utils.parseUnits("1", 24);

    let liquidatableCount = 0;
    let executedCount = 0;
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
            const indexToken = getIndexToken(marketAddr);

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

                // Execute liquidation if in execute mode
                if (EXECUTE_LIQUIDATIONS && liquidationHandler) {
                    console.log(`\n   ⚡ Executing liquidation for this position...`);

                    // Update oracle prices for this specific market
                    const priceUpdateSuccess = await updateOraclePricesForMarket(signer, marketAddr, currentPrice);

                    if (!priceUpdateSuccess) {
                        console.log(`   ❌ Failed to update oracle prices, skipping liquidation\n`);
                    } else {
                        // Execute the liquidation
                        const success = await executeLiquidation(signer, liquidationHandler, positionData, marketInfo, currentPrice);
                        if (success) {
                            executedCount++;
                        }
                    }
                }
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
    console.log(`\n📊 LIQUIDATION ${EXECUTE_LIQUIDATIONS ? 'EXECUTION' : 'SCAN'} SUMMARY\n`);
    console.log(`Total Positions in DataStore: ${positionCount.toString()}`);
    console.log(`Active Positions (size > 0): ${activePositions.length}`);
    console.log(`Liquidatable Positions: ${liquidatableCount}`);
    console.log(`Healthy Positions: ${activePositions.length - liquidatableCount}`);

    if (EXECUTE_LIQUIDATIONS) {
        console.log(`Successfully Executed Liquidations: ${executedCount}`);
        console.log(`Failed Liquidations: ${liquidatableCount - executedCount}`);
    }

    if (liquidatableCount > 0) {
        console.log(`\n💀 LIQUIDATABLE POSITIONS:\n`);
        for (let i = 0; i < liquidatablePositions.length; i++) {
            const p = liquidatablePositions[i];
            console.log(`${i + 1}. ${p.account} - ${p.isLong ? 'LONG' : 'SHORT'} in ${p.marketName}`);
            console.log(`   Current Price: $${p.currentPrice}`);
            console.log(`   Size: ${ethers.utils.formatUnits(p.position.numbers.sizeInUsd, 30)} USD`);
            console.log(`   Collateral: ${ethers.utils.formatUnits(p.position.numbers.collateralAmount, 6)} mUSD`);
            console.log(`   Key: ${p.key}`);
            console.log();
        }

        if (!EXECUTE_LIQUIDATIONS) {
            console.log("💡 To execute liquidations, run with: EXECUTE_LIQUIDATIONS=true");
        }
    } else {
        console.log("\n✅ All positions are healthy at current prices!");
    }
}

main().catch(console.error);
