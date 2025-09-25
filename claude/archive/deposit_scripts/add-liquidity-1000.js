const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding 1000 USDT Liquidity ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses from deployment
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);

    // Check market is initialized
    const currentSupply = await marketToken.totalSupply();
    console.log("Current market token supply:", ethers.utils.formatEther(currentSupply));
    if (currentSupply.eq(0)) {
        console.log("❌ Market needs to be initialized first!");
        return;
    }

    // Step 1: Check USDT balance in DepositVault
    console.log("\nStep 1: Checking USDT balance in DepositVault...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    if (vaultBalance.lt(ethers.utils.parseUnits("1000", 6))) {
        console.log("  ⚠️  DepositVault needs at least 1000 USDT");
        console.log("  Transferring 1000 USDT to DepositVault...");

        const transferAmount = ethers.utils.parseUnits("1000", 6);
        const tx = await usdt.transfer(DEPOSIT_VAULT, transferAmount);
        console.log("  Transfer tx:", tx.hash);
        await tx.wait();
        console.log("  ✅ Transfer complete\n");
    } else {
        console.log("  ✅ Sufficient USDT in vault\n");
    }

    // Step 2: Create deposit parameters
    console.log("Step 2: Creating deposit parameters...");

    // For normal deposits after initialization:
    // - receiver is YOUR address (not address(1))
    // - We can add significant liquidity

    const depositParams = {
        addresses: {
            receiver: signer.address, // YOUR address for normal deposits
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("  Deposit params:");
    console.log("    Market:", MARKET);
    console.log("    Long token (USDT):", USDT);
    console.log("    Short token (USDT):", USDT);
    console.log("    Amount: 1000 USDT");
    console.log("    Receiver:", signer.address, "(your address - you'll get market tokens)");
    console.log("    Execution fee:", depositParams.executionFee);

    // Step 3: Call createDeposit
    console.log("\nStep 3: Calling createDeposit on ExchangeRouter...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n✅ SUCCESS! Liquidity deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n⏳ Next steps:");
        console.log("   1. Execute this deposit to add your liquidity");
        console.log("   2. You'll receive market tokens representing your share");
        console.log("\n💡 Market tokens:");
        console.log("   - Represent your share of the pool");
        console.log("   - Earn fees from trades");
        console.log("   - Can be withdrawn anytime for underlying USDT");

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });