const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("\n=== Setting USD-based Prices for mNGN Market ===");
    console.log("Following the successful sNGN market pricing model");
    console.log("Signer:", signer.address);

    // Contract addresses
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";

    // Get MockOracleProvider contract
    const mockProvider = await ethers.getContractAt(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider",
        MOCK_PROVIDER
    );

    // Set prices in USD terms (like the original successful deployment)
    // USDT: $1.00 with 30 decimals precision and 6 token decimals
    // Price = 1 * 10^(30-6) = 10^24
    const usdtPrice = ethers.BigNumber.from(10).pow(24);

    // mNGN: $1/1500 with 30 decimals precision and 18 token decimals
    // Price = (1/1500) * 10^(30-18) = 10^12 / 1500
    const mngnPrice = ethers.BigNumber.from(10).pow(12).div(1500);

    console.log("\nNew Price Configuration (USD-based):");
    console.log("  USDT: $1.00");
    console.log("  Raw value:", usdtPrice.toString());
    console.log("  mNGN: $0.000666... (1/1500)");
    console.log("  Raw value:", mngnPrice.toString());
    console.log("\nThis matches the successful sNGN market pricing model");

    try {
        // Set USDT price
        console.log("\nSetting USDT price to $1.00...");
        const tx1 = await mockProvider.setPriceWithPrecision(
            USDT,
            usdtPrice
        );
        console.log(`  Transaction: ${tx1.hash}`);
        await tx1.wait();
        console.log("  ✅ USDT price set");

        // Set mNGN price
        console.log("\nSetting mNGN price to $1/1500...");
        const tx2 = await mockProvider.setPriceWithPrecision(
            mNGN,
            mngnPrice
        );
        console.log(`  Transaction: ${tx2.hash}`);
        await tx2.wait();
        console.log("  ✅ mNGN price set");

        console.log("\n✅ Prices successfully updated to USD-based model!");
        console.log("\nImplications:");
        console.log("  - 1 USDT = $1.00");
        console.log("  - 1 mNGN = $0.000666...");
        console.log("  - Exchange rate: 1 USDT = 1500 mNGN");
        console.log("  - Deposit of 1000 USDT + 1,500,000 mNGN = $2000 total liquidity");

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