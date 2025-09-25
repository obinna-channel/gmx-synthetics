const { ethers } = require("hardhat");

async function main() {
    console.log("=== MANUALLY REGISTERING MARKET IN DATASTORE ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";  
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const ROLE_STORE = "0xAD5Ca3aE69C60b1B699B604DE06AaC96Eb1F8C1b";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const [deployer] = await ethers.getSigners();
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Check if we have CONTROLLER role
    const CONTROLLER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
    const hasControllerRole = await roleStore.hasRole(deployer.address, CONTROLLER);
    console.log("Deployer:", deployer.address);
    console.log("Has CONTROLLER role:", hasControllerRole);

    console.log("\nAttempting to register market in DataStore...");
    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));

    try {
        // Add market to MARKET_LIST
        console.log("Adding market to MARKET_LIST...");
        const addMarketTx = await dataStore.addAddress(MARKET_LIST_KEY, MARKET);
        await addMarketTx.wait();
        console.log("✓ Added market to MARKET_LIST");

        // Set MARKET_TOKEN
        const marketTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
        );
        const setMarketTx = await dataStore.setAddress(marketTokenKey, MARKET);
        await setMarketTx.wait();
        console.log("✓ Set MARKET_TOKEN");

        // Set INDEX_TOKEN
        const indexTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["INDEX_TOKEN", MARKET])
        );
        const setIndexTx = await dataStore.setAddress(indexTokenKey, sNGN);
        await setIndexTx.wait();
        console.log("✓ Set INDEX_TOKEN to sNGN");

        // Set LONG_TOKEN
        const longTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", MARKET])
        );
        const setLongTx = await dataStore.setAddress(longTokenKey, USDT);
        await setLongTx.wait();
        console.log("✓ Set LONG_TOKEN to USDT");

        // Set SHORT_TOKEN
        const shortTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["SHORT_TOKEN", MARKET])
        );
        const setShortTx = await dataStore.setAddress(shortTokenKey, USDT);
        await setShortTx.wait();
        console.log("✓ Set SHORT_TOKEN to USDT");

        console.log("\n✅ Market registered successfully!");

    } catch (error) {
        console.log("\n❌ Error:", error.reason || error.message);
        
        if (error.message.includes("Unauthorized")) {
            console.log("\nYou need CONTROLLER role to write to DataStore");
            console.log("To grant CONTROLLER role, the admin needs to run:");
            console.log(`await roleStore.grantRole("${deployer.address}", "${CONTROLLER}")`);
        }
    }

    // Verify registration
    console.log("\n=== VERIFYING REGISTRATION ===");
    const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log("Total markets in DataStore:", marketCount.toString());
    
    if (marketCount.gt(0)) {
        const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, 0, marketCount);
        for (let i = 0; i < markets.length; i++) {
            console.log(`Market ${i}:`, markets[i]);
        }
    }
}

main().catch(console.error);
