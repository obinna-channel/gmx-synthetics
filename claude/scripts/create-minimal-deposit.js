const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Minimal Deposit (1 USDT, No Execution Fee) ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Check and clear vault if needed
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("Vault status:");
    console.log("  USDT actual:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN actual:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (usdtRecorded.gt(0) || sngnRecorded.gt(0)) {
        console.log("\n⚠️  Clearing vault first...");
        
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

    // Minimal deposit amount - just 1 USDT
    const usdtAmount = ethers.utils.parseUnits("1", 6);

    console.log("\n📊 Deposit Configuration:");
    console.log("  USDT amount: 1.0");
    console.log("  sNGN amount: 0 (single-sided deposit)");
    console.log("  Execution fee: 0 (no fee)");
    console.log("  Receiver: address(1) for first deposit");

    // Check balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("\n💰 Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));

    if (userBalance.lt(usdtAmount)) {
        console.log("❌ Insufficient USDT");
        return;
    }

    // Approve Router
    console.log("\n📍 Approving Router...");
    const currentAllowance = await usdt.allowance(signer.address, ROUTER);
    if (currentAllowance.lt(usdtAmount)) {
        const tx = await usdt.approve(ROUTER, usdtAmount);
        await tx.wait();
        console.log("  ✅ Approved");
    } else {
        console.log("  ✅ Already approved");
    }

    // Build multicall data - just sendTokens + createDeposit, no sendWnt
    console.log("\n📍 Building multicall (sendTokens + createDeposit only)...");
    
    const multicallData = [];

    // 1. Send USDT
    const sendUsdtData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        usdtAmount
    ]);
    multicallData.push(sendUsdtData);

    // 2. Create deposit
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1)
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

    console.log("  ✅ Prepared multicall:");
    console.log("     1. Send 1 USDT to DepositVault");
    console.log("     2. Create deposit with no execution fee");

    // Execute
    console.log("\n📍 Executing multicall...");
    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            gasLimit: 2500000
        });

        console.log("  Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("\n  ✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        console.log("  View on Arbiscan: https://sepolia.arbiscan.io/tx/" + tx.hash);

        // Extract deposit key from logs
        console.log("\n  Looking for deposit key...");
        for (const log of receipt.logs) {
            if (log.topics.length >= 3) {
                // The deposit key might be in topic[2]
                const potentialKey = log.topics[2];
                if (potentialKey && potentialKey.startsWith("0x") && potentialKey.length === 66) {
                    console.log("\n🔑 Potential deposit key:", potentialKey);
                    console.log("\n📝 Next steps:");
                    console.log("1. Set fresh oracle prices");
                    console.log("2. Execute deposit with this key");
                    console.log("3. Check if it succeeds or gets cancelled");
                    break;
                }
            }
        }

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