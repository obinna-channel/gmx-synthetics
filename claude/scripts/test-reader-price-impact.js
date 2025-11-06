const { ethers } = require("hardhat");

/**
 * Test Reader's getExecutionPrice for estimating price impact on new orders
 */

async function main() {
    const MARKET_ADDRESS = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb"; // mUSDTNGN [mUSD-mUSD]
    const INDEX_TOKEN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"; // mUSDTNGN
    const IS_LONG = process.env.IS_LONG === "false" ? false : true;

    // Test with different order sizes
    const TEST_ORDER_SIZES_USD = [
        1000,   // $1k
        5000,   // $5k
        10000,  // $10k
        50000,  // $50k
        100000, // $100k
        200000  // $200k
    ];

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║       TEST READER PRICE IMPACT ESTIMATION                        ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`📊 Market: ${MARKET_ADDRESS}`);
    console.log(`📊 Index Token: ${INDEX_TOKEN}`);
    console.log(`📊 Side: ${IS_LONG ? 'LONG' : 'SHORT'}\n`);

    // Get contracts
    const dataStore = await ethers.getContract("DataStore");
    const reader = await ethers.getContract("Reader");

    // Get market
    const market = await reader.getMarket(dataStore.address, MARKET_ADDRESS);
    console.log(`✅ Market loaded:`);
    console.log(`   indexToken: ${market.indexToken}`);
    console.log(`   longToken: ${market.longToken}`);
    console.log(`   shortToken: ${market.shortToken}\n`);

    // Get current oracle price (we'll use a mock price for testing)
    // In production, you'd get this from your oracle
    const mockOraclePrice = ethers.utils.parseUnits("1475", 12); // 1475 with 12 decimals

    console.log(`📈 Using mock oracle price: ${ethers.utils.formatUnits(mockOraclePrice, 12)}\n`);

    // Create prices structure
    const prices = {
        indexTokenPrice: {
            min: mockOraclePrice,
            max: mockOraclePrice
        },
        longTokenPrice: {
            min: ethers.utils.parseUnits("1", 12), // USDT = $1
            max: ethers.utils.parseUnits("1", 12)
        },
        shortTokenPrice: {
            min: ethers.utils.parseUnits("1", 12), // USDT = $1
            max: ethers.utils.parseUnits("1", 12)
        }
    };

    console.log(`${'═'.repeat(80)}`);
    console.log(`\n📊 TESTING PRICE IMPACT FOR DIFFERENT ORDER SIZES\n`);
    console.log(`${'═'.repeat(80)}\n`);

    for (const orderSizeUsd of TEST_ORDER_SIZES_USD) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`\n💰 Order Size: $${orderSizeUsd.toLocaleString()}\n`);

        // Convert to 30 decimals
        const sizeDeltaUsd = ethers.utils.parseUnits(orderSizeUsd.toString(), 30);

        try {
            // Call getExecutionPrice for a NEW position
            // positionSizeInUsd = 0, positionSizeInTokens = 0, pendingImpactAmount = 0
            const result = await reader.getExecutionPrice(
                dataStore.address,
                MARKET_ADDRESS,  // marketKey (address, not struct)
                prices,
                0,              // positionSizeInUsd (0 for new position)
                0,              // positionSizeInTokens (0 for new position)
                sizeDeltaUsd,   // sizeDeltaUsd (positive for increase)
                0,              // pendingImpactAmount (0 for new position)
                IS_LONG
            );

            console.log(`📝 Result from Reader.getExecutionPrice():`);
            console.log(`   priceImpactUsd:       ${ethers.utils.formatUnits(result.priceImpactUsd, 30)} USD (${result.priceImpactUsd.toString()})`);
            console.log(`   executionPrice:       ${ethers.utils.formatUnits(result.executionPrice, 12)} (${result.executionPrice.toString()})`);
            console.log(`   balanceWasImproved:   ${result.balanceWasImproved}`);

            // Calculate impact as percentage
            const impactPercent = result.priceImpactUsd.abs().mul(100).mul(ethers.BigNumber.from(10).pow(12)).div(sizeDeltaUsd);
            const impactPercentFormatted = ethers.utils.formatUnits(impactPercent, 12);

            console.log(`\n📊 Calculated Metrics:`);
            console.log(`   Impact %:             ${result.priceImpactUsd.gte(0) ? '+' : '-'}${impactPercentFormatted}%`);
            console.log(`   Impact USD:           ${result.priceImpactUsd.gte(0) ? '+' : '-'}$${ethers.utils.formatUnits(result.priceImpactUsd.abs(), 30)}`);

            // Calculate price difference
            const priceDiff = result.executionPrice.sub(mockOraclePrice);
            const priceDiffFormatted = ethers.utils.formatUnits(priceDiff.abs(), 12);

            console.log(`   Oracle Price:         ${ethers.utils.formatUnits(mockOraclePrice, 12)}`);
            console.log(`   Execution Price:      ${ethers.utils.formatUnits(result.executionPrice, 12)}`);
            console.log(`   Price Difference:     ${priceDiff.gte(0) ? '+' : '-'}${priceDiffFormatted}`);
            console.log(`   Helps Balance:        ${result.balanceWasImproved ? '✅ Yes (positive impact)' : '❌ No (negative impact)'}`);

        } catch (error) {
            console.log(`❌ Error calling getExecutionPrice:`);
            console.log(`   ${error.message}`);
        }
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`\n✅ Testing complete!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
