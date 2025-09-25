const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x87518a50e5f4d56bed8f2d099e59875e414a877d83a29f620324494530d3c93a";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("Transaction receipt for market creation:");
    console.log("  Events found:", receipt.logs.length);
    
    // Look for MarketCreated event (topic hash)
    const marketCreatedTopic = ethers.utils.id("MarketCreated(address,bytes32,address,address,address)");
    
    for (const log of receipt.logs) {
        if (log.topics[0] === marketCreatedTopic) {
            // The first indexed parameter (marketToken) is in topics[1]
            const marketAddress = "0x" + log.topics[1].slice(-40);
            console.log("\n🎯 MARKET ADDRESS:", marketAddress);
            console.log("\nThis is your new USDTNGN market!");
            break;
        }
    }
}

main().catch(console.error);
