const { ethers } = require("hardhat");

async function main() {
    console.log("=== Tracing Cancel Failure ===\n");

    const txHash = "0xca6145fc7ed4a5a889ba0f5c8c2610a44d007c5e130a56b5b625c41a748bd3d2";

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

        console.log("Simulation result:", result);
    } catch (error) {
        console.log("Simulation failed (expected)");

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("\nError data:", errorData);

            const errorSig = errorData.slice(0, 10);
            console.log("Error signature:", errorSig);

            // Try to decode based on signature
            if (errorSig === "0x979dc780") {
                console.log("Error: InsufficientFeeTokenAmount");

                try {
                    // Decode the parameters: (address token, address account, uint256 amount)
                    const params = "0x" + errorData.slice(10);
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ["address", "address", "uint256"],
                        params
                    );

                    console.log("\nDetails:");
                    console.log("  Token address:", decoded[0]);
                    console.log("  Account address:", decoded[1]);
                    console.log("  Required amount (raw):", decoded[2].toString());

                    // Check which token
                    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
                    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
                    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

                    if (decoded[0].toLowerCase() === USDT.toLowerCase()) {
                        console.log("  Token: USDT");
                        console.log("  Required amount:", ethers.utils.formatUnits(decoded[2], 6), "USDT");
                    } else if (decoded[0].toLowerCase() === sNGN.toLowerCase()) {
                        console.log("  Token: sNGN");
                        console.log("  Required amount:", ethers.utils.formatUnits(decoded[2], 18), "sNGN");
                    } else if (decoded[0].toLowerCase() === WETH.toLowerCase()) {
                        console.log("  Token: WETH");
                        console.log("  Required amount:", ethers.utils.formatEther(decoded[2]), "WETH");
                    }

                    console.log("\n💡 This means:");
                    console.log("The cancellation is trying to refund tokens to account", decoded[1]);
                    console.log("But there aren't enough tokens in the vault to refund");
                    console.log("This is strange since the deposit has all zero values!");

                } catch (decodeError) {
                    console.log("Failed to decode parameters:", decodeError.message);
                }
            } else if (errorSig === "0x646cf558") {
                console.log("Error: EmptyDeposit - deposit doesn't exist or already cancelled");
            } else if (errorSig === "0xa35b150b") {
                console.log("Error: Unauthorized - only keeper can cancel");
            } else {
                console.log("Unknown error signature");
            }
        }
    }
}

main().catch(console.error);