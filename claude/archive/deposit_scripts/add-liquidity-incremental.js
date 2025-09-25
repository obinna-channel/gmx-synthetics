const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Adding Liquidity Incrementally to USDTNGN Market ===\n");
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

    // Calculate current pool value (approximation)
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("Current DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Step 1: Try smaller increment - 0.5 USDT
    const INCREMENT_AMOUNT = "0.5"; // Start with 0.5 USDT
    console.log("\n🔍 TESTING INCREMENTAL LIQUIDITY ADDITION");
    console.log("   Strategy: Add", INCREMENT_AMOUNT, "USDT at a time");
    console.log("   Reason: Avoid price impact from large deposits\n");

    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));

    const requiredAmount = ethers.utils.parseUnits(INCREMENT_AMOUNT, 6);
    if (userBalance.lt(requiredAmount)) {
        console.log("❌ Insufficient USDT. You need at least", INCREMENT_AMOUNT, "USDT");
        return;
    }

    // Step 2: Check and transfer USDT to DepositVault
    console.log("\nStep 1: Ensuring DepositVault has funds...");

    if (vaultBalance.lt(requiredAmount)) {
        console.log("  Transferring", INCREMENT_AMOUNT, "USDT to DepositVault...");
        const tx = await usdt.transfer(DEPOSIT_VAULT, requiredAmount);
        console.log("  Transfer tx:", tx.hash);
        await tx.wait();
        console.log("  ✅ Transfer complete\n");
    } else {
        console.log("  ✅ Sufficient USDT in vault\n");
    }

    // Step 3: Create deposit parameters for incremental addition
    console.log("Step 2: Creating incremental deposit parameters...");

    // For normal deposits after initialization:
    // - receiver is YOUR address (not address(1))
    // - Small amounts to avoid price impact
    // - Single-token markets don't support swaps

    const depositParams = {
        addresses: {
            receiver: signer.address, // YOUR address for normal deposits
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT, // Same as long for single-token market
            longTokenSwapPath: [], // No swaps in single-token markets
            shortTokenSwapPath: [] // No swaps in single-token markets
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("  Deposit params:");
    console.log("    Market:", MARKET);
    console.log("    Amount:", INCREMENT_AMOUNT, "USDT (small increment)");
    console.log("    Receiver:", signer.address);
    console.log("    Single-token market: USDT/USDT");
    console.log("    Note: No swaps supported for single-token markets");

    // Step 4: Call createDeposit with small amount
    console.log("\nStep 3: Creating incremental deposit...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        console.log("\n✅ SUCCESS! Incremental deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n💡 Strategy for single-token markets:");
        console.log("   1. Add liquidity in small increments (" + INCREMENT_AMOUNT + " USDT)");
        console.log("   2. Execute each deposit before adding more");
        console.log("   3. Gradually build up pool liquidity");
        console.log("   4. Avoid large deposits that trigger price impact");
        console.log("\n⏳ Next step: Execute this deposit to add liquidity");
        console.log("\n🔄 Then repeat process to gradually increase pool size");

    } catch (error) {
        console.log("\n❌ Error creating incremental deposit:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }

        console.log("\n💡 If this fails, try even smaller amounts:");
        console.log("   - 0.1 USDT");
        console.log("   - 0.01 USDT");
        console.log("   Single-token markets may have strict price impact limits");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });