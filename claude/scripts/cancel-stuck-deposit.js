const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Cancelling Stuck Deposit ===\n");

    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";

    console.log("Deposit Key:", depositKey);
    console.log("Signer:", signer.address);

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check deposit exists before
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const beforeInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    console.log("\nDeposit in list before cancel:", beforeInList ? "YES ✅" : "NO ❌");

    try {
        console.log("\n📍 Cancelling deposit...");
        const tx = await depositHandler.cancelDeposit(depositKey, {
            gasLimit: 1000000
        });

        console.log("  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Deposit cancelled successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        console.log("  Status:", receipt.status === 1 ? "SUCCESS ✅" : "FAILED ❌");

        // Check if removed from list
        const afterInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
        console.log("\nDeposit in list after cancel:", afterInList ? "YES ❌ (still there)" : "NO ✅ (removed)");

        // Check deposit count
        const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
        console.log("Total deposits in queue now:", depositCount.toString());

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

        console.log("\n✅ SUCCESS! The stuck deposit has been cancelled!");
        console.log("You should have received back:");
        console.log("  - 1 USDT");
        console.log("  - 1500 sNGN");
        console.log("  - 0.001 WETH");
        console.log("\nThe DEPOSIT_LIST should now be clear for new deposits!");

    } catch (error) {
        console.log("\n❌ Cancellation failed!");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);