const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING HOLDING_ADDRESS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const [signer] = await ethers.getSigners();

    // Use the deployer address as holding address for simplicity
    // This is where any excess tokens would be sent
    const holdingAddress = signer.address;

    const HOLDING_ADDRESS = ethers.utils.id("HOLDING_ADDRESS");

    // Check current value
    const currentHolding = await dataStore.getAddress(HOLDING_ADDRESS);
    console.log("Current HOLDING_ADDRESS:", currentHolding);

    if (currentHolding === ethers.constants.AddressZero) {
        console.log("\nSetting HOLDING_ADDRESS to:", holdingAddress);
        const tx = await dataStore.setAddress(HOLDING_ADDRESS, holdingAddress);
        await tx.wait();
        console.log("✓ Transaction confirmed");

        // Verify
        const newHolding = await dataStore.getAddress(HOLDING_ADDRESS);
        console.log("New HOLDING_ADDRESS:", newHolding);

        if (newHolding === holdingAddress) {
            console.log("\n✅ HOLDING_ADDRESS successfully set!");
        } else {
            console.log("\n❌ Failed to set HOLDING_ADDRESS");
        }
    } else {
        console.log("\n✓ HOLDING_ADDRESS is already set");
    }
}

main().catch(console.error);