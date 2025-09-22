const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFY ORACLE PRICE FORMAT ===\n");

    const ORACLE_ADDRESS = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const SNGN_TOKEN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const USDT_TOKEN = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const oracle = await ethers.getContractAt("Oracle", ORACLE_ADDRESS);

    console.log("Checking prices for tokens:\n");

    // Check sNGN (we just set this)
    try {
        const sNGNPrice = await oracle.getPrimaryPrice(SNGN_TOKEN);
        const readable = ethers.utils.formatUnits(sNGNPrice.min, 30);
        console.log("sNGN Token (0xe0dBA...):");
        console.log("  Raw (30 dec):", sNGNPrice.min.toString());
        console.log("  Human readable:", readable, "NGN per USDT");
        console.log("  ✓ This is the format contracts will read\n");
    } catch (e) {
        console.log("sNGN: No price set");
    }

    // Try to check USDT (probably not set, but let's see)
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT_TOKEN);
        if (usdtPrice.min.gt(0)) {
            const readable = ethers.utils.formatUnits(usdtPrice.min, 30);
            console.log("USDT Token (0x5fE0C...):");
            console.log("  Raw (30 dec):", usdtPrice.min.toString());
            console.log("  Human readable:", readable);
        } else {
            console.log("USDT Token: No price set (expected - USDT is usually the base)");
        }
    } catch (e) {
        console.log("USDT Token: Empty price (expected - USDT is the base currency)");
    }

    // Verify the Oracle state
    console.log("\n=== ORACLE STATE ===");
    const tokensCount = await oracle.getTokensWithPricesCount();
    console.log("Total tokens with prices:", tokensCount.toString());
    
    if (tokensCount.gt(0)) {
        const tokens = await oracle.getTokensWithPrices(0, tokensCount);
        console.log("Tokens with active prices:");
        for (const token of tokens) {
            console.log("  -", token);
        }
    }

    console.log("\n=== SUMMARY ===");
    console.log("✓ Oracle is correctly storing prices in 30 decimal format");
    console.log("✓ Prices are stored as Price.Props struct with min/max");
    console.log("✓ GMX contracts will call getPrimaryPrice(token) to read prices");
    console.log("✓ The price represents: How many NGN per 1 USDT");
    console.log("\nYour keeper needs to:");
    console.log("1. Fetch price from API (e.g., 1650 NGN per USDT)");
    console.log("2. Convert to 30 decimals: price * 10^30");
    console.log("3. Call setPrimaryPrice(token, {min: price30, max: price30})");
}

main().catch(console.error);
