const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x0361f548db4dbc8f1c775ac2fc01f6df412bacdb580f4418d8eff642373047b2";
    
    const provider = ethers.provider;
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log("Transaction:", txHash);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Block:", receipt.blockNumber);
    
    // Try to get revert reason
    try {
        await provider.call(tx, receipt.blockNumber - 1);
    } catch (error) {
        console.log("\nRevert Reason:");
        console.log(error.message);
        
        // Try to decode the error
        if (error.data) {
            console.log("\nError Data:", error.data);
        }
    }
}

main().catch(console.error);
