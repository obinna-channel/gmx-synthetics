const { ethers } = require("hardhat");

async function main() {
    console.log("=== Analyzing Transaction Events ===\n");
    
    const txHash = "0x0cbdd71a5f36c8fdfcb82e72cb8bdccc30b917afeb03bbd69a083b8e1f64a00b";
    const provider = ethers.provider;
    
    console.log("Transaction Hash:", txHash);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log("Transaction Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("Gas Used:", receipt.gasUsed.toString());
    
    // Decode logs
    console.log("\n📋 EVENTS:");
    
    // Transfer event signature
    const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
    
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\nEvent ${i + 1}:`);
        console.log("  Contract:", log.address);
        console.log("  Topics:", log.topics.length);
        
        if (log.topics[0] === transferTopic) {
            // This is a Transfer event
            const from = ethers.utils.getAddress("0x" + log.topics[1].slice(26));
            const to = ethers.utils.getAddress("0x" + log.topics[2].slice(26));
            const amount = ethers.BigNumber.from(log.data);
            
            console.log("  Type: Transfer");
            console.log("  From:", from);
            console.log("  To:", to);
            
            // Check if this is USDT
            const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
            const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
            const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
            
            if (log.address.toLowerCase() === USDT.toLowerCase()) {
                console.log("  Token: USDT");
                console.log("  Amount:", ethers.utils.formatUnits(amount, 6), "USDT");
                
                if (from.toLowerCase() === DEPOSIT_VAULT.toLowerCase()) {
                    console.log("  💸 This is a REFUND from DepositVault!");
                    console.log("     The deposit was CANCELLED!");
                }
            } else if (log.address.toLowerCase() === MARKET.toLowerCase()) {
                console.log("  Token: Market Token");
                console.log("  Amount:", ethers.utils.formatEther(amount));
                console.log("  ✅ Market tokens were minted!");
            }
        } else {
            console.log("  Topic[0]:", log.topics[0]);
        }
    }
    
    console.log("\n\n📊 SUMMARY:");
    console.log("The transaction succeeded but the deposit was cancelled internally.");
    console.log("This happens when the deposit execution encounters an error in the try-catch.");
    console.log("The USDT was refunded from DepositVault to your wallet.");
    console.log("\nThe mysterious error 0x95b66fe9 is still occurring during execution.");
}

main().catch(console.error);
