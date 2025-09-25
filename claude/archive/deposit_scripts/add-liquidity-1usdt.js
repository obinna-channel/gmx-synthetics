const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding 1 USDT Liquidity (Matching Initial Deposit Size) ===\n");
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

    if (vaultBalance.lt(ethers.utils.parseUnits("1", 6))) {
        console.log("  ⚠️  DepositVault needs at least 1 USDT");
        console.log("  Transferring 1 USDT to DepositVault...");

        const transferAmount = ethers.utils.parseUnits("1", 6);
        const tx = await usdt.transfer(DEPOSIT_VAULT, transferAmount);
        console.log("  Transfer tx:", tx.hash);
        await tx.wait();
        console.log("  ✅ Transfer complete\n");
    } else {
        console.log("  ✅ Sufficient USDT in vault\n");
    }

    // Step 2: Create deposit parameters
    console.log("Step 2: Creating deposit parameters...");
    console.log("  Note: Using 1 USDT to match the initial deposit size");

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
    console.log("    Amount: 1 USDT (same as initialization)");
    console.log("    Receiver:", signer.address, "(your address)");
    console.log("    Execution fee:", depositParams.executionFee);

    // Step 3: Call createDeposit
    console.log("\nStep 3: Calling createDeposit on ExchangeRouter...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n✅ SUCCESS! 1 USDT liquidity deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n💡 Expected behavior:");
        console.log("   - This should double the pool from 1 USDT to 2 USDT");
        console.log("   - You should receive ~999,300 market tokens (same as init)");
        console.log("\n⏳ Execute this deposit to receive market tokens");

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });