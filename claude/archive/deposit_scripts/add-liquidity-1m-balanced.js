const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding MASSIVE BALANCED Liquidity (1M USDT) to USDTNGN Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses from deployment
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const ROUTER = "0xAE75C18248905dB5E1ceE00c4655Feb49BA25252"; // Correct Router from deployment

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);

    // Check market is initialized
    const currentSupply = await marketToken.totalSupply();
    console.log("Current market token supply:", ethers.utils.formatEther(currentSupply));
    console.log("Current ratio: 999,300 tokens for 1 USDT");

    // MASSIVE BALANCED DEPOSIT
    const LONG_AMOUNT = "500000"; // 500K USDT for long side
    const SHORT_AMOUNT = "500000"; // 500K USDT for short side
    const TOTAL_AMOUNT = "1000000"; // Total 1M USDT

    console.log("\n🐋 MASSIVE BALANCED DEPOSIT:");
    console.log("   Long side:", LONG_AMOUNT, "USDT");
    console.log("   Short side:", SHORT_AMOUNT, "USDT");
    console.log("   Total:", TOTAL_AMOUNT, "USDT");
    console.log("   Expected outcome: Should definitely overcome rounding issues!");
    console.log("   Expected tokens: ~999.3B market tokens (if proportional)\n");

    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6), "USDT");

    const totalRequired = ethers.utils.parseUnits(TOTAL_AMOUNT, 6);
    if (userBalance.lt(totalRequired)) {
        console.log("❌ Insufficient USDT. You need", TOTAL_AMOUNT, "USDT (1 million)");
        console.log("   Current balance:", ethers.utils.formatUnits(userBalance, 6), "USDT");
        return;
    }

    console.log("✅ Sufficient balance for massive deposit!\n");

    // Step 1: Approve Router for 1M USDT (Router handles token transfers)
    console.log("Step 1: Approving Router to spend", TOTAL_AMOUNT, "USDT...");
    const currentAllowance = await usdt.allowance(signer.address, ROUTER);

    if (currentAllowance.lt(totalRequired)) {
        const approveTx = await usdt.approve(ROUTER, totalRequired);
        console.log("  Approval tx:", approveTx.hash);
        await approveTx.wait();
        console.log("  ✅ Approved 1M USDT to Router\n");
    } else {
        console.log("  ✅ Already has sufficient approval\n");
    }

    // Step 2: Send tokens to DepositVault via ExchangeRouter
    console.log("Step 2: Sending 1M USDT to DepositVault (500K each side)...");

    const longAmount = ethers.utils.parseUnits(LONG_AMOUNT, 6);
    const shortAmount = ethers.utils.parseUnits(SHORT_AMOUNT, 6);

    console.log("  Sending 500K USDT for long side...");
    const sendLongTx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, longAmount);
    console.log("  Long tx:", sendLongTx.hash);
    await sendLongTx.wait();
    console.log("  ✅ Long tokens sent");

    console.log("  Sending 500K USDT for short side...");
    const sendShortTx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, shortAmount);
    console.log("  Short tx:", sendShortTx.hash);
    await sendShortTx.wait();
    console.log("  ✅ Short tokens sent\n");

    // Step 3: Create deposit
    console.log("Step 3: Creating 1M USDT balanced deposit...");

    const depositParams = {
        addresses: {
            receiver: signer.address,
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

    console.log("  Deposit configuration:");
    console.log("    Market:", MARKET);
    console.log("    Long: 500K USDT");
    console.log("    Short: 500K USDT");
    console.log("    Total: 1M USDT");
    console.log("    Balanced: YES (50/50 split)");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("\n  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n🎉 SUCCESS! 1 MILLION USDT deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n💰 This massive deposit should:");
        console.log("   - Overcome any rounding issues");
        console.log("   - Significantly increase pool liquidity");
        console.log("   - Generate substantial market tokens");
        console.log("   - Make the market usable for trading");
        console.log("\n⏳ Execute this deposit to receive market tokens");

    } catch (error) {
        console.log("\n❌ Error creating 1M deposit:", error.message);
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