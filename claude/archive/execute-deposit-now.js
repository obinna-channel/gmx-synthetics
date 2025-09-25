const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== EXECUTING DEPOSIT NOW ===\n");
    console.log("Keeper address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_KEY = "0x3772b0c5ec95382c48668749a697d7586df957e3d46b97658950d33d9daa5910";

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Quick time check
    const depositCreationTime = 1758501155;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = 3600 - (currentTime - depositCreationTime);

    console.log("⏰ TIME CHECK:");
    console.log("  Time remaining:", timeRemaining, "seconds");

    if (timeRemaining <= 0) {
        console.log("  ❌ DEPOSIT HAS EXPIRED!");
        return;
    }

    console.log("  ✅ Still valid - executing quickly!\n");

    // Set oracle timestamps to match deposit creation time better
    console.log("Setting oracle timestamps...");
    try {
        // Set timestamps close to deposit creation time to ensure validation passes
        const minTs = depositCreationTime + 10; // Just after deposit creation
        const maxTs = depositCreationTime + 120; // 2 minutes after creation

        const tx = await oracle.setTimestamps(minTs, maxTs);
        await tx.wait();
        console.log("  ✅ Timestamps set");
        console.log("  Min:", minTs);
        console.log("  Max:", maxTs);
    } catch (e) {
        console.log("  Error setting timestamps:", e.message);
    }

    // Execute with empty oracle params
    console.log("\n🚀 EXECUTING DEPOSIT...");

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    try {
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            {
                gasLimit: 5000000
            }
        );

        console.log("\nTransaction sent:", executeTx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await executeTx.wait();

        console.log("\n✅✅✅ DEPOSIT EXECUTED SUCCESSFULLY! ✅✅✅");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        if (receipt.events && receipt.events.length > 0) {
            console.log("\nEvents emitted:", receipt.events.length);
        }

        console.log("\n🎉 THE FIRST DEPOSIT HAS BEEN EXECUTED!");
        console.log("💰 100 USDT liquidity added to USDTNGN market!");
        console.log("📈 Market is now initialized and ready for trading!");

    } catch (error) {
        console.log("\n❌ Execution failed:", error.message);

        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });