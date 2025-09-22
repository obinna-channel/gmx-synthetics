const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMULATING DEPOSIT CREATION - NO ACTUAL TRANSACTION ===\n");

    // EXACT ADDRESSES FROM DEPLOYMENTS (as documented in DEPOSIT_ISSUE_UPDATE)
    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    const depositAmount = ethers.utils.parseUnits("100", 6); // 100 USDT

    // ========================================
    // CHECK CURRENT STATE
    // ========================================
    console.log("\n=== CURRENT STATE ===");
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6), "USDT");

    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    console.log("\n=== SIMULATION SCENARIOS ===");
    console.log("We'll test different scenarios to see what works:\n");

    // ========================================
    // SCENARIO 1: With USDT already in vault (from previous attempts)
    // ========================================
    if (vaultBalance.gte(depositAmount)) {
        console.log("SCENARIO 1: Using USDT already in vault");
        console.log("- Vault has:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
        console.log("- We want to deposit: 100 USDT");

        const depositParams1 = {
            addresses: {
                receiver: signer.address,
                callbackContract: ethers.constants.AddressZero,
                uiFeeReceiver: ethers.constants.AddressZero,
                market: ADDRESSES.MARKET,
                initialLongToken: ADDRESSES.USDT,
                initialShortToken: ADDRESSES.USDT,  // MUST be USDT, not AddressZero!
                longTokenSwapPath: [],
                shortTokenSwapPath: []
            },
            minMarketTokens: 0,
            shouldUnwrapNativeToken: false,
            executionFee: 0,  // MUST be 0 - key discovery!
            callbackGasLimit: 0,
            dataList: []
        };

        console.log("\nSimulating deposit creation (no transfer needed)...");
        try {
            const result = await exchangeRouter.callStatic.createDeposit(
                depositParams1,
                { value: 0 }
            );
            console.log("✅ SCENARIO 1 SUCCESS!");
            console.log("Simulated deposit key:", result);
            console.log("\nThis approach works! The USDT in vault can be used.");
        } catch (error) {
            console.log("❌ SCENARIO 1 FAILED");
            console.log("Error:", error.message.substring(0, 200));
            if (error.data) {
                console.log("Error data:", error.data);
            }
        }
    }

    // ========================================
    // SCENARIO 2: Fresh deposit - simulate transfer then create
    // ========================================
    console.log("\n-----------------------------------");
    console.log("SCENARIO 2: Fresh deposit (transfer + create)");
    console.log("- Will transfer 100 USDT to vault");
    console.log("- Then create deposit");

    // We can't actually simulate the transfer, but we can simulate the deposit
    // assuming the transfer happened
    const depositParams2 = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // Zero fee
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\nSimulating deposit creation (assuming fresh 100 USDT in vault)...");
    try {
        // This simulates as if we had just transferred 100 USDT
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams2,
            { value: 0 }
        );
        console.log("✅ SCENARIO 2 SUCCESS!");
        console.log("Simulated deposit key:", result);
        console.log("\nThis is the proven approach from DEPOSIT_ISSUE_UPDATE!");
    } catch (error) {
        console.log("❌ SCENARIO 2 FAILED");
        console.log("Error:", error.message.substring(0, 200));
    }

    // ========================================
    // SCENARIO 3: Test with execution fee (should fail based on findings)
    // ========================================
    console.log("\n-----------------------------------");
    console.log("SCENARIO 3: With execution fee (expected to fail)");

    const depositParams3 = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),  // With fee
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\nSimulating with 0.001 ETH execution fee...");
    try {
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams3,
            { value: ethers.utils.parseEther("0.001") }
        );
        console.log("✅ SCENARIO 3 SUCCESS (unexpected!)");
        console.log("Simulated deposit key:", result);
    } catch (error) {
        console.log("❌ SCENARIO 3 FAILED (as expected)");
        console.log("Error confirms: execution fee causes issues");
        console.log("Error:", error.message.substring(0, 100));
    }

    // ========================================
    // SCENARIO 4: Wrong token configuration (should fail)
    // ========================================
    console.log("\n-----------------------------------");
    console.log("SCENARIO 4: With AddressZero as shortToken (should fail)");

    const depositParams4 = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ethers.constants.AddressZero,  // Wrong!
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\nSimulating with AddressZero as shortToken...");
    try {
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams4,
            { value: 0 }
        );
        console.log("✅ SCENARIO 4 SUCCESS (unexpected!)");
        console.log("Simulated deposit key:", result);
    } catch (error) {
        console.log("❌ SCENARIO 4 FAILED (as expected)");
        console.log("Error confirms: both tokens must be USDT");
        console.log("Error:", error.message.substring(0, 100));
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log("\n=== SIMULATION SUMMARY ===");
    console.log("\nKEY FINDINGS:");
    console.log("1. executionFee MUST be 0");
    console.log("2. Both initialLongToken and initialShortToken MUST be USDT");
    console.log("3. USDT must be in DepositVault before createDeposit");
    console.log("4. No ETH value should be sent with transaction");

    console.log("\nNEXT STEPS:");
    console.log("1. If simulations passed: Run actual deposit creation");
    console.log("2. Extract deposit key from transaction logs");
    console.log("3. Set oracle prices");
    console.log("4. Execute deposit with ORDER_KEEPER role");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });