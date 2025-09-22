const { ethers } = require("hardhat");

async function main() {
    console.log("=== Testing if minting to address(1) is the issue ===\n");
    
    // Let's check if there's any special validation for address(1)
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    
    // Check current supply
    const supply = await marketToken.totalSupply();
    console.log("Current market token supply:", ethers.utils.formatEther(supply));
    
    // The issue might be in the ERC20 base contract
    // Standard OpenZeppelin ERC20 prevents minting to address(0) but allows address(1)
    
    console.log("\n💡 INSIGHT:");
    console.log("  Minting to address(1) should work in standard ERC20");
    console.log("  But the error 0x95b66fe9 might be from:");
    console.log("  1. A custom validation in your MarketToken");
    console.log("  2. A callback or hook during minting");
    console.log("  3. An issue with the pool value calculation");
    
    console.log("\n🔍 CHECKING ERROR SIGNATURE:");
    // Let's decode what 0x95b66fe9 might be
    const errorSig = "0x95b66fe9";
    console.log("  Error signature:", errorSig);
    
    // Try to match common error patterns
    const possibleErrors = [
        "MintToZeroAddress()",
        "InvalidReceiver()",
        "TransferToZeroAddress()",
        "InvalidMintAmount()",
        "MintToAddressOne()"
    ];
    
    for (const err of possibleErrors) {
        const hash = ethers.utils.id(err).slice(0, 10);
        if (hash === errorSig) {
            console.log("  ✅ FOUND MATCH:", err);
        }
    }
    
    console.log("\n📝 RECOMMENDATION:");
    console.log("  Try creating a deposit with receiver = your address instead of address(1)");
    console.log("  This would bypass any address(1) related issues");
}

main().catch(console.error);
