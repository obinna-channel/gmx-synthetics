const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    // Get amount from environment variable (default to 10000)
    const depositAmount = process.env.AMOUNT || "10000";

    console.log("=== Creating FIRST Deposit for mUSDTNGN [USDC-USDC] Market ===\n");
    console.log("Signer address:", signer.address);
    console.log("Deposit amount:", depositAmount, "USDC");

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x0A9aaD88Ee9548b9aAe0526277982E730d2fBD38"; // Market 19: mUSDTNGN/USDC/USDC
    const USDC = "0xe73B11Fb1e3eeEe8AF2a23079A4410Fe1B370548";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    console.log("\n📍 Using Market 19 (mUSDTNGN/USDC/USDC):", MARKET);
    console.log("   Index Token: mUSDTNGN (tracks USDT/NGN exchange rate)");
    console.log("   Long Token: USDC");
    console.log("   Short Token: USDC (single-token market)\n");

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Get WNT (Wrapped Native Token) address
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
        : WNT;
    console.log("Using WNT/WETH:", WETH);

    // Parse deposit amount (USDC has 6 decimals)
    const usdcAmount = ethers.utils.parseUnits(depositAmount, 6);
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH

    console.log("\n📊 FIRST Deposit Configuration:");
    console.log("  USDC amount:", ethers.utils.formatUnits(usdcAmount, 6));
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");
    console.log("  NOTE: Single-token market - only USDC needed");
    console.log("  Receiver: address(1) (FIRST DEPOSIT - tokens burned to initialize market)");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdcBalance = await usdc.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  USDC:", ethers.utils.formatUnits(usdcBalance, 6));

    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH");
        return;
    }
    if (usdcBalance.lt(usdcAmount)) {
        console.log("❌ Insufficient USDC (need " + depositAmount + " USDC)");
        return;
    }

    // Step 1: Approve tokens to Router
    console.log("\n📍 STEP 1: Approve Router for USDC");

    const usdcAllowance = await usdc.allowance(signer.address, ROUTER);
    if (usdcAllowance.lt(usdcAmount)) {
        const tx = await usdc.approve(ROUTER, usdcAmount);
        await tx.wait();
        console.log("  ✅ USDC approved");
    } else {
        console.log("  ✅ USDC already approved");
    }

    // Step 2: Check and clear vault if needed
    console.log("\n📍 STEP 2: Checking vault...");
    const vaultUsdcBalance = await usdc.balanceOf(DEPOSIT_VAULT);
    const usdcRecorded = await depositVault.tokenBalances(USDC);

    console.log("  Vault USDC balance:", ethers.utils.formatUnits(vaultUsdcBalance, 6));
    console.log("  Recorded USDC:", ethers.utils.formatUnits(usdcRecorded, 6));

    if (vaultUsdcBalance.gt(0)) {
        console.log("  Clearing vault...");
        try {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                USDC, signer.address, vaultUsdcBalance, false
            );
            await tx.wait();
            await depositVault.syncTokenBalance(USDC);
            console.log("  ✅ Vault cleared");
        } catch (e) {
            console.log("  ⚠️ Could not clear vault:", e.message);
        }
    }

    // Step 3: Build multicall
    console.log("\n📍 STEP 3: Building multicall");
    console.log("  1. sendWnt - Send execution fee");
    console.log("  2. sendTokens - Send USDC");
    console.log("  3. createDeposit (FIRST DEPOSIT - receiver = address(1))");

    const multicallData = [];

    // 1. Send WNT (execution fee) - MUST BE FIRST to avoid reentrancy
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        DEPOSIT_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // 2. Send USDC
    const sendUsdcData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDC,
        DEPOSIT_VAULT,
        usdcAmount
    ]);
    multicallData.push(sendUsdcData);

    // 3. Create FIRST deposit with address(1) as receiver
    // IMPORTANT: First deposit MUST have:
    // - receiver = address(1)
    // - minMarketTokens = 0
    const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";

    const depositParams = {
        addresses: {
            receiver: ADDRESS_ONE, // FIRST DEPOSIT - must be address(1)
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDC,
            initialShortToken: USDC, // Same as long token (single-token market)
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0, // MUST be 0 for first deposit
        shouldUnwrapNativeToken: false,
        executionFee: executionFee,
        callbackGasLimit: 0,
        dataList: []
    };

    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);
    multicallData.push(createDepositData);

    // Step 4: Simulate first, then execute
    console.log("\n📍 STEP 4: Simulating multicall first...");

    try {
        // Simulate the transaction first
        const estimatedGas = await exchangeRouter.estimateGas.multicall(multicallData, {
            value: executionFee
        });
        console.log("  ✅ Simulation successful!");
        console.log("  Estimated gas:", estimatedGas.toString());
    } catch (simError) {
        console.log("  ❌ Simulation failed!");
        console.log("  Error:", simError.message);
        if (simError.error && simError.error.data) {
            console.log("  Error data:", simError.error.data);
        }
        return;
    }

    console.log("\n📍 STEP 5: Executing multicall");
    console.log("  Sending", ethers.utils.formatEther(executionFee), "ETH as execution fee");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee,
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");
        const receipt = await tx.wait();

        console.log("\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Find deposit key from events
        let depositKey = null;
        for (const log of receipt.logs) {
            if (log.topics && log.topics.length >= 3) {
                const potentialKey = log.topics[2];
                if (potentialKey && potentialKey.length === 66 && !potentialKey.includes("000000")) {
                    depositKey = potentialKey;
                    console.log("\n🔑 DEPOSIT KEY:", depositKey);

                    // Save to file
                    const fs = require("fs");
                    fs.writeFileSync("latest-deposit-key-usdtngn-usdc.txt", depositKey);
                    break;
                }
            }
        }

        if (depositKey) {
            console.log("\n🎯 Next steps:");
            console.log("1. Execute deposit with: npx hardhat run scripts/execute-deposit-usdtngn-usdc.js --network arbitrumSepolia");
            console.log("\n📝 Saved deposit key to: latest-deposit-key-usdtngn-usdc.txt");
        }

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);
