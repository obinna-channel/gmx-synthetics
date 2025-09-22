const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x87518a50e5f4d56bed8f2d099e59875e414a877d83a29f620324494530d3c93a";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("Raw log data:");
    const log = receipt.logs[0];
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics);
    console.log("  Data:", log.data);
    
    // Decode manually - the market address should be in the data
    if (log.data && log.data.length >= 66) {
        // First 32 bytes (64 hex chars + 0x prefix) should be the market address
        const marketAddress = "0x" + log.data.slice(26, 66);
        console.log("\n🎯 DECODED MARKET ADDRESS:", marketAddress);
        
        // Verify it's a valid address
        const code = await ethers.provider.getCode(marketAddress);
        if (code !== "0x") {
            console.log("✅ Contract exists at this address!");
            console.log("\nUse this address for your deposits:", marketAddress);
        }
    }
}

main().catch(console.error);
