const { ethers } = require("hardhat");

async function main() {
    console.log("=== Creating Balanced Deposit (50/50 Long/Short) ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    // Contract addresses - use checksummed addresses
    const EXCHANGE_ROUTER = ethers.utils.getAddress("0xfc6cf8ae57f98426dd07992c8bc81f41f674c78a");
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // Step 1: Check USDT balance in DepositVault (should already have 100 USDT from previous attempt)
    console.log("Step 1: Checking USDT balance in DepositVault...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    const requiredAmount = ethers.utils.parseUnits("100", 6); // 100 USDT total
    if (vaultBalance.lt(requiredAmount)) {
        const transferAmount = requiredAmount.sub(vaultBalance);
        console.log("  Need to transfer", ethers.utils.formatUnits(transferAmount, 6), "USDT more");
        
        const transferTx = await usdt.transfer(DEPOSIT_VAULT, transferAmount);
        console.log("  Transfer tx:", transferTx.hash);
        await transferTx.wait();
        console.log("  ✅ Transfer complete");
    } else {
        console.log("  ✅ DepositVault already has enough USDT");
    }

    // Step 2: Create deposit with 50/50 split
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
        numbers: {
            initialLongTokenAmount: ethers.utils.parseUnits("50", 6), // 50 USDT for long side
            initialShortTokenAmount: ethers.utils.parseUnits("50", 6), // 50 USDT for short side
            minMarketTokens: 0,
            updatedAtTime: 0,
            executionFee: 0, // Must be 0 for first deposit
            callbackGasLimit: 0
        },
        srcChainId: 0,
        dataList: []
    };

    console.log("  Deposit params:");
    console.log("    Market:", MARKET);
    console.log("    Long token (USDT):", USDT);
    console.log("    Short token (USDT):", USDT);
    console.log("    Long amount: 50 USDT");
    console.log("    Short amount: 50 USDT");
    console.log("    Receiver:", depositParams.addresses.receiver, "(address(1) - required for first deposit)");
    console.log("    Execution fee: 0 (must be 0)");

    console.log("\nStep 3: Calling createDeposit on ExchangeRouter...");
    console.log("  NOT sending any ETH (fee = 0 discovery)");

    const createTx = await exchangeRouter.createDeposit(depositParams, { value: 0 });
    console.log("  Transaction sent:", createTx.hash);

    const receipt = await createTx.wait();
    console.log("  Transaction confirmed in block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());

    // Try to extract deposit key from events if possible
    console.log("\n  Events emitted:");
    if (receipt.logs && receipt.logs.length > 0) {
        // Look for DepositCreated event
        for (const log of receipt.logs) {
            console.log("    Event at", log.address);
        }
    }

    console.log("\n✅ SUCCESS! Balanced deposit created!");
    console.log("\n📝 Transaction hash:", createTx.hash);
    console.log("\n⏳ Note: The deposit has been CREATED but not yet EXECUTED.");
    console.log("   A keeper needs to execute it with oracle prices.");
    console.log("\n🔑 Key parameters used:");
    console.log("   - 50 USDT for long side");
    console.log("   - 50 USDT for short side");
    console.log("   - receiver = address(1) (required for first deposit)");
    console.log("   - executionFee = 0 (bypass fee validation)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
