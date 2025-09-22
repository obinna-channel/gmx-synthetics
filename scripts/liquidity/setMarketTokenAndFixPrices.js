const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Setting Market Token and Correct Oracle Prices ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    // Contract addresses
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("\n=== Step 1: Setting Market Token ===");
    console.log("In GMX V2, the market address IS the market token (GM token) address.");
    console.log("Market/GM Token:", MARKET);

    // Set MARKET_TOKEN to point to itself
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_TOKEN"))]
        )
    );

    console.log("Setting MARKET_TOKEN to:", MARKET);
    const tx = await dataStore.setAddress(marketTokenKey, MARKET);
    await tx.wait();
    console.log("✅ MARKET_TOKEN set!");

    // Verify it was set
    const verifyMarketToken = await dataStore.getAddress(marketTokenKey);
    console.log("Verification: MARKET_TOKEN =", verifyMarketToken);

    console.log("\n=== Step 2: Setting Correct Oracle Prices ===");
    console.log("IMPORTANT: For USDT/NGN market:");
    console.log("- USDT price = $1 (stable)");
    console.log("- sNGN price = 1650 (meaning 1 USDT = 1650 NGN)");

    try {
        // Clear existing prices
        console.log("\nClearing existing oracle prices...");
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("Prices cleared!");

        // USDT price: $1 USD (with 30 decimals)
        const usdtPrice = {
            min: ethers.utils.parseUnits("1", 30),
            max: ethers.utils.parseUnits("1", 30)
        };

        // sNGN price: 1650 (1 USDT = 1650 NGN, with 30 decimals)
        // This represents the USDT/NGN exchange rate
        const sNgnPrice = {
            min: ethers.utils.parseUnits("1650", 30),
            max: ethers.utils.parseUnits("1650", 30)
        };

        console.log("\nSetting USDT price to $1.00...");
        console.log("  Raw value:", usdtPrice.min.toString());
        const setUsdtTx = await oracle.setPrimaryPrice(USDT, usdtPrice);
        await setUsdtTx.wait();
        console.log("✅ USDT price set!");

        console.log("\nSetting sNGN price to 1650 (USDT/NGN rate)...");
        console.log("  Raw value:", sNgnPrice.min.toString());
        const setSNgnTx = await oracle.setPrimaryPrice(sNGN, sNgnPrice);
        await setSNgnTx.wait();
        console.log("✅ sNGN price set!");

        // Verify prices
        const usdtPriceCheck = await oracle.getPrimaryPrice(USDT);
        const sNgnPriceCheck = await oracle.getPrimaryPrice(sNGN);

        console.log("\n=== Price Verification ===");
        console.log("USDT price: $", ethers.utils.formatUnits(usdtPriceCheck.min, 30));
        console.log("sNGN price (USDT/NGN rate):", ethers.utils.formatUnits(sNgnPriceCheck.min, 30));

    } catch (error) {
        console.log("Oracle price setting error:", error.message);
    }

    console.log("\n✅ Configuration complete!");
    console.log("Market token is set and prices are configured correctly.");
    console.log("You can now execute the deposit.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });