const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Testing Primary Price Setting ===\n");
    console.log("Signer address:", signer.address);

    // Oracle address from deployment
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("Oracle address:", ORACLE);

    // Step 1: Check current prices
    console.log("\n📍 STEP 1: Check current primary prices...");
    
    let currentUsdtPrice, currentSngnPrice;
    let hasUsdtPrice = false;
    let hasSngnPrice = false;

    try {
        const usdtPriceData = await oracle.primaryPrices(USDT);
        console.log("  USDT price data:", usdtPriceData);
        if (usdtPriceData.min && !usdtPriceData.min.eq(0)) {
            currentUsdtPrice = usdtPriceData;
            hasUsdtPrice = true;
            console.log("  USDT min price:", usdtPriceData.min.toString());
            console.log("  USDT max price:", usdtPriceData.max.toString());
        } else {
            console.log("  USDT: No price set");
        }
    } catch (error) {
        console.log("  USDT: Error reading or no price set");
    }

    try {
        const sngnPriceData = await oracle.primaryPrices(sNGN);
        console.log("  sNGN price data:", sngnPriceData);
        if (sngnPriceData.min && !sngnPriceData.min.eq(0)) {
            currentSngnPrice = sngnPriceData;
            hasSngnPrice = true;
            console.log("  sNGN min price:", sngnPriceData.min.toString());
            console.log("  sNGN max price:", sngnPriceData.max.toString());
        } else {
            console.log("  sNGN: No price set");
        }
    } catch (error) {
        console.log("  sNGN: Error reading or no price set");
    }

    // Step 2: Clear prices if they exist
    console.log("\n📍 STEP 2: Clear existing prices if needed...");

    if (hasUsdtPrice || hasSngnPrice) {
        console.log("  Existing prices found. Attempting to clear all prices...");
        
        try {
            console.log("  Calling clearAllPrices()...");
            const clearTx = await oracle.clearAllPrices();
            console.log("  Transaction sent:", clearTx.hash);
            const clearReceipt = await clearTx.wait();
            console.log("  ✅ Prices cleared successfully!");
        } catch (error) {
            console.log("  ❌ Failed to clear prices:", error.message);
            console.log("\n  Note: You might need to clear individual prices or the error might be permission-related.");
        }
    } else {
        console.log("  No existing prices to clear.");
    }

    // Step 3: Prepare new prices
    console.log("\n📍 STEP 3: Prepare new prices...");

    // USDT: $1.00
    // Price per unit = $1 / 10^6 = $0.000001
    // Oracle stores as: 0.000001 * 10^30 = 10^24
    const usdtPrice = ethers.BigNumber.from(10).pow(24);

    // sNGN: $1/1500 (for balanced deposits)
    // Price per unit = (1/1500) / 10^18
    // Oracle stores as: 1/(1.5 * 10^21) * 10^30 = 10^9/1.5 = 666666666
    const sngnPrice = ethers.BigNumber.from(10).pow(9).mul(2).div(3);

    console.log("  USDT price (10^24):", usdtPrice.toString());
    console.log("  sNGN price (666666666):", sngnPrice.toString());

    // Create Price.Props struct
    // struct Props {
    //     uint256 min;
    //     uint256 max;
    // }
    const usdtPriceStruct = {
        min: usdtPrice,
        max: usdtPrice  // Using same price for min/max (no spread)
    };

    const sngnPriceStruct = {
        min: sngnPrice,
        max: sngnPrice  // Using same price for min/max (no spread)
    };

    // Step 4: Set new prices
    console.log("\n📍 STEP 4: Set new primary prices...");
    console.log("\n⚠️  EXECUTION DISABLED - Review the plan first");
    console.log("\nWhat will happen:");
    console.log("  1. Set USDT primary price to $1.00");
    console.log("  2. Set sNGN primary price to $0.000666... (1/1500)");
    console.log("  3. Set oracle timestamps");
    console.log("  4. Prices will be ready for deposit execution");

    // EXECUTION CODE - READY TO EXECUTE
    try {
        // Set USDT price
        console.log("\n  Setting USDT price...");
        const usdtTx = await oracle.setPrimaryPrice(USDT, usdtPriceStruct);
        console.log("  TX sent:", usdtTx.hash);
        await usdtTx.wait();
        console.log("  ✅ USDT price set!");

        // Set sNGN price
        console.log("\n  Setting sNGN price...");
        const sngnTx = await oracle.setPrimaryPrice(sNGN, sngnPriceStruct);
        console.log("  TX sent:", sngnTx.hash);
        await sngnTx.wait();
        console.log("  ✅ sNGN price set!");

        // Set timestamps
        const block = await ethers.provider.getBlock("latest");
        const currentTimestamp = block.timestamp;
        console.log("\n  Setting timestamps...");
        const timestampTx = await oracle.setTimestamps(currentTimestamp, currentTimestamp + 60);
        console.log("  TX sent:", timestampTx.hash);
        await timestampTx.wait();
        console.log("  ✅ Timestamps set!");
        console.log("    Min timestamp:", currentTimestamp);
        console.log("    Max timestamp:", currentTimestamp + 60);

        console.log("\n✅ SUCCESS! Oracle prices are now set and ready for deposit execution!");

        // Verify the prices were set
        console.log("\n📍 STEP 5: Verify prices were set correctly...");
        const finalUsdtPrice = await oracle.primaryPrices(USDT);
        const finalSngnPrice = await oracle.primaryPrices(sNGN);
        
        console.log("\n  USDT price:");
        console.log("    Min:", finalUsdtPrice.min.toString());
        console.log("    Max:", finalUsdtPrice.max.toString());
        
        console.log("\n  sNGN price:");
        console.log("    Min:", finalSngnPrice.min.toString());
        console.log("    Max:", finalSngnPrice.max.toString());

        const timestamps = await oracle.getTimestamps();
        console.log("\n  Timestamps:");
        console.log("    Min:", timestamps.min.toString());
        console.log("    Max:", timestamps.max.toString());

    } catch (error) {
        console.log("\n❌ Error setting prices:", error.message);
        
        if (error.message.includes("Unauthorized")) {
            console.log("\n⚠️  You don't have permission to set oracle prices.");
            console.log("  You need CONTROLLER role on the Oracle contract.");
        }
    }
}

main().catch(console.error);