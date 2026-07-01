const { ethers } = require("hardhat");

async function main() {
    const provider = ethers.provider;
    
    // Successful Python keeper tx
    const successTx = await provider.getTransaction("0xcd45a2e899053e77ad99438bc695c4b547f3264b0b6b1398c246c932b2f731ed");
    
    // Our failed tx
    const failedTx = await provider.getTransaction("0xe121d17a11a45fd591abff1a156a1bd6cab60084938f09c03db25afdcd410f2c");
    
    console.log("=== SUCCESSFUL TX (Python Keeper) ===");
    console.log("From:", successTx.from);
    console.log("To:", successTx.to);
    console.log("Data length:", successTx.data.length);
    console.log("Gas limit:", successTx.gasLimit.toString());
    console.log("\nFirst 200 chars of data:");
    console.log(successTx.data.substring(0, 200));
    
    console.log("\n=== FAILED TX (Our Script) ===");
    console.log("From:", failedTx.from);
    console.log("To:", failedTx.to);
    console.log("Data length:", failedTx.data.length);
    console.log("Gas limit:", failedTx.gasLimit.toString());
    console.log("\nFirst 200 chars of data:");
    console.log(failedTx.data.substring(0, 200));
    
    console.log("\n=== COMPARISON ===");
    console.log("Same sender?", successTx.from.toLowerCase() === failedTx.from.toLowerCase());
    console.log("Same contract?", successTx.to.toLowerCase() === failedTx.to.toLowerCase());
    console.log("Same function selector?", successTx.data.substring(0, 10) === failedTx.data.substring(0, 10));
    console.log("Same data length?", successTx.data.length === failedTx.data.length);
    
    if (successTx.data !== failedTx.data) {
        console.log("\n❌ DATA IS DIFFERENT!");
        console.log("\nFull successful tx data:");
        console.log(successTx.data);
        console.log("\nFull failed tx data:");
        console.log(failedTx.data);
    } else {
        console.log("\n✅ Data is identical");
    }
}

main().catch(console.error);
