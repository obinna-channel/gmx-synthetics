const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Normal Deposit for USDT Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // USDT market
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    console.log("📍 Using USDT Market:", MARKET);
    console.log("   Index Token: USDT");
    console.log("   Long Token: USDT");
    console.log("   Short Token: sNGN\n");

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Get WNT (Wrapped Native Token) address
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
        : WNT;
    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts - balanced 1:1 in USD value
    const usdtAmount = ethers.utils.parseUnits("100000", 6); // 100,000 USDT
    const sngnAmount = ethers.utils.parseUnits("150000000", 18); // 150,000,000 sNGN (worth $100,000 at $1/1500 rate)
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH

    console.log("\n📊 Deposit Configuration:");
    console.log("  USDT amount:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  sNGN amount:", ethers.utils.formatUnits(sngnAmount, 18));
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");
    console.log("  Receiver:", signer.address); // Your address instead of address(1)

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);
    const sngnBalance = await sngn.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnBalance, 18));

    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH");
        return;
    }
    if (usdtBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT");
        return;
    }
    if (sngnBalance.lt(sngnAmount)) {
        console.log("❌ Insufficient sNGN");
        return;
    }

    // Step 1: Approve tokens to Router
    console.log("\n📍 STEP 1: Approve Router for tokens");

    const usdtAllowance = await usdt.allowance(signer.address, ROUTER);
    if (usdtAllowance.lt(usdtAmount)) {
        const tx = await usdt.approve(ROUTER, usdtAmount);
        await tx.wait();
        console.log("  ✅ USDT approved");
    } else {
        console.log("  ✅ USDT already approved");
    }

    const sngnAllowance = await sngn.allowance(signer.address, ROUTER);
    if (sngnAllowance.lt(sngnAmount)) {
        const tx = await sngn.approve(ROUTER, sngnAmount);
        await tx.wait();
        console.log("  ✅ sNGN approved");
    } else {
        console.log("  ✅ sNGN already approved");
    }

    // Step 2: Check and clear vault if needed
    console.log("\n📍 STEP 2: Checking vault...");
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("  Vault USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  Vault sNGN balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  Recorded USDT:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  Recorded sNGN:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (vaultUsdtBalance.gt(0) || vaultSngnBalance.gt(0)) {
        console.log("  Clearing vault...");
        if (vaultUsdtBalance.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                USDT, signer.address, vaultUsdtBalance, false
            );
            await tx.wait();
        }
        if (vaultSngnBalance.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                sNGN, signer.address, vaultSngnBalance, false
            );
            await tx.wait();
        }
        await depositVault.syncTokenBalance(USDT);
        await depositVault.syncTokenBalance(sNGN);
        console.log("  ✅ Vault cleared");
    }

    // Step 3: Build multicall
    console.log("\n📍 STEP 3: Building multicall");
    console.log("  1. sendWnt - Send execution fee");
    console.log("  2. sendTokens - Send USDT");
    console.log("  3. sendTokens - Send sNGN");
    console.log("  4. createDeposit with YOUR address as receiver");

    const multicallData = [];

    // 1. Send WNT (execution fee) - MUST BE FIRST to avoid reentrancy
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        DEPOSIT_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // 2. Send USDT
    const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        usdtAmount
    ]);
    multicallData.push(sendUsdtData);

    // 3. Send sNGN
    const sendSngnData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        sNGN,
        DEPOSIT_VAULT,
        sngnAmount
    ]);
    multicallData.push(sendSngnData);

    // 4. Create deposit with YOUR address as receiver for NORMAL deposit
    const depositParams = {
        addresses: {
            receiver: signer.address, // YOUR address for normal deposits
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0, // Can set to a minimum expected amount for protection
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
                    fs.writeFileSync("latest-normal-deposit-key.txt", depositKey);
                    break;
                }
            }
        }

        if (depositKey) {
            console.log("\n🎯 Next steps:");
            console.log("1. Execute deposit with: npx hardhat run claude/scripts/execute-normal-deposit.js --network arbitrumSepolia");
            console.log("\n📝 Saved deposit key to: latest-normal-deposit-key.txt");
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