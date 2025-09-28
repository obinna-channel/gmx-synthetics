const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("\n=== Setting Prices for mUSDTNGN Market ===");
    console.log("Signer:", signer.address);

    // Contract addresses
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"; // Index token (18 decimals)
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // Long token (6 decimals)
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827"; // Short token (18 decimals)

    // Get MockOracleProvider contract
    const mockProvider = await ethers.getContractAt(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider",
        MOCK_PROVIDER
    );

    // Current exchange rate: 1 USD = 1500 NGN
    const EXCHANGE_RATE = 1500;

    console.log("\nPrice Configuration:");
    console.log("  Exchange Rate: 1 USD = " + EXCHANGE_RATE + " NGN");
    console.log("");
    console.log("  Token Prices in USD:");
    console.log("  - mUSDTNGN: " + EXCHANGE_RATE + " (tracks USDT/NGN rate)");
    console.log("  - mUSD: 1 USD");
    console.log("  - mNGN: " + (1/EXCHANGE_RATE).toFixed(9) + " USD");

    // Calculate raw prices with proper decimals
    // mUSDTNGN: 18 decimals, precision 30 => 30 - 18 = 12
    const musdtNgnPrice = ethers.utils.parseUnits(EXCHANGE_RATE.toString(), 12);

    // mUSD: 6 decimals, precision 30 => 30 - 6 = 24
    const musdPrice = ethers.utils.parseUnits("1", 24);

    // mNGN: 18 decimals, precision 30 => 30 - 18 = 12
    // Price = 1/1500 = 0.000666667
    const mngnPriceInUsd = (1 / EXCHANGE_RATE).toFixed(9);
    const mngnPrice = ethers.utils.parseUnits(mngnPriceInUsd, 12);

    console.log("\nRaw Values (with precision):");
    console.log("  mUSDTNGN: " + musdtNgnPrice.toString());
    console.log("  mUSD: " + musdPrice.toString());
    console.log("  mNGN: " + mngnPrice.toString());

    try {
        // Set mUSDTNGN price
        console.log("\nSetting mUSDTNGN price...");
        const tx1 = await mockProvider.setPriceWithPrecision(mUSDTNGN, musdtNgnPrice);
        console.log(`  Transaction: ${tx1.hash}`);
        await tx1.wait();
        console.log("  ✅ mUSDTNGN price updated to " + EXCHANGE_RATE);

        // Set mUSD price
        console.log("\nSetting mUSD price...");
        const tx2 = await mockProvider.setPriceWithPrecision(mUSD, musdPrice);
        console.log(`  Transaction: ${tx2.hash}`);
        await tx2.wait();
        console.log("  ✅ mUSD price updated to 1 USD");

        // Set mNGN price
        console.log("\nSetting mNGN price...");
        const tx3 = await mockProvider.setPriceWithPrecision(mNGN, mngnPrice);
        console.log(`  Transaction: ${tx3.hash}`);
        await tx3.wait();
        console.log("  ✅ mNGN price updated to " + mngnPriceInUsd + " USD");

        console.log("\n✅ All prices successfully updated!");

        console.log("\nPrice Summary:");
        console.log("  mUSDTNGN = " + EXCHANGE_RATE + " (index tracking USDT/NGN)");
        console.log("  mUSD = 1 USD");
        console.log("  mNGN = " + mngnPriceInUsd + " USD");

        console.log("\nDeposit Value Calculations (in USD):");
        console.log("  First deposit (100 mUSD + 150,000 mNGN):");
        console.log("    - 100 mUSD = $100");
        console.log("    - 150,000 mNGN = $100");
        console.log("    - Total liquidity: $200 USD");

        console.log("\nPosition P&L Example:");
        console.log("  $100 long position:");
        console.log("  - At 1500: SIZE_IN_TOKENS = 100/1500 = 0.0667 mUSDTNGN");
        console.log("  - If rate moves to 1600: P&L = 0.0667 × (1600-1500) = $6.67");
        console.log("  - Expected behavior: ✅");

        console.log("\nNext steps:");
        console.log("1. Run: npx hardhat run scripts/create-musdtngn-first-deposit.js --network arbitrumSepolia");
        console.log("2. Run: npx hardhat run scripts/execute-musdtngn-deposit.js --network arbitrumSepolia");

    } catch (error) {
        console.log("\n❌ Error setting prices:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });