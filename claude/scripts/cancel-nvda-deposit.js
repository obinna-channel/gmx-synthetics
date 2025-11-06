const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Canceling NVDA Deposit ===\n");
    console.log("Signer address:", signer.address);

    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";

    // Read deposit key from file
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-deposit-key-nvda-market.txt", "utf8").trim();
        console.log("Deposit key to cancel:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key from latest-deposit-key-nvda-market.txt");
        return;
    }

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
            console.log("Your mUSD has been returned to your wallet.");
            console.log("Note: Execution fee may or may not be refunded depending on configuration.");
        }

    } catch (error) {
        console.log("\n❌ Error canceling deposit:", error.message);
    }

    // Check mUSD balance
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const musd = await ethers.getContractAt("IERC20", mUSD);
    const musdBalance = await musd.balanceOf(signer.address);

    console.log("\nYour mUSD balance after cancellation:");
    console.log("  ", ethers.utils.formatUnits(musdBalance, 6));
}

main().catch(console.error);
