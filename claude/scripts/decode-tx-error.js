const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xa6ace9886287072458abbdc5f4384474f5e0df7289ee187f4a5479d077c74dde";

    console.log("Analyzing failed transaction:", txHash);

    const provider = new ethers.providers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");

    // Get transaction
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("\nTransaction details:");
    console.log("  To:", tx.to);
    console.log("  Status:", receipt.status);
    console.log("  Gas Used:", receipt.gasUsed.toString());

    // Try to simulate the transaction to get error
    try {
        const result = await provider.call(tx, tx.blockNumber - 1);
        console.log("Simulation result:", result);
    } catch (error) {
        console.log("\nSimulation error:", error.message);

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("Error data:", errorData);

            // Try to decode common errors
            const errorInterface = new ethers.utils.Interface([
                "error EmptyDepositAmounts()",
                "error Unauthorized(address,string)",
                "error EmptyMarket(address)",
                "error DisabledMarket(address)",
                "error InvalidReceiverForFirstDeposit(address,address)"
            ]);

            try {
                const decoded = errorInterface.parseError(errorData);
                console.log("\n✅ Decoded error:", decoded.name);
                if (decoded.args && decoded.args.length > 0) {
                    console.log("   Args:", decoded.args.toString());
                }
            } catch (e) {
                console.log("Could not decode as known error");
            }
        }
    }
}

main().catch(console.error);