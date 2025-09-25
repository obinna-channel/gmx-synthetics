const { ethers } = require("hardhat");

async function main() {
    console.log("=== Analyzing Deposit Execution Transaction ===\n");
    
    const txHash = "0x90678882efe64512122b0571d10561f698d058fa6f242ff2d0db1062080f9456";
    console.log("Transaction:", txHash);
    console.log("View on Arbiscan: https://sepolia.arbiscan.io/tx/" + txHash);
    
    const provider = ethers.provider;
    
    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log("\nTransaction details:");
    console.log("  From:", tx.from);
    console.log("  To:", tx.to, "(DepositHandler)");
    console.log("  Status:", receipt.status === 1 ? "Success (1)" : "Failed (0)");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());
    
    // Parse events
    console.log("\n📋 Events emitted (", receipt.logs.length, "total ):");
    
    // Known event signatures
    const eventSignatures = {
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer",
        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": "Approval",
        "0x69326d429c7cfff04c8e7c0f9c960bb52ff088fa19b42bc87eac959f95e59f40": "DepositCreated",
        "0x7b8ad5b41628c239370e63f8658ac405e9bebe9b8fb814dcaf6fb647e05c867f": "DepositExecuted",
        "0x4e186bc75a2220191b826baff3ee63c3e970e94e8a3b0dd3b862e0e6d44d4018": "DepositCancelled",
        "0xb0cc92e56ba2e4a064c0ee23fb0ea7c78e8b4cbf09faf79a4a3e11e3bb019e5f": "OraclePriceUpdate"
    };
    
    let hasDepositCancelled = false;
    let hasDepositExecuted = false;
    let transferEvents = [];
    
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        const eventSig = log.topics[0];
        const eventName = eventSignatures[eventSig] || "Unknown";
        
        console.log(`\n  Event ${i + 1}: ${eventName}`);
        console.log("    Address:", log.address);
        
        if (eventName === "Transfer") {
            // Decode Transfer event
            try {
                const iface = new ethers.utils.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
                const decoded = iface.parseLog(log);
                console.log("    From:", decoded.args.from);
                console.log("    To:", decoded.args.to);
                console.log("    Value:", ethers.utils.formatUnits(decoded.args.value, 6), "(assuming 6 decimals)");
                
                transferEvents.push({
                    from: decoded.args.from,
                    to: decoded.args.to,
                    value: decoded.args.value
                });
            } catch (e) {
                console.log("    Could not decode transfer details");
            }
        } else if (eventName === "DepositCancelled") {
            hasDepositCancelled = true;
            console.log("    ⚠️ DEPOSIT WAS CANCELLED!");
        } else if (eventName === "DepositExecuted") {
            hasDepositExecuted = true;
            console.log("    ✅ DEPOSIT WAS EXECUTED!");
        }
    }
    
    // Analyze transfers
    console.log("\n💰 Transfer Analysis:");
    const DEPOSIT_VAULT = "0x77Dc2ceeaA0155DAEA6a6f0A131CDF587b96514D";
    const USER = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    for (const transfer of transferEvents) {
        if (transfer.from.toLowerCase() === DEPOSIT_VAULT.toLowerCase() && 
            transfer.to.toLowerCase() === USER.toLowerCase()) {
            console.log("  ❌ REFUND: DepositVault -> User");
            console.log("    Amount:", ethers.utils.formatUnits(transfer.value, 6));
        }
    }
    
    console.log("\n📊 Summary:");
    if (hasDepositCancelled && !hasDepositExecuted) {
        console.log("  ❌ The deposit was CANCELLED, not executed");
        console.log("  Tokens were refunded to the user");
        console.log("  This usually happens when:");
        console.log("    1. Oracle validation failed");
        console.log("    2. Market validation failed");
        console.log("    3. Pool value calculations failed");
        console.log("    4. Min market tokens requirement not met");
    } else if (hasDepositExecuted) {
        console.log("  ✅ The deposit was successfully executed");
    } else {
        console.log("  ⚠️ Unclear outcome - check events above");
    }
    
    // Check current deposit status
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0x6910a8c71248cf1df8109c450ad50fc8cef19b592e74ae744f13acdfc900ccd5";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const stillExists = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    
    console.log("\n🔍 Deposit status:");
    console.log("  Still in DEPOSIT_LIST:", stillExists ? "YES ❌" : "NO ✅");
    if (!stillExists) {
        console.log("  The deposit has been removed (either executed or cancelled)");
    }
}

main().catch(console.error);