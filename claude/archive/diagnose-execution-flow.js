const { ethers } = require("hardhat");

async function main() {
    console.log("=== Analyzing Deposit Execution Flow ===\n");
    
    const [signer] = await ethers.getSigners();
    
    // First, let's create a fresh deposit and execute it while monitoring
    console.log("Step 1: Creating a fresh deposit for analysis...\n");
    
    const EXCHANGE_ROUTER = "0x3cf4238ae5B5224E711E59d6E23B66C965f64706";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check balance
    const balance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(balance, 6));
    
    if (balance.lt(ethers.utils.parseUnits("100", 6))) {
        console.log("❌ Need at least 100 USDT");
        return;
    }
    
    // Approve USDT
    const allowance = await usdt.allowance(signer.address, "0x032b241De86a8660f1Ae0691a4760B426EA246d7");
    if (allowance.lt(ethers.utils.parseUnits("100", 6))) {
        console.log("Approving USDT...");
        await usdt.approve("0x032b241De86a8660f1Ae0691a4760B426EA246d7", ethers.utils.parseUnits("100", 6));
        console.log("✅ Approved\n");
    }
    
    // Create deposit
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        numbers: {
            initialLongTokenAmount: ethers.utils.parseUnits("100", 6),
            initialShortTokenAmount: 0,
            minMarketTokens: 0,
            updatedAtBlock: 0,
            updatedAtTime: 0,
            executionFee: 0,
            callbackGasLimit: 0
        },
        orderType: 0,
        shouldUnwrapNativeToken: false,
        autoCancel: false
    };
    
    console.log("Creating deposit...\n");
    const createTx = await exchangeRouter.connect(signer).createDeposit(depositParams);
    const createReceipt = await createTx.wait();
    
    // Get deposit key from events
    const eventEmitter = await ethers.getContractAt("EventEmitter", "0x9f7a35862df4513e59d63cceac1eb15e0f887ad2");
    let depositKey;
    for (const log of createReceipt.logs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            if (parsed.name === "DepositCreated") {
                depositKey = parsed.args.key;
                console.log("✅ Deposit created with key:", depositKey);
                break;
            }
        } catch {}
    }
    
    if (!depositKey) {
        console.log("❌ Could not find deposit key");
        return;
    }
    
    // Now set oracle prices and execute
    console.log("\nStep 2: Setting oracle prices...\n");
    
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const sNGN = "0xe0dba0326623dece1712581271ebcd846d67b29f";
    
    await oracle.clearAllPrices();
    await oracle.setPrimaryPrice(USDT, { 
        min: ethers.utils.parseUnits("1", 30), 
        max: ethers.utils.parseUnits("1", 30) 
    });
    await oracle.setPrimaryPrice(sNGN, { 
        min: ethers.utils.parseUnits("1500", 30), 
        max: ethers.utils.parseUnits("1500", 30) 
    });
    
    const currentTime = Math.floor(Date.now() / 1000);
    await oracle.setTimestamps(currentTime - 30, currentTime + 30);
    console.log("✅ Prices set\n");
    
    // Execute with detailed monitoring
    console.log("Step 3: Executing deposit and monitoring...\n");
    
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    console.log("Executing deposit...");
    const executeTx = await depositHandler.executeDeposit(
        depositKey,
        oracleParams,
        { gasLimit: 5000000 }
    );
    
    console.log("Transaction hash:", executeTx.hash);
    console.log("Waiting for receipt...\n");
    
    const receipt = await executeTx.wait();
    
    console.log("=== EXECUTION RESULTS ===");
    console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Block:", receipt.blockNumber);
    
    // Analyze events
    console.log("\n=== EVENTS ANALYSIS ===");
    if (receipt.logs && receipt.logs.length > 0) {
        console.log("Total events:", receipt.logs.length);
        
        let depositCancelledFound = false;
        let errorReason = null;
        
        for (const log of receipt.logs) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                if (parsed.name === "DepositCancelled") {
                    depositCancelledFound = true;
                    console.log("\n⚠️ DEPOSIT CANCELLED EVENT FOUND");
                    if (parsed.args.reason) {
                        errorReason = parsed.args.reason;
                        console.log("Cancellation reason:", errorReason);
                    }
                    if (parsed.args.reasonBytes) {
                        console.log("Reason bytes:", parsed.args.reasonBytes);
                    }
                }
                
                // Log important events
                if (["DepositExecuted", "DepositCancelled", "MarketPoolValueUpdated", "SwapInfo"].includes(parsed.name)) {
                    console.log("Event:", parsed.name);
                }
            } catch {}
        }
        
        if (depositCancelledFound) {
            console.log("\n❌ DEPOSIT WAS CANCELLED INTERNALLY");
            if (errorReason) {
                console.log("Error:", errorReason);
                // Try to decode the error
                if (errorReason.startsWith("0x")) {
                    console.log("\nAttempting to decode error:", errorReason);
                    if (errorReason === "0x95b66fe9") {
                        console.log("This is the mysterious 0x95b66fe9 error!");
                    }
                }
            }
        }
    } else {
        console.log("No events emitted - transaction may have reverted early");
    }
    
    // Check final state
    console.log("\n=== FINAL STATE ===");
    const DEPOSIT_VAULT = "0x149a382b27bf4d9de20142d3e22d0933c9f8c794";
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const yourBalance = await usdt.balanceOf(signer.address);
    
    console.log("DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6));
    console.log("Your USDT:", ethers.utils.formatUnits(yourBalance, 6));
    
    if (vaultBalance.eq(0)) {
        console.log("\n💡 USDT was refunded - deposit was cancelled");
    }
    
    // Check if market has any liquidity
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const marketSupply = await marketToken.totalSupply();
    console.log("\nMarket token supply:", ethers.utils.formatEther(marketSupply));
    
    if (marketSupply.gt(0)) {
        console.log("✅ Market has liquidity!");
    } else {
        console.log("❌ Market still has no liquidity");
    }
}

main().catch(console.error);