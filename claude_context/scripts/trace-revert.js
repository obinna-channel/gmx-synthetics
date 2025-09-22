const { ethers } = require("hardhat");

async function main() {
    console.log("=== TRACING EXACT REVERT REASON ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";

    const [signer] = await ethers.getSigners();

    // Get the failed transaction data from our last attempt
    const failedTxHash = "0x02f4add2dd13f88f564b10886b61a9e71a7fea046eb481007f48fea89e98a1e9";

    console.log("Analyzing failed transaction:", failedTxHash);

    try {
        const provider = ethers.provider;
        const tx = await provider.getTransaction(failedTxHash);

        console.log("Transaction details:");
        console.log("- To:", tx.to);
        console.log("- Value:", ethers.utils.formatEther(tx.value), "ETH");
        console.log("- Data length:", tx.data.length);

        // Try to replay the transaction as a call to get the error
        console.log("\nReplaying transaction as eth_call to get error...");

        try {
            // Replay the exact transaction
            const result = await provider.call({
                from: tx.from,
                to: tx.to,
                data: tx.data,
                value: tx.value
            }, tx.blockNumber - 1); // Use block before transaction

            console.log("Call succeeded (shouldn't happen):", result);
        } catch (error) {
            console.log("Call failed as expected");

            // Extract error data
            if (error.error && error.error.data) {
                const errorData = error.error.data;
                console.log("\nError data:", errorData);

                // Try to decode against known error selectors
                const errorSelectors = {
                    "0x3a78cd7e": "InsufficientExecutionFee",
                    "0xc4726842": "EmptyDepositAmounts",
                    "0x08c379a0": "Error(string)", // Standard revert
                    "0x4e487b71": "Panic(uint256)",
                    "0x": "Empty revert (no reason)"
                };

                const selector = errorData.slice(0, 10);
                if (errorSelectors[selector]) {
                    console.log("\n✅ Identified error:", errorSelectors[selector]);
                } else {
                    console.log("\n❌ Unknown error selector:", selector);
                }

                // If it's InsufficientExecutionFee, decode the amounts
                if (selector === "0x3a78cd7e") {
                    const iface = new ethers.utils.Interface([
                        "error InsufficientExecutionFee(uint256 provided, uint256 required)"
                    ]);
                    try {
                        const decoded = iface.parseError(errorData);
                        console.log("Provided:", ethers.utils.formatEther(decoded.args[0]), "ETH");
                        console.log("Required:", ethers.utils.formatEther(decoded.args[1]), "ETH");
                    } catch (e) {
                        console.log("Could not decode amounts");
                    }
                }
            }
        }
    } catch (error) {
        console.log("Error:", error.message);
    }

    console.log("\n=== ALTERNATIVE: Check if it's a state issue ===");

    // Check if DepositVault's internal state is the problem
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // The DepositVault might have stale tokenBalances state
    console.log("\nTheory: DepositVault's tokenBalances[USDT] might be wrong");
    console.log("If tokenBalances is higher than actual balance, recordTransferIn returns negative/reverts");

    // We can't read tokenBalances directly (it's internal), but we can infer issues
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const actualBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("Actual USDT in DepositVault:", ethers.utils.formatUnits(actualBalance, 6));

    console.log("\nIf recordTransferIn is reverting, it might be because:");
    console.log("1. tokenBalances[USDT] > actualBalance (underflow)");
    console.log("2. The contract expects fresh transfers in the same transaction");
}

main().catch(console.error);