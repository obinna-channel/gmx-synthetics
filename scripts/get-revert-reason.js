const hre = require("hardhat");

async function main() {
    const txHash = "0xed0e4b0386162e8859f78026af3a172d267c0bf123e3ebb55323d20f16c10fb3";

    console.log("Fetching transaction details...\n");

    const provider = hre.ethers.provider;
    const tx = await provider.getTransaction(txHash);

    console.log("Transaction found. Attempting to replay to get revert reason...\n");

    try {
        // Try to call the transaction to get the revert reason
        await provider.call(tx, tx.blockNumber);
    } catch (error) {
        console.log("Revert reason:");
        console.log(error.reason || error.message);

        // Try to decode the error data if available
        if (error.data) {
            console.log("\nRaw error data:", error.data);
        }

        if (error.error && error.error.data) {
            console.log("\nError data from RPC:", error.error.data);
        }
    }
}

main().catch(console.error);
