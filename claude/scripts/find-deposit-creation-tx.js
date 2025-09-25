const { ethers } = require("hardhat");

async function main() {
    console.log("=== Finding Deposit Creation Transaction ===\n");
    
    const depositKey = "0x6910a8c71248cf1df8109c450ad50fc8cef19b592e74ae744f13acdfc900ccd5";
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    console.log("Looking for deposit key:", depositKey);
    console.log("\nSearching for DepositCreated events...\n");
    
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    // Get recent blocks
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 1000; // Look back 1000 blocks
    
    // Look for logs with the deposit key as a topic
    const filter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            null, // any event signature
            null, // any first topic
            depositKey // deposit key as second or third topic
        ]
    };
    
    try {
        const logs = await ethers.provider.getLogs(filter);
        
        if (logs.length > 0) {
            console.log("Found", logs.length, "events with this deposit key\n");
            
            for (const log of logs) {
                const tx = await ethers.provider.getTransaction(log.transactionHash);
                const receipt = await ethers.provider.getTransactionReceipt(log.transactionHash);
                const block = await ethers.provider.getBlock(log.blockNumber);
                
                console.log("Transaction:", log.transactionHash);
                console.log("  Block:", log.blockNumber);
                console.log("  Time:", new Date(block.timestamp * 1000).toISOString());
                console.log("  From:", tx.from);
                console.log("  To:", tx.to);
                console.log("  Value (ETH):", ethers.utils.formatEther(tx.value));
                console.log("  Status:", receipt.status ? "Success" : "Failed");
                
                // Check if this is a createDeposit transaction
                if (tx.to === EXCHANGE_ROUTER) {
                    console.log("  \n✅ This is a deposit creation via ExchangeRouter!");
                    
                    // Try to decode the input
                    if (tx.data.startsWith("0xac9650d8")) { // multicall
                        console.log("  Method: multicall");
                    } else if (tx.data.startsWith("0x3b5fa14f")) { // createDeposit
                        console.log("  Method: createDeposit");
                    }
                    
                    // Check if WETH was sent
                    if (tx.value && tx.value.gt(0)) {
                        console.log("  \n💰 WETH SENT WITH TRANSACTION:", ethers.utils.formatEther(tx.value), "ETH");
                    }
                }
                console.log("\n" + "=".repeat(50) + "\n");
            }
            
            // Also check for any sendWnt calls in the same block range
            console.log("Checking for sendWnt transactions...\n");
            const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
            const sendWntFilter = exchangeRouter.filters.Transfer();
            
        } else {
            console.log("❌ No events found with this deposit key");
            console.log("The deposit might have been created earlier than", fromBlock);
        }
        
    } catch (error) {
        console.log("Error searching logs:", error.message);
    }
}

main().catch(console.error);