const { ethers } = require("hardhat");

const ADDRESSES = {
    ORACLE: "0x2128510EF2dEf2B46B039f3Ca8417C965F51a9de",
    MOCK_PROVIDER: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5",
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827"
};

async function main() {
    console.log("\n=== Checking Oracle Prices ===\n");

    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    // Try to get primary prices
    try {
        const musdPriceKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["string", "address"],
                ["PRICE", ADDRESSES.mUSD]
            )
        );

        console.log("Checking DataStore prices...");
        console.log("mUSD price key:", musdPriceKey);

        // Try different price keys
        const priceKeys = [
            ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["PRICE"])),
            ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string", "address"], ["PRICE", ADDRESSES.mUSD])),
            ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address"], [ADDRESSES.mUSD]))
        ];

        for (const key of priceKeys) {
            try {
                const price = await dataStore.getUint(key);
                if (price.gt(0)) {
                    console.log(`Price found with key ${key}: ${ethers.utils.formatUnits(price, 30)}`);
                }
            } catch (e) {
                // Silent fail, try next key
            }
        }
    } catch (error) {
        console.log("Could not read prices from DataStore:", error.message);
    }

    // Try to call Oracle's primary/secondary price
    try {
        console.log("\nTrying Oracle methods...");

        // Get the Oracle ABI to see available methods
        const oracleArtifact = require("../artifacts/contracts/oracle/Oracle.sol/Oracle.json");
        const oracleContract = new ethers.Contract(ADDRESSES.ORACLE, oracleArtifact.abi, ethers.provider);

        // Try to get primary price
        const primaryPriceKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["address"], [ADDRESSES.mUSD])
        );

        console.log("Primary price key for mUSD:", primaryPriceKey);

        // Check if Oracle has a getPrimaryPrice function
        if (oracleContract.getPrimaryPrice) {
            const primaryPrice = await oracleContract.getPrimaryPrice(ADDRESSES.mUSD);
            console.log("Primary price for mUSD:", ethers.utils.formatUnits(primaryPrice.min, 30));
        }
    } catch (error) {
        console.log("Oracle method error:", error.message);
    }

    // Check Mock Provider prices
    try {
        console.log("\n=== Mock Provider Prices ===");

        // Try to read from mock provider storage
        const mockProvider = await ethers.getContractAt(
            ["function getPrice(address token) external view returns (uint256)"],
            ADDRESSES.MOCK_PROVIDER
        );

        const musdPrice = await mockProvider.getPrice(ADDRESSES.mUSD);
        const mngnPrice = await mockProvider.getPrice(ADDRESSES.mNGN);

        console.log("mUSD price from Mock Provider:", ethers.utils.formatUnits(musdPrice, 24), "NGN");
        console.log("mNGN price from Mock Provider:", ethers.utils.formatUnits(mngnPrice, 12), "NGN");
    } catch (error) {
        console.log("Mock provider error:", error.message);
    }

    // Try to check price feed type
    try {
        console.log("\n=== Price Feed Configuration ===");

        const priceFeedKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["PRICE_FEED"])), ADDRESSES.mUSD]
            )
        );

        const priceFeed = await dataStore.getAddress(priceFeedKey);
        console.log("Price feed for mUSD:", priceFeed);

        if (priceFeed === ADDRESSES.MOCK_PROVIDER) {
            console.log("✓ Using Mock Provider for prices");
        }
    } catch (error) {
        console.log("Price feed check error:", error.message);
    }

    console.log("\n=== Summary ===");
    console.log("1. The Mock Provider should be providing prices");
    console.log("2. When you set price to 1600, it should affect position PnL");
    console.log("3. The $0.004088 profit suggests price is ~1500.06, not 1600");
    console.log("4. This could mean:");
    console.log("   - Price reverts after setting");
    console.log("   - Execution uses different price");
    console.log("   - PnL calculation has a bug");
}

main().catch(console.error);