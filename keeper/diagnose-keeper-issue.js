const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const oracle = await ethers.getContractAt("Oracle", "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C");

    console.log("=== DIAGNOSING KEEPER ISSUES ===\n");

    // First, clear all prices to start fresh
    console.log("Clearing all existing prices...");
    try {
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("✓ Prices cleared\n");
    } catch (e) {
        console.log("Error clearing:", e.message, "\n");
    }

    // Now test setting a price to see if there's a pattern
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    console.log("Test 1: Setting price for sNGN...");
    try {
        const price1 = ethers.utils.parseUnits("1650", 30);
        const tx1 = await oracle.setPrimaryPrice(sNGN, {min: price1, max: price1});
        await tx1.wait();
        console.log("✓ First update successful");
        
        // Read it back
        const stored1 = await oracle.getPrimaryPrice(sNGN);
        console.log(`  Stored: ${ethers.utils.formatUnits(stored1.min, 30)}`);
    } catch (e) {
        console.log("✗ First update failed:", e.reason || e.message);
    }

    console.log("\nTest 2: Updating the same price again (no change)...");
    try {
        const price2 = ethers.utils.parseUnits("1650", 30); // Same price
        const tx2 = await oracle.setPrimaryPrice(sNGN, {min: price2, max: price2});
        await tx2.wait();
        console.log("✓ Re-update with same price successful");
    } catch (e) {
        console.log("✗ Re-update failed:", e.reason || e.message);
    }

    console.log("\nTest 3: Updating with a different price...");
    try {
        const price3 = ethers.utils.parseUnits("1651", 30); // Different price
        const tx3 = await oracle.setPrimaryPrice(sNGN, {min: price3, max: price3});
        await tx3.wait();
        console.log("✓ Update with new price successful");
        
        const stored3 = await oracle.getPrimaryPrice(sNGN);
        console.log(`  Stored: ${ethers.utils.formatUnits(stored3.min, 30)}`);
    } catch (e) {
        console.log("✗ Update with new price failed:", e.reason || e.message);
    }

    // Check gas differences
    console.log("\n=== GAS ANALYSIS ===");
    const testAddresses = [
        ["Real token (sNGN)", "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"],
        ["Zero address 2", "0x0000000000000000000000000000000000000002"],
        ["Random address", "0x1234567890123456789012345678901234567890"],
    ];

    for (const [name, addr] of testAddresses) {
        try {
            const price = ethers.utils.parseUnits("1000", 30);
            const gas = await oracle.estimateGas.setPrimaryPrice(addr, {min: price, max: price});
            console.log(`${name}: ${gas.toString()} gas`);
        } catch (e) {
            console.log(`${name}: Cannot estimate (${e.reason || 'error'})`);
        }
    }

    // Final state
    console.log("\n=== FINAL STATE ===");
    const count = await oracle.getTokensWithPricesCount();
    console.log(`Tokens with prices: ${count.toString()}`);
}

main().catch(console.error);
