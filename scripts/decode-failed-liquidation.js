const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x566c96e075cab3849a0ddeaacf8774a5a46e66f5a289e7abf847af35a157cb7c";

    console.log("=== Decoding Failed Liquidation Transaction ===\n");
    console.log("TX Hash:", TX_HASH);
    console.log();

    const provider = ethers.provider;

    // Get the transaction
    console.log("📋 Fetching transaction...");
    const tx = await provider.getTransaction(TX_HASH);

    if (!tx) {
        console.log("❌ Transaction not found!");
        return;
    }

    console.log("   From:", tx.from);
    console.log("   To:", tx.to);
    console.log("   Gas Limit:", tx.gasLimit.toString());
    console.log("   Gas Price:", ethers.utils.formatUnits(tx.gasPrice, "gwei"), "gwei");
    console.log();

    // Get the transaction receipt
    console.log("📋 Fetching transaction receipt...");
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("❌ Receipt not found!");
        return;
    }

    console.log("   Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("   Gas Used:", receipt.gasUsed.toString());
    console.log("   Block:", receipt.blockNumber);
    console.log();

    if (receipt.status === 1) {
        console.log("✅ Transaction succeeded - no error to decode");
        return;
    }

    // Transaction failed - try to get revert reason
    console.log("🔍 Transaction failed - attempting to decode revert reason...\n");

    // Method 1: Try to replay the transaction
    try {
        console.log("Method 1: Replaying transaction call...");
        await provider.call(tx, receipt.blockNumber - 1);
        console.log("   ⚠️  Call succeeded when replayed (no revert reason found)");
    } catch (error) {
        console.log("   ✅ Caught revert:");

        if (error.reason) {
            console.log("\n📝 Revert Reason:", error.reason);
        }

        if (error.code) {
            console.log("📝 Error Code:", error.code);
        }

        if (error.message) {
            console.log("\n📝 Error Message:");
            console.log(error.message);
        }

        if (error.data) {
            console.log("\n📝 Error Data:", error.data);

            // Try to decode error data
            try {
                // Common error selectors
                const errorSelectors = {
                    '0x08c379a0': 'Error(string)',  // Standard revert
                    '0x4e487b71': 'Panic(uint256)', // Panic codes
                };

                const selector = error.data.slice(0, 10);
                console.log("   Error Selector:", selector);

                if (selector === '0x08c379a0') {
                    // Decode Error(string)
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ['string'],
                        '0x' + error.data.slice(10)
                    );
                    console.log("\n❌ Decoded Error String:", decoded[0]);
                } else if (selector === '0x4e487b71') {
                    // Decode Panic(uint256)
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ['uint256'],
                        '0x' + error.data.slice(10)
                    );
                    console.log("\n❌ Panic Code:", decoded[0].toString());

                    // Common panic codes
                    const panicCodes = {
                        '0': 'Generic panic',
                        '1': 'Assert failed',
                        '17': 'Arithmetic overflow/underflow',
                        '18': 'Division by zero',
                        '33': 'Invalid enum value',
                        '34': 'Invalid storage encoding',
                        '49': 'Empty array pop',
                        '50': 'Array out of bounds',
                        '65': 'Out of memory',
                        '81': 'Invalid internal function'
                    };

                    if (panicCodes[decoded[0].toString()]) {
                        console.log("   Meaning:", panicCodes[decoded[0].toString()]);
                    }
                } else {
                    console.log("   ⚠️  Custom error - may need contract ABI to decode");
                }
            } catch (decodeError) {
                console.log("   ⚠️  Could not decode error data");
            }
        }
    }

    // Method 2: Check for events that might indicate the error
    console.log("\n🔍 Checking transaction logs for error events...\n");

    if (receipt.logs && receipt.logs.length > 0) {
        console.log(`Found ${receipt.logs.length} log(s):`);
        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`\nLog ${i + 1}:`);
            console.log("   Address:", log.address);
            console.log("   Topics:", log.topics);
            console.log("   Data:", log.data);
        }
    } else {
        console.log("   No logs found (transaction reverted before emitting events)");
    }

    console.log("\n" + "=".repeat(80));
}

main().catch(console.error);
