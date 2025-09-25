const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING SWAP_HANDLER IN DATASTORE ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const SWAP_HANDLER_ADDRESS = "0x1Fc0C1D13BB2223763af0A41df95F9738e08eB14";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const SWAP_HANDLER = ethers.utils.id("SWAP_HANDLER");

    // Check current value
    const currentSwapHandler = await dataStore.getAddress(SWAP_HANDLER);
    console.log("Current SWAP_HANDLER in DataStore:", currentSwapHandler);

    if (currentSwapHandler === ethers.constants.AddressZero) {
        console.log("\nSetting SWAP_HANDLER to:", SWAP_HANDLER_ADDRESS);
        const tx = await dataStore.setAddress(SWAP_HANDLER, SWAP_HANDLER_ADDRESS);
        await tx.wait();
        console.log("✓ Transaction confirmed");

        // Verify
        const newSwapHandler = await dataStore.getAddress(SWAP_HANDLER);
        console.log("New SWAP_HANDLER:", newSwapHandler);

        if (newSwapHandler === SWAP_HANDLER_ADDRESS) {
            console.log("\n✅ SWAP_HANDLER successfully set!");
        } else {
            console.log("\n❌ Failed to set SWAP_HANDLER");
        }
    } else {
        console.log("\n✓ SWAP_HANDLER is already set");
    }
}

main().catch(console.error);