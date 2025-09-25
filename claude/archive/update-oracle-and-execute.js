const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Updating Oracle & Executing Deposit ===\n");

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    // Update timestamps to current time
    console.log("1️⃣ UPDATING ORACLE TIMESTAMPS...");
    const currentTime = Math.floor(Date.now() / 1000);
    console.log("  Current time:", currentTime);
    console.log("  Setting timestamps: min =", currentTime - 30, ", max =", currentTime + 30);
    
    const timestampTx = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
    await timestampTx.wait();
    console.log("  ✅ Timestamps updated\n");

    // Execute deposit
    console.log("2️⃣ EXECUTING DEPOSIT...");
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    try {
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            { gasLimit: 5000000 }
        );

        console.log("  Transaction sent:", executeTx.hash);
        const receipt = await executeTx.wait();

        if (receipt.status === 1) {
            console.log("\n✅ DEPOSIT EXECUTED SUCCESSFULLY!");
            console.log("  Block:", receipt.blockNumber);
            console.log("  Gas used:", receipt.gasUsed.toString());
        } else {
            console.log("\n❌ Transaction failed!");
        }
    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("  Error:", error.message);
    }
}

main().catch(console.error);
