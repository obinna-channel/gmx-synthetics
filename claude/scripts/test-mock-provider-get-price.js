const { ethers } = require("hardhat");

async function main() {
    console.log("=== Testing MockOracleProvider.getOraclePrice() ===\n");

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    const mockProviderAbi = [
        {
            "inputs": [
                {"name": "token", "type": "address"},
                {"name": "data", "type": "bytes"}
            ],
            "name": "getOraclePrice",
            "outputs": [
                {
                    "components": [
                        {"name": "token", "type": "address"},
                        {"name": "min", "type": "uint256"},
                        {"name": "max", "type": "uint256"},
                        {"name": "timestamp", "type": "uint256"},
                        {"name": "provider", "type": "address"}
                    ],
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const mockProvider = await ethers.getContractAt(mockProviderAbi, MOCK_PROVIDER);

    console.log("Testing mNVDA...");
    try {
        const nvdaPrice = await mockProvider.getOraclePrice(mNVDA, "0x");
        console.log("✅ mNVDA price retrieved:");
        console.log("  token:", nvdaPrice.token);
        console.log("  min:", nvdaPrice.min.toString());
        console.log("  max:", nvdaPrice.max.toString());
        console.log("  timestamp:", nvdaPrice.timestamp.toString());
        console.log("  provider:", nvdaPrice.provider);
    } catch (e) {
        console.log("❌ Error getting mNVDA price:", e.message);
        if (e.error && e.error.data) {
            console.log("  Error data:", e.error.data);
        }
    }

    console.log("\nTesting mUSD...");
    try {
        const musdPrice = await mockProvider.getOraclePrice(mUSD, "0x");
        console.log("✅ mUSD price retrieved:");
        console.log("  token:", musdPrice.token);
        console.log("  min:", musdPrice.min.toString());
        console.log("  max:", musdPrice.max.toString());
        console.log("  timestamp:", musdPrice.timestamp.toString());
        console.log("  provider:", musdPrice.provider);
    } catch (e) {
        console.log("❌ Error getting mUSD price:", e.message);
        if (e.error && e.error.data) {
            console.log("  Error data:", e.error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
