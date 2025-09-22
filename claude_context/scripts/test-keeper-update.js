const { ethers } = require("hardhat");

async function main() {
    console.log("Testing keeper price updates...\n");

    const [deployer] = await ethers.getSigners();
    const oracle = await ethers.getContractAt("Oracle", "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C");

    // Test tokens from the keeper
    const tokens = {
        "USDTNGN": "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",  // Real token
        "USDTARS": "0x0000000000000000000000000000000000000002",  // Placeholder
        "USDTPKR": "0x0000000000000000000000000000000000000003",  // Placeholder
    };

    for (const [pair, address] of Object.entries(tokens)) {
        console.log(`\nTesting ${pair} (${address}):`);

        const testPrice = ethers.utils.parseUnits("1500", 30);
        const priceTuple = { min: testPrice, max: testPrice };

        try {
            // Try to set price
            const tx = await oracle.setPrimaryPrice(address, priceTuple);
            console.log(`  ✓ Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  ✓ Price set successfully, gas: ${receipt.gasUsed}`);

            // Try to read it back
            const price = await oracle.getPrimaryPrice(address);
            console.log(`  ✓ Price retrieved: ${ethers.utils.formatUnits(price.min, 30)}`);
        } catch (error) {
            console.log(`  ✗ Error: ${error.reason || error.message}`);
            if (error.data) {
                console.log(`  Error data: ${error.data}`);
            }
        }
    }

    // Check current state
    console.log("\n=== Current Oracle State ===");
    const count = await oracle.getTokensWithPricesCount();
    console.log(`Tokens with prices: ${count.toString()}`);

    if (count.gt(0)) {
        const tokens = await oracle.getTokensWithPrices(0, count);
        console.log("Active tokens:");
        for (const token of tokens) {
            try {
                const price = await oracle.getPrimaryPrice(token);
                const readable = ethers.utils.formatUnits(price.min, 30);
                console.log(`  ${token}: ${readable}`);
            } catch (e) {
                console.log(`  ${token}: Error reading price`);
            }
        }
    }

    // Clear all prices to reset state
    console.log("\n=== Clearing All Prices ===");
    try {
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("✓ All prices cleared");

        const countAfter = await oracle.getTokensWithPricesCount();
        console.log(`Tokens with prices after clear: ${countAfter.toString()}`);
    } catch (e) {
        console.log("Error clearing prices:", e.message);
    }
}

main().catch(console.error);