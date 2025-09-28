const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating First Deposit for USDT/USDT/mNGN Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x2AE76b768a26CA2DfCcd7ccB46273D3C8283C2A7"; // Market 5: USDT/USDT/mNGN
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    console.log("📍 Using Market 5:", MARKET);
    console.log("   Index Token: USDT (tracks USDT/NGN exchange rate)");
    console.log("   Long Token: USDT");
    console.log("   Short Token: mNGN\n");

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const mngn = await ethers.getContractAt("IERC20", mNGN);

    // Get WNT (Wrapped Native Token) address
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    console.log("WNT address from DataStore:", WNT);

    // If WNT is not set, we need WETH on Arbitrum Sepolia
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" // WETH on Arbitrum Sepolia
        : WNT;

    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts - balanced 1:1 in USD value
    // 1000 USDT = $1500000 at rate of 1 USDT = 1500 NGN
    // 1,500,000 mNGN = $1500000 at rate of 1 mNGN = 1 NGN
    const usdtAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDT
    const mngnAmount = ethers.utils.parseUnits("1500000", 18); // 1,500,000 mNGN (equal value)
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH execution fee

    console.log("\n📊 Deposit Configuration:");
    console.log("  USDT amount:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  mNGN amount:", ethers.utils.formatUnits(mngnAmount, 18));
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");
    console.log("  Value ratio: 1 USDT = 1500 mNGN (balanced liquidity)");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);
    const mngnBalance = await mngn.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("  mNGN:", ethers.utils.formatUnits(mngnBalance, 18));

    // Validate balances
    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH for execution fee");
        return;
    }
    if (usdtBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT balance");
        return;
    }
    if (mngnBalance.lt(mngnAmount)) {
        console.log("❌ Insufficient mNGN balance");
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
    } else {
        console.log("  ✅ USDT already approved");
    }

    const mngnAllowance = await mngn.allowance(signer.address, ROUTER);
    if (mngnAllowance.lt(mngnAmount)) {
        console.log("  Approving mNGN...");
        const tx = await mngn.approve(ROUTER, mngnAmount);
        await tx.wait();
        console.log("  ✅ mNGN approved");
    } else {
        console.log("  ✅ mNGN already approved");
    }

    // Step 2: Clear vault if needed
    console.log("\n📍 STEP 2: Check vault status");
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultMngnBalance = await mngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const mngnRecorded = await depositVault.tokenBalances(mNGN);

    console.log("  Vault USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  Vault USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  Vault mNGN balance:", ethers.utils.formatUnits(vaultMngnBalance, 18));
    console.log("  Vault mNGN recorded:", ethers.utils.formatUnits(mngnRecorded, 18));

    if (vaultUsdtBalance.gt(0) || vaultMngnBalance.gt(0)) {
        console.log("\n⚠️  Warning: Vault has existing balances. Clearing first...");

        if (vaultUsdtBalance.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                USDT, signer.address, vaultUsdtBalance, false
            );
            await tx.wait();
            console.log("  ✅ USDT withdrawn");
        }

        if (vaultMngnBalance.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                mNGN, signer.address, vaultMngnBalance, false
            );
            await tx.wait();
            console.log("  ✅ mNGN withdrawn");
        }

        // Sync to reset recorded balances
        await depositVault.syncTokenBalance(USDT);
        await depositVault.syncTokenBalance(mNGN);
        console.log("  ✅ Vault cleared");
    }

    // Step 3: Build multicall following the report's recommendations
    console.log("\n📍 STEP 3: Building multicall with execution fee");
    console.log("  Following exact sequence from research report:");
    console.log("  1. sendWnt - Send execution fee to vault");
    console.log("  2. sendTokens - Send USDT to vault");
    console.log("  3. sendTokens - Send mNGN to vault");
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

    // 3. Send mNGN
    console.log("  Encoding sendTokens for mNGN...");
    const sendMngnData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        mNGN,
        DEPOSIT_VAULT,
        mngnAmount
    ]);
    multicallData.push(sendMngnData);

    // 4. Create deposit with execution fee
    console.log("  Encoding createDeposit...");
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // First deposit must use address(1)
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: mNGN,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0, // Must be 0 for first deposit
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
    console.log("\n📍 STEP 4: Simulating multicall first...");

    try {
        // Simulate first
        const estimatedGas = await exchangeRouter.estimateGas.multicall(multicallData, {
            value: executionFee
        });
        console.log("  ✅ Simulation successful!");
        console.log("  Estimated gas:", estimatedGas.toString());

        console.log("\n📍 STEP 5: Executing multicall");
        console.log("  Sending", ethers.utils.formatEther(executionFee), "ETH with transaction");
        console.log("  This ETH will be wrapped to WNT by sendWnt");

        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee, // Send ETH to be wrapped
            gasLimit: estimatedGas.mul(120).div(100) // 20% buffer
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();

        console.log("\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Look for deposit key in logs
        let depositKey = null;
        for (const log of receipt.logs) {
            if (log.topics && log.topics.length >= 3) {
                const potentialKey = log.topics[2];
                if (potentialKey && potentialKey.length === 66 && !potentialKey.includes("000000")) {
                    depositKey = potentialKey;
                    console.log("\n🔑 DEPOSIT KEY:", depositKey);

                    // Save to file
                    const fs = require("fs");
                    fs.writeFileSync("latest-deposit-key-mngn.txt", depositKey);
                    console.log("📝 Saved deposit key to: latest-deposit-key-mngn.txt");
                    break;
                }
            }
        }

        if (depositKey) {
            console.log("\n🎉 SUCCESS! First deposit created for mNGN market!");
            console.log("\n🎯 Next steps:");
            console.log("1. The deposit can now be executed by keepers");
            console.log("2. Or manually execute with: npx hardhat run claude/scripts/execute-mngn-deposit.js --network arbitrumSepolia");
        }

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

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
        const finalVaultMngnBalance = await mngn.balanceOf(DEPOSIT_VAULT);
        console.log("\nFinal vault state:");
        console.log("  USDT:", ethers.utils.formatUnits(finalVaultUsdtBalance, 6));
        console.log("  mNGN:", ethers.utils.formatUnits(finalVaultMngnBalance, 18));
    }
}

main().catch(console.error);