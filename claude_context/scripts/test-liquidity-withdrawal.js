const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING LIQUIDITY WITHDRAWAL (NO KEEPER) ===\n");

    // Contract addresses
    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        WITHDRAWAL_HANDLER: "0xf5190441f0021b1782fca1E5213Eb9b0520A31b5",
        WITHDRAWAL_VAULT: "0xF7cF74E15eD502EDFE0381078cE2E4F9aC3F6C66",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };

    const [deployer] = await ethers.getSigners();
    console.log("Withdrawer address:", deployer.address);

    // Get contract instances
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const market = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.MARKET);
    const withdrawalHandler = await ethers.getContractAt("WithdrawalHandler", ADDRESSES.WITHDRAWAL_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);

    console.log("\n=== STEP 1: CHECK INITIAL BALANCES ===");

    const initialUSDT = await usdt.balanceOf(deployer.address);
    const initialGM = await market.balanceOf(deployer.address);

    console.log("USDT Balance:", ethers.utils.formatUnits(initialUSDT, 6), "USDT");
    console.log("GM Token Balance:", ethers.utils.formatUnits(initialGM, 18), "GM");

    if (initialGM.eq(0)) {
        console.log("\n❌ No GM tokens to withdraw!");
        console.log("   Please run the deposit script first to get GM tokens.");
        return;
    }

    // Withdraw half of GM tokens (or all if you prefer)
    const WITHDRAWAL_AMOUNT = initialGM.div(2); // Withdraw 50% of GM tokens
    console.log("\nPlanning to withdraw:", ethers.utils.formatUnits(WITHDRAWAL_AMOUNT, 18), "GM tokens");

    console.log("\n=== STEP 2: APPROVE GM TOKEN SPENDING ===");

    // Check current allowance for GM tokens
    const currentAllowance = await market.allowance(deployer.address, ADDRESSES.EXCHANGE_ROUTER);
    console.log("Current GM allowance:", ethers.utils.formatUnits(currentAllowance, 18), "GM");

    if (currentAllowance.lt(WITHDRAWAL_AMOUNT)) {
        console.log("Approving ExchangeRouter to spend GM tokens...");
        const approveTx = await market.approve(ADDRESSES.EXCHANGE_ROUTER, WITHDRAWAL_AMOUNT);
        await approveTx.wait();
        console.log("✓ Approved!");
    } else {
        console.log("✓ Sufficient allowance already exists");
    }

    console.log("\n=== STEP 3: SET ORACLE PRICES ===");

    // For withdrawal execution, we need prices set in the Oracle
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

    console.log("\n=== STEP 4: CREATE WITHDRAWAL ===");

    // Prepare withdrawal parameters
    const withdrawalParams = {
        addresses: {
            receiver: deployer.address,              // Who receives USDT
            callbackContract: ethers.constants.AddressZero, // No callback
            uiFeeReceiver: ethers.constants.AddressZero,    // No UI fee
            market: ADDRESSES.MARKET,                // Market to withdraw from
            longTokenSwapPath: [],                   // No swap needed
            shortTokenSwapPath: []                   // No swap needed
        },
        minLongTokenAmount: 0,                      // Accept any amount (for testing)
        minShortTokenAmount: 0,                     // Accept any amount
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"), // Small execution fee
        callbackGasLimit: 0
    };

    try {
        console.log("Creating withdrawal...");
        console.log("  GM Tokens:", ethers.utils.formatUnits(WITHDRAWAL_AMOUNT, 18));
        console.log("  Market:", ADDRESSES.MARKET);
        console.log("  Execution fee: 0.001 ETH");

        // Transfer GM tokens to ExchangeRouter first
        console.log("\nTransferring GM tokens to ExchangeRouter...");
        const transferTx = await market.transfer(ADDRESSES.EXCHANGE_ROUTER, WITHDRAWAL_AMOUNT);
        await transferTx.wait();
        console.log("✓ GM tokens transferred");

        // Create the withdrawal
        const createWithdrawalTx = await exchangeRouter.createWithdrawal(
            withdrawalParams,
            { value: ethers.utils.parseEther("0.001") }
        );

        const receipt = await createWithdrawalTx.wait();
        console.log("✓ Withdrawal created! Tx:", receipt.transactionHash);

        // Get withdrawal key from events
        const withdrawalCreatedEvent = receipt.events?.find(e => e.event === "WithdrawalCreated");
        const withdrawalKey = withdrawalCreatedEvent?.args?.key;
        console.log("  Withdrawal Key:", withdrawalKey || "Could not find key");

        console.log("\n=== STEP 5: EXECUTE WITHDRAWAL (BYPASS KEEPER) ===");

        if (withdrawalKey) {
            console.log("Attempting to execute withdrawal directly...");

            try {
                // We need to provide oracle prices for execution
                const oracleParams = {
                    signerInfo: 0,  // No signers for testing
                    tokens: [ADDRESSES.sNGN],
                    providers: [ethers.constants.AddressZero],
                    data: []
                };

                // This might fail if we don't have KEEPER role
                const executeTx = await withdrawalHandler.executeWithdrawal(
                    withdrawalKey,
                    oracleParams
                );

                const execReceipt = await executeTx.wait();
                console.log("✓ Withdrawal executed! Gas used:", execReceipt.gasUsed.toString());

            } catch (e) {
                console.log("❌ Could not execute withdrawal directly:", e.reason || e.message);
                console.log("\nThis is expected if we don't have KEEPER role.");
                console.log("The withdrawal is created and waiting for a keeper to execute it.");
                console.log("To execute: Need ORDER_KEEPER or FROZEN_ORDER_KEEPER role");
            }
        }

    } catch (error) {
        console.log("\n❌ Error creating withdrawal:", error.reason || error.message);
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
    const gmChange = initialGM.sub(finalGM);

    console.log("\nChanges:");
    console.log("  USDT received:", ethers.utils.formatUnits(usdtChange, 6), "USDT");
    console.log("  GM Tokens burned:", ethers.utils.formatUnits(gmChange, 18), "GM");

    console.log("\n=== SUMMARY ===");
    if (usdtChange.gt(0)) {
        console.log("✅ Withdrawal successful! You received USDT back.");
    } else {
        console.log("⏳ Withdrawal created but needs keeper execution.");
        console.log("   Run a withdrawal keeper or grant ORDER_KEEPER role to execute.");
    }
}

main().catch(console.error);