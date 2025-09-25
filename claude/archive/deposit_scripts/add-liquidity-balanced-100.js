const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding LARGE BALANCED Liquidity to USDTNGN Market ===\n");
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

    // LARGE BALANCED DEPOSIT
    const LONG_AMOUNT = "100"; // 100 USDT for long side
    const SHORT_AMOUNT = "100"; // 100 USDT for short side
    const TOTAL_AMOUNT = "200"; // Total 200 USDT

    console.log("\n💡 LARGE BALANCED DEPOSIT:");
    console.log("   Long side:", LONG_AMOUNT, "USDT");
    console.log("   Short side:", SHORT_AMOUNT, "USDT");
    console.log("   Total:", TOTAL_AMOUNT, "USDT");
    console.log("   Strategy: Large enough to overcome rounding issues\n");

    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));

    const totalRequired = ethers.utils.parseUnits(TOTAL_AMOUNT, 6);
    if (userBalance.lt(totalRequired)) {
        console.log("❌ Insufficient USDT. You need", TOTAL_AMOUNT, "USDT");
        return;
    }

    // Step 1: Approve Router
    console.log("Step 1: Approving Router to spend", TOTAL_AMOUNT, "USDT...");
    const currentAllowance = await usdt.allowance(signer.address, ROUTER);

    if (currentAllowance.lt(totalRequired)) {
        const approveTx = await usdt.approve(ROUTER, totalRequired);
        console.log("  Approval tx:", approveTx.hash);
        await approveTx.wait();
        console.log("  ✅ Approved\n");
    } else {
        console.log("  ✅ Already has sufficient approval\n");
    }

    // Step 2: Send tokens to DepositVault via ExchangeRouter
    console.log("Step 2: Sending USDT to DepositVault...");

    const longAmount = ethers.utils.parseUnits(LONG_AMOUNT, 6);
    const shortAmount = ethers.utils.parseUnits(SHORT_AMOUNT, 6);

    const sendLongTx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, longAmount);
    console.log("  Sent", LONG_AMOUNT, "USDT for long side, tx:", sendLongTx.hash);
    await sendLongTx.wait();

    const sendShortTx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, shortAmount);
    console.log("  Sent", SHORT_AMOUNT, "USDT for short side, tx:", sendShortTx.hash);
    await sendShortTx.wait();
    console.log("  ✅ Tokens sent\n");

    // Step 3: Create deposit
    console.log("Step 3: Creating large balanced deposit...");

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

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n✅ SUCCESS! Large balanced deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n💡 With 200 USDT total (100/100 balanced):");
        console.log("   - Should overcome market token rounding issues");
        console.log("   - Expected ~200M market tokens based on initial ratio");
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