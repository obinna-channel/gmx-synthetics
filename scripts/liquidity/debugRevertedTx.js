const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING REVERTED TRANSACTION ===\n");

    const txHash = "0x1733e44bbd1fec5562b49e045c883939099948a8a10f806d45773399c28009b9";
    const provider = ethers.provider;

    try {
        // Try to get the revert reason
        const tx = await provider.getTransaction(txHash);
        console.log("Transaction to:", tx.to);
        console.log("From:", tx.from);

        // Try to simulate the call to get the revert reason
        try {
            await provider.call(tx, tx.blockNumber);
        } catch (error) {
            console.log("\nRevert reason:", error.message);
            if (error.data) {
                console.log("Error data:", error.data);

                // Try to decode common error signatures
                const errorSigs = {
                    "0x8e4a23d6": "Unauthorized",
                    "0x01af8c24": "Empty deposit (no tokens detected)",
                    "0xf9996e9f": "InvalidPoolValueForDeposit",
                    "0x4e487b71": "Panic",
                };

                const sig = error.data.slice(0, 10);
                if (errorSigs[sig]) {
                    console.log("Error type:", errorSigs[sig]);
                }
            }
        }

        // Check gas usage
        const receipt = await provider.getTransactionReceipt(txHash);
        console.log("\nGas used:", receipt.gasUsed.toString());
        console.log("Status:", receipt.status);

        // Check if it ran out of gas
        if (receipt.gasUsed.eq(tx.gasLimit)) {
            console.log("⚠️ Transaction ran out of gas!");
        }

    } catch (error) {
        console.log("Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });