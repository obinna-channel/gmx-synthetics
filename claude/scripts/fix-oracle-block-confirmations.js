const { ethers } = require("hardhat");

async function main() {
    console.log("=== Fixing MIN_ORACLE_BLOCK_CONFIRMATIONS ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Key for MIN_ORACLE_BLOCK_CONFIRMATIONS
    const MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_BLOCK_CONFIRMATIONS"])
    );

    // Check current value
    const currentValue = await dataStore.getUint(MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY);
    console.log("Current MIN_ORACLE_BLOCK_CONFIRMATIONS:", currentValue.toString());

    if (currentValue.gt(0)) {
        console.log("\n🔧 Setting MIN_ORACLE_BLOCK_CONFIRMATIONS to 0 for testing...");

        try {
            const tx = await dataStore.setUint(MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY, 0);
            console.log("  Transaction sent:", tx.hash);
            await tx.wait();
            console.log("  ✅ Transaction confirmed!");

            // Verify the change
            const newValue = await dataStore.getUint(MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY);
            console.log("\nNew MIN_ORACLE_BLOCK_CONFIRMATIONS:", newValue.toString());

            if (newValue.eq(0)) {
                console.log("✅ Successfully set MIN_ORACLE_BLOCK_CONFIRMATIONS to 0!");
                console.log("\n📝 This allows oracle prices to use current block numbers.");
                console.log("   Remember to set this back to a reasonable value for production!");
            } else {
                console.log("❌ Failed to update value");
            }
        } catch (error) {
            console.log("❌ Error setting value:", error.message);
        }
    } else {
        console.log("✅ MIN_ORACLE_BLOCK_CONFIRMATIONS is already 0");
    }
}

main().catch(console.error);