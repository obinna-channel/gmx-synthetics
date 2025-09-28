const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("\n=== Setting Exchange Rate Prices for mNGN ===");
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

    // Set exchange rates
    const usdtRate = 1500;  // 1 USDT = 1500 NGN
    const mngnRate = 1;     // 1 mNGN = 1 NGN

    // Calculate prices with proper precision
    // USDT has 6 decimals, so we need 30 - 6 = 24 additional decimals
    // mNGN has 18 decimals, so we need 30 - 18 = 12 additional decimals
    const usdtPriceWithPrecision = ethers.utils.parseUnits(usdtRate.toString(), 24);
    const mngnPriceWithPrecision = ethers.utils.parseUnits(mngnRate.toString(), 12);

    console.log("\nNew Exchange Rate Configuration:");
    console.log(`  1 USDT = ${usdtRate} NGN`);
    console.log(`  1 mNGN = ${mngnRate} NGN`);
    console.log(`  Exchange Rate: 1 USDT = ${usdtRate/mngnRate} mNGN`);

    console.log("\nRaw Values (with precision):");
    console.log(`  USDT: ${usdtPriceWithPrecision.toString()}`);
    console.log(`  mNGN: ${mngnPriceWithPrecision.toString()}`);

    try {
        // Set USDT price
        console.log("\nSetting USDT price...");
        const tx1 = await mockProvider.setPriceWithPrecision(
            USDT,
            usdtPriceWithPrecision
        );
        console.log(`  Transaction: ${tx1.hash}`);
        await tx1.wait();
        console.log("  ✅ USDT price updated to 1500");

        // Set mNGN price
        console.log("\nSetting mNGN price...");
        const tx2 = await mockProvider.setPriceWithPrecision(
            mNGN,
            mngnPriceWithPrecision
        );
        console.log(`  Transaction: ${tx2.hash}`);
        await tx2.wait();
        console.log("  ✅ mNGN price updated to 1");

        console.log("\n✅ Exchange rate prices successfully updated!");
        console.log("\nPrice Summary:");
        console.log("  USDT/NGN Rate: 1:1500");
        console.log("  mNGN/NGN Rate: 1:1");

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