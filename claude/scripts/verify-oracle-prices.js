const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Oracle Prices ===\n");
    
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    console.log("💰 Getting prices from Oracle contract:");
    
    // Get primary prices
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("\nUSDT Primary Price:");
        console.log("  Min:", usdtPrice.min.toString());
        console.log("  Max:", usdtPrice.max.toString());
        
        if (usdtPrice.min.gt(0)) {
            // Convert from price with 30 decimals to USD
            const priceInUsd = ethers.utils.formatUnits(usdtPrice.min, 24); // 30 - 6 decimals
            console.log("  Price in USD: $", priceInUsd);
        }
    } catch (e) {
        console.log("  Error getting USDT price:", e.message);
    }
    
    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("\nsNGN Primary Price:");
        console.log("  Min:", ngnPrice.min.toString());
        console.log("  Max:", ngnPrice.max.toString());
        
        if (ngnPrice.min.gt(0)) {
            // Convert from price with 30 decimals to USD  
            const priceInUsd = ethers.utils.formatUnits(ngnPrice.min, 12); // 30 - 18 decimals
            console.log("  Price in USD: $", priceInUsd);
        }
    } catch (e) {
        console.log("  Error getting sNGN price:", e.message);
    }
    
    // Check timestamps
    try {
        const minTimestamp = await oracle.minTimestamp();
        const maxTimestamp = await oracle.maxTimestamp();
        console.log("\n⏰ Oracle Timestamps:");
        console.log("  Min:", minTimestamp.toString());
        console.log("  Max:", maxTimestamp.toString());
    
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("\nCurrent block timestamp:", currentBlock.timestamp);
    
        if (minTimestamp.gt(0)) {
            const timeDiff = currentBlock.timestamp - minTimestamp.toNumber();
            console.log("Time since min timestamp:", timeDiff, "seconds");

            if (timeDiff > 300) {
                console.log("⚠️  Timestamps are stale (> 5 minutes old)");
            } else {
                console.log("✅ Timestamps are fresh");
            }
        }
    } catch (e) {
        console.log("  Error getting timestamps:", e.message);
    }
    
    // Now check DataStore directly to see if prices are stored there
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("\n📊 Checking DataStore directly:");
    
    // Build the keys for MIN_PRICE and MAX_PRICE
    const MIN_PRICE_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_PRICE"])
    );
    const MAX_PRICE_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PRICE"])
    );
    
    // USDT price keys
    const usdtMinKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_PRICE_KEY, USDT]
        )
    );
    const usdtMaxKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MAX_PRICE_KEY, USDT]
        )
    );
    
    const usdtMinPrice = await dataStore.getUint(usdtMinKey);
    const usdtMaxPrice = await dataStore.getUint(usdtMaxKey);
    
    console.log("\nUSDT prices in DataStore:");
    console.log("  Min:", usdtMinPrice.toString());
    console.log("  Max:", usdtMaxPrice.toString());
    
    // sNGN price keys
    const ngnMinKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_PRICE_KEY, sNGN]
        )
    );
    const ngnMaxKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MAX_PRICE_KEY, sNGN]
        )
    );
    
    const ngnMinPrice = await dataStore.getUint(ngnMinKey);
    const ngnMaxPrice = await dataStore.getUint(ngnMaxKey);
    
    console.log("\nsNGN prices in DataStore:");
    console.log("  Min:", ngnMinPrice.toString());
    console.log("  Max:", ngnMaxPrice.toString());
    
    console.log("\n🎯 Summary:");
    if (usdtMinPrice.eq(0) && ngnMinPrice.eq(0)) {
        console.log("❌ Prices are NOT set in DataStore!");
        console.log("This explains why the deposit was cancelled.");
        console.log("The setPrimaryPrice might not be writing to DataStore.");
    } else {
        console.log("✅ Prices are set in DataStore");
    }
}

main().catch(console.error);