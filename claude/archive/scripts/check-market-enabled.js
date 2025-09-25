const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING IF MARKET IS ENABLED ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check if market is disabled
    const IS_MARKET_DISABLED = ethers.utils.id("IS_MARKET_DISABLED");
    const disabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [IS_MARKET_DISABLED, MARKET])
    );
    const isDisabled = await dataStore.getBool(disabledKey);
    console.log("Market disabled:", isDisabled);
    
    // The getEnabledMarket function checks:
    // 1. Market exists (marketToken != address(0))
    // 2. Market is not disabled
    
    // Let's check if market token is properly set
    const MARKET_TOKEN = ethers.utils.id("MARKET_TOKEN");
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, MARKET_TOKEN])
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    
    console.log("Market token from DataStore:", marketToken);
    console.log("Expected (market address):", MARKET);
    
    if (marketToken === ethers.constants.AddressZero) {
        console.log("\n❌ Market token is zero address!");
        console.log("This will cause getEnabledMarket to fail.");
    } else if (marketToken.toLowerCase() !== MARKET.toLowerCase()) {
        console.log("\n⚠️ Market token doesn't match market address!");
        console.log("In GMX v2, the market address IS the market token.");
    } else {
        console.log("\n✓ Market token is correctly set.");
    }
    
    // Check if the market contract actually exists
    const code = await ethers.provider.getCode(MARKET);
    console.log("\nMarket contract exists:", code.length > 2);
}

main().catch(console.error);
