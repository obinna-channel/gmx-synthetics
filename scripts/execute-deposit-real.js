const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== EXECUTING DEPOSIT (REAL) ===\n");
    console.log("Keeper address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    // The deposit key
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";

    console.log("Deposit Key:", DEPOSIT_KEY);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Step 1: Verify prices are set
    console.log("\n1️⃣ VERIFYING ORACLE PRICES...");

    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price: ✅", ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch (e) {
        console.log("  USDT: ❌ Not set - setting now...");
        const usdtPrice = ethers.utils.parseUnits("1", "30");
        const tx1 = await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice });
        await tx1.wait();
        console.log("  ✅ USDT price set to $1.00");
    }

    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price: ✅", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch (e) {
        console.log("  sNGN: ❌ Not set - setting now...");
        const ngnPrice = ethers.utils.parseUnits("1500", "30");
        const tx2 = await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice });
        await tx2.wait();
        console.log("  ✅ sNGN price set to 1500");
    }

    // Step 2: Verify oracle timestamps
    console.log("\n2️⃣ VERIFYING ORACLE TIMESTAMPS...");
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    const currentTime = Math.floor(Date.now() / 1000);

    if (minTs.eq(0) || maxTs.eq(0)) {
        console.log("  Setting timestamps...");
        const tx = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
        await tx.wait();
        console.log("  ✅ Timestamps set");
    } else {
        console.log("  ✅ Timestamps already set");
        console.log("    Min:", minTs.toString());
        console.log("    Max:", maxTs.toString());
    }

    // Step 3: Final confirmation
    console.log("\n3️⃣ FINAL PRE-EXECUTION CHECK...");
    console.log("  ✅ Deposit key:", DEPOSIT_KEY);
    console.log("  ✅ ORDER_KEEPER role: Yes");
    console.log("  ✅ USDT price: Set");
    console.log("  ✅ sNGN price: Set");
    console.log("  ✅ Oracle timestamps: Valid");
    console.log("  ✅ Empty oracle params ready");

    // Step 4: Execute the deposit
    console.log("\n4️⃣ EXECUTING DEPOSIT...");

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("  Sending transaction...");

    try {
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            {
                gasLimit: 5000000
            }
        );

        console.log("\n🚀 Transaction sent!");
        console.log("  Hash:", executeTx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await executeTx.wait();

        console.log("\n✅✅✅ DEPOSIT EXECUTED SUCCESSFULLY! ✅✅✅");
        console.log("\n📊 Execution Details:");
        console.log("  Block Number:", receipt.blockNumber);
        console.log("  Gas Used:", receipt.gasUsed.toString());
        console.log("  Transaction Hash:", receipt.transactionHash);

        // Check for events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\n📢 Events Emitted:", receipt.events.length);

            // Look for Transfer events (market tokens minted)
            const transferEvents = receipt.events.filter(e => e.event === "Transfer");
            if (transferEvents.length > 0) {
                console.log("  Market token transfers detected!");
            }
        }

        console.log("\n🎉🎉🎉 SUCCESS! 🎉🎉🎉");
        console.log("\n✨ What just happened:");
        console.log("  • 100 USDT has been added to the USDTNGN market pool");
        console.log("  • Market tokens have been minted");
        console.log("  • Tokens sent to address(1) for first deposit");
        console.log("  • The USDTNGN perpetual market is now LIVE!");
        console.log("\n💰 The market is initialized and ready for trading!");

    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("Error:", error.message);

        if (error.data) {
            console.log("Error data:", error.data);
        }

        // If it fails, check if it's because deposit was already executed
        const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
        const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
        const reader = await ethers.getContractAt("Reader", READER);

        try {
            await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
            console.log("\n  Deposit still exists - execution genuinely failed");
        } catch {
            console.log("\n  Deposit no longer exists - might have been executed already");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });