const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding SHORT-ONLY Liquidity to USDTNGN Market ===\n");
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
    console.log("Market initialized with 1 USDT LONG deposit");

    // SHORT-ONLY DEPOSIT: Provide only short tokens
    const SHORT_AMOUNT = "1"; // 1 USDT for short side

    console.log("\n💡 SHORT-ONLY DEPOSIT STRATEGY:");
    console.log("   Long side: 0 USDT");
    console.log("   Short side:", SHORT_AMOUNT, "USDT");
    console.log("   Reason: Balance the pool (initial was long-only)\n");

    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));

    const requiredAmount = ethers.utils.parseUnits(SHORT_AMOUNT, 6);
    if (userBalance.lt(requiredAmount)) {
        console.log("❌ Insufficient USDT. You need", SHORT_AMOUNT, "USDT");
        return;
    }

    // Step 1: Transfer USDT to DepositVault (single transfer for short)
    console.log("\nStep 1: Checking USDT balance in DepositVault...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    if (vaultBalance.lt(requiredAmount)) {
        console.log("  Transferring", SHORT_AMOUNT, "USDT to DepositVault...");
        const tx = await usdt.transfer(DEPOSIT_VAULT, requiredAmount);
        console.log("  Transfer tx:", tx.hash);
        await tx.wait();
        console.log("  ✅ Transfer complete\n");
    } else {
        console.log("  ✅ Sufficient USDT in vault\n");
    }

    // Step 2: Create SHORT-ONLY deposit parameters
    console.log("Step 2: Creating short-only deposit parameters...");

    const depositParams = {
        addresses: {
            receiver: signer.address, // YOUR address for normal deposits
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,  // Still USDT but we're not depositing any
            initialShortToken: USDT, // Depositing 1 USDT here
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
    console.log("    Long tokens: 0 USDT (none)");
    console.log("    Short tokens:", SHORT_AMOUNT, "USDT");
    console.log("    Receiver:", signer.address);
    console.log("    Type: SHORT-ONLY\n");

    // Step 3: Call createDeposit
    console.log("Step 3: Creating short-only deposit...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n✅ SUCCESS! Short-only deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n💡 Expected outcome:");
        console.log("   - This should balance the pool (1 USDT long, 1 USDT short)");
        console.log("   - Single transfer, single deposit");
        console.log("   - Should receive market tokens for short side liquidity");
        console.log("\n⏳ Execute this deposit to receive market tokens");

    } catch (error) {
        console.log("\n❌ Error creating short-only deposit:", error.message);
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