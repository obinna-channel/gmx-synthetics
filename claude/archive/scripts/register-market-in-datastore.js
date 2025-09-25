const { ethers } = require("hardhat");

async function main() {
    console.log("=== MANUALLY REGISTERING MARKET IN DATASTORE ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";  // Our new market
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const ROLE_STORE = "0xAD5ca3aE69C60b1B699B604DE06AaC96Eb1F8C1b";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const [deployer] = await ethers.getSigners();
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Check if we have CONTROLLER role
    const CONTROLLER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
    const hasControllerRole = await roleStore.hasRole(deployer.address, CONTROLLER);
    console.log("Has CONTROLLER role:", hasControllerRole);

    if (!hasControllerRole) {
        console.log("Granting CONTROLLER role to deployer...");
        try {
            const grantTx = await roleStore.grantRole(deployer.address, CONTROLLER);
            await grantTx.wait();
            console.log("✓ CONTROLLER role granted");
        } catch (e) {
            console.log("❌ Could not grant role:", e.message);
        }
    }

    console.log("\nRegistering market in DataStore...");

    try {
        // Add market to MARKET_LIST
        const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
        const addMarketTx = await dataStore.addAddress(MARKET_LIST_KEY, MARKET);
        await addMarketTx.wait();
        console.log("✓ Added market to MARKET_LIST");

        // Set MARKET_TOKEN (the market address is its own token)
        const marketTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
        );
        await dataStore.setAddress(marketTokenKey, MARKET);
        console.log("✓ Set MARKET_TOKEN");

        // Set INDEX_TOKEN (sNGN)
        const indexTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["INDEX_TOKEN", MARKET])
        );
        await dataStore.setAddress(indexTokenKey, sNGN);
        console.log("✓ Set INDEX_TOKEN to sNGN");

        // Set LONG_TOKEN (USDT)
        const longTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", MARKET])
        );
        await dataStore.setAddress(longTokenKey, USDT);
        console.log("✓ Set LONG_TOKEN to USDT");

        // Set SHORT_TOKEN (USDT for same-collateral market)
        const shortTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["SHORT_TOKEN", MARKET])
        );
        await dataStore.setAddress(shortTokenKey, USDT);
        console.log("✓ Set SHORT_TOKEN to USDT");

        console.log("\n✅ Market registered successfully!");
        console.log("Market address:", MARKET);

    } catch (error) {
        console.log("\n❌ Error registering market:", error.reason || error.message);
        if (error.message.includes("Unauthorized")) {
            console.log("You need CONTROLLER role to write to DataStore");
        }
    }

    // Verify registration
    console.log("\n=== VERIFYING REGISTRATION ===");
    const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log("Total markets in DataStore:", marketCount.toString());
}

main().catch(console.error);
