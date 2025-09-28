const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("\n=== Setting Exchange Rate Prices for mUSD/mNGN ===");
    console.log("Signer:", signer.address);

    // Contract addresses
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";

    // Get MockOracleProvider contract
    const mockProvider = await ethers.getContractAt(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider",
        MOCK_PROVIDER
    );

    // Set prices with NGN-based exchange rate logic
    // mUSD: 1 mUSD = 1500 NGN
    // Price = 1500 * 10^(30-6) = 1500 * 10^24
    const musdPrice = ethers.BigNumber.from("1500").mul(ethers.BigNumber.from("10").pow(24));

    // mNGN: 1 mNGN = 1 NGN
    // Price = 1 * 10^(30-18) = 10^12
    const mngnPrice = ethers.BigNumber.from("10").pow(12);

    console.log("\nExchange Rate Configuration:");
    console.log("  1 mUSD = 1500 NGN");
    console.log("  1 mNGN = 1 NGN");
    console.log("  Exchange Rate: 1 mUSD = 1500 mNGN");

    console.log("\nRaw Values (with precision):");
    console.log("  mUSD: " + musdPrice.toString());
    console.log("  mNGN: " + mngnPrice.toString());

    try {
        // Set mUSD price
        console.log("\nSetting mUSD price...");
        const tx1 = await mockProvider.setPriceWithPrecision(mUSD, musdPrice);
        console.log(`  Transaction: ${tx1.hash}`);
        await tx1.wait();
        console.log("  ✅ mUSD price updated");

        // Set mNGN price
        console.log("\nSetting mNGN price...");
        const tx2 = await mockProvider.setPriceWithPrecision(mNGN, mngnPrice);
        console.log(`  Transaction: ${tx2.hash}`);
        await tx2.wait();
        console.log("  ✅ mNGN price updated");

        console.log("\n✅ Exchange rate prices successfully updated!");

        console.log("\nPrice Summary:");
        console.log("  mUSD/NGN Rate: 1:1500");
        console.log("  mNGN/NGN Rate: 1:1");

        console.log("\nDeposit Value Calculations:");
        console.log("  Small deposit (10 mUSD + 15,000 mNGN):");
        console.log("    - 10 mUSD = 15,000 NGN");
        console.log("    - 15,000 mNGN = 15,000 NGN");
        console.log("    - Total liquidity: 30,000 NGN");

        console.log("\n  Medium deposit (100 mUSD + 150,000 mNGN):");
        console.log("    - 100 mUSD = 150,000 NGN");
        console.log("    - 150,000 mNGN = 150,000 NGN");
        console.log("    - Total liquidity: 300,000 NGN");

        console.log("\nNext steps:");
        console.log("1. Run deposit creation script");
        console.log("2. Execute deposit with oracle provider");

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