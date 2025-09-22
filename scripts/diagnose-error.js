const { ethers } = require("hardhat");

async function main() {
    console.log("=== Diagnosing Error 0x95b66fe9 ===\n");
    
    const [signer] = await ethers.getSigners();
    
    // 1. Check if this error comes from USDT token
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    console.log("1. Checking USDT token contract:");
    const usdtCode = await ethers.provider.getCode(USDT);
    console.log("   USDT has code:", usdtCode.length > 2 ? "✅ YES" : "❌ NO");
    
    // Search for the error selector in the bytecode
    const errorSelector = "95b66fe9";
    if (usdtCode.includes(errorSelector)) {
        console.log("   ⚠️ ERROR SELECTOR FOUND IN USDT CONTRACT!");
    } else {
        console.log("   Error selector NOT in USDT contract");
    }
    
    // 2. Check other contracts that might be involved
    const contracts = [
        { name: "Oracle", address: "0x2b44fd56615FFA5F2980cA624871716340762238" },
        { name: "DataStore", address: "0xb6840dd443cd484ff8f89cf7d766549b768db21f" },
        { name: "EventEmitter", address: "0x9f7a35862df4513e59d63cceac1eb15e0f887ad2" },
        { name: "DepositVault", address: "0x149a382b27bf4d9de20142d3e22d0933c9f8c794" },
        { name: "sNGN", address: "0xe0dba0326623dece1712581271ebcd846d67b29f" },
        { name: "MarketToken", address: "0x6136252ce73bd4da432f85b2a7065481de227601" }
    ];
    
    console.log("\n2. Checking other contracts for error selector:");
    for (const contract of contracts) {
        const code = await ethers.provider.getCode(contract.address);
        if (code.includes(errorSelector)) {
            console.log(`   ⚠️ FOUND IN ${contract.name}!`);
        } else {
            console.log(`   Not in ${contract.name}`);
        }
    }
    
    // 3. Try to decode as standard error signatures
    console.log("\n3. Attempting to decode error:");
    console.log("   Selector: 0x" + errorSelector);
    console.log("   As bytes4: 0x95b66fe9");
    
    // Common error patterns
    const commonErrors = [
        { sig: "Error(string)", selector: "0x08c379a0" },
        { sig: "Panic(uint256)", selector: "0x4e487b71" },
        { sig: "InsufficientBalance()", selector: "0xf4d678b8" },
        { sig: "TransferFailed()", selector: "0x90b8ec18" }
    ];
    
    console.log("\n4. Checking against common error patterns:");
    for (const err of commonErrors) {
        console.log(`   ${err.sig}: ${err.selector} - ${err.selector === "0x" + errorSelector ? "MATCH!" : "no match"}`);
    }
    
    // 5. Check if it could be a custom error from token implementation
    console.log("\n5. Token contract analysis:");
    try {
        const totalSupply = await usdt.totalSupply();
        console.log("   USDT total supply:", ethers.utils.formatUnits(totalSupply, 6));
        
        const depositVaultBalance = await usdt.balanceOf("0x149A382b27BF4D9DE20142d3E22d0933c9f8C794");
        console.log("   DepositVault balance:", ethers.utils.formatUnits(depositVaultBalance, 6), "USDT");
        
        // Try to get token metadata
        try {
            const name = await usdt.name();
            const symbol = await usdt.symbol();
            const decimals = await usdt.decimals();
            console.log(`   Token: ${name} (${symbol}), decimals: ${decimals}`);
        } catch (e) {
            console.log("   Could not read token metadata");
        }
    } catch (e) {
        console.log("   Error reading token:", e.message);
    }
    
    console.log("\n6. Hypothesis:");
    console.log("   The error 0x95b66fe9 is likely a custom error from:");
    console.log("   - A token transfer restriction");
    console.log("   - A paused/frozen token state");
    console.log("   - An allowance/approval issue");
    console.log("   - A blacklist/whitelist check");
}

main().catch(console.error);