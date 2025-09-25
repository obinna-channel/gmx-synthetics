const { ethers } = require("hardhat");

async function main() {
    console.log("=== Finding the Registered Market ===\n");
    
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Get all registered markets
    const MARKET_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_LIST"])
    );
    
    const marketCount = await dataStore.getAddressCount(MARKET_LIST);
    console.log("Total registered markets:", marketCount.toString());
    
    if (marketCount.gt(0)) {
        const markets = await dataStore.getAddressValuesAt(MARKET_LIST, 0, marketCount);
        
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            console.log(`\nMarket ${i + 1}: ${market}`);
            
            // Get market configuration
            const LONG_TOKEN = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["string"], ["LONG_TOKEN"])
            );
            const SHORT_TOKEN = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["string"], ["SHORT_TOKEN"])
            );
            const INDEX_TOKEN = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["string"], ["INDEX_TOKEN"])
            );
            
            const longTokenKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [LONG_TOKEN, market])
            );
            const shortTokenKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [SHORT_TOKEN, market])
            );
            const indexTokenKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [INDEX_TOKEN, market])
            );
            
            const longToken = await dataStore.getAddress(longTokenKey);
            const shortToken = await dataStore.getAddress(shortTokenKey);
            const indexToken = await dataStore.getAddress(indexTokenKey);
            
            console.log("  Long token:", longToken);
            console.log("  Short token:", shortToken);
            console.log("  Index token:", indexToken);
            
            // Check if this is our USDTNGN market
            const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6".toLowerCase();
            const sNGN = "0xe0dba0326623dece1712581271ebcd846d67b29f".toLowerCase();
            
            if (longToken === USDT && shortToken === USDT && indexToken === sNGN) {
                console.log("  ✅ THIS IS THE USDTNGN MARKET!");
                console.log("\n🔴 IMPORTANT: Use this address as the market:", market);
                
                // Check market token
                const marketToken = await ethers.getContractAt("IERC20", market);
                const totalSupply = await marketToken.totalSupply();
                console.log("\nMarket token supply:", ethers.utils.formatEther(totalSupply));
            }
        }
    } else {
        console.log("\n❌ No markets registered!");
        console.log("This explains the error - there's no valid market to deposit into.");
    }
    
    console.log("\n=== THE ISSUE ===");
    console.log("You've been trying to deposit to: 0x6136252ce73bD4dA432F85b2A7065481DE227601");
    console.log("But that's not a registered market address!");
    console.log("\nUse the correct market address shown above in your deposit scripts.");
}

main().catch(console.error);