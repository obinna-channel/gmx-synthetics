const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING FEE_RECEIVER ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const [signer] = await ethers.getSigners();

    // Use the deployer address as fee receiver for now
    // In production, this should be a dedicated fee collection address
    const feeReceiverAddress = signer.address;

    console.log("Setting FEE_RECEIVER to:", feeReceiverAddress);

    const FEE_RECEIVER = ethers.utils.id("FEE_RECEIVER");

    // Check current value
    const currentReceiver = await dataStore.getAddress(FEE_RECEIVER);
    console.log("Current FEE_RECEIVER:", currentReceiver);

    if (currentReceiver === ethers.constants.AddressZero) {
        console.log("\nSetting new FEE_RECEIVER...");
        const tx = await dataStore.setAddress(FEE_RECEIVER, feeReceiverAddress);
        await tx.wait();
        console.log("✓ Transaction confirmed");

        // Verify
        const newReceiver = await dataStore.getAddress(FEE_RECEIVER);
        console.log("New FEE_RECEIVER:", newReceiver);

        if (newReceiver === feeReceiverAddress) {
            console.log("\n✅ FEE_RECEIVER successfully set!");
        } else {
            console.log("\n❌ Failed to set FEE_RECEIVER");
        }
    } else {
        console.log("\n✓ FEE_RECEIVER is already set");
    }

    // Also set SWAP_FEE_RECEIVER_FACTOR if not set
    const SWAP_FEE_RECEIVER_FACTOR = ethers.utils.id("SWAP_FEE_RECEIVER_FACTOR");
    const swapFeeReceiverFactor = await dataStore.getUint(SWAP_FEE_RECEIVER_FACTOR);

    console.log("\nSWAP_FEE_RECEIVER_FACTOR:", swapFeeReceiverFactor.toString());

    if (swapFeeReceiverFactor.eq(0)) {
        // Set to 50% (0.5 * 10^30)
        const factor = ethers.utils.parseUnits("0.5", 30);
        console.log("Setting SWAP_FEE_RECEIVER_FACTOR to 50%...");
        const tx = await dataStore.setUint(SWAP_FEE_RECEIVER_FACTOR, factor);
        await tx.wait();
        console.log("✓ SWAP_FEE_RECEIVER_FACTOR set");
    }

    console.log("\n=== FEE CONFIGURATION COMPLETE ===");
    console.log("You can now attempt to create deposits");
}

main().catch(console.error);