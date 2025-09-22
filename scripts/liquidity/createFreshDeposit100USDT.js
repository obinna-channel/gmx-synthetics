const { ethers } = require("hardhat");

async function main() {
    console.log("=== FRESH DEPOSIT CREATION - 100 USDT ===\n");

    // EXACT ADDRESSES FROM THE SUCCESSFUL ATTEMPT (from deployments)
    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        ROLE_STORE: "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778"
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    // ========================================
    // CHECK CURRENT BALANCES
    // ========================================
    console.log("\n=== CURRENT STATE ===");
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6), "USDT");

    const vaultBalanceBefore = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault balance (before):", ethers.utils.formatUnits(vaultBalanceBefore, 6), "USDT");

    const depositAmount = ethers.utils.parseUnits("100", 6); // 100 USDT

    if (userBalance.lt(depositAmount)) {
        console.log("❌ Insufficient USDT balance. Need 100 USDT");
        return;
    }

    // ========================================
    // STEP 1: SIMULATE DEPOSIT CREATION
    // ========================================
    console.log("\n=== STEP 1: SIMULATE DEPOSIT CREATION ===");

    // Build deposit params EXACTLY as in the successful attempt
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,  // BOTH must be USDT, not AddressZero!
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // MUST BE ZERO - this was the key discovery!
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Deposit parameters:");
    console.log("- Market:", ADDRESSES.MARKET);
    console.log("- Initial long token:", ADDRESSES.USDT);
    console.log("- Initial short token:", ADDRESSES.USDT, "(NOT AddressZero!)");
    console.log("- Execution fee:", 0, "(MUST BE ZERO!)");

    // First, simulate with static call
    console.log("\nSimulating with static call...");
    try {
        // Note: We simulate WITHOUT transferring first - the router will handle it
        const simulatedResult = await exchangeRouter.callStatic.createDeposit(
            depositParams,
            { value: 0 }  // No ETH sent
        );
        console.log("✅ Simulation successful!");
        console.log("Simulated deposit key:", simulatedResult);
    } catch (error) {
        console.log("❌ Simulation failed:", error.message);

        if (error.data) {
            console.log("Error data:", error.data);

            // Decode common errors
            const errorSelectors = {
                "0x7c946ed7": "EmptyDepositAmounts",
                "0x5e7b1938": "Unauthorized",
                "0x01af8c24": "Unknown error (check contract)"
            };

            const selector = error.data.slice(0, 10);
            if (errorSelectors[selector]) {
                console.log("Error type:", errorSelectors[selector]);
            }
        }

        console.log("\n⚠️ Simulation failed. Not proceeding with actual transaction.");
        return;
    }

    // ========================================
    // STEP 2: TRANSFER USDT TO DEPOSIT VAULT
    // ========================================
    console.log("\n=== STEP 2: TRANSFER USDT TO VAULT ===");

    console.log("Transferring 100 USDT to DepositVault...");
    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, depositAmount);
    console.log("Transfer tx sent:", transferTx.hash);
    await transferTx.wait();
    console.log("✅ Transferred 100 USDT");

    const vaultBalanceAfter = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault balance (after):", ethers.utils.formatUnits(vaultBalanceAfter, 6), "USDT");

    // ========================================
    // STEP 3: CREATE DEPOSIT
    // ========================================
    console.log("\n=== STEP 3: CREATE DEPOSIT ===");

    console.log("Creating deposit with 0 execution fee...");
    const createTx = await exchangeRouter.createDeposit(
        depositParams,
        {
            value: 0,  // NO ETH - execution fee is 0
            gasLimit: 1000000
        }
    );

    console.log("Transaction sent:", createTx.hash);
    const createReceipt = await createTx.wait();

    console.log("✅ DEPOSIT CREATED SUCCESSFULLY!");
    console.log("Block number:", createReceipt.blockNumber);
    console.log("Gas used:", createReceipt.gasUsed.toString());

    // ========================================
    // STEP 4: EXTRACT DEPOSIT KEY
    // ========================================
    console.log("\n=== STEP 4: EXTRACT DEPOSIT KEY ===");

    let depositKey;

    // Method from successful attempt: Look for EventLog2 with DepositCreated
    const eventLog2Topic = ethers.utils.id("EventLog2(address,address,string,bytes32,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))");
    const depositCreatedHash = ethers.utils.id("DepositCreated");

    for (const log of createReceipt.logs) {
        if (log.topics[0] === eventLog2Topic && log.topics[2] === depositCreatedHash) {
            depositKey = log.topics[1];
            console.log("✅ Deposit key found:", depositKey);
            break;
        }
    }

    if (!depositKey) {
        console.log("⚠️ Could not extract deposit key from EventLog2");
        console.log("Trying alternative method...");

        // Try any topic that looks like a key
        for (const log of createReceipt.logs) {
            if (log.topics.length > 1 && log.topics[1].startsWith("0x")) {
                depositKey = log.topics[1];
                console.log("Found potential key:", depositKey);
                break;
            }
        }
    }

    if (depositKey) {
        // Save to file
        const fs = require('fs');
        fs.writeFileSync('fresh-deposit-key-100.txt', depositKey);
        console.log("✅ Deposit key saved to fresh-deposit-key-100.txt");
    } else {
        console.log("❌ Could not find deposit key");
        console.log("Check transaction manually:", createReceipt.transactionHash);
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log("\n=== SUMMARY ===");
    console.log("✅ Successfully created deposit for 100 USDT");
    console.log("Transaction hash:", createReceipt.transactionHash);
    if (depositKey) {
        console.log("Deposit key:", depositKey);
        console.log("\nNext steps:");
        console.log("1. Set oracle prices (USDT = $1, sNGN = $0.000606)");
        console.log("2. Execute deposit using DepositHandler.executeDeposit()");
    }

    const userBalanceAfter = await usdt.balanceOf(signer.address);
    console.log("\nYour remaining USDT:", ethers.utils.formatUnits(userBalanceAfter, 6), "USDT");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });