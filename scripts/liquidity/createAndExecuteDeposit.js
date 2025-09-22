const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== CREATING AND EXECUTING NEW DEPOSIT ===");

    const [signer] = await ethers.getSigners();

    // Contract addresses
    const EXCHANGE_ROUTER = "0xa960D79eb628eaD15e6308b3021FF87Fe7F3D9cA";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Current State ===");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    if (vaultBalance.eq(0)) {
        console.log("❌ No USDT in vault. Need to transfer first.");
        return;
    }

    console.log("\n=== Creating New Deposit ===");
    console.log("Using USDT already in vault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Create deposit with 0 executionFee and 0 callbackGasLimit
    const createDepositParams = {
        receiver: signer.address,
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: MARKET,
        initialLongToken: USDT,
        initialShortToken: USDT,
        longTokenSwapPath: [],
        shortTokenSwapPath: [],
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // CRITICAL: Must be 0
        callbackGasLimit: 0
    };

    console.log("Creating deposit with parameters:");
    console.log("- Market:", MARKET);
    console.log("- Initial long token:", USDT);
    console.log("- Initial short token:", USDT);
    console.log("- Execution fee: 0 (CRITICAL)");
    console.log("- Callback gas limit: 0");

    try {
        // Since USDT is already in vault, we send 0 value
        const tx = await exchangeRouter.createDeposit(createDepositParams, { value: 0 });
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed!");

        // Get the deposit key from events
        const depositCreatedEvent = receipt.events?.find(e => e.event === "DepositCreated");
        let depositKey;

        if (depositCreatedEvent) {
            depositKey = depositCreatedEvent.args.key;
        } else {
            // Parse logs manually if event not decoded
            const eventSignature = ethers.utils.id("DepositCreated(bytes32,(tuple))");
            const log = receipt.logs.find(log => log.topics[0] === eventSignature);
            if (log) {
                depositKey = log.topics[1];
            }
        }

        if (!depositKey) {
            // Try to get from transaction logs
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() === EXCHANGE_ROUTER.toLowerCase()) {
                    // The first topic after event signature is usually the key
                    if (log.topics.length > 1) {
                        depositKey = log.topics[1];
                        break;
                    }
                }
            }
        }

        if (!depositKey) {
            console.log("❌ Could not extract deposit key from transaction");
            console.log("Transaction hash:", receipt.transactionHash);
            return;
        }

        console.log("\n✅ Deposit created successfully!");
        console.log("Deposit key:", depositKey);

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

        // Set sNGN price - try with USD price first
        const sNgnPrice = {
            min: ethers.utils.parseUnits("0.000667", 30),
            max: ethers.utils.parseUnits("0.000667", 30)
        };
        await oracle.setPrimaryPrice(sNGN, sNgnPrice);
        console.log("✅ sNGN price set to $0.000667 (1/1500)");

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

        console.log("\n🎉 First deposit successful! The market is now initialized.");

    } catch (error) {
        console.log("\n❌ Error:", error.message);

        if (error.data) {
            const selector = error.data.slice(0, 10);
            console.log("Error selector:", selector);

            if (selector === "0xf9996e9f") {
                console.log("InvalidPoolValueForDeposit - pool value is still negative");
                console.log("\nThis might be because:");
                console.log("1. Impact pools are non-zero");
                console.log("2. Oracle prices need adjustment");
                console.log("3. Market configuration issues");
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