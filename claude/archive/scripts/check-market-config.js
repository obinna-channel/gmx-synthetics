const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING MARKET CONFIGURATION ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check if market exists
    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
    const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log("Total markets in DataStore:", marketCount.toString());

    // Check if our market is in the list
    const MARKET_KEY = ethers.utils.keccak256(ethers.utils.solidityPack(["string", "address"], ["MARKET", MARKET]));
    
    try {
        // Try to get market data
        console.log("\nChecking market data for:", MARKET);
        
        // Check market token
        const marketTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
        );
        const marketToken = await dataStore.getAddress(marketTokenKey);
        console.log("Market token:", marketToken);

        // Check index token
        const indexTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["INDEX_TOKEN", MARKET])
        );
        const indexToken = await dataStore.getAddress(indexTokenKey);
        console.log("Index token:", indexToken);

        // Check long token
        const longTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", MARKET])
        );
        const longToken = await dataStore.getAddress(longTokenKey);
        console.log("Long token:", longToken);

        // Check short token
        const shortTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["SHORT_TOKEN", MARKET])
        );
        const shortToken = await dataStore.getAddress(shortTokenKey);
        console.log("Short token:", shortToken);

        if (marketToken === ethers.constants.AddressZero) {
            console.log("\n⚠️ Market not found in DataStore!");
            console.log("The market needs to be properly created through MarketFactory");
        } else {
            console.log("\n✅ Market found in DataStore");
        }

    } catch (e) {
        console.log("Error reading market data:", e.message);
    }
}

main().catch(console.error);
