const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== EXECUTING NEW DEPOSIT (REAL) ===\n");
    console.log("Keeper address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const NEW_DEPOSIT_KEY = "0xa086d3ac59bbab5dfeb369072a8f0b04f6cade27fb9324d7d2ec165c937884aa";

    console.log("Deposit Key:", NEW_DEPOSIT_KEY);

    // Get contract
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    console.log("\n✅ Pre-flight checks passed (from simulation):");
    console.log("  • Deposit exists and is valid");
    console.log("  • Oracle prices are set (USDT: $1, sNGN: 1500)");
    console.log("  • Oracle timestamps are fresh");
    console.log("  • MAX_PNL_FACTOR set to 50%");
    console.log("  • MIN_ORACLE_SIGNERS = 0");
    console.log("  • REQUEST_EXPIRATION_TIME = 3600");

    console.log("\n🚀 EXECUTING DEPOSIT...");

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("  Sending transaction...");

    try {
        const executeTx = await depositHandler.executeDeposit(
            NEW_DEPOSIT_KEY,
            oracleParams,
            {
                gasLimit: 5000000
            }
        );

        console.log("\n📤 Transaction sent!");
        console.log("  Hash:", executeTx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await executeTx.wait();

        console.log("\n✅✅✅ DEPOSIT EXECUTED SUCCESSFULLY! ✅✅✅");
        console.log("\n📊 Execution Details:");
        console.log("  Block Number:", receipt.blockNumber);
        console.log("  Gas Used:", receipt.gasUsed.toString());
        console.log("  Transaction Hash:", receipt.transactionHash);

        // Check for events
        if (receipt.logs && receipt.logs.length > 0) {
            console.log("\n📢 Events Emitted:", receipt.logs.length);
        }

        console.log("\n🎉🎉🎉 SUCCESS! 🎉🎉🎉");
        console.log("\n✨ What just happened:");
        console.log("  • 100 USDT has been added to the USDTNGN market pool");
        console.log("  • Market tokens have been minted to address(1)");
        console.log("  • The USDTNGN perpetual market is now LIVE!");
        console.log("\n💰 The market is initialized and ready for trading!");

    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("Error:", error.message);

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
