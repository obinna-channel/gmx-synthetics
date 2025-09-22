const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING FOR ZERO ADDRESSES IN DEPOSIT FLOW ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check if the market has all required addresses set
    console.log("Checking market configuration:");
    
    // Market token (should be the market address itself)
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "address"], 
        [ethers.utils.id("MARKET_TOKEN"), MARKET])
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    console.log("MARKET_TOKEN:", marketToken);
    console.log("  Is zero?", marketToken === ethers.constants.AddressZero);
    
    // Index token
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "address"], 
        [ethers.utils.id("INDEX_TOKEN"), MARKET])
    );
    const indexToken = await dataStore.getAddress(indexTokenKey);
    console.log("\nINDEX_TOKEN:", indexToken);
    console.log("  Is zero?", indexToken === ethers.constants.AddressZero);
    
    // Long token
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "address"], 
        [ethers.utils.id("LONG_TOKEN"), MARKET])
    );
    const longToken = await dataStore.getAddress(longTokenKey);
    console.log("\nLONG_TOKEN:", longToken);
    console.log("  Is zero?", longToken === ethers.constants.AddressZero);
    
    // Short token
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "address"], 
        [ethers.utils.id("SHORT_TOKEN"), MARKET])
    );
    const shortToken = await dataStore.getAddress(shortTokenKey);
    console.log("\nSHORT_TOKEN:", shortToken);
    console.log("  Is zero?", shortToken === ethers.constants.AddressZero);
    
    // Check WNT (wrapped native token)
    const wntKey = ethers.utils.id("WNT");
    const wnt = await dataStore.getAddress(wntKey);
    console.log("\nWNT:", wnt);
    console.log("  Is zero?", wnt === ethers.constants.AddressZero);
    
    if (wnt === ethers.constants.AddressZero) {
        console.log("\n⚠️ WNT is not set!");
        console.log("This could cause the Unauthorized error with zero address.");
    }
}

main().catch(console.error);
