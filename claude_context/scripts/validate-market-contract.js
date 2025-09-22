const { ethers } = require("hardhat");

async function main() {
    console.log("=== VALIDATING MARKET CONTRACT ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    // Check if it's actually a Market contract
    const code = await ethers.provider.getCode(MARKET);
    console.log("Contract code size:", code.length, "bytes");
    
    // Try to interact with it as a Market contract
    try {
        const market = await ethers.getContractAt("Market", MARKET);
        
        // Market contracts should have basic ERC20 functions
        const name = await market.name();
        const symbol = await market.symbol();
        const decimals = await market.decimals();
        const totalSupply = await market.totalSupply();
        
        console.log("\nMarket token details:");
        console.log("  Name:", name);
        console.log("  Symbol:", symbol);
        console.log("  Decimals:", decimals);
        console.log("  Total Supply:", ethers.utils.formatUnits(totalSupply, decimals));
        
    } catch (e) {
        console.log("Error reading market contract:", e.message);
        
        // The contract might not be a proper Market token
        console.log("\n⚠️  This might not be a valid Market contract!");
        console.log("It was created by MarketFactory but may not have all required functions.");
    }
    
    // Check MarketFactory to see what it actually created
    console.log("\n=== CHECKING MARKETFACTORY ===");
    const MARKET_FACTORY = "0x6691AFCa903E83996493283ab827DE22E9018959";
    const marketFactory = await ethers.getContractAt("MarketFactory", MARKET_FACTORY);
    
    // Check if MarketFactory recognizes this market
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Get market list
    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
    const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, 0, 1);
    
    console.log("Market in DataStore:", markets[0]);
    console.log("Our market:", MARKET);
    console.log("Match:", markets[0].toLowerCase() === MARKET.toLowerCase());
}

main().catch(console.error);
