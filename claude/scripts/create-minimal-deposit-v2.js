const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Minimal Deposit V2 (Following deposit-with-execution-fee pattern) ===\n");
    console.log("Testing with: 1 USDT only, NO execution fee");
    console.log("Signer address:", signer.address);

    // Contract addresses (same as deposit-with-execution-fee.js)
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
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Get WNT address (same as deposit-with-execution-fee.js)
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" // WETH on Arbitrum Sepolia
        : WNT;
    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts - MODIFIED: just 1 USDT, no sNGN, no execution fee
    const usdtAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
    const sngnAmount = ethers.utils.parseUnits("0", 18); // 0 sNGN
    const executionFee = ethers.utils.parseEther("0"); // 0 ETH execution fee

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

    if (usdtBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT");
        return;
    }

    // Step 1: Approve tokens to Router (not ExchangeRouter)
    console.log("\n📍 STEP 1: Approve Router for USDT");
    const currentAllowance = await usdt.allowance(signer.address, ROUTER);
    console.log("  Current allowance:", ethers.utils.formatUnits(currentAllowance, 6));

    if (currentAllowance.lt(usdtAmount)) {
        const approveTx = await usdt.approve(ROUTER, usdtAmount);
        await approveTx.wait();
        console.log("  ✅ Approved");
    } else {
        console.log("  ✅ Already approved");
    }

    // Step 2: Clear vault if needed (same as deposit-with-execution-fee.js)
    console.log("\n📍 STEP 2: Checking vault status");
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (usdtRecorded.gt(0) || sngnRecorded.gt(0)) {
        console.log("  Clearing vault...");
        
        if (usdtRecorded.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                USDT, signer.address, usdtRecorded, false
            );
            await tx.wait();
            await depositVault.syncTokenBalance(USDT);
            console.log("  ✅ USDT cleared");
        }

        if (sngnRecorded.gt(0)) {
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                sNGN, signer.address, sngnRecorded, false
            );
            await tx.wait();
            await depositVault.syncTokenBalance(sNGN);
            console.log("  ✅ sNGN cleared");
        }
    }

    // Step 3: Build multicall - Try WITHOUT sendWnt since no execution fee
    console.log("\n📍 STEP 3: Building multicall (no sendWnt since executionFee=0)");
    console.log("  Sequence:");
    console.log("  1. sendTokens - Send USDT to vault");
    console.log("  2. createDeposit - Create the deposit");

    const multicallData = [];

    // 1. Send USDT
    console.log("\n  Encoding sendTokens for USDT...");
    const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        usdtAmount
    ]);
    multicallData.push(sendUsdtData);

    // 2. Create deposit with NO execution fee
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
        executionFee: 0, // NO EXECUTION FEE
        callbackGasLimit: 0,
        dataList: []
    };

    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);
    multicallData.push(createDepositData);

    // Step 4: Execute multicall WITHOUT ETH value
    console.log("\n📍 STEP 4: Executing multicall");
    console.log("  NO ETH being sent (executionFee = 0)");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        console.log("  Status:", receipt.status ? "SUCCESS" : "FAILED");

        if (!receipt.status) {
            console.log("\n❌ Transaction failed - likely due to reentrancy guard");
            console.log("The guide warns about this issue with multicall");
            return;
        }

        // Look for deposit key in logs
        console.log("\n  Checking for deposit key in logs...");
        for (const log of receipt.logs) {
            if (log.topics && log.topics.length >= 3) {
                const potentialKey = log.topics[2];
                if (potentialKey && potentialKey.length === 66) {
                    console.log("\n🔑 DEPOSIT KEY FOUND:", potentialKey);
                    console.log("\nNext steps:");
                    console.log("1. Set fresh oracle prices");
                    console.log("2. Execute with: npx hardhat run claude/scripts/execute-deposit-simple.js");
                    console.log("   (update the depositKey in that script first)");
                    
                    // Save to file
                    const fs = require("fs");
                    fs.writeFileSync("latest-deposit-key.txt", potentialKey);
                    console.log("\n📝 Saved to latest-deposit-key.txt");
                    break;
                }
            }
        }

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error:", error.message);
        
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
            
            const errorSig = error.error.data.slice(0, 10);
            const errors = {
                "0x01af8c24": "EmptyDepositAmounts - tokens weren't recorded",
                "0xa35b150b": "Unauthorized",
                "0x3c6be8c0": "InsufficientWntAmountForExecutionFee"
            };
            
            if (errors[errorSig]) {
                console.log("\n🔍 Decoded error:", errors[errorSig]);
            }
        }
    }
}

main().catch(console.error);