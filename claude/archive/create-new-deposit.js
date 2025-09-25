const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating New Deposit ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Step 1: Check USDT balance
    console.log("Step 1: Checking USDT balance...");
    const balance = await usdt.balanceOf(signer.address);
    console.log("  Your USDT balance:", ethers.utils.formatUnits(balance, 6), "USDT");

    // Step 2: Transfer USDT to DepositVault
    console.log("\nStep 2: Transferring 100 USDT to DepositVault...");
    const depositAmount = ethers.utils.parseUnits("100", 6);

    try {
        const vaultBalanceBefore = await usdt.balanceOf(DEPOSIT_VAULT);
        console.log("  DepositVault balance before:", ethers.utils.formatUnits(vaultBalanceBefore, 6), "USDT");

        const transferTx = await usdt.transfer(DEPOSIT_VAULT, depositAmount);
        console.log("  Transfer tx:", transferTx.hash);
        await transferTx.wait();

        const vaultBalanceAfter = await usdt.balanceOf(DEPOSIT_VAULT);
        console.log("  DepositVault balance after:", ethers.utils.formatUnits(vaultBalanceAfter, 6), "USDT");
        console.log("  ✅ Transfer complete");
    } catch (error) {
        console.log("  ❌ Transfer failed:", error.message);
        return;
    }

    // Step 3: Create deposit parameters
    console.log("\nStep 3: Creating deposit parameters...");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT, // Single-token market
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0, // 0 to bypass fee validation
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("  Parameters:");
    console.log("    Market:", MARKET);
    console.log("    Receiver:", depositParams.addresses.receiver, "(address(1))");
    console.log("    Long Token (USDT):", USDT);
    console.log("    Short Token (USDT):", USDT);
    console.log("    Amount:", ethers.utils.formatUnits(depositAmount, 6), "USDT");
    console.log("    Execution Fee:", depositParams.executionFee, "(bypassed)");

    // Step 4: Create the deposit
    console.log("\nStep 4: Creating deposit on ExchangeRouter...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("\n🚀 Transaction sent:", depositTx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await depositTx.wait();
        console.log("\n✅ Deposit created successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Extract deposit key from events
        console.log("\n📝 Looking for deposit key in events...");

        if (receipt.events && receipt.events.length > 0) {
            for (const event of receipt.events) {
                if (event.topics && event.topics.length >= 3) {
                    // The deposit key is usually in topics[2] or topics[3]
                    console.log("  Potential deposit key:", event.topics[2]);
                    break;
                }
            }
        }

        // Get deposit count to verify
        const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

        const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
        );

        const accountKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ACCOUNT_DEPOSIT_LIST, signer.address]
            )
        );

        const depositCount = await dataStore.getBytes32Count(accountKey);
        console.log("\n  Your total deposits:", depositCount.toString());

        if (depositCount.gt(0)) {
            const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
            const latestDepositKey = depositKeys[depositKeys.length - 1];
            console.log("\n🔑 NEW DEPOSIT KEY:", latestDepositKey);
            console.log("\n📋 Save this key for execution!");
        }

        console.log("\n=== DEPOSIT CREATION COMPLETE ===");
        console.log("✅ Deposit has been created and is waiting for execution");
        console.log("⏳ The deposit has 1 hour to be executed (REQUEST_EXPIRATION_TIME)");
        console.log("\n⚠️  DO NOT EXECUTE YET - Waiting for your signal");

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);
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