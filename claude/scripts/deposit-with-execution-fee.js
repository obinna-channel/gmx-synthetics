const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit with Execution Fee (Following Research Report) ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Get WNT (Wrapped Native Token) address
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    console.log("WNT address from DataStore:", WNT);

    // If WNT is not set, we need WETH on Arbitrum Sepolia
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" // WETH on Arbitrum Sepolia
        : WNT;

    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts
    const usdtAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
    const sngnAmount = ethers.utils.parseUnits("1500", 18); // 1500 sNGN
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH execution fee

    console.log("\n📊 Deposit Configuration:");
    console.log("  USDT amount:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  sNGN amount:", ethers.utils.formatUnits(sngnAmount, 18));
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);
    const sngnBalance = await sngn.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnBalance, 18));

    // Validate balances
    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH for execution fee");
        return;
    }
    if (usdtBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT balance");
        return;
    }
    if (sngnBalance.lt(sngnAmount)) {
        console.log("❌ Insufficient sNGN balance");
        return;
    }

    // Step 1: Approve Router for tokens
    console.log("\n📍 STEP 1: Approve Router for tokens");

    const usdtAllowance = await usdt.allowance(signer.address, ROUTER);
    if (usdtAllowance.lt(usdtAmount)) {
        console.log("  Approving USDT...");
        const tx = await usdt.approve(ROUTER, usdtAmount);
        await tx.wait();
        console.log("  ✅ USDT approved");
    }

    const sngnAllowance = await sngn.allowance(signer.address, ROUTER);
    if (sngnAllowance.lt(sngnAmount)) {
        console.log("  Approving sNGN...");
        const tx = await sngn.approve(ROUTER, sngnAmount);
        await tx.wait();
        console.log("  ✅ sNGN approved");
    }

    // Step 2: Clear vault if needed
    console.log("\n📍 STEP 2: Check vault status");
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("  Vault USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  Vault USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  Vault sNGN balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  Vault sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (vaultUsdtBalance.gt(0) || vaultSngnBalance.gt(0)) {
        console.log("\n⚠️  Warning: Vault has existing balances. Clearing first...");

        if (vaultUsdtBalance.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                USDT, signer.address, vaultUsdtBalance, false
            );
            await tx.wait();
            console.log("  ✅ USDT withdrawn");
        }

        if (vaultSngnBalance.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                sNGN, signer.address, vaultSngnBalance, false
            );
            await tx.wait();
            console.log("  ✅ sNGN withdrawn");
        }

        // Sync to reset recorded balances
        await depositVault.syncTokenBalance(USDT);
        await depositVault.syncTokenBalance(sNGN);
        console.log("  ✅ Vault cleared");
    }

    // Step 3: Build multicall following the report's recommendations
    console.log("\n📍 STEP 3: Building multicall with execution fee");
    console.log("  Following exact sequence from research report:");
    console.log("  1. sendWnt - Send execution fee to vault");
    console.log("  2. sendTokens - Send USDT to vault");
    console.log("  3. sendTokens - Send sNGN to vault");
    console.log("  4. createDeposit - Create the deposit");

    const multicallData = [];

    // 1. Send WNT (execution fee) - using sendWnt which wraps ETH
    console.log("\n  Encoding sendWnt for execution fee...");
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        DEPOSIT_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // 2. Send USDT
    console.log("  Encoding sendTokens for USDT...");
    const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        usdtAmount
    ]);
    multicallData.push(sendUsdtData);

    // 3. Send sNGN
    console.log("  Encoding sendTokens for sNGN...");
    const sendSngnData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        sNGN,
        DEPOSIT_VAULT,
        sngnAmount
    ]);
    multicallData.push(sendSngnData);

    // 4. Create deposit with execution fee
    console.log("  Encoding createDeposit...");
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // First deposit must use address(1)
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: executionFee, // Match the WNT amount sent
        callbackGasLimit: 0,
        dataList: []
    };

    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);
    multicallData.push(createDepositData);

    // Step 4: Execute multicall with ETH value for execution fee
    console.log("\n📍 STEP 4: Executing multicall");
    console.log("  Sending", ethers.utils.formatEther(executionFee), "ETH with transaction");
    console.log("  This ETH will be wrapped to WNT by sendWnt");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee, // Send ETH to be wrapped
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();

        console.log("\n  Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");
        console.log("  Gas used:", receipt.gasUsed.toString());

        if (receipt.status) {
            // Check for events
            if (receipt.events && receipt.events.length > 0) {
                console.log("\n  Events emitted:");
                for (const event of receipt.events) {
                    if (event.event) {
                        console.log(`    - ${event.event}`);
                        if (event.event === "DepositCreated") {
                            const depositKey = event.args?.key || event.args?.[0];
                            console.log(`      🎉 DEPOSIT KEY: ${depositKey}`);
                            console.log("\n🎉 SUCCESS! Deposit created with execution fee!");
                            console.log("The deposit can now be executed by keepers.");
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.log("\n❌ Transaction failed:", error.message);

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("Error data:", errorData);

            // Decode known errors
            const errorSignatures = {
                "0x01af8c24": "EmptyDepositAmounts",
                "0x3c6be8c0": "InsufficientWntAmountForExecutionFee",
                "0xd4d0290e": "ReentrancyGuardReentrantCall"
            };

            if (errorSignatures[errorData]) {
                console.log(`\n  Decoded error: ${errorSignatures[errorData]}`);
            }
        }

        // Check final vault state
        const finalVaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
        const finalVaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
        console.log("\nFinal vault state:");
        console.log("  USDT:", ethers.utils.formatUnits(finalVaultUsdtBalance, 6));
        console.log("  sNGN:", ethers.utils.formatUnits(finalVaultSngnBalance, 18));
    }
}

main().catch(console.error);