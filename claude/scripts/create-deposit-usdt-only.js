const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit (USDT Only, With Execution Fee) ===\n");
    console.log("Exactly like deposit-with-execution-fee.js but NO sNGN");
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
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Get WNT (Wrapped Native Token) address
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    console.log("WNT address from DataStore:", WNT);

    // If WNT is not set, we need WETH on Arbitrum Sepolia
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" // WETH on Arbitrum Sepolia
        : WNT;

    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts - MODIFIED: NO sNGN
    const usdtAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
    const sngnAmount = ethers.utils.parseUnits("0", 18); // 0 sNGN - NO sNGN!
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH execution fee

    console.log("\n📊 Deposit Configuration:");
    console.log("  USDT amount:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  sNGN amount:", ethers.utils.formatUnits(sngnAmount, 18), "(NONE)");
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));

    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH for execution fee");
        return;
    }

    if (usdtBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT");
        return;
    }

    // Step 1: Approve USDT to Router (not ExchangeRouter!)
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
    console.log("\n📍 STEP 2: Checking and clearing vault if needed");
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("  USDT in vault:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN in vault:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (vaultUsdtBalance.gt(0) || vaultSngnBalance.gt(0)) {
        console.log("\n  Clearing vault physical balances...");

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

    // Step 3: Build multicall following deposit-with-execution-fee.js EXACTLY
    console.log("\n📍 STEP 3: Building multicall with execution fee");
    console.log("  Following exact sequence from deposit-with-execution-fee.js:");
    console.log("  1. sendWnt - Send execution fee to vault");
    console.log("  2. sendTokens - Send USDT to vault");
    console.log("  3. createDeposit - Create the deposit");
    console.log("  (Skipping sNGN sendTokens)");

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

    // 3. NO sNGN - skipping this step
    console.log("  Skipping sNGN sendTokens (amount = 0)");

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
        console.log("\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        console.log("  Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");

        if (receipt.status) {
            // Look for deposit key
            console.log("\n  Looking for deposit key in logs...");
            for (const log of receipt.logs) {
                if (log.topics && log.topics.length >= 3) {
                    const potentialKey = log.topics[2];
                    if (potentialKey && potentialKey.length === 66 && !potentialKey.includes("000000")) {
                        console.log("\n🔑 DEPOSIT KEY:", potentialKey);
                        
                        // Save to file
                        const fs = require("fs");
                        fs.writeFileSync("latest-deposit-key.txt", potentialKey);
                        console.log("💾 Saved to latest-deposit-key.txt");
                        
                        console.log("\n🎯 Next steps:");
                        console.log("1. Run: npx hardhat run claude/scripts/set-fresh-prices.js --network arbitrumSepolia");
                        console.log("2. Update depositKey in execute-deposit-simple.js");
                        console.log("3. Run: npx hardhat run claude/scripts/execute-deposit-simple.js --network arbitrumSepolia");
                        break;
                    }
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
                "0x01af8c24": "EmptyDepositAmounts",
                "0xa35b150b": "Unauthorized",
                "0x3c6be8c0": "InsufficientWntAmountForExecutionFee"
            };
            
            if (errors[errorSig]) {
                console.log("Decoded:", errors[errorSig]);
            }
        }
    }
}

main().catch(console.error);