const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting Fresh Oracle Prices ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("Current block:", currentBlock.number);
    console.log("Current timestamp:", currentBlock.timestamp);
    console.log("Current time:", new Date(currentBlock.timestamp * 1000).toISOString());

    // Price calculations
    // USDT: $1.00 = 10^24 (with 30 decimals of precision)
    const usdtPrice = ethers.BigNumber.from(10).pow(24);
    // sNGN: $1/1500 = 666666666 (with 30 decimals of precision)
    const sngnPrice = ethers.BigNumber.from(10).pow(9).mul(2).div(3);

    console.log("\n📊 Prices to set:");
    console.log("  USDT: $1.00 (", usdtPrice.toString(), ")");
    console.log("  sNGN: $0.000666... (", sngnPrice.toString(), ")");

    try {
        // Step 1: Clear existing prices
        console.log("\n📍 Step 1: Clearing existing prices...");
        const clearTx = await oracle.clearAllPrices();
        console.log("  TX:", clearTx.hash);
        await clearTx.wait();
        console.log("  ✅ Prices cleared");

        // Step 2: Set primary prices
        console.log("\n📍 Step 2: Setting primary prices...");
        
        const usdtPriceStruct = {
            min: usdtPrice,
            max: usdtPrice
        };
        
        const sngnPriceStruct = {
            min: sngnPrice,
            max: sngnPrice
        };

        // Set USDT price
        console.log("  Setting USDT price...");
        const usdtTx = await oracle.setPrimaryPrice(USDT, usdtPriceStruct);
        console.log("    TX:", usdtTx.hash);
        await usdtTx.wait();
        console.log("    ✅ USDT price set");

        // Set sNGN price
        console.log("  Setting sNGN price...");
        const sngnTx = await oracle.setPrimaryPrice(sNGN, sngnPriceStruct);
        console.log("    TX:", sngnTx.hash);
        await sngnTx.wait();
        console.log("    ✅ sNGN price set");

        // Step 3: Set timestamps using JavaScript time
        console.log("\n📍 Step 3: Setting timestamps using JavaScript time...");
        const currentTime = Math.floor(Date.now() / 1000);
        const currentBlock = await ethers.provider.getBlock("latest");
        const blockTimestamp = currentBlock.timestamp;

        console.log("    JavaScript time:", currentTime);
        console.log("    Blockchain time:", blockTimestamp);
        console.log("    Difference:", currentTime - blockTimestamp, "seconds");

        const timestampTx = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
        console.log("  TX:", timestampTx.hash);
        await timestampTx.wait();
        console.log("  ✅ Timestamps set");
        console.log("    Using JavaScript time:", currentTime);
        console.log("    Min:", currentTime - 30, "(-30 seconds)");
        console.log("    Max:", currentTime + 30, "(+30 seconds)");
        console.log("    Window: 60 seconds total");

        // Step 4: Verify prices were set
        console.log("\n📍 Step 4: Verifying prices...");
        
        const usdtPriceData = await oracle.primaryPrices(USDT);
        console.log("  USDT:");
        console.log("    Min:", usdtPriceData.min.toString());
        console.log("    Max:", usdtPriceData.max.toString());
        console.log("    ✅ Matches expected:", usdtPriceData.min.eq(usdtPrice));

        const sngnPriceData = await oracle.primaryPrices(sNGN);
        console.log("  sNGN:");
        console.log("    Min:", sngnPriceData.min.toString());
        console.log("    Max:", sngnPriceData.max.toString());
        console.log("    ✅ Matches expected:", sngnPriceData.min.eq(sngnPrice));

        console.log("\n✅ SUCCESS! Oracle prices are fresh and ready!");
        console.log("\n📝 Summary:");
        console.log("  - USDT price: $1.00");
        console.log("  - sNGN price: $0.000666... (1/1500)");
        console.log("  - Timestamp window: 60 seconds (30 in past, 30 in future)");
        console.log("  - Using blockchain timestamp from block", currentBlock.number);
        
        return true;

    } catch (error) {
        console.log("\n❌ Error setting prices:", error.message);
        
        if (error.data) {
            console.log("Error data:", error.data);
            
            // Try to decode common errors
            const errorSig = error.data.slice(0, 10);
            const errorMessages = {
                "0xded099de": "EmptyPrimaryPrice - Price validation failed",
                "0xa35b150b": "Unauthorized - Missing required role",
                "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired"
            };
            
            if (errorMessages[errorSig]) {
                console.log("Decoded:", errorMessages[errorSig]);
            }
        }
        
        return false;
    }
}

// Run the script
main()
    .then((success) => {
        if (success) {
            console.log("\n🎉 Price setting completed successfully!");
        } else {
            console.log("\n⚠️  Price setting failed. Check errors above.");
        }
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });