const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("=== Cancelling Pending Orders ===\n");
    console.log("User:", signer.address);

    // Your pending order keys from the check
    const orderKeys = [
        "0xb755c1f20ea37dc235595857f876a91898d4040f6f61addb72108d807fd159fc",
        "0xb4bda92e07f7706a87eadefc4faea05d715e23aabb8193a0d9cc7474f5ffdd41",
        "0x6ce97c597f1ffee1422d337f2d036f934e091dffa149cecf85d45c710c167114",
        "0x9ac8c39921fd5e821539baea066f4157d4f24742c8da56a71d28186d438cc45a",
        "0x66c7ce2641db441c9b861263f5d6cbe33f8392f0bc229fb8858c0d6db196791f",
        "0x0dbed59807e33091e798fe163ff1dfdd371f542032d206913cd57f143dfd8f46",
        "0x313f353d705cf6fb3060853558f7c4045eec5cbe8861110918686520ba80b2b8",
        "0x5e50a81ea7aa86f7d15dc5c32c0a87b4244e3f7368e46d175e8ce708b2bb6a58",
        "0xe8d8931de03a769e7626dd1307a14ee282585b0aa40e2da01d5214e915377946",
        "0x2eb8948544d9172bfd48cc6d321a2fa18917234b271da58ff6b9f9bf201f58f0",
        "0xdb5194b606da474f8cbc9fe1990786c2fe34a4d84ce21f5772004e1d35fe69f8",
        "0x661cec338d0a01306b697226dc619f12fbb5ede7bf933651a57a1294c96f1f26"
    ];

    console.log(`Found ${orderKeys.length} pending orders to cancel\n`);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    console.log("📋 Orders to cancel:");
    orderKeys.forEach((key, index) => {
        console.log(`  ${index + 1}. ${key}`);
    });

    console.log("\n🚀 Starting cancellation process...\n");

    for (let i = 0; i < orderKeys.length; i++) {
        const orderKey = orderKeys[i];
        console.log(`\nCancelling order ${i + 1}/${orderKeys.length}:`);
        console.log(`  Key: ${orderKey}`);

        try {
            // Call cancelOrder on the ExchangeRouter
            const tx = await exchangeRouter.cancelOrder(orderKey, {
                gasLimit: 1000000
            });

            console.log(`  📤 TX sent: ${tx.hash}`);
            console.log(`  ⏳ Waiting for confirmation...`);

            const receipt = await tx.wait();
            console.log(`  ✅ Cancelled! Block: ${receipt.blockNumber}`);
            console.log(`     Gas used: ${receipt.gasUsed.toString()}`);

        } catch (error) {
            console.log(`  ❌ Failed to cancel: ${error.message}`);

            // Check specific error reasons
            if (error.message.includes("Unauthorized")) {
                console.log("     → You are not authorized to cancel this order");
            } else if (error.message.includes("OrderNotFound")) {
                console.log("     → Order not found (might already be cancelled)");
            } else if (error.message.includes("EmptyOrder")) {
                console.log("     → Order is empty or already executed");
            }
        }
    }

    console.log("\n✅ Cancellation process complete!");
    console.log("\nYou can run check-pending-orders.js again to verify all orders are cancelled.");
}

main().catch(console.error);