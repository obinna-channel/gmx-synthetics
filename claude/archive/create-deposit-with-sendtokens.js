const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit Using ExchangeRouter.sendTokens ===\n");
    console.log("Signer address:", signer.address);

    // Correct deployment addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D"; // Market 1: sNGN [USDT-sNGN]
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("Contract addresses:");
    console.log("  ExchangeRouter:", EXCHANGE_ROUTER);
    console.log("  DepositVault:", DEPOSIT_VAULT);
    console.log("  Market 1:", MARKET);
    console.log("  USDT:", USDT);
    console.log("  sNGN:", sNGN);

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    const depositAmount = ethers.utils.parseUnits("1", 6); // 1 USDT

    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("\n💰 Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));

    if (userBalance.lt(depositAmount)) {
        console.log("❌ Insufficient USDT balance");
        return;
    }

    // Step 1: Approve EXCHANGE_ROUTER (not Router!)
    console.log("\n📍 STEP 1: Approve ExchangeRouter to spend USDT");
    console.log("  This time approving ExchangeRouter (not Router)");

    const currentAllowance = await usdt.allowance(signer.address, EXCHANGE_ROUTER);
    console.log("  Current ExchangeRouter allowance:", ethers.utils.formatUnits(currentAllowance, 6), "USDT");

    if (currentAllowance.lt(depositAmount)) {
        console.log("  Approving ExchangeRouter to spend 1 USDT...");
        const approveTx = await usdt.approve(EXCHANGE_ROUTER, depositAmount);
        console.log("  Approval tx:", approveTx.hash);
        await approveTx.wait();
        console.log("  ✅ ExchangeRouter approved for 1 USDT");
    } else {
        console.log("  ✅ ExchangeRouter already has sufficient approval");
    }

    // Step 2: Prepare multicall - sendTokens AND createDeposit in ONE transaction
    console.log("\n📍 STEP 2: Preparing multicall (sendTokens + createDeposit in ONE transaction)");
    console.log("  Following GMX docs: Both operations must be in a single transaction");

    // Check DepositVault balance before
    const vaultBalanceBefore = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault balance BEFORE:", ethers.utils.formatUnits(vaultBalanceBefore, 6), "USDT");

    // Step 3: Build multicall data
    console.log("\n📍 STEP 3: Building multicall data");

    // Encode sendTokens call
    const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        depositAmount
    ]);
    console.log("  ✅ Encoded sendTokens");

    // Prepare deposit parameters
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",  // address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN,  // Market 1 is USDT-sNGN
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    // Encode createDeposit call
    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);
    console.log("  ✅ Encoded createDeposit");

    console.log("\n  Deposit parameters:");
    console.log("    Market:", MARKET);
    console.log("    Receiver:", depositParams.addresses.receiver, "(address(1))");
    console.log("    Long token:", USDT);
    console.log("    Short token:", sNGN, "(Market 1 configuration)");

    // Step 4: Execute multicall
    console.log("\n📍 STEP 4: Executing multicall");
    console.log("  This will atomically:");
    console.log("    1. Send 1 USDT to DepositVault");
    console.log("    2. Create the deposit");

    try {
        const multicallData = [sendTokensData, createDepositData];

        console.log("\n  Calling exchangeRouter.multicall...");
        console.log("  Using gas limit: 2,500,000 (like TypeScript scripts)");
        const tx = await exchangeRouter.multicall(multicallData, { gasLimit: 2500000 });
        console.log("  Transaction sent:", tx.hash);

        const receipt = await tx.wait();
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
        console.log("📝 Transaction hash:", tx.hash);
        console.log("📊 View on Arbiscan: https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);

        if (error.error && error.error.data) {
            console.log("Revert data:", error.error.data);

            try {
                const errorInterface = new ethers.utils.Interface([
                    "error Unauthorized(address,string)",
                    "error InsufficientExecutionFee(uint256,uint256)",
                    "error EmptyDepositAmounts()",
                    "error InsufficientAllowance()"
                ]);
                const decoded = errorInterface.parseError(error.error.data);
                console.log("\nDecoded error:", decoded.name);
                if (decoded.args) {
                    console.log("Error args:", decoded.args);
                }
            } catch (e) {
                // Couldn't decode
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });