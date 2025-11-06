const { ethers } = require("hardhat");

async function main() {
    console.log("=== Analyzing Why This Specific Order Failed ===\n");
    
    const account = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const collateralToken = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    
    console.log("Order Details from Logs:");
    console.log("- Type: MarketDecrease (short position close)");
    console.log("- Account:", account);
    console.log("- Collateral Token:", collateralToken);
    console.log("- Collateral Amount: 99378907 (raw)");
    console.log("- Size Delta USD: 2484.38");
    console.log("- Is Long: False (SHORT position)");
    
    console.log("\n=== Potential Reasons for Transfer Failure ===\n");
    
    // Check if account is a contract
    const code = await ethers.provider.getCode(account);
    const isContract = code !== "0x";
    
    console.log("1. Receiver Type Check:");
    console.log("   Account:", account);
    console.log("   Is Contract:", isContract);
    
    if (isContract) {
        console.log("   ⚠️  POTENTIAL ISSUE: Contract receivers can fail transfers!");
    } else {
        console.log("   ✓ EOA - should normally accept transfers");
    }
    
    // Get token transfer gas limit
    const dataStoreAddr = "0xd4e917e95bfbcdb12a50e842c4fe80ba81fd1e89";
    const dataStore = await ethers.getContractAt("DataStore", dataStoreAddr);
    
    const tokenTransferGasLimitKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TOKEN_TRANSFER_GAS_LIMIT")), collateralToken]
        )
    );
    
    console.log("\n2. Gas Limit Configuration:");
    try {
        const gasLimit = await dataStore.getUint(tokenTransferGasLimitKey);
        console.log("   Token Transfer Gas Limit:", gasLimit.toString());
        
        if (gasLimit.eq(0)) {
            console.log("   ❌ PROBLEM: Gas limit is 0! This causes EmptyTokenTransferGasLimit error");
        } else if (gasLimit.lt(50000)) {
            console.log("   ⚠️  POTENTIAL ISSUE: Gas limit might be too low");
        } else {
            console.log("   ✓ Gas limit seems reasonable");
        }
    } catch (e) {
        console.log("   Error reading gas limit:", e.message);
    }
    
    console.log("\n3. Token Characteristics:");
    try {
        const token = await ethers.getContractAt("IERC20", collateralToken);
        const name = await token.name();
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        
        console.log("   Name:", name);
        console.log("   Symbol:", symbol);
        console.log("   Decimals:", decimals);
        
        // Check if it's a special token with hooks
        const tokenCode = await ethers.provider.getCode(collateralToken);
        console.log("   Code size:", tokenCode.length, "bytes");
        
        if (tokenCode.length > 10000) {
            console.log("   ⚠️  Large contract - might have transfer hooks/callbacks");
        }
    } catch (e) {
        console.log("   Error reading token:", e.message);
    }
    
    console.log("\n=== Most Likely Causes ===");
    console.log("\nBased on the code flow:");
    console.log("Bank.transferOut() → TokenUtils.transfer() → nonRevertingTransferWithGasLimit()");
    console.log("\nThe transfer failed at the FIRST attempt (to receiver),");
    console.log("then tried the holding address fallback, which wasn't configured.");
    console.log("\nPossible causes:");
    console.log("1. Token transfer gas limit too low for this token");
    console.log("2. Token has transfer restrictions/hooks that failed");
    console.log("3. Receiver has some issue accepting tokens");
    console.log("4. Out of gas during the transfer call");
}

main().catch(console.error);
