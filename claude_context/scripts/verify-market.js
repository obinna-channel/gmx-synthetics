const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFYING USDTNGN MARKET ===\n");

    const MARKET = "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    
    console.log("Market address we're using:", MARKET);
    console.log("DataStore address:", DATA_STORE);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get all markets from DataStore
    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
    const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    
    console.log("\nTotal markets in DataStore:", marketCount.toString());

    if (marketCount.gt(0)) {
        console.log("Checking all registered markets:");
        for (let i = 0; i < marketCount.toNumber(); i++) {
            const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, i, 1);
            const marketAddr = markets[0];
            console.log(`  Market ${i}: ${marketAddr}`);
            
            if (marketAddr.toLowerCase() === MARKET.toLowerCase()) {
                console.log("    ✅ This is our USDTNGN market!");
                
                // Get market details
                const indexTokenKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(["string", "address"], ["INDEX_TOKEN", marketAddr])
                );
                const indexToken = await dataStore.getAddress(indexTokenKey);
                
                const longTokenKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", marketAddr])
                );
                const longToken = await dataStore.getAddress(longTokenKey);
                
                const shortTokenKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(["string", "address"], ["SHORT_TOKEN", marketAddr])
                );
                const shortToken = await dataStore.getAddress(shortTokenKey);
                
                console.log("    Index Token:", indexToken);
                console.log("    Long Token:", longToken);
                console.log("    Short Token:", shortToken);
            }
        }
    }

    // Check the market directly
    console.log("\nDirect check for our market:", MARKET);
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    
    if (marketToken !== ethers.constants.AddressZero) {
        console.log("✅ Market is registered! Market token:", marketToken);
    } else {
        console.log("❌ Market NOT found in DataStore");
    }
}

main().catch(console.error);
