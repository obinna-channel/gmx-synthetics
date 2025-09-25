const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Balanced Deposit (USDT + sNGN) ===\n");
    console.log("Exactly like deposit-with-execution-fee.js");
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
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
        : WNT;
    console.log("Using WNT/WETH:", WETH);

    // Deposit amounts - BALANCED
    const usdtAmount = ethers.utils.parseUnits("100", 6); // 100 USDT
    const sngnAmount = ethers.utils.parseUnits("0.1", 18); // 0.1 sNGN (will be worth $150 if priced at $1500)
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH

    console.log("\n📊 Deposit Configuration:");
    console.log("  USDT amount:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  sNGN amount:", ethers.utils.formatUnits(sngnAmount, 18));
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");
    console.log("\n  Note: We'll set sNGN price to $1500 during execution");
    console.log("  So 0.1 sNGN = $150, balancing with $100 USDT");

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

    // Step 2: Clear vault if needed
    console.log("\n📍 STEP 2: Checking vault...");
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

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
    console.log("  4. createDeposit");

    const multicallData = [];

    // 1. Send WNT (execution fee)
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

    // 4. Create deposit
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
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
        executionFee: executionFee,
        callbackGasLimit: 0,
        dataList: []
    };

    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);
    multicallData.push(createDepositData);

    // Step 4: Execute
    console.log("\n📍 STEP 4: Executing multicall");
    console.log("  Sending", ethers.utils.formatEther(executionFee), "ETH");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee,
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Find deposit key
        for (const log of receipt.logs) {
            if (log.topics && log.topics.length >= 3) {
                const potentialKey = log.topics[2];
                if (potentialKey && potentialKey.length === 66 && !potentialKey.includes("000000")) {
                    console.log("\n🔑 DEPOSIT KEY:", potentialKey);
                    
                    const fs = require("fs");
                    fs.writeFileSync("latest-deposit-key.txt", potentialKey);
                    
                    console.log("\n🎯 Next step:");
                    console.log("We'll execute with sNGN price set to $1500!");
                    console.log("This will make 0.1 sNGN = $150, balancing the $100 USDT");
                    break;
                }
            }
        }

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error:", error.message);
    }
}

main().catch(console.error);