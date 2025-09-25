const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Canceling Deposit ===\n");
    console.log("Signer address:", signer.address);

    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const depositKey = "0x88184ffadce65f029094613b80eb8d8d8ce292c7cf44a1f2df2555b21b7ef522"; // Latest deposit key

    console.log("Deposit key to cancel:", depositKey);

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    try {
        console.log("\nCalling cancelDeposit...");
        const tx = await exchangeRouter.cancelDeposit(depositKey, { gasLimit: 1000000 });
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed!");
        console.log("Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");

        if (receipt.status) {
            console.log("\n✅ Deposit canceled successfully!");
            console.log("Your USDT and sNGN have been returned to your wallet.");
            console.log("Note: Execution fee (0.001 ETH) may or may not be refunded depending on configuration.");
        }

    } catch (error) {
        console.log("\n❌ Error canceling deposit:", error.message);
    }

    // Check final balances
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    const usdtBalance = await usdt.balanceOf(signer.address);
    const sngnBalance = await sngn.balanceOf(signer.address);

    console.log("\nYour balances after cancellation:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnBalance, 18));
}

main().catch(console.error);