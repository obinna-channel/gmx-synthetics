const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking All Token Prices in MockOracleProvider ===\n");

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4";
    const mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    const mockProviderAbi = [
        {
            "inputs": [{"name": "token", "type": "address"}],
            "name": "prices",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const mockProvider = await ethers.getContractAt(mockProviderAbi, MOCK_PROVIDER);

    // Check TSLA
    console.log("📊 mTSLA:");
    const tslaPrice = await mockProvider.prices(mTSLA);
    console.log("  Raw value:", tslaPrice.toString());
    console.log("  As USD (÷ 10^12):", tslaPrice.div(ethers.BigNumber.from(10).pow(12)).toString());

    // Check NVDA
    console.log("\n📊 mNVDA:");
    const nvdaPrice = await mockProvider.prices(mNVDA);
    console.log("  Raw value:", nvdaPrice.toString());
    console.log("  As USD (÷ 10^12):", nvdaPrice.div(ethers.BigNumber.from(10).pow(12)).toString());

    // Check mUSD
    console.log("\n📊 mUSD:");
    const musdPrice = await mockProvider.prices(mUSD);
    console.log("  Raw value:", musdPrice.toString());
    console.log("  As USD (÷ 10^24):", musdPrice.div(ethers.BigNumber.from(10).pow(24)).toString());

    console.log("\n" + "=".repeat(50));
    console.log("Expected values:");
    console.log("  mTSLA: 428 × 10^12 =", ethers.BigNumber.from(428).mul(ethers.BigNumber.from(10).pow(12)).toString());
    console.log("  mNVDA: 180 × 10^12 =", ethers.BigNumber.from(180).mul(ethers.BigNumber.from(10).pow(12)).toString());
    console.log("  mUSD:  1 × 10^24 =", ethers.BigNumber.from(1).mul(ethers.BigNumber.from(10).pow(24)).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
