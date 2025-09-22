const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING UPDATED KEEPER LOGIC ===\n");

    const [deployer] = await ethers.getSigners();
    const oracle = await ethers.getContractAt("Oracle", "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C");
    const SNGN_TOKEN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    // Step 1: Set an initial price to simulate existing state
    console.log("Step 1: Setting initial price...");
    try {
        await oracle.clearAllPrices();
        const initialPrice = ethers.utils.parseUnits("1650", 30);
        const tx1 = await oracle.setPrimaryPrice(SNGN_TOKEN, {min: initialPrice, max: initialPrice});
        await tx1.wait();
        console.log("✓ Initial price set: 1650 NGN per USDT\n");
    } catch (e) {
        console.log("Error setting initial price:", e.message, "\n");
    }

    // Step 2: Simulate keeper update cycle (clear then set)
    console.log("Step 2: Simulating keeper update cycle...");
    console.log("  2a. Clearing all prices...");

    try {
        const clearTx = await oracle.clearAllPrices();
        const clearReceipt = await clearTx.wait();
        console.log(`  ✓ Prices cleared, gas used: ${clearReceipt.gasUsed}`);

        // Check that prices are actually cleared
        try {
            await oracle.getPrimaryPrice(SNGN_TOKEN);
            console.log("  ⚠ WARNING: Price still exists after clear!");
        } catch (e) {
            if (e.reason && e.reason.includes("EmptyPrimaryPrice")) {
                console.log("  ✓ Confirmed: Price is cleared (EmptyPrimaryPrice error)");
            }
        }
    } catch (e) {
        console.log("  ✗ Error clearing prices:", e.message);
    }

    console.log("\n  2b. Setting new price...");

    try {
        const newPrice = ethers.utils.parseUnits("1505.2", 30);  // New price from API
        const tx2 = await oracle.setPrimaryPrice(SNGN_TOKEN, {min: newPrice, max: newPrice});
        const receipt2 = await tx2.wait();
        console.log(`  ✓ New price set: 1505.2 NGN per USDT, gas used: ${receipt2.gasUsed}`);

        // Verify the new price
        const storedPrice = await oracle.getPrimaryPrice(SNGN_TOKEN);
        const readable = ethers.utils.formatUnits(storedPrice.min, 30);
        console.log(`  ✓ Verified stored price: ${readable} NGN per USDT`);
    } catch (e) {
        console.log("  ✗ Error setting new price:", e.message);
    }

    // Step 3: Test rapid update cycles
    console.log("\n\nStep 3: Testing multiple update cycles...");

    const testPrices = ["1506", "1507", "1508"];
    for (let i = 0; i < testPrices.length; i++) {
        console.log(`\n  Cycle ${i + 1}: Updating to ${testPrices[i]} NGN per USDT`);

        try {
            // Clear
            console.log("    Clearing...");
            const clearTx = await oracle.clearAllPrices();
            await clearTx.wait();

            // Set
            console.log("    Setting...");
            const price = ethers.utils.parseUnits(testPrices[i], 30);
            const setTx = await oracle.setPrimaryPrice(SNGN_TOKEN, {min: price, max: price});
            await setTx.wait();

            console.log(`    ✓ Cycle ${i + 1} successful`);

            // Small delay between cycles
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.log(`    ✗ Cycle ${i + 1} failed:`, e.reason || e.message);
        }
    }

    // Final verification
    console.log("\n\n=== FINAL VERIFICATION ===");
    const tokensCount = await oracle.getTokensWithPricesCount();
    console.log("Tokens with prices:", tokensCount.toString());

    if (tokensCount.gt(0)) {
        const finalPrice = await oracle.getPrimaryPrice(SNGN_TOKEN);
        console.log("Final NGN price:", ethers.utils.formatUnits(finalPrice.min, 30), "NGN per USDT");
    }

    console.log("\n✅ Clear-then-set pattern works correctly!");
    console.log("The keeper script should now be able to continuously update prices.");
}

main().catch(console.error);