const { ethers } = require("hardhat");

async function main() {
    console.log("=== Creating Balanced Deposit (50/50 Long/Short) ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0xFc6cF8aE57f98426DD07992C8Bc81f41F674c78a";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // Step 1: Check USDT balance
    console.log("Step 1: Checking USDT balance in DepositVault...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    const requiredAmount = ethers.utils.parseUnits("100", 6);
    if (vaultBalance.lt(requiredAmount)) {
        const transferAmount = requiredAmount.sub(vaultBalance);
        console.log("  Need to transfer", ethers.utils.formatUnits(transferAmount, 6), "USDT");
        
        const transferTx = await usdt.transfer(DEPOSIT_VAULT, transferAmount);
        await transferTx.wait();
        console.log("  ✅ Transfer complete");
    } else {
        console.log("  ✅ DepositVault has enough USDT");
    }

    // Step 2: Create balanced deposit using CORRECT structure
    console.log("\nStep 2: Creating balanced deposit parameters...");
    
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
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
        executionFee: 0, // Must be 0
        callbackGasLimit: 0,
        dataList: []
    };

    // Now we need to send the amounts separately
    const amounts = {
        initialLongTokenAmount: ethers.utils.parseUnits("50", 6), // 50 USDT for long
        initialShortTokenAmount: ethers.utils.parseUnits("50", 6), // 50 USDT for short
    };

    console.log("  Deposit structure:");
    console.log("    Market:", MARKET);
    console.log("    Long amount: 50 USDT");
    console.log("    Short amount: 50 USDT");
    console.log("    Receiver:", depositParams.addresses.receiver);

    console.log("\nStep 3: Sending funds to Router first...");
    // First send the long token amount
    const sendLongTx = await exchangeRouter.sendTokens(
        USDT,
        DEPOSIT_VAULT,
        amounts.initialLongTokenAmount
    );
    await sendLongTx.wait();
    console.log("  ✅ Long tokens sent");

    // Then send the short token amount
    const sendShortTx = await exchangeRouter.sendTokens(
        USDT,
        DEPOSIT_VAULT,
        amounts.initialShortTokenAmount
    );
    await sendShortTx.wait();
    console.log("  ✅ Short tokens sent");

    console.log("\nStep 4: Creating the deposit...");
    const createTx = await exchangeRouter.createDeposit(depositParams, { value: 0 });
    console.log("  Transaction sent:", createTx.hash);

    const receipt = await createTx.wait();
    console.log("  Transaction confirmed!");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());

    console.log("\n✅ SUCCESS! Balanced deposit created!");
    console.log("\n🔑 Key parameters:");
    console.log("   - 50 USDT for long side");
    console.log("   - 50 USDT for short side");
    console.log("   - Total: 100 USDT");
}

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
