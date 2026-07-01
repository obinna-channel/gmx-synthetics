const { ethers } = require("hardhat");

async function main() {
    const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Token addresses
    const mMETA = "0xE2f8B015D23bB0EFdD57D8C08a328180437D031D";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mUSDTARS = "0xed6890bE2409F0db06a00C809a298E2E06553BE1";

    console.log("=== Checking MockOracleProvider Prices ===\n");
    console.log("Provider:", MOCK_ORACLE_PROVIDER, "\n");

    const mockProviderAbi = [
        "function getPrice(address token) external view returns (uint256)",
        "function getPriceWithPrecision(address token) external view returns (uint256)"
    ];

    const mockProvider = await ethers.getContractAt(mockProviderAbi, MOCK_ORACLE_PROVIDER);

    // Check mMETA
    console.log("Checking mMETA (", mMETA, "):");
    try {
        const price = await mockProvider.getPriceWithPrecision(mMETA);
        console.log("  Price:", price.toString());
        console.log("  Human-readable:", (Number(price) / 10**12).toFixed(4), "@ 12 decimals");
    } catch (e) {
        console.log("  Error:", e.message);
    }

    // Check mUSD
    console.log("\nChecking mUSD (", mUSD, "):");
    try {
        const price = await mockProvider.getPriceWithPrecision(mUSD);
        console.log("  Price:", price.toString());
        console.log("  Human-readable:", (Number(price) / 10**24).toFixed(2), "@ 24 decimals");
    } catch (e) {
        console.log("  Error:", e.message);
    }

    // Check mUSDTARS
    console.log("\nChecking mUSDTARS (", mUSDTARS, "):");
    try {
        const price = await mockProvider.getPriceWithPrecision(mUSDTARS);
        console.log("  Price:", price.toString());
        console.log("  Human-readable:", (Number(price) / 10**12).toFixed(4), "@ 12 decimals");
    } catch (e) {
        console.log("  Error:", e.message);
    }
}

main().catch(console.error);
