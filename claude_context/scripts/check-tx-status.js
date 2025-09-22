const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x87518a50e5f4d56bed8f2d099e59875e414a877d83a29f620324494530d3c93a";
    
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("Transaction details:");
    console.log("  Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    console.log("  From:", tx.from);
    console.log("  To:", tx.to);
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Logs:", receipt.logs.length);
    
    if (receipt.logs.length > 0) {
        console.log("\nDecoding logs...");
        const marketFactory = await ethers.getContractAt("MarketFactory", tx.to);
        
        try {
            const parsedLogs = receipt.logs.map(log => {
                try {
                    return marketFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
            
            for (const log of parsedLogs) {
                console.log("\nEvent:", log.name);
                console.log("Args:", log.args);
            }
        } catch (e) {
            console.log("Could not parse logs:", e.message);
        }
    }
}

main().catch(console.error);
