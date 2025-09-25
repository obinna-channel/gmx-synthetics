const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Execution Result ===\n");
    
    const txHash = "0x1bc1988db9d4b9309a4b7b6381d59715b6c190f7efa99afa3d717e4d23674e98";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xbb7aa6074f7af48a394d7267a6630640d3f332027231b0fd89bdca8612cbe3e1";
    
    console.log("Transaction:", txHash);
    console.log("View on Arbiscan: https://sepolia.arbiscan.io/tx/" + txHash);
    
    // Get transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("\n📦 Transaction Status:");
    console.log("  Success:", receipt.status === 1 ? "YES ✅" : "NO ❌");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas Used:", receipt.gasUsed.toString());
    
    // Check for refund transfers
    console.log("\n💰 Checking for refunds...");
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const USER = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    let hasRefund = false;
    for (const log of receipt.logs) {
        // Check for Transfer events
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
            try {
                const iface = new ethers.utils.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
                const decoded = iface.parseLog(log);
                
                if (decoded.args.to.toLowerCase() === USER.toLowerCase() && 
                    log.address.toLowerCase() === USDT.toLowerCase()) {
                    console.log("  ❌ REFUND DETECTED: USDT returned to user");
                    console.log("    Amount:", ethers.utils.formatUnits(decoded.args.value, 6));
                    hasRefund = true;
                }
            } catch {}
        }
    }
    
    if (hasRefund) {
        console.log("\n  ⚠️  Deposit was CANCELLED and tokens refunded!");
    }
    
    // Check if deposit still exists
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const stillExists = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    
    console.log("\n🔍 Deposit Status:");
    console.log("  Still in DEPOSIT_LIST:", stillExists ? "YES ❌ (not executed)" : "NO ✅ (processed)");
    
    // Check market token supply
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    const totalSupply = await marketToken.totalSupply();
    const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");
    
    console.log("\n🎯 Market Token Status:");
    console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
    console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));
    
    if (totalSupply.eq(0)) {
        console.log("  ❌ NO MARKET TOKENS MINTED - Deposit was cancelled!");
    } else {
        console.log("  ✅ Market tokens exist!");
    }
    
    // Check pool amounts
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    const usdtPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );
    
    const usdtPoolAmount = await dataStore.getUint(usdtPoolKey);
    
    console.log("\n📊 Pool Amounts:");
    console.log("  USDT in pool:", ethers.utils.formatUnits(usdtPoolAmount, 6));
    
    if (usdtPoolAmount.eq(0)) {
        console.log("  ❌ Pool is empty - no liquidity added!");
    }
    
    console.log("\n📝 Summary:");
    if (hasRefund && totalSupply.eq(0) && usdtPoolAmount.eq(0)) {
        console.log("❌ Deposit was CANCELLED during execution");
        console.log("Likely reasons:");
        console.log("1. MinMarketTokens check failed (deposit too small)");
        console.log("2. Pool value calculation returned 0");
        console.log("3. Single-sided deposit (no sNGN) might be causing issues");
    } else if (totalSupply.gt(0)) {
        console.log("✅ Deposit was SUCCESSFUL!");
    } else {
        console.log("⚠️  Unclear status - check transaction logs");
    }
}

main().catch(console.error);