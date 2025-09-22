const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Final Deposit Execution Attempt ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    // Deposit key from previous creation
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    console.log("Deposit Key:", depositKey);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Setting Oracle Prices ===");

    try {
        // First, let's check the Oracle ABI to understand setPrices function
        console.log("Clearing existing prices...");
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("Prices cleared!");

        // Set prices using the simpler setPrimaryPrice if available, or the correct setPrices format
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log("Current block:", blockNumber);

        // USDT price: $1 with 30 decimals
        const usdtPriceStruct = {
            min: ethers.utils.parseUnits("1", 30),
            max: ethers.utils.parseUnits("1", 30)
        };

        // sNGN price: USDT/NGN rate = 1500 (1 USDT = 1500 NGN) with 30 decimals
        const sNgnPriceStruct = {
            min: ethers.utils.parseUnits("1500", 30),
            max: ethers.utils.parseUnits("1500", 30)
        };

        // Try setting primary prices directly
        console.log("\nSetting USDT primary price to $1.00...");
        try {
            const setUsdtTx = await oracle.setPrimaryPrice(USDT, usdtPriceStruct);
            await setUsdtTx.wait();
            console.log("✅ USDT price set!");
        } catch (e) {
            console.log("setPrimaryPrice not available, trying alternative method...");
            // If setPrimaryPrice doesn't exist, we may need to use a different approach
            // For now, we'll continue without prices and see if the execution provides more info
        }

        console.log("\nSetting sNGN primary price to 1500 (USDT/NGN rate)...");
        try {
            const setSNgnTx = await oracle.setPrimaryPrice(sNGN, sNgnPriceStruct);
            await setSNgnTx.wait();
            console.log("✅ sNGN price set!");
        } catch (e) {
            console.log("setPrimaryPrice not available for sNGN");
        }

        // Verify prices if possible
        try {
            const usdtPrice = await oracle.getPrimaryPrice(USDT);
            console.log("\nUSDT price verified:");
            console.log("  Min:", ethers.utils.formatUnits(usdtPrice.min, 30), "USD");
            console.log("  Max:", ethers.utils.formatUnits(usdtPrice.max, 30), "USD");
        } catch (e) {
            console.log("Could not verify USDT price");
        }

        try {
            const sNgnPrice = await oracle.getPrimaryPrice(sNGN);
            console.log("\nsNGN price verified:");
            console.log("  Min:", ethers.utils.formatUnits(sNgnPrice.min, 30), "USD");
            console.log("  Max:", ethers.utils.formatUnits(sNgnPrice.max, 30), "USD");
        } catch (e) {
            console.log("Could not verify sNGN price");
        }

    } catch (error) {
        console.log("Oracle setup error:", error.message);
        console.log("Continuing with execution attempt anyway...");
    }

    console.log("\n=== Executing Deposit ===");

    try {
        // Create oracle params for execution
        const oracleParams = {
            signerInfo: 0, // No signature validation for keeper execution
            tokens: [USDT, sNGN], // Both tokens needed
            providers: [ORACLE, ORACLE], // Same oracle for both
            data: [] // Empty data for keeper execution
        };

        console.log("\nOracle Params:");
        console.log("  Tokens:", oracleParams.tokens);
        console.log("  Providers:", oracleParams.providers);
        console.log("  Data length:", oracleParams.data.length);

        console.log("\nCalling executeDeposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            {
                gasLimit: 5000000 // Provide sufficient gas
            }
        );

        console.log("\nTransaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ DEPOSIT EXECUTED SUCCESSFULLY!");
        console.log("Transaction hash:", receipt.transactionHash);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Block:", receipt.blockNumber);

        // Check for events
        if (receipt.logs && receipt.logs.length > 0) {
            console.log("\n=== Events Emitted ===");
            console.log("Number of events:", receipt.logs.length);
            for (let i = 0; i < Math.min(5, receipt.logs.length); i++) {
                console.log(`Event ${i + 1} at:`, receipt.logs[i].address);
            }
        }

        console.log("\n🎉 Congratulations! Your first deposit has been executed successfully!");

    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("Error message:", error.message);

        if (error.data) {
            console.log("\nError data:", error.data);

            // Try to decode common errors
            try {
                const errorInterface = new ethers.utils.Interface([
                    "error EmptyDeposit()",
                    "error EmptyPrimaryPrice(address token)",
                    "error InvalidBlockNumber(uint256 blockNumber)",
                    "error DisabledFeature(bytes32 key)",
                    "error InsufficientPoolAmount(uint256 amount, uint256 poolAmount)",
                    "error InvalidPrices()",
                    "error OracleError(string reason)"
                ]);

                const decodedError = errorInterface.parseError(error.data);
                console.log("\n🔍 Decoded error:", decodedError.name);
                if (decodedError.args && decodedError.args.length > 0) {
                    console.log("Error arguments:");
                    decodedError.args.forEach((arg, i) => {
                        console.log(`  Arg ${i}:`, arg.toString());
                    });
                }
            } catch (e) {
                console.log("Could not decode error");
            }
        }

        // Additional debugging
        console.log("\n=== Additional Debugging ===");

        // Check if the deposit still exists
        try {
            const depositExists = await dataStore.contains(
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_LIST")),
                depositKey
            );
            console.log("Deposit still exists:", depositExists);
        } catch (e) {
            console.log("Could not check deposit existence");
        }

        // Check market pool amounts
        const poolAmountLongKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32"],
                ["0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970", ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
            )
        );

        try {
            const poolAmount = await dataStore.getUint(poolAmountLongKey);
            console.log("Current pool amount:", poolAmount.toString());
        } catch (e) {
            console.log("Could not get pool amount");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });