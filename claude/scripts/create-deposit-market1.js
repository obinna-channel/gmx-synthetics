const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit for Market 1 (USDT-sNGN) ===\n");
    console.log("Signer address:", signer.address);

    // TOKEN FLOW EXPLANATION:
    // 1. User approves Router (the actual token handler)
    // 2. ExchangeRouter.sendTokens orchestrates the transfer
    // 3. Router pulls tokens from user and sends to DepositVault
    // 4. ExchangeRouter.createDeposit creates the deposit

    // Deployment addresses from latest deployment
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc"; // Router (not ExchangeRouter!)
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D"; // Market 1: sNGN [USDT-sNGN]
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("Contract addresses:");
    console.log("  Router:", ROUTER);
    console.log("  ExchangeRouter:", EXCHANGE_ROUTER);
    console.log("  DepositVault:", DEPOSIT_VAULT);
    console.log("  Market 1:", MARKET);
    console.log("  USDT (long token):", USDT);
    console.log("  sNGN (short token):", sNGN);

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const router = await ethers.getContractAt("Router", ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Deposit configuration
    const DEPOSIT_MODE = "dual"; // "single" for USDT-only, "dual" for USDT+sNGN
    const usdtAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
    const sngnAmount = ethers.utils.parseUnits("1500", 18); // 1500 sNGN (if dual mode)

    console.log("\n📊 Deposit Configuration:");
    console.log("  Mode:", DEPOSIT_MODE);
    console.log("  USDT amount:", ethers.utils.formatUnits(usdtAmount, 6));
    if (DEPOSIT_MODE === "dual") {
        console.log("  sNGN amount:", ethers.utils.formatUnits(sngnAmount, 18));
    }

    // Check balances
    const usdtBalance = await usdt.balanceOf(signer.address);
    const sngnBalance = await sngn.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnBalance, 18));

    // Validate balances
    if (usdtBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT balance");
        return;
    }
    if (DEPOSIT_MODE === "dual" && sngnBalance.lt(sngnAmount)) {
        console.log("❌ Insufficient sNGN balance");
        return;
    }

    // Step 1: Approve Router (NOT ExchangeRouter!)
    console.log("\n📍 STEP 1: Approve Router to spend tokens");
    console.log("  IMPORTANT: Approving Router, not ExchangeRouter!");

    // Check and approve USDT
    const usdtAllowance = await usdt.allowance(signer.address, ROUTER);
    console.log("  Current USDT allowance to Router:", ethers.utils.formatUnits(usdtAllowance, 6));

    if (usdtAllowance.lt(usdtAmount)) {
        console.log("  Approving Router for USDT...");
        const approveTx = await usdt.approve(ROUTER, usdtAmount);
        await approveTx.wait();
        console.log("  ✅ Router approved for USDT");
    } else {
        console.log("  ✅ Router already has USDT approval");
    }

    // Check and approve sNGN if dual mode
    if (DEPOSIT_MODE === "dual") {
        const sngnAllowance = await sngn.allowance(signer.address, ROUTER);
        console.log("  Current sNGN allowance to Router:", ethers.utils.formatUnits(sngnAllowance, 18));

        if (sngnAllowance.lt(sngnAmount)) {
            console.log("  Approving Router for sNGN...");
            const approveTx = await sngn.approve(ROUTER, sngnAmount);
            await approveTx.wait();
            console.log("  ✅ Router approved for sNGN");
        } else {
            console.log("  ✅ Router already has sNGN approval");
        }
    }

    // Step 2: Transfer tokens to DepositVault using ExchangeRouter.sendTokens
    console.log("\n📍 STEP 2: Transfer tokens to DepositVault");
    console.log("  Using ExchangeRouter.sendTokens (which calls Router internally)");

    // Build multicall data for ExchangeRouter
    const multicallData = [];

    // Add USDT transfer
    const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        usdtAmount
    ]);
    multicallData.push(sendUsdtData);
    console.log("  ✅ Prepared USDT transfer");

    // Add sNGN transfer if dual mode
    if (DEPOSIT_MODE === "dual") {
        const sendSngnData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
            sNGN,
            DEPOSIT_VAULT,
            sngnAmount
        ]);
        multicallData.push(sendSngnData);
        console.log("  ✅ Prepared sNGN transfer");
    }

    // Execute transfers via ExchangeRouter multicall
    console.log("\n  Transferring tokens to DepositVault...");
    const transferTx = await exchangeRouter.multicall(multicallData, { gasLimit: 500000 });
    console.log("  Transfer tx:", transferTx.hash);
    await transferTx.wait();
    console.log("  ✅ Tokens transferred to DepositVault");

    // Verify vault balances
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    console.log("\n  DepositVault balances:");
    console.log("    USDT:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("    sNGN:", ethers.utils.formatUnits(vaultSngnBalance, 18));

    // Step 3: Create deposit (separate transaction after tokens are in vault)
    console.log("\n📍 STEP 3: Create deposit");
    console.log("  Note: Could also combine Steps 2 & 3 in a single multicall for atomicity");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN, // Market 1 uses sNGN as short token
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0, // 0 for first deposit
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n  Deposit parameters:");
    console.log("    Market:", MARKET);
    console.log("    Receiver:", depositParams.addresses.receiver, "(address(1) for first deposit)");
    console.log("    Long token:", USDT);
    console.log("    Short token:", sNGN);
    console.log("    Execution fee:", depositParams.executionFee, "(0 for first deposit)");

    try {
        console.log("\n  Creating deposit...");
        const createDepositTx = await exchangeRouter.createDeposit(depositParams, { gasLimit: 2500000 });
        console.log("  Transaction sent:", createDepositTx.hash);

        const receipt = await createDepositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check for events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\n  Events emitted:");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log("    -", event.event);

                    // Look for DepositCreated event
                    if (event.event === "DepositCreated" && event.args) {
                        const depositKey = event.args.key || event.args[0];
                        console.log("      Deposit Key:", depositKey);

                        // Save deposit key
                        const fs = require("fs");
                        fs.writeFileSync("deposit-key.txt", depositKey);
                        console.log("      (Saved to deposit-key.txt)");
                    }
                }
            }
        }

        console.log("\n✅ SUCCESS! Deposit created!");
        console.log("📝 Transaction hash:", createDepositTx.hash);
        console.log("📊 View on Arbiscan: https://sepolia.arbiscan.io/tx/" + createDepositTx.hash);

        // Note about execution
        console.log("\n📌 Next Steps:");
        console.log("  1. The deposit is now pending execution");
        console.log("  2. A keeper needs to execute it with oracle prices");
        console.log("  3. Or you can manually execute it using the execute-deposit script");

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);

        if (error.error && error.error.data) {
            console.log("Revert data:", error.error.data);

            try {
                const errorInterface = new ethers.utils.Interface([
                    "error Unauthorized(address,string)",
                    "error InsufficientExecutionFee(uint256,uint256)",
                    "error EmptyDepositAmounts()",
                    "error InsufficientAllowance()",
                    "error EmptyMarket(address)",
                    "error DisabledMarket(address)"
                ]);
                const decoded = errorInterface.parseError(error.error.data);
                console.log("\nDecoded error:", decoded.name);
                if (decoded.args) {
                    console.log("Error args:", decoded.args.toString());
                }
            } catch (e) {
                console.log("Could not decode error");
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Fatal error:", error);
        process.exit(1);
    });