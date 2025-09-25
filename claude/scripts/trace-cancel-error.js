const { ethers } = require("hardhat");

async function main() {
    console.log("=== Tracing Cancel Error ===\n");

    const txHash = "0xb42b29a0fc84aff6216f04c193e47bfc3296c33968afc660f3dc501b04c4ece7";

    // Get the transaction
    const tx = await ethers.provider.getTransaction(txHash);
    console.log("Failed transaction:", txHash);

    // Try to simulate it at the block before to get error
    try {
        const result = await ethers.provider.call({
            to: tx.to,
            from: tx.from,
            data: tx.data,
            value: tx.value
        }, tx.blockNumber - 1);

        console.log("Simulation succeeded (unexpected)");
    } catch (error) {
        console.log("Simulation failed with error:");

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("\nError data:", errorData);

            const errorSig = errorData.slice(0, 10);
            console.log("Error signature:", errorSig);

            // Known error signatures
            const errors = {
                "0x97d6f5bf": "RequestNotYetCancellable",
                "0xa35b150b": "Unauthorized",
                "0x646cf558": "EmptyDeposit",
                "0x979dc780": "InsufficientFeeTokenAmount",
                "0xf4844814": "Unauthorized"
            };

            if (errors[errorSig]) {
                console.log("Error type:", errors[errorSig]);
            }

            // If it's RequestNotYetCancellable, decode the time values
            if (errorSig === "0x97d6f5bf") {
                try {
                    const params = "0x" + errorData.slice(10);
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ["uint256", "uint256", "uint256"],
                        params
                    );

                    console.log("\nRequestNotYetCancellable details:");
                    console.log("  Current block timestamp:", decoded[0].toString());
                    console.log("  Request timestamp:", decoded[1].toString());
                    console.log("  Time delay:", decoded[2].toString());

                    const timeLeft = decoded[1].add(decoded[2]).sub(decoded[0]);
                    console.log("  Time until cancellable:", timeLeft.toString(), "seconds");
                } catch (e) {
                    console.log("Could not decode time values");
                }
            }
        }
    }
}

main().catch(console.error);