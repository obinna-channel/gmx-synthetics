const { ethers } = require("hardhat");

async function main() {
    console.log("=== ATTEMPTING TO GET DETAILED ERROR ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    
    // Try with minimal parameters
    const params = {
        addresses: {
            receiver: deployer.address,
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
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };
    
    console.log("Attempting static call first to see if it would revert...");
    
    try {
        // Try static call to see what happens without sending transaction
        const result = await exchangeRouter.callStatic.createDeposit(
            params,
            { value: ethers.utils.parseEther("0.001") }
        );
        console.log("Static call succeeded! Would return:", result);
        
        // If static succeeds, try actual transaction
        console.log("\nSending actual transaction...");
        const tx = await exchangeRouter.createDeposit(
            params,
            { value: ethers.utils.parseEther("0.001") }
        );
        const receipt = await tx.wait();
        console.log("✅ SUCCESS! Tx:", receipt.transactionHash);
        
    } catch (error) {
        console.log("Error details:");
        console.log("  Message:", error.message);
        
        // Try to extract error from message
        const match = error.message.match(/reason="([^"]+)"/);
        if (match) {
            console.log("\n📍 REVERT REASON:", match[1]);
        }
        
        // Check if it's an execution revert with no reason
        if (error.message.includes("execution reverted") && !match) {
            console.log("\nExecution reverted with no reason string.");
            console.log("This usually means:");
            console.log("1. An assertion failed without a message");
            console.log("2. A low-level call failed");
            console.log("3. The contract doesn't exist or has no code");
            
            // Check if ExchangeRouter has createDeposit function
            const code = await ethers.provider.getCode(EXCHANGE_ROUTER);
            console.log("\nExchangeRouter has code:", code.length > 2);
            
            // The issue might be in a downstream contract
            console.log("\nThe revert is likely happening in a contract called by ExchangeRouter.");
            console.log("Possible culprits:");
            console.log("- DepositHandler");
            console.log("- DepositVault"); 
            console.log("- DataStore");
            console.log("- The market contract itself");
        }
    }
}

main().catch(console.error);
