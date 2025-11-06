const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING USDTNGN MARKET RATE CONFIGURATION ===\n");

    // Contract addresses from marks-arbitrumSepolia-deployments
    const USDTNGN_MARKET = "0x5E63276Caae0FF49b2762b98A1d37941AA50F804";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";

    console.log("USDTNGN Market:", USDTNGN_MARKET);
    console.log("DataStore:", DATA_STORE);
    console.log("Reader:", READER);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check borrowing factors using correct key format (slope-based model)
    console.log("\n=== BORROWING FACTORS (SLOPE MODEL) ===");

    // Helper to hash keys correctly (matching keys.ts)
    const BASE_BORROWING_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BASE_BORROWING_FACTOR"));
    const ABOVE_OPTIMAL_USAGE_BORROWING_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ABOVE_OPTIMAL_USAGE_BORROWING_FACTOR"));
    const OPTIMAL_USAGE_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPTIMAL_USAGE_FACTOR"));
    const BORROWING_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BORROWING_FACTOR"));
    const FUNDING_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FUNDING_FACTOR"));
    const FUNDING_EXPONENT_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FUNDING_EXPONENT_FACTOR"));
    const BORROWING_EXPONENT_FACTOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BORROWING_EXPONENT_FACTOR"));

    // Base Borrowing Factor (slope model)
    const baseBorrowingFactorKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [BASE_BORROWING_FACTOR, USDTNGN_MARKET, true]
        )
    );
    const baseBorrowingFactorLong = await dataStore.getUint(baseBorrowingFactorKeyLong);
    console.log("Base Borrowing Factor (Long):", baseBorrowingFactorLong.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(baseBorrowingFactorLong, 30));
    console.log("  Per year:", parseFloat(ethers.utils.formatUnits(baseBorrowingFactorLong, 30)) * 31536000 * 100, "%");

    const baseBorrowingFactorKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [BASE_BORROWING_FACTOR, USDTNGN_MARKET, false]
        )
    );
    const baseBorrowingFactorShort = await dataStore.getUint(baseBorrowingFactorKeyShort);
    console.log("\nBase Borrowing Factor (Short):", baseBorrowingFactorShort.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(baseBorrowingFactorShort, 30));
    console.log("  Per year:", parseFloat(ethers.utils.formatUnits(baseBorrowingFactorShort, 30)) * 31536000 * 100, "%");

    // Above Optimal Usage Borrowing Factor
    const aboveOptimalKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [ABOVE_OPTIMAL_USAGE_BORROWING_FACTOR, USDTNGN_MARKET, true]
        )
    );
    const aboveOptimalLong = await dataStore.getUint(aboveOptimalKeyLong);
    console.log("\nAbove Optimal Borrowing Factor (Long):", aboveOptimalLong.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(aboveOptimalLong, 30));
    console.log("  Per year:", parseFloat(ethers.utils.formatUnits(aboveOptimalLong, 30)) * 31536000 * 100, "%");

    const aboveOptimalKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [ABOVE_OPTIMAL_USAGE_BORROWING_FACTOR, USDTNGN_MARKET, false]
        )
    );
    const aboveOptimalShort = await dataStore.getUint(aboveOptimalKeyShort);
    console.log("\nAbove Optimal Borrowing Factor (Short):", aboveOptimalShort.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(aboveOptimalShort, 30));
    console.log("  Per year:", parseFloat(ethers.utils.formatUnits(aboveOptimalShort, 30)) * 31536000 * 100, "%");

    // Optimal Usage Factor
    const optimalUsageKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [OPTIMAL_USAGE_FACTOR, USDTNGN_MARKET, true]
        )
    );
    const optimalUsageLong = await dataStore.getUint(optimalUsageKeyLong);
    console.log("\nOptimal Usage Factor (Long):", optimalUsageLong.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(optimalUsageLong, 30));
    console.log("  As percent:", parseFloat(ethers.utils.formatUnits(optimalUsageLong, 30)) * 100, "%");

    const optimalUsageKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [OPTIMAL_USAGE_FACTOR, USDTNGN_MARKET, false]
        )
    );
    const optimalUsageShort = await dataStore.getUint(optimalUsageKeyShort);
    console.log("\nOptimal Usage Factor (Short):", optimalUsageShort.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(optimalUsageShort, 30));
    console.log("  As percent:", parseFloat(ethers.utils.formatUnits(optimalUsageShort, 30)) * 100, "%");

    // Old borrowing factor keys (for reference)
    console.log("\n=== OLD BORROWING FACTOR KEYS (deprecated?) ===");
    const borrowingFactorKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [BORROWING_FACTOR, USDTNGN_MARKET, true]
        )
    );
    const borrowingFactorLong = await dataStore.getUint(borrowingFactorKeyLong);
    console.log("Borrowing Factor (Long):", borrowingFactorLong.toString());

    const borrowingFactorKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [BORROWING_FACTOR, USDTNGN_MARKET, false]
        )
    );
    const borrowingFactorShort = await dataStore.getUint(borrowingFactorKeyShort);
    console.log("Borrowing Factor (Short):", borrowingFactorShort.toString());

    // Check funding factor
    console.log("\n=== FUNDING FACTOR ===");

    const fundingFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [FUNDING_FACTOR, USDTNGN_MARKET]
        )
    );
    const fundingFactor = await dataStore.getUint(fundingFactorKey);
    console.log("Funding Factor:", fundingFactor.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(fundingFactor, 30));

    // Check other rate-related configs
    console.log("\n=== OTHER RATE CONFIGS ===");

    const fundingExponentKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [FUNDING_EXPONENT_FACTOR, USDTNGN_MARKET]
        )
    );
    const fundingExponent = await dataStore.getUint(fundingExponentKey);
    console.log("Funding Exponent Factor:", fundingExponent.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(fundingExponent, 30));

    const borrowingExponentKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [BORROWING_EXPONENT_FACTOR, USDTNGN_MARKET, true]
        )
    );
    const borrowingExponentLong = await dataStore.getUint(borrowingExponentKeyLong);
    console.log("Borrowing Exponent Factor (Long):", borrowingExponentLong.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(borrowingExponentLong, 30));

    // Now use Reader to get market info with actual rates
    console.log("\n=== READER getMarketInfo OUTPUT ===");

    const reader = await ethers.getContractAt("Reader", READER);

    // Create price payload (using placeholder price of $400 for USDTNGN)
    const price = ethers.utils.parseUnits("400", 30);
    const usdPrice = ethers.utils.parseUnits("1", 30);

    const marketPrices = {
        indexTokenPrice: { min: price, max: price },
        longTokenPrice: { min: usdPrice, max: usdPrice },
        shortTokenPrice: { min: usdPrice, max: usdPrice }
    };

    const marketInfo = await reader.getMarketInfo(DATA_STORE, marketPrices, USDTNGN_MARKET);

    console.log("\nBorrowing Factor Per Second (Longs):", marketInfo.borrowingFactorPerSecondForLongs.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(marketInfo.borrowingFactorPerSecondForLongs, 30));
    console.log("  Per year (approx):", parseFloat(ethers.utils.formatUnits(marketInfo.borrowingFactorPerSecondForLongs, 30)) * 31536000 * 100, "%");

    console.log("\nBorrowing Factor Per Second (Shorts):", marketInfo.borrowingFactorPerSecondForShorts.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(marketInfo.borrowingFactorPerSecondForShorts, 30));
    console.log("  Per year (approx):", parseFloat(ethers.utils.formatUnits(marketInfo.borrowingFactorPerSecondForShorts, 30)) * 31536000 * 100, "%");

    console.log("\nFunding Factor Per Second:", marketInfo.nextFunding.fundingFactorPerSecond.toString());
    console.log("  As decimal:", ethers.utils.formatUnits(marketInfo.nextFunding.fundingFactorPerSecond, 30));
    console.log("  Per year (approx):", parseFloat(ethers.utils.formatUnits(marketInfo.nextFunding.fundingFactorPerSecond, 30)) * 31536000 * 100, "%");

    console.log("\nLongs Pay Shorts:", marketInfo.nextFunding.longsPayShorts);

    // Expected values from config
    console.log("\n=== EXPECTED VALUES FROM CONFIG ===");
    const SECONDS_PER_YEAR = 31536000;
    const expectedBaseBorrowing = 0.50 / SECONDS_PER_YEAR; // 50% per year
    const expectedMaxFunding = 0.90 / SECONDS_PER_YEAR; // 90% per year

    console.log("Expected Base Borrowing Factor (50%/year):", expectedBaseBorrowing);
    console.log("  As 30-decimal:", ethers.utils.parseUnits(expectedBaseBorrowing.toFixed(30), 30).toString());

    console.log("Expected Max Funding Factor (90%/year):", expectedMaxFunding);
    console.log("  As 30-decimal:", ethers.utils.parseUnits(expectedMaxFunding.toFixed(30), 30).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
