const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x89ece4181f30cdd75d154287e58c3d57579871defeab707e52191d3d03503b18";

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
                } else {
                    console.log("   ⚠️  Custom error - attempting raw decode");

                    // Try to decode as LiquidatablePosition error
                    try {
                        const params = ethers.utils.defaultAbiCoder.decode(
                            ['bytes32', 'uint256', 'uint256', 'uint256'],
                            '0x' + error.data.slice(10)
                        );
                        console.log("\n📊 Decoded as LiquidatablePosition:");
                        console.log("   Position Key:", params[0]);
                        console.log("   Remaining Collateral USD:", ethers.utils.formatUnits(params[1], 30));
                        console.log("   Min Collateral USD:", ethers.utils.formatUnits(params[2], 30));
                        console.log("   Min Collateral for Leverage:", ethers.utils.formatUnits(params[3], 30));
                    } catch (e) {
                        console.log("   Could not decode as LiquidatablePosition");
                    }
                }
            } catch (decodeError) {
                console.log("   ⚠️  Could not decode error data");
            }
        }
    }

    console.log("\n" + "=".repeat(80));
}

main().catch(console.error);
