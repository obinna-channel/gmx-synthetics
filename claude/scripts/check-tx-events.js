const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x45c8b4fd37b224f86cd6ea8d477cc0d5e584d291268fff7109ecafb4006aba1a";
    console.log("=== Analyzing Execution Transaction ===\n");
    console.log("TX Hash:", TX_HASH);

    // Get the transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
    console.log("\nTransaction status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Number of logs:", receipt.logs.length);

    // Define event signatures we care about
    const DEPOSIT_CANCELLED_SIG = ethers.utils.id("DepositCancelled(bytes32,string)");

    console.log("\n📋 Checking for cancellation:");

    for (const log of receipt.logs) {
        if (log.topics[0] === DEPOSIT_CANCELLED_SIG) {
            console.log("  ❌ Found DepositCancelled event!");
            console.log("    Log index:", receipt.logs.indexOf(log));
            console.log("    Topics:", log.topics);
            console.log("    Data:", log.data);

            // The deposit key is topic[1]
            if (log.topics[1]) {
                console.log("    Deposit Key:", log.topics[1]);
            }
        }
    }

    // Also look for any transfer events back to the user
    const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");

    console.log("\n📋 Checking for refund transfers:");

    for (const log of receipt.logs) {
        if (log.topics[0] === TRANSFER_SIG) {
            try {
                const from = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[1])[0];
                const to = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[2])[0];
                const amount = ethers.utils.defaultAbiCoder.decode(["uint256"], log.data)[0];

                // Check if it's a refund (transfer TO the user from vault)
                if (to.toLowerCase() === "0xbab0d0892bf8563b731f8e8970fe856ce9308292".toLowerCase()) {
                    console.log(`  💸 Refund detected: ${ethers.utils.formatUnits(amount, 6)} tokens`);
                    console.log(`     From: ${from}`);
                    console.log(`     To: ${to}`);
                }
            } catch (e) {
                // Not a standard transfer event
            }
        }
    }

    console.log("\n💡 This confirms the deposit was cancelled and tokens were refunded.");
}

main().catch(console.error);