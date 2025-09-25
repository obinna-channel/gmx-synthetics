const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Cancelling Pending Deposit ===\n");

    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";

    console.log("Deposit Key:", depositKey);
    console.log("Signer:", signer.address);

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    try {
        console.log("\n📍 Cancelling deposit...");
        const tx = await depositHandler.cancelDeposit(depositKey);
        console.log("  Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("\n✅ Deposit cancelled!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("❌ Cancellation failed:", error.message);
    }
}

main().catch(console.error);