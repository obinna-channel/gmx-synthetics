const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Cancelling Expired Deposit on NEW Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    // Deposit key to cancel
    const depositKey = "0xb96830699e00c7868d9acd657e6e7226d66237980b2692f6b55843309edbb21c";

    console.log("Deposit Key to cancel:", depositKey);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Step 1: Verify deposit exists
    console.log("\n📍 Step 1: Verifying deposit exists...");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);

    if (!isInList) {
        console.log("❌ Deposit not found! May have already been cancelled.");
        return;
    }
    console.log("✅ Deposit found");

    // Step 2: Cancel the deposit
    console.log("\n📍 Step 2: Cancelling deposit...");

    try {
        const tx = await depositHandler.cancelDeposit(depositKey);
        console.log("  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Deposit cancelled!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Verify it's removed from list
        const stillInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
        if (!stillInList) {
            console.log("  ✅ Deposit removed from DEPOSIT_LIST");
        } else {
            console.log("  ⚠️ Deposit still in list (might need time to update)");
        }

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

        console.log("\n✅ SUCCESS! Deposit cancelled. You should have received:");
        console.log("  - 1 USDT refunded");
        console.log("  - 1500 sNGN refunded");
        console.log("  - 0.001 ETH execution fee refunded");

    } catch (error) {
        console.log("❌ Cancellation failed:", error.message);

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);

            // Decode common errors
            const errorSig = error.error.data.slice(0, 10);
            const errors = {
                "0xa35b150b": "Unauthorized - only keeper can cancel",
                "0x646cf558": "Empty deposit - already cancelled"
            };

            if (errors[errorSig]) {
                console.log("Decoded error:", errors[errorSig]);
            }
        }
    }
}

main().catch(console.error);