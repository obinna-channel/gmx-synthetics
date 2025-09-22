const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING CRITICAL MISSING DATA ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const [deployer] = await ethers.getSigners();
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("Checking if prices are set...");
    
    // Primary price for sNGN (index token)
    const primaryPriceKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["PRIMARY_PRICE", sNGN])
    );
    
    // Try to get price as uint256
    try {
        const price = await dataStore.getUint(primaryPriceKey);
        console.log("sNGN primary price:", price.toString());
    } catch (e) {
        console.log("No primary price for sNGN");
    }
    
    // Check USDT price
    const usdtPriceKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["PRIMARY_PRICE", USDT])
    );
    
    try {
        const price = await dataStore.getUint(usdtPriceKey);
        console.log("USDT primary price:", price.toString());
    } catch (e) {
        console.log("No primary price for USDT");
    }
    
    console.log("\nThe issue might be:");
    console.log("1. Oracle prices not properly set in DataStore");
    console.log("2. Missing market configuration parameters");
    console.log("3. The deposit flow expects different contract interactions");
    
    // Check if we should be using multicall
    console.log("\nIn GMX v2, the typical flow is:");
    console.log("1. multicall([");
    console.log("   sendTokens(token, receiver, amount),");
    console.log("   createDeposit(params)");
    console.log("])");
    console.log("\nThis ensures atomicity and proper state updates.");
}

main().catch(console.error);
