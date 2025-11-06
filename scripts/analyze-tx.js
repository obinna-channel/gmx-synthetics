const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x628d2ec8980a2a88b41a18da25eb58f211a0acf4a56516813327b482d44af310";
    
    console.log("=== Analyzing Transaction ===\n");
    console.log("TX Hash:", TX_HASH);
    console.log();

    const tx = await ethers.provider.getTransaction(TX_HASH);
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
    
    console.log("From:", tx.from);
    console.log("To:", tx.to);
    console.log("Block:", tx.blockNumber);
    console.log("Value:", ethers.utils.formatEther(tx.value), "ETH");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    console.log();
    
    console.log("=".repeat(80));
    console.log("\n📋 Transaction Logs:\n");
    
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`Log #${i}:`);
        console.log(`   Address: ${log.address}`);
        console.log(`   Topics: ${log.topics.length}`);
        
        // Try to decode as Transfer event
        const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
        if (log.topics[0] === transferTopic && log.topics.length === 3) {
            const from = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[1])[0];
            const to = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[2])[0];
            const amount = ethers.utils.defaultAbiCoder.decode(["uint256"], log.data)[0];
            
            console.log(`   Type: Transfer`);
            console.log(`   From: ${from}`);
            console.log(`   To: ${to}`);
            console.log(`   Amount: ${amount.toString()}`);
        }
        
        console.log();
    }
    
    console.log("=".repeat(80));
    console.log("\n🔍 Decoding function call...\n");
    
    // Try to decode the input data
    console.log("Input data (first 200 chars):", tx.data.substring(0, 200));
    console.log("Function selector:", tx.data.substring(0, 10));
    
    // Check if it's createOrder
    const createOrderSelector = "0x44023929"; // createOrder(IBaseOrderUtils.CreateOrderParams)
    
    if (tx.data.substring(0, 10) === createOrderSelector) {
        console.log("\n✅ This is a createOrder call!");
        
        const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
        const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
        
        try {
            const decoded = exchangeRouter.interface.parseTransaction({ data: tx.data });
            console.log("\nDecoded parameters:");
            console.log(JSON.stringify(decoded.args, null, 2));
        } catch (e) {
            console.log("Could not decode:", e.message);
        }
    }
}

main().catch(console.error);
