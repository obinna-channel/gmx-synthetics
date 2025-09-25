const { ethers } = require("hardhat");

async function main() {
    console.log("=== COMPLETE DEPOSIT FLOW - CREATE AND EXECUTE ===\n");

    // ALL ADDRESSES FROM DEPLOYMENTS FOLDER
    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        ROLE_STORE: "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C"
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const depositHandler = await ethers.getContractAt("DepositHandler", ADDRESSES.DEPOSIT_HANDLER);
    const roleStore = await ethers.getContractAt("RoleStore", ADDRESSES.ROLE_STORE);
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);

    // ========================================
    // STEP 1: ENSURE WE HAVE ORDER_KEEPER ROLE
    // ========================================
    console.log("\n=== STEP 1: CHECK/GRANT KEEPER ROLE ===");
    const ORDER_KEEPER = ethers.utils.id("ORDER_KEEPER");
    const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);

    if (!hasKeeperRole) {
        console.log("Granting ORDER_KEEPER role...");
        const grantTx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
        await grantTx.wait();
        console.log("✓ ORDER_KEEPER role granted");
    } else {
        console.log("✓ Already have ORDER_KEEPER role");
    }

    // ========================================
    // STEP 2: TRANSFER FRESH USDT TO DEPOSIT VAULT
    // ========================================
    console.log("\n=== STEP 2: TRANSFER USDT TO VAULT ===");
    const depositAmount = ethers.utils.parseUnits("50", 6); // 50 USDT

    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6), "USDT");

    console.log("Transferring 50 USDT to DepositVault...");
    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, depositAmount);
    await transferTx.wait();
    console.log("✓ Transferred");

    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault now has:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // ========================================
    // STEP 3: CREATE DEPOSIT WITH 0 EXECUTION FEE
    // ========================================
    console.log("\n=== STEP 3: CREATE DEPOSIT ===");

    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,  // Both long and short are USDT
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // ZERO FEE - this is the key!
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Creating deposit with 0 execution fee...");
    const createTx = await exchangeRouter.createDeposit(
        depositParams,
        { gasLimit: 1000000 }
    );

    console.log("Transaction sent:", createTx.hash);
    const createReceipt = await createTx.wait();
    console.log("✓ Deposit created!");
    console.log("Gas used:", createReceipt.gasUsed.toString());

    // Find the deposit key from events
    let depositKey;
    for (const log of createReceipt.logs) {
        // Look for EventLog2 events
        const eventLog2Topic = ethers.utils.id("EventLog2(address,address,string,bytes32,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))");

        if (log.topics[0] === eventLog2Topic) {
            const depositCreatedHash = ethers.utils.id("DepositCreated");
            if (log.topics[2] === depositCreatedHash) {
                // The deposit key is the first topic after the event signature
                depositKey = log.topics[1];
                console.log("Deposit key found:", depositKey);
                break;
            }
        }
    }

    if (!depositKey) {
        console.log("⚠️  Could not find deposit key in events, checking store...");
        // Try to get it from the data store
        // The deposit key would be the hash of the nonce
        // We'll need to execute by trying recent keys
    }

    // ========================================
    // STEP 4: SET ORACLE PRICES
    // ========================================
    console.log("\n=== STEP 4: SET ORACLE PRICES ===");

    // Clear any old prices
    await oracle.clearAllPrices();
    console.log("✓ Cleared old prices");

    // Set USDT price ($1)
    const usdtPrice = ethers.utils.parseUnits("1", 30);
    await oracle.setPrimaryPrice(ADDRESSES.USDT, {
        min: usdtPrice,
        max: usdtPrice
    });
    console.log("✓ Set USDT price: $1");

    // Set sNGN price (1 NGN = 0.000606 USD, based on 1650 NGN/USD rate)
    const ngnPrice = ethers.utils.parseUnits("0.000606", 30);
    await oracle.setPrimaryPrice(ADDRESSES.sNGN, {
        min: ngnPrice,
        max: ngnPrice
    });
    console.log("✓ Set sNGN price: 1650 NGN per USD");

    // ========================================
    // STEP 5: EXECUTE THE DEPOSIT
    // ========================================
    console.log("\n=== STEP 5: EXECUTE DEPOSIT ===");

    if (!depositKey) {
        // If we couldn't find the key, we need to try to find it another way
        console.log("⚠️  No deposit key found, cannot execute");
        console.log("Please check the transaction logs manually");
        return;
    }

    // Build oracle params (minimal since we set prices directly)
    const oracleParams = {
        signerInfo: 0,
        tokens: [ADDRESSES.USDT, ADDRESSES.sNGN],
        providers: [ADDRESSES.ORACLE, ADDRESSES.ORACLE],
        data: []
    };

    console.log("Executing deposit with key:", depositKey);
    try {
        const executeTx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 5000000 }
        );

        console.log("Transaction sent:", executeTx.hash);
        const executeReceipt = await executeTx.wait();

        console.log("✓ Deposit executed!");
        console.log("Gas used:", executeReceipt.gasUsed.toString());

        // Check GM token balance
        const marketToken = await ethers.getContractAt("MarketToken", ADDRESSES.MARKET);
        const gmBalance = await marketToken.balanceOf(signer.address);
        console.log("\n🎉 SUCCESS! Your GM token balance:", ethers.utils.formatUnits(gmBalance, 18), "GM");

    } catch (error) {
        console.log("\n❌ Execution failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }

    // ========================================
    // FINAL STATUS
    // ========================================
    console.log("\n=== FINAL STATUS ===");
    const finalUsdtBalance = await usdt.balanceOf(signer.address);
    const marketToken = await ethers.getContractAt("MarketToken", ADDRESSES.MARKET);
    const finalGmBalance = await marketToken.balanceOf(signer.address);

    console.log("Your USDT balance:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
    console.log("Your GM token balance:", ethers.utils.formatUnits(finalGmBalance, 18), "GM");
    console.log("\nIf you have GM tokens, the deposit was successful!");
}

main().catch(console.error);