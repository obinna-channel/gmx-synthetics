const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit with Own Address as Receiver ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // Step 1: Check USDT balance in DepositVault
    console.log("Step 1: Checking USDT balance in DepositVault...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    if (vaultBalance.lt(ethers.utils.parseUnits("100", 6))) {
        const needed = ethers.utils.parseUnits("100", 6).sub(vaultBalance);
        console.log("  Transferring", ethers.utils.formatUnits(needed, 6), "USDT to DepositVault...");
        const tx = await usdt.transfer(DEPOSIT_VAULT, needed);
        await tx.wait();
        console.log("  ✅ Transfer complete");
    } else {
        console.log("  ✅ Sufficient USDT in vault");
    }

    // Step 2: Create deposit with SIGNER ADDRESS as receiver
    console.log("\nStep 2: Creating deposit with YOUR address as receiver...");
    
    const depositParams = {
        addresses: {
            receiver: signer.address, // CHANGED: Using signer address instead of address(1)
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
    console.log("    Receiver:", depositParams.addresses.receiver, "(YOUR ADDRESS)");
    console.log("    Market:", MARKET);
    console.log("    Amount: 100 USDT");

    console.log("\nStep 3: Creating deposit...");
    
    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
        console.log("  Transaction sent:", depositTx.hash);
        
        const receipt = await depositTx.wait();
        console.log("  ✅ Deposit created successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        
        console.log("\n📝 KEY CHANGE:");
        console.log("  Receiver is now YOUR address, not address(1)");
        console.log("  This should bypass any address(1) related issues");
        console.log("  Market tokens will be minted to YOU if execution succeeds");
        
    } catch (error) {
        console.log("  ❌ Error creating deposit:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
