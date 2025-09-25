const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debugging Failed Create Deposit Transaction ===\n");

    const txHash = "0x02211691686cf250065ce996c1238a861c83aa17199baf6eab3c799b93a01680";
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";

    // Get transaction
    const tx = await ethers.provider.getTransaction(txHash);
    console.log("Transaction hash:", tx.hash);
    console.log("To:", tx.to);
    console.log("From:", tx.from);
    console.log("Value:", ethers.utils.formatEther(tx.value), "ETH");

    // Get receipt
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    console.log("\nStatus:", receipt.status === 0 ? "FAILED ❌" : "SUCCESS");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Block:", receipt.blockNumber);

    // Try to simulate the call to get error
    console.log("\nTrying to simulate call to get error...");

    try {
        // Try calling the transaction at the block before it was mined
        await ethers.provider.call({
            to: tx.to,
            from: tx.from,
            data: tx.data,
            value: tx.value
        }, tx.blockNumber - 1);

        console.log("Simulation succeeded (unexpected)");
    } catch (error) {
        console.log("Error caught:", error.reason || error.message);

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("\nError data:", errorData);

            // Try to decode error selector
            const errorSig = errorData.slice(0, 10);
            console.log("Error signature:", errorSig);

            // Common error signatures
            const knownErrors = {
                "0x08c379a0": "Error(string)", // Standard revert
                "0x4e487b71": "Panic(uint256)", // Panic
                "0xf4844814": "Unauthorized",
                "0x030cfbfd": "TransferFailed",
                "0xe450d38c": "SafeERC20 low-level call failed",
                "0x7939f424": "TransferFromFailed",
                "0xb12d13eb": "ETH transfer failed",
                "0x8d6cc56e": "Reentrancy guard"
            };

            if (knownErrors[errorSig]) {
                console.log("Decoded error type:", knownErrors[errorSig]);

                if (errorSig === "0x08c379a0") {
                    // Try to decode revert string
                    try {
                        const decoded = ethers.utils.defaultAbiCoder.decode(
                            ["string"],
                            "0x" + errorData.slice(10)
                        );
                        console.log("Revert message:", decoded[0]);
                    } catch {}
                }
            }
        }
    }

    // Check if multicall is the issue
    console.log("\n📍 Checking multicall data...");
    const iface = new ethers.utils.Interface([
        "function multicall(bytes[] calldata data) payable returns (bytes[] memory results)"
    ]);

    try {
        const decoded = iface.decodeFunctionData("multicall", tx.data);
        console.log("Number of calls in multicall:", decoded[0].length);
        console.log("1. sendWnt (execution fee)");
        console.log("2. sendTokens (USDT)");
        console.log("3. sendTokens (sNGN)");
        console.log("4. createDeposit");
    } catch (e) {
        console.log("Failed to decode multicall");
    }
}

main().catch(console.error);