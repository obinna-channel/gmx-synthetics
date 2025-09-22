const { ethers } = require("hardhat");

async function main() {
    console.log("=== Understanding Deposit Split Mechanism ===\n");
    
    // The successful create deposit transaction
    const txHash = "0x7a051a51b11c82a7c1329639420c0dedb5ef48db42a2f959e1a27ccdfab2147a";
    
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("Transaction that successfully created deposit:");
    console.log("  To:", tx.to);
    console.log("  Value:", tx.value.toString());
    
    // Decode the transaction data
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const router = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    
    try {
        const decoded = router.interface.parseTransaction({ data: tx.data });
        console.log("\nMethod called:", decoded.name);
        console.log("Parameters:", decoded.args);
        
        // The params should show us the structure
        const params = decoded.args[0];
        console.log("\nDeposit Parameters:");
        console.log("  Receiver:", params.addresses.receiver);
        console.log("  Market:", params.addresses.market);
        console.log("  Initial Long Token:", params.addresses.initialLongToken);
        console.log("  Initial Short Token:", params.addresses.initialShortToken);
        
        // The key insight: createDeposit doesn't specify amounts!
        // It uses whatever is in the DepositVault
        console.log("\n💡 KEY INSIGHT:");
        console.log("  createDeposit doesn't specify amounts in the params!");
        console.log("  It reads the total from DepositVault");
        console.log("  For single-token deposits (USDT/USDT), it seems to use all for long side");
    } catch (e) {
        console.log("Error decoding:", e.message);
    }
}

main().catch(console.error);
