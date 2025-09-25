const { ethers } = require("hardhat");

async function main() {
    console.log("=== Searching for Error Origins ===\n");
    
    // The mysterious errors we've seen
    const errors = [
        { selector: "0x95b66fe9", context: "Deposit cancellation after 1.4M gas" },
        { selector: "0x7d677abf", context: "Static call failure" }
    ];
    
    console.log("Errors we're investigating:");
    for (const err of errors) {
        console.log(`  ${err.selector} - ${err.context}`);
    }
    
    // Check if these could be from assembly or low-level calls
    console.log("\n=== Checking Contract Bytecode ===\n");
    
    const contracts = [
        { name: "MarketToken", address: "0x6136252ce73bD4dA432F85b2A7065481DE227601" },
        { name: "USDT", address: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6" },
        { name: "sNGN", address: "0xe0dba0326623dece1712581271ebcd846d67b29f" },
        { name: "DepositHandler", address: "0xEfA03387703cc220e6273fB25Fa847d474984057" },
        { name: "Oracle", address: "0x2b44fd56615FFA5F2980cA624871716340762238" }
    ];
    
    for (const contract of contracts) {
        console.log(`Checking ${contract.name}...`);
        const code = await ethers.provider.getCode(contract.address);
        
        // Remove 0x prefix and search for error selectors
        const codeStr = code.substring(2);
        
        for (const err of errors) {
            const selector = err.selector.substring(2); // Remove 0x
            if (codeStr.includes(selector)) {
                console.log(`  ⚠️ FOUND ${err.selector} in ${contract.name}!`);
                
                // Try to find context around it
                const index = codeStr.indexOf(selector);
                const context = codeStr.substring(Math.max(0, index - 20), Math.min(codeStr.length, index + 20));
                console.log(`     Context: ...${context}...`);
            }
        }
    }
    
    // Check if MarketToken might be a proxy
    console.log("\n=== Checking for Proxy Patterns ===\n");
    
    const marketCode = await ethers.provider.getCode("0x6136252ce73bD4dA432F85b2A7065481DE227601");
    const marketCodeSize = (marketCode.length - 2) / 2; // Bytes
    console.log("MarketToken code size:", marketCodeSize, "bytes");
    
    if (marketCodeSize < 1000) {
        console.log("⚠️ MarketToken might be a proxy (small bytecode)");
        
        // Check for common proxy storage slots
        const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"; // EIP-1967
        const implementation = await ethers.provider.getStorageAt(
            "0x6136252ce73bD4dA432F85b2A7065481DE227601",
            IMPLEMENTATION_SLOT
        );
        
        if (implementation !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const implAddress = "0x" + implementation.substring(26);
            console.log("Found implementation at:", implAddress);
            
            // Check implementation for errors
            const implCode = await ethers.provider.getCode(implAddress);
            const implCodeStr = implCode.substring(2);
            
            for (const err of errors) {
                const selector = err.selector.substring(2);
                if (implCodeStr.includes(selector)) {
                    console.log(`  ⚠️ FOUND ${err.selector} in implementation!`);
                }
            }
        }
    }
    
    // Try to understand what happens during minting
    console.log("\n=== Understanding Market Token Minting ===\n");
    
    const marketToken = await ethers.getContractAt("IERC20", "0x6136252ce73bD4dA432F85b2A7065481DE227601");
    
    try {
        // Try to read basic properties
        const totalSupply = await marketToken.totalSupply();
        console.log("Current total supply:", totalSupply.toString());
        
        // Check if it has special mint functions
        console.log("\nTrying to identify market token type...");
        
        // Try common function selectors
        const functionSelectors = [
            { sig: "mint(address,uint256)", selector: "0x40c10f19" },
            { sig: "mintTo(address,uint256)", selector: "0x449a52f8" },
            { sig: "mint(uint256)", selector: "0xa0712d68" }
        ];
        
        for (const func of functionSelectors) {
            if (marketCode.includes(func.selector.substring(2))) {
                console.log(`  Found ${func.sig} function`);
            }
        }
        
    } catch (e) {
        console.log("Error reading market token:", e.message);
    }
    
    console.log("\n=== CONCLUSION ===\n");
    console.log("The error 0x95b66fe9 that causes deposit cancellation is likely:");
    console.log("1. A custom error in the MarketToken contract");
    console.log("2. Related to first mint validation");
    console.log("3. Possibly checking minimum liquidity or pool ratios");
    console.log("\nThe fact that it uses 1.4M gas means it gets very far in execution");
    console.log("before hitting this specific validation check.");
}

main().catch(console.error);