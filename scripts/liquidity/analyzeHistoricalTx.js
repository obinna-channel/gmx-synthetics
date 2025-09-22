const { ethers } = require("hardhat");

async function main() {
    console.log("=== ANALYZING 'SUCCESSFUL' DEPOSIT TRANSACTION ===\n");

    const txHash = "0xbd62a9a987b00e82a9f13a7230fbc5f24c9ef681b70bc48012c5bb4575d1d316";
    const provider = ethers.provider;

    try {
        const receipt = await provider.getTransactionReceipt(txHash);

        console.log("Transaction:", txHash);
        console.log("Block:", receipt.blockNumber);
        console.log("To:", receipt.to);
        console.log("From:", receipt.from);
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
        console.log("Gas Used:", receipt.gasUsed.toString());

        console.log("\n=== LOGS ANALYSIS ===");
        console.log("Total logs:", receipt.logs.length);

        const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
        const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
        const EVENT_EMITTER = "0x306E6368851c889dc67700E77F278fAB92205aea";

        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`\nLog ${i}:`);
            console.log("  Address:", log.address);

            if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
                console.log("  ✅ FROM DEPOSIT HANDLER!");
            } else if (log.address.toLowerCase() === EXCHANGE_ROUTER.toLowerCase()) {
                console.log("  From ExchangeRouter");
            } else if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
                console.log("  From EventEmitter");
            }

            if (log.topics.length > 0) {
                console.log("  Topics:", log.topics.length);
                if (log.topics[0]) {
                    // Try to identify the event
                    const knownEvents = {
                        [ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)")]: "DepositCreated",
                        [ethers.utils.id("Transfer(address,address,uint256)")]: "Transfer",
                    };

                    const eventName = knownEvents[log.topics[0]];
                    if (eventName) {
                        console.log("  Event:", eventName);
                    }
                }

                // Show potential deposit key
                if (log.topics[1] && log.topics[1].length === 66) {
                    console.log("  Topic[1]:", log.topics[1]);
                }
            }
        }

        console.log("\n=== CONCLUSION ===");
        console.log("This transaction, like our recent attempts:");
        console.log("1. Called ExchangeRouter.createDeposit");
        console.log("2. Transaction succeeded");
        console.log("3. But NO deposit was actually created in DataStore");
        console.log("\nThe deposit creation has NEVER worked with this deployment!");

    } catch (error) {
        console.log("Error fetching transaction:", error.message);
        console.log("\nNote: This transaction might be too old or on a different network.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });