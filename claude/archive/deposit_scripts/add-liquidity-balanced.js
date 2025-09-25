const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding BALANCED Liquidity to USDTNGN Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses from deployment
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const ROUTER = "0x032b241De86a8660f1Ae0691a4760B426EA246d7";

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

    // BALANCED DEPOSIT: Provide both long and short tokens equally
    const LONG_AMOUNT = "1"; // 1 USDT for long side
    const SHORT_AMOUNT = "1"; // 1 USDT for short side
    const TOTAL_AMOUNT = "2"; // Total 2 USDT

    console.log("\n💡 BALANCED DEPOSIT STRATEGY:");
    console.log("   Long side:", LONG_AMOUNT, "USDT");
    console.log("   Short side:", SHORT_AMOUNT, "USDT");
    console.log("   Total:", TOTAL_AMOUNT, "USDT");
    console.log("   Reason: Avoid price impact by providing balanced liquidity\n");

    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));

    const totalRequired = ethers.utils.parseUnits(TOTAL_AMOUNT, 6);
    if (userBalance.lt(totalRequired)) {
        console.log("❌ Insufficient USDT. You need", TOTAL_AMOUNT, "USDT");
        return;
    }

    // Step 1: Approve Router to spend USDT (for BOTH long and short)
    console.log("Step 1: Approving Router to spend", TOTAL_AMOUNT, "USDT...");
    const currentAllowance = await usdt.allowance(signer.address, ROUTER);

    if (currentAllowance.lt(totalRequired)) {
        const approveTx = await usdt.approve(ROUTER, totalRequired);
        console.log("  Approval tx:", approveTx.hash);
        await approveTx.wait();
        console.log("  ✅ Approved", TOTAL_AMOUNT, "USDT\n");
    } else {
        console.log("  ✅ Already approved\n");
    }

    // Step 2: Send USDT for BOTH long and short to Router
    console.log("Step 2: Sending USDT to Router...");
    console.log("  Long amount:", LONG_AMOUNT, "USDT");
    console.log("  Short amount:", SHORT_AMOUNT, "USDT");

    const longAmount = ethers.utils.parseUnits(LONG_AMOUNT, 6);
    const shortAmount = ethers.utils.parseUnits(SHORT_AMOUNT, 6);

    // For ExchangeRouter deposits, we need to sendTokens first
    const sendLongTx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, longAmount);
    console.log("  Sent long tokens tx:", sendLongTx.hash);
    await sendLongTx.wait();

    const sendShortTx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, shortAmount);
    console.log("  Sent short tokens tx:", sendShortTx.hash);
    await sendShortTx.wait();
    console.log("  ✅ Both long and short tokens sent\n");

    // Step 3: Create BALANCED deposit parameters
    console.log("Step 3: Creating balanced deposit parameters...");

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
    console.log("    Long tokens:", LONG_AMOUNT, "USDT");
    console.log("    Short tokens:", SHORT_AMOUNT, "USDT");
    console.log("    Receiver:", signer.address);
    console.log("    Balanced: YES (equal long/short)\n");

    // Step 4: Call createDeposit
    console.log("Step 4: Creating balanced deposit...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n✅ SUCCESS! Balanced liquidity deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n💡 Why balanced deposits work better:");
        console.log("   - No price impact from imbalancing the pool");
        console.log("   - Equal exposure to both sides");
        console.log("   - Optimal for single-token markets");
        console.log("\n⏳ Execute this deposit to receive market tokens");

    } catch (error) {
        console.log("\n❌ Error creating balanced deposit:", error.message);
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