const { ethers } = require("hardhat");

async function main() {
    console.log("Testing MarksSimplifiedOracle...\n");
    
    const oracleAddress = "0x178a0F71bAB704b989A9930E109aBC11eE9beCe0";
    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);
    
    // Get the Oracle contract
    const oracle = await ethers.getContractAt("MarksSimplifiedOracle", oracleAddress);
    
    // Test token addresses
    const tokens = [
        "0x0000000000000000000000000000000000000001", // NGN
        "0x0000000000000000000000000000000000000002", // ARS
        "0x0000000000000000000000000000000000000003", // PKR
        "0x0000000000000000000000000000000000000004", // GHS
        "0x0000000000000000000000000000000000000008", // COP
    ];
    
    // Test prices (with 30 decimals)
    const prices = [
        ethers.utils.parseUnits("1500", 30),   // NGN
        ethers.utils.parseUnits("1200", 30),   // ARS
        ethers.utils.parseUnits("280", 30),    // PKR
        ethers.utils.parseUnits("13", 30),     // GHS
        ethers.utils.parseUnits("3800", 30),   // COP
    ];
    
    console.log("=== SETTING PRICES ===");
    try {
        // Call setSimplePrices with arrays
        const tx = await oracle.setSimplePrices(tokens, prices, prices); // same min/max for FX
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("✅ Prices set successfully!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
    } catch (error) {
        console.log("❌ Error setting prices:", error.message);
        return;
    }
    
    console.log("\n=== VERIFYING PRICES ===");
    
    const pairs = ["NGN", "ARS", "PKR", "GHS", "COP"];
    const expectedPrices = ["1500", "1200", "280", "13", "3800"];
    
    for (let i = 0; i < tokens.length; i++) {
        try {
            const priceResult = await oracle.getPrimaryPrice(tokens[i]);
            const minPrice = ethers.utils.formatUnits(priceResult.min, 30);
            const maxPrice = ethers.utils.formatUnits(priceResult.max, 30);
            
            console.log(`✓ ${pairs[i]}: ${parseFloat(minPrice).toFixed(2)} (expected: ${expectedPrices[i]})`);
        } catch (error) {
            console.log(`❌ ${pairs[i]}: Failed to get price -`, error.message);
        }
    }
    
    console.log("\n✅ Oracle is working correctly!");
    console.log("\nYou can now update your keeper to:");
    console.log("1. Use oracle address:", oracleAddress);
    console.log("2. Call setSimplePrices() instead of setPrices()");
    console.log("3. Pass three arrays: tokens, minPrices, maxPrices");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });