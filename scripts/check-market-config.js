const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Configuration ===\n");

    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Get market info
    console.log("Market Address:", MARKET);

    try {
        const market = await reader.getMarket(DATA_STORE, MARKET);
        console.log("\nMarket Configuration:");
        console.log("  Market Token:", market.marketToken);
        console.log("  Index Token:", market.indexToken);
        console.log("  Long Token:", market.longToken);
        console.log("  Short Token:", market.shortToken);

        // Check what tokens are configured
        console.log("\nToken Analysis:");

        if (market.indexToken === USDT) {
            console.log("  Index Token: USDT (base currency)");
        } else if (market.indexToken === sNGN) {
            console.log("  Index Token: sNGN");
        } else {
            console.log("  Index Token: Unknown -", market.indexToken);
        }

        if (market.longToken === USDT) {
            console.log("  Long Token: USDT");
        }

        if (market.shortToken === USDT) {
            console.log("  Short Token: USDT");
        }

        console.log("\n💡 Market Type:");
        if (market.longToken === market.shortToken) {
            console.log("  Single-token market (long = short = USDT)");
            console.log("  This is a synthetic market where both sides use USDT");
        }

        console.log("\n📊 Price Requirements:");
        console.log("  For a USDT/NGN perpetual market:");
        console.log("  - USDT price: Not needed (always $1 by definition)");
        console.log("  - NGN price: REQUIRED (to calculate the USDT/NGN rate)");
        console.log("  - The market tracks: How many NGN per 1 USDT");

    } catch (error) {
        console.log("Error reading market:", error.message);
    }
}

main().catch(console.error);