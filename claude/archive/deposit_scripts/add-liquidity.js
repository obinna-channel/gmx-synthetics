const { ethers } = require("hardhat");

async function main() {
    console.log("=== Adding Liquidity to USDTNGN Market ===\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);
    
    // Contract addresses
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const ROUTER = "0x032b241De86a8660f1Ae0691a4760B426EA246d7";
    
    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    
    // Check current market token supply
    const currentSupply = await marketToken.totalSupply();
    console.log("Current market token supply:", ethers.utils.formatEther(currentSupply));
    console.log("Market is initialized:", currentSupply.gt(0) ? "✅ YES" : "❌ NO");
    
    if (currentSupply.eq(0)) {
        console.log("\n❌ Market needs to be initialized first!");
        console.log("Run the 1 USDT first deposit script.");
        return;
    }
    
    // Step 1: Decide how much liquidity to add
    const LIQUIDITY_AMOUNT = "1000"; // 1000 USDT
    console.log("\nStep 1: Preparing to add", LIQUIDITY_AMOUNT, "USDT liquidity");
    
    // Check user balance
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("  Your USDT balance:", ethers.utils.formatUnits(userBalance, 6));
    
    const requiredAmount = ethers.utils.parseUnits(LIQUIDITY_AMOUNT, 6);
    if (userBalance.lt(requiredAmount)) {
        console.log("  ❌ Insufficient USDT. You need", LIQUIDITY_AMOUNT, "USDT");
        return;
    }
    
    // Step 2: Approve Router to spend USDT
    console.log("\nStep 2: Approving Router to spend USDT...");
    const currentAllowance = await usdt.allowance(signer.address, ROUTER);
    
    if (currentAllowance.lt(requiredAmount)) {
        const approveTx = await usdt.approve(ROUTER, requiredAmount);
        console.log("  Approval tx:", approveTx.hash);
        await approveTx.wait();
        console.log("  ✅ Approved");
    } else {
        console.log("  ✅ Already approved");
    }
    
    // Step 3: Create deposit parameters
    console.log("\nStep 3: Creating deposit parameters...");
    
    // For normal deposits (not first):
    // - receiver is the user's address (not address(1))
    // - executionFee can be non-zero (but we'll keep it 0 for simplicity)
    // - We'll deposit all as long token (100% to long side)
    
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
    
    console.log("  Deposit configuration:");
    console.log("    Amount:", LIQUIDITY_AMOUNT, "USDT");
    console.log("    Receiver:", signer.address, "(your address)");
    console.log("    Long side:", LIQUIDITY_AMOUNT, "USDT");
    console.log("    Short side: 0 USDT");
    console.log("    Execution fee: 0");
    
    // Step 4: Create the deposit
    console.log("\nStep 4: Creating deposit...");
    
    try {
        const depositTx = await exchangeRouter.createDeposit(
            depositParams,
            { value: 0 } // No ETH for execution fee
        );
        
        console.log("  Transaction sent:", depositTx.hash);
        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        
        console.log("\n✅ SUCCESS! Liquidity deposit created!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n⏳ Next steps:");
        console.log("   1. Execute the deposit with oracle prices");
        console.log("   2. You'll receive market tokens representing your liquidity share");
        console.log("\n💡 Note: You can also split liquidity between long and short sides");
        console.log("   - All to long: protects against price increases");
        console.log("   - All to short: protects against price decreases");
        console.log("   - 50/50 split: balanced exposure");
        
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