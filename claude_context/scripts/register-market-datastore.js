const { ethers } = require("hardhat");

async function main() {
    console.log("=== REGISTERING MARKET IN DATASTORE ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";  
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778"; // Correct from deployments
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const [deployer] = await ethers.getSigners();
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    console.log("Deployer:", deployer.address);

    // Check CONTROLLER role
    const CONTROLLER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
    const hasControllerRole = await roleStore.hasRole(deployer.address, CONTROLLER);
    console.log("Has CONTROLLER role:", hasControllerRole);

    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));

    try {
        // Step 1: Add market to MARKET_LIST
        console.log("\n1. Adding market to MARKET_LIST...");
        const addTx = await dataStore.addAddress(MARKET_LIST_KEY, MARKET);
        await addTx.wait();
        console.log("✓ Added to MARKET_LIST");

        // Step 2: Set market configuration
        console.log("\n2. Setting market configuration...");
        
        // MARKET_TOKEN
        const marketTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
        );
        await dataStore.setAddress(marketTokenKey, MARKET);
        console.log("✓ MARKET_TOKEN = market address");

        // INDEX_TOKEN (sNGN)
        const indexTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["INDEX_TOKEN", MARKET])
        );
        await dataStore.setAddress(indexTokenKey, sNGN);
        console.log("✓ INDEX_TOKEN = sNGN");

        // LONG_TOKEN (USDT)
        const longTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", MARKET])
        );
        await dataStore.setAddress(longTokenKey, USDT);
        console.log("✓ LONG_TOKEN = USDT");

        // SHORT_TOKEN (USDT)
        const shortTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["SHORT_TOKEN", MARKET])
        );
        await dataStore.setAddress(shortTokenKey, USDT);
        console.log("✓ SHORT_TOKEN = USDT");

        console.log("\n✅ Market registered successfully!");
        console.log("Market address:", MARKET);

    } catch (error) {
        console.log("\n❌ Error:", error.reason || error.message);
        
        if (error.message.includes("Unauthorized")) {
            console.log("\nNeed CONTROLLER role. Admin should grant it with:");
            console.log("roleStore.grantRole('" + deployer.address + "', '" + CONTROLLER + "')");
        }
    }

    // Verify
    console.log("\n=== VERIFICATION ===");
    const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log("Total markets:", marketCount.toString());
    
    if (marketCount.gt(0)) {
        console.log("Registered markets:");
        for (let i = 0; i < marketCount; i++) {
            const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, i, 1);
            console.log("  " + (i + 1) + ". " + markets[0]);
        }
    }
}

main().catch(console.error);
