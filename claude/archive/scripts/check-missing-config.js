const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING MISSING CONFIGURATIONS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // 1. Check FEE_RECEIVER
    const FEE_RECEIVER = ethers.utils.id("FEE_RECEIVER");
    const feeReceiver = await dataStore.getAddress(FEE_RECEIVER);
    console.log("1. FEE_RECEIVER:", feeReceiver);
    console.log("   Status:", feeReceiver === ethers.constants.AddressZero ? "❌ MISSING" : "✓ Set");
    
    // 2. Check MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT
    const MIN_MARKET_TOKENS = ethers.utils.id("MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT");
    const minTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [MIN_MARKET_TOKENS, MARKET])
    );
    const minTokens = await dataStore.getUint(minTokensKey);
    console.log("\n2. MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT:", minTokens.toString());
    console.log("   Status:", minTokens.eq(0) ? "✓ Not required" : "⚠️ Set - first deposit needs special handling");
    
    // 3. Check if this is the first deposit
    const market = await ethers.getContractAt("MarketToken", MARKET);
    let totalSupply = ethers.BigNumber.from(0);
    try {
        totalSupply = await market.totalSupply();
    } catch (e) {
        console.log("\n3. Market Token Supply: Cannot read (not an ERC20)");
    }
    console.log("\n3. Market Token Supply:", totalSupply.toString());
    console.log("   Status:", totalSupply.eq(0) ? "⚠️ First deposit" : "✓ Has liquidity");
    
    // 4. Check HOLDING_ADDRESS  
    const HOLDING_ADDRESS = ethers.utils.id("HOLDING_ADDRESS");
    const holdingAddress = await dataStore.getAddress(HOLDING_ADDRESS);
    console.log("\n4. HOLDING_ADDRESS:", holdingAddress);
    console.log("   Status:", holdingAddress === ethers.constants.AddressZero ? "⚠️ Not set" : "✓ Set");
    
    console.log("\n=== SUMMARY ===");
    if (feeReceiver === ethers.constants.AddressZero) {
        console.log("❌ CRITICAL: FEE_RECEIVER must be set!");
        console.log("   This is likely causing the Unauthorized(address(0)) error");
    }
}

main().catch(console.error);
