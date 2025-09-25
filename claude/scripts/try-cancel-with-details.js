const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Attempting to Cancel Corrupted Deposit ===\n");

    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";

    console.log("Deposit Key:", depositKey);
    console.log("Signer:", signer.address);

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    try {
        console.log("\n📍 Attempting to cancel deposit...");

        // Try with manual gas limit to force the transaction
        const tx = await depositHandler.cancelDeposit(depositKey, {
            gasLimit: 1000000
        });

        console.log("  Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("\n✅ Deposit cancelled!");

    } catch (error) {
        console.log("\n❌ Cancellation failed!");
        console.log("Error message:", error.message);

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("\nError data:", errorData);

            // Try to decode the error
            const errorSig = errorData.slice(0, 10);
            console.log("Error signature:", errorSig);

            // Known error signatures
            const errors = {
                "0x979dc780": "InsufficientFeeTokenAmount",
                "0xa35b150b": "Unauthorized",
                "0x646cf558": "EmptyDeposit",
                "0x97d6f5bf": "RequestNotYetCancellable",
                "0xf4844814": "Unauthorized",
                "0x030cfbfd": "TransferFailed"
            };

            if (errors[errorSig]) {
                console.log("Decoded error:", errors[errorSig]);
            }

            // If it's InsufficientFeeTokenAmount, decode the parameters
            if (errorSig === "0x979dc780") {
                try {
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ["address", "address", "uint256"],
                        "0x" + errorData.slice(10)
                    );
                    console.log("\nInsufficientFeeTokenAmount details:");
                    console.log("  Token:", decoded[0]);
                    console.log("  Account:", decoded[1]);
                    console.log("  Amount needed:", decoded[2].toString());

                    if (decoded[0] === "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6") {
                        console.log("  Token is USDT");
                        console.log("  Amount needed:", ethers.utils.formatUnits(decoded[2], 6), "USDT");
                    }
                } catch (e) {
                    console.log("Could not decode parameters");
                }
            }
        }

        // Also check reason if available
        if (error.reason) {
            console.log("\nError reason:", error.reason);
        }
    }
}

main().catch(console.error);