const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating First Deposit for AAPL/USD Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449"; // Market 16: mAAPL/mUSD/mUSD
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mAAPL = "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    console.log("📍 Using Market 16 (AAPL/USD):", MARKET);
    console.log("   Index Token: mAAPL (tracks AAPL stock price)");
    console.log("   Long Token: mUSD");
    console.log("   Short Token: mUSD (single-token market)\n");

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const musd = await ethers.getContractAt("IERC20", mUSD);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Get WNT (Wrapped Native Token) address
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
        : WNT;
    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts - single-token market (only mUSD)
    const musdAmount = ethers.utils.parseUnits("1000", 6); // 1000 mUSD
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH

    console.log("\n📊 Deposit Configuration:");
    console.log("  mUSD amount:", ethers.utils.formatUnits(musdAmount, 6));
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");
    console.log("  NOTE: Single-token market - only mUSD needed (same for long and short)");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const musdBalance = await musd.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  mUSD:", ethers.utils.formatUnits(musdBalance, 6));

    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH");
        return;
    }
    if (musdBalance.lt(musdAmount)) {
        console.log("❌ Insufficient mUSD");
        return;
    }

    // Step 1: Approve tokens to Router
    console.log("\n📍 STEP 1: Approve Router for mUSD");

    const musdAllowance = await musd.allowance(signer.address, ROUTER);
    if (musdAllowance.lt(musdAmount)) {
        const tx = await musd.approve(ROUTER, musdAmount);
        await tx.wait();
        console.log("  ✅ mUSD approved");
    } else {
        console.log("  ✅ mUSD already approved");
    }

    // Step 2: Check and clear vault if needed
    console.log("\n📍 STEP 2: Checking vault...");
    const vaultMusdBalance = await musd.balanceOf(DEPOSIT_VAULT);
    const musdRecorded = await depositVault.tokenBalances(mUSD);

    console.log("  Vault mUSD balance:", ethers.utils.formatUnits(vaultMusdBalance, 6));
    console.log("  Recorded mUSD:", ethers.utils.formatUnits(musdRecorded, 6));

    if (vaultMusdBalance.gt(0)) {
        console.log("  Clearing vault...");
        const tx = await depositVault["transferOut(address,address,uint256,bool)"](
            mUSD, signer.address, vaultMusdBalance, false
        );
        await tx.wait();
        await depositVault.syncTokenBalance(mUSD);
        console.log("  ✅ Vault cleared");
    }

    // Step 3: Build multicall
    console.log("\n📍 STEP 3: Building multicall");
    console.log("  1. sendWnt - Send execution fee");
    console.log("  2. sendTokens - Send mUSD");
    console.log("  3. createDeposit");

    const multicallData = [];

    // 1. Send WNT (execution fee) - MUST BE FIRST to avoid reentrancy
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        DEPOSIT_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // 2. Send mUSD
    const sendMusdData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        mUSD,
        DEPOSIT_VAULT,
        musdAmount
    ]);
    multicallData.push(sendMusdData);

    // 3. Create deposit with address(1) as receiver for first deposit
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET, // AAPL/USD market
            initialLongToken: mUSD,
            initialShortToken: mUSD, // Same as long token (single-token market)
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
                    fs.writeFileSync("latest-deposit-key-aapl-market.txt", depositKey);
                    break;
                }
            }
        }

        if (depositKey) {
            console.log("\n🎯 Next steps:");
            console.log("1. Execute deposit with: npx hardhat run claude/scripts/execute-deposit-aapl-market.js --network arbitrumSepolia");
            console.log("\n📝 Saved deposit key to: latest-deposit-key-aapl-market.txt");
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
