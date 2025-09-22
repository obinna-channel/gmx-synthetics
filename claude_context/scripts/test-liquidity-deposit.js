const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING LIQUIDITY DEPOSIT (NO KEEPER) ===\n");

    // Contract addresses from deployments folder
    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",  // New USDTNGN market created via MarketFactory
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",  // Correct Router from deployments
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };

    const [deployer] = await ethers.getSigners();
    console.log("Depositor address:", deployer.address);

    // Get contract instances
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const market = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.MARKET);
    const depositHandler = await ethers.getContractAt("DepositHandler", ADDRESSES.DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);

    // Deposit amount
    const DEPOSIT_AMOUNT = ethers.utils.parseUnits("100", 6); // 100 USDT (6 decimals)

    console.log("\n=== STEP 1: CHECK INITIAL BALANCES ===");

    const initialUSDT = await usdt.balanceOf(deployer.address);
    const initialGM = await market.balanceOf(deployer.address);

    console.log("USDT Balance:", ethers.utils.formatUnits(initialUSDT, 6), "USDT");
    console.log("GM Token Balance:", ethers.utils.formatUnits(initialGM, 18), "GM");

    if (initialUSDT.lt(DEPOSIT_AMOUNT)) {
        console.log("\n❌ Insufficient USDT balance!");
        return;
    }

    console.log("\n=== STEP 2: APPROVE USDT SPENDING ===");

    // Check current allowance for Router (not ExchangeRouter!)
    const currentAllowance = await usdt.allowance(deployer.address, ADDRESSES.ROUTER);
    console.log("Current allowance for Router:", ethers.utils.formatUnits(currentAllowance, 6), "USDT");

    if (currentAllowance.lt(DEPOSIT_AMOUNT)) {
        console.log("Approving Router to spend USDT...");
        const approveTx = await usdt.approve(ADDRESSES.ROUTER, DEPOSIT_AMOUNT);
        await approveTx.wait();
        console.log("✓ Approved!");
    } else {
        console.log("✓ Sufficient allowance already exists");
    }

    console.log("\n=== STEP 3: SET ORACLE PRICES ===");

    // For deposit execution, we need prices set in the Oracle
    // Clear and set fresh price
    try {
        console.log("Clearing old prices...");
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();

        console.log("Setting fresh NGN price...");
        const ngnPrice = ethers.utils.parseUnits("1650", 30); // 1650 NGN per USDT
        const setPriceTx = await oracle.setPrimaryPrice(ADDRESSES.sNGN, {
            min: ngnPrice,
            max: ngnPrice
        });
        await setPriceTx.wait();
        console.log("✓ Price set: 1650 NGN per USDT");
    } catch (e) {
        console.log("Warning: Could not update oracle prices:", e.message);
    }

    console.log("\n=== STEP 4: CREATE DEPOSIT ===");

    // Prepare deposit parameters - structured as arrays for the contract
    const depositParams = {
        addresses: {
            receiver: deployer.address,           // Who receives GM tokens
            callbackContract: ethers.constants.AddressZero, // No callback
            uiFeeReceiver: ethers.constants.AddressZero,    // No UI fee
            market: ADDRESSES.MARKET,             // Target market
            initialLongToken: ADDRESSES.USDT,     // Depositing USDT
            initialShortToken: ethers.constants.AddressZero, // Not depositing short token
            longTokenSwapPath: [],                // No swap needed
            shortTokenSwapPath: []                // No swap needed
        },
        minMarketTokens: 0,                      // Accept any amount (for testing)
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"), // Small execution fee
        callbackGasLimit: 0,
        dataList: []                              // Empty data list
    };

    try {
        console.log("Creating deposit...");
        console.log("  Amount: 100 USDT");
        console.log("  Market:", ADDRESSES.MARKET);
        console.log("  Execution fee: 0.001 ETH");

        // First, we need to send USDT to the DepositVault using ExchangeRouter.sendTokens
        console.log("\nSending USDT to DepositVault...");

        // Use sendTokens from ExchangeRouter (inherited from BaseRouter)
        const sendTokensTx = await exchangeRouter.sendTokens(
            ADDRESSES.USDT,
            ADDRESSES.DEPOSIT_VAULT,
            DEPOSIT_AMOUNT
        );
        await sendTokensTx.wait();
        console.log("✓ USDT sent to DepositVault");

        // Create the deposit
        const createDepositTx = await exchangeRouter.createDeposit(
            depositParams,
            { value: ethers.utils.parseEther("0.001") }
        );

        const receipt = await createDepositTx.wait();
        console.log("✓ Deposit created! Tx:", receipt.transactionHash);

        // Get deposit key from events
        const depositCreatedEvent = receipt.events?.find(e => e.event === "DepositCreated");
        const depositKey = depositCreatedEvent?.args?.key;
        console.log("  Deposit Key:", depositKey || "Could not find key");

        console.log("\n=== STEP 5: EXECUTE DEPOSIT (BYPASS KEEPER) ===");

        if (depositKey) {
            console.log("Attempting to execute deposit directly...");

            // Try to execute the deposit ourselves
            try {
                // We need to provide oracle prices for execution
                const oracleParams = {
                    signerInfo: 0,  // No signers for testing
                    tokens: [ADDRESSES.sNGN],
                    providers: [ethers.constants.AddressZero],
                    data: []
                };

                // This might fail if we don't have KEEPER role
                const executeTx = await depositHandler.executeDeposit(
                    depositKey,
                    oracleParams
                );

                const execReceipt = await executeTx.wait();
                console.log("✓ Deposit executed! Gas used:", execReceipt.gasUsed.toString());

            } catch (e) {
                console.log("❌ Could not execute deposit directly:", e.reason || e.message);
                console.log("\nThis is expected if we don't have KEEPER role.");
                console.log("The deposit is created and waiting for a keeper to execute it.");

                // Check deposit status
                const depositStore = await ethers.getContractAt("DepositStore", ADDRESSES.DATA_STORE);
                console.log("\nDeposit is stored and waiting for execution.");
                console.log("To execute: Need ORDER_KEEPER or FROZEN_ORDER_KEEPER role");
            }
        }

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.reason || error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }

    console.log("\n=== STEP 6: CHECK FINAL BALANCES ===");

    const finalUSDT = await usdt.balanceOf(deployer.address);
    const finalGM = await market.balanceOf(deployer.address);

    console.log("USDT Balance:", ethers.utils.formatUnits(finalUSDT, 6), "USDT");
    console.log("GM Token Balance:", ethers.utils.formatUnits(finalGM, 18), "GM");

    const usdtChange = finalUSDT.sub(initialUSDT);
    const gmChange = finalGM.sub(initialGM);

    console.log("\nChanges:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtChange, 6), "USDT");
    console.log("  GM Tokens:", ethers.utils.formatUnits(gmChange, 18), "GM");

    console.log("\n=== SUMMARY ===");
    if (gmChange.gt(0)) {
        console.log("✅ Deposit successful! You received GM tokens.");
    } else {
        console.log("⏳ Deposit created but needs keeper execution.");
        console.log("   Run a deposit keeper or grant ORDER_KEEPER role to execute.");
    }
}

main().catch(console.error);