const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== CREATING AND EXECUTING NEW DEPOSIT WITH CORRECT ADDRESSES ===");

    const [signer] = await ethers.getSigners();

    // Contract addresses FROM DEPLOYMENTS
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40"; // from deployments/marks/arbitrumSepolia/ExchangeRouter.json
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827"; // from deployments/marks/arbitrumSepolia/DepositHandler.json
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C"; // from deployments/marks/arbitrumSepolia/Oracle.json
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da"; // from deployments/marks/arbitrumSepolia/DataStore.json
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"; // from deployments/marks/arbitrumSepolia/DepositVault.json

    // Token addresses FROM CONFIG
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6"; // from config/tokens.ts
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"; // from config/tokens.ts

    // Market address (confirmed correct by user)
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Contract Addresses ===");
    console.log("ExchangeRouter:", EXCHANGE_ROUTER);
    console.log("DepositHandler:", DEPOSIT_HANDLER);
    console.log("Oracle:", ORACLE);
    console.log("DataStore:", DATA_STORE);
    console.log("DepositVault:", DEPOSIT_VAULT);
    console.log("USDT:", USDT);
    console.log("sNGN:", sNGN);
    console.log("Market:", MARKET);

    console.log("\n=== Current State ===");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    if (vaultBalance.eq(0)) {
        console.log("❌ No USDT in vault. Need to transfer first.");
        return;
    }

    console.log("\n=== Creating New Deposit ===");
    console.log("Using USDT already in vault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Create deposit with nested structure and 0 executionFee
    const createDepositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // CRITICAL: Must be 0
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\nDeposit parameters:");
    console.log("- Market:", MARKET);
    console.log("- Initial long token:", USDT);
    console.log("- Initial short token:", USDT);
    console.log("- Execution fee: 0 (CRITICAL)");
    console.log("- Callback gas limit: 0");

    try {
        // Since USDT is already in vault, we send 0 value
        console.log("\nCreating deposit...");
        const tx = await exchangeRouter.createDeposit(createDepositParams, { value: 0 });
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed!");

        // Extract deposit key from logs
        let depositKey;

        // Try to find the deposit key in the logs
        for (const log of receipt.logs) {
            // Check if this is from ExchangeRouter or related contract
            if (log.topics.length > 1) {
                // The deposit key is often the first indexed parameter (topics[1])
                depositKey = log.topics[1];
                console.log("Found potential deposit key:", depositKey);
                break;
            }
        }

        if (!depositKey) {
            console.log("⚠️ Could not automatically extract deposit key");
            console.log("Please check transaction:", receipt.transactionHash);
            console.log("You may need to manually find the deposit key from the logs");
            return;
        }

        console.log("\n✅ Deposit created successfully!");
        console.log("Deposit key:", depositKey);

        // Save deposit key to file
        const fs = require('fs');
        fs.writeFileSync('new-deposit-key.txt', depositKey);
        console.log("Deposit key saved to new-deposit-key.txt");

        // Wait a bit for chain to process
        console.log("\nWaiting 3 seconds before execution...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log("\n=== Setting Oracle Prices ===");
        await oracle.clearAllPrices();

        // Set USDT price
        const usdtPrice = {
            min: ethers.utils.parseUnits("1", 30),
            max: ethers.utils.parseUnits("1", 30)
        };
        await oracle.setPrimaryPrice(USDT, usdtPrice);
        console.log("✅ USDT price set to $1.00");

        // Set sNGN price - try with USD price first (1/1500)
        const sNgnPrice = {
            min: ethers.utils.parseUnits("0.000667", 30),
            max: ethers.utils.parseUnits("0.000667", 30)
        };
        await oracle.setPrimaryPrice(sNGN, sNgnPrice);
        console.log("✅ sNGN price set to $0.000667 (1/1500 USD)");

        console.log("\n=== Executing Deposit ===");

        const oracleParams = {
            signerInfo: 0,
            tokens: [USDT, sNGN],
            providers: [ORACLE, ORACLE],
            data: []
        };

        console.log("Executing deposit with key:", depositKey);
        const execTx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 10000000 }
        );

        console.log("Execution transaction sent:", execTx.hash);
        const execReceipt = await execTx.wait();

        console.log("\n✅ DEPOSIT EXECUTED SUCCESSFULLY!");
        console.log("Gas used:", execReceipt.gasUsed.toString());

        // Check results
        const marketToken = await ethers.getContractAt("IERC20", MARKET);
        const gmBalance = await marketToken.balanceOf(signer.address);
        console.log("\n=== Results ===");
        console.log("Your GM token balance:", ethers.utils.formatEther(gmBalance), "GM");

        const poolAmountKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "address", "bytes32"],
                [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
            )
        );
        const poolAmount = await dataStore.getUint(poolAmountKey);
        console.log("Pool USDT amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

        console.log("\n🎉 First deposit successful! The USDTNGN market is now initialized.");

    } catch (error) {
        console.log("\n❌ Error:", error.message);

        if (error.data) {
            const selector = error.data.slice(0, 10);
            console.log("Error selector:", selector);

            const errorMessages = {
                "0xf9996e9f": "InvalidPoolValueForDeposit",
                "0x5e7b1938": "Unauthorized",
                "0x7c946ed7": "EmptyDeposit"
            };

            if (errorMessages[selector]) {
                console.log("Error type:", errorMessages[selector]);

                if (selector === "0xf9996e9f") {
                    console.log("\nPool value is still negative. Checking diagnostics...");

                    // Check impact pools
                    const impactPoolAmountKey = ethers.utils.keccak256(
                        ethers.utils.solidityPack(
                            ["bytes32", "address"],
                            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_IMPACT_POOL_AMOUNT")), MARKET]
                        )
                    );
                    const impactPoolAmount = await dataStore.getUint(impactPoolAmountKey);
                    console.log("Position impact pool:", impactPoolAmount.toString());

                    if (impactPoolAmount.gt(0)) {
                        console.log("⚠️ Impact pool is non-zero! This needs to be reset.");
                    }
                }
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });