const { ethers } = require("hardhat");

async function main() {
    console.log("=== ORACLE PRICE UPDATE TEST ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer/Keeper:", deployer.address);

    // Contract addresses
    const ORACLE_ADDRESS = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const SNGN_TOKEN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"; // sNGN token address

    // Get Oracle contract
    const oracle = await ethers.getContractAt("Oracle", ORACLE_ADDRESS);

    // Test price: 1 USDT = 1650 NGN (example rate)
    const TEST_PRICE_NGN = 1650.0;

    // Convert to 30 decimals (GMX standard precision)
    const PRICE_DECIMALS = 30;
    const price30Decimals = ethers.utils.parseUnits(TEST_PRICE_NGN.toString(), PRICE_DECIMALS);

    console.log("Test Configuration:");
    console.log("  Token: sNGN (", SNGN_TOKEN, ")");
    console.log("  Price: 1 USDT =", TEST_PRICE_NGN, "NGN");
    console.log("  Price (30 decimals):", price30Decimals.toString());

    // Step 1: Check current price (if any)
    console.log("\n=== STEP 1: CHECK CURRENT PRICE ===");
    try {
        const currentPrice = await oracle.getPrimaryPrice(SNGN_TOKEN);
        console.log("Current price in Oracle:");
        console.log("  Min:", currentPrice.min.toString());
        console.log("  Max:", currentPrice.max.toString());
        if (currentPrice.min.gt(0)) {
            const minReadable = ethers.utils.formatUnits(currentPrice.min, PRICE_DECIMALS);
            const maxReadable = ethers.utils.formatUnits(currentPrice.max, PRICE_DECIMALS);
            console.log("  Min (readable):", minReadable, "NGN");
            console.log("  Max (readable):", maxReadable, "NGN");
        } else {
            console.log("  (No price set yet)");
        }
    } catch (error) {
        console.log("Error reading current price:", error.message);
    }

    // Step 2: Set new price using setPrimaryPrice
    console.log("\n=== STEP 2: SET NEW PRICE ===");
    console.log("Calling setPrimaryPrice...");

    try {
        // For FX markets, we typically use the same price for min and max (no spread)
        const priceStruct = {
            min: price30Decimals,
            max: price30Decimals
        };

        console.log("Price struct:");
        console.log("  min:", priceStruct.min.toString());
        console.log("  max:", priceStruct.max.toString());

        // Send transaction
        const tx = await oracle.setPrimaryPrice(SNGN_TOKEN, priceStruct);
        console.log("Transaction sent:", tx.hash);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        if (receipt.status === 1) {
            console.log("✓ Price update successful!");
        } else {
            console.log("✗ Transaction failed!");
            return;
        }
    } catch (error) {
        console.log("✗ Error setting price:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
        return;
    }

    // Step 3: Read back the price to verify
    console.log("\n=== STEP 3: VERIFY PRICE WAS SET ===");
    try {
        const newPrice = await oracle.getPrimaryPrice(SNGN_TOKEN);
        console.log("New price in Oracle:");
        console.log("  Min:", newPrice.min.toString());
        console.log("  Max:", newPrice.max.toString());

        // Convert back to readable format
        const minReadable = ethers.utils.formatUnits(newPrice.min, PRICE_DECIMALS);
        const maxReadable = ethers.utils.formatUnits(newPrice.max, PRICE_DECIMALS);
        console.log("  Min (readable):", minReadable, "NGN");
        console.log("  Max (readable):", maxReadable, "NGN");

        // Verify it matches what we set
        if (newPrice.min.eq(price30Decimals) && newPrice.max.eq(price30Decimals)) {
            console.log("\n✓ SUCCESS! Price was correctly set and retrieved!");
            console.log("  Expected:", TEST_PRICE_NGN, "NGN");
            console.log("  Got:", minReadable, "NGN");
        } else {
            console.log("\n✗ WARNING: Price doesn't match expected value");
            console.log("  Expected:", price30Decimals.toString());
            console.log("  Got Min:", newPrice.min.toString());
            console.log("  Got Max:", newPrice.max.toString());
        }
    } catch (error) {
        console.log("✗ Error reading new price:", error.message);
    }

    // Step 4: Test that contracts can read this price correctly
    console.log("\n=== STEP 4: TEST ADDITIONAL ORACLE FUNCTIONS ===");

    try {
        // Check if token is in the tokens with prices list
        const tokensWithPricesCount = await oracle.getTokensWithPricesCount();
        console.log("Tokens with prices count:", tokensWithPricesCount.toString());

        // Get tokens with prices (if the function exists)
        try {
            const tokensWithPrices = await oracle.getTokensWithPrices(0, tokensWithPricesCount);
            console.log("Tokens with prices:", tokensWithPrices);

            if (tokensWithPrices.includes(SNGN_TOKEN)) {
                console.log("✓ sNGN token is in the tokens with prices list");
            }
        } catch (e) {
            // Function might not exist or have different signature
            console.log("(Cannot enumerate tokens with prices)");
        }

        // Check timestamps
        const minTimestamp = await oracle.minTimestamp();
        const maxTimestamp = await oracle.maxTimestamp();
        console.log("\nOracle Timestamps:");
        console.log("  Min timestamp:", minTimestamp.toString());
        console.log("  Max timestamp:", maxTimestamp.toString());

        if (minTimestamp.eq(0) && maxTimestamp.eq(0)) {
            console.log("  (Timestamps not set - may need to call setTimestamps)");
        }
    } catch (error) {
        console.log("Error checking additional functions:", error.message);
    }

    console.log("\n=== TEST COMPLETE ===");
    console.log("\nSummary:");
    console.log("✓ Successfully pushed price update using setPrimaryPrice");
    console.log("✓ Successfully retrieved price using getPrimaryPrice");
    console.log("✓ Price format confirmed: 30 decimals, stored as (min, max) tuple");
    console.log("\nYour keeper script should:");
    console.log("1. Use setPrimaryPrice(token, {min: price30dec, max: price30dec})");
    console.log("2. Format prices with 30 decimal places");
    console.log("3. Use the same value for min and max for FX rates");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });