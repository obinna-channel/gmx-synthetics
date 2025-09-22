const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING DEPOSIT WITH DETAILED LOGGING ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    
    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    
    // Check current state
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("DepositVault has:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    
    const params = {
        addresses: {
            receiver: deployer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: ethers.constants.AddressZero,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };
    
    console.log("\nSending actual transaction...");
    
    try {
        const tx = await exchangeRouter.createDeposit(
            params,
            { 
                value: ethers.utils.parseEther("0.001"),
                gasLimit: 3000000 // High gas limit to ensure it's not gas issue
            }
        );
        
        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        console.log("\n✅ SUCCESS! Transaction mined!");
        console.log("Status:", receipt.status);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Events emitted:", receipt.events?.length || 0);
        
        // Parse events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\n=== EVENTS ===");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log(`\nEvent: ${event.event}`);
                    if (event.args) {
                        for (const key of Object.keys(event.args)) {
                            if (isNaN(key)) {
                                console.log(`  ${key}:`, event.args[key].toString());
                            }
                        }
                    }
                } else {
                    // Try to decode unknown events
                    console.log("\nUnknown event from:", event.address);
                    console.log("Topics:", event.topics);
                }
            }
        }
        
        // Get the return value
        const returnData = receipt.logs[0]?.data;
        if (returnData) {
            console.log("\nReturn data:", returnData);
        }
        
    } catch (error) {
        console.log("\n❌ Transaction failed!");
        
        // Check if it's a revert
        if (error.receipt) {
            console.log("Transaction was mined but reverted");
            console.log("Status:", error.receipt.status);
            console.log("Transaction hash:", error.receipt.transactionHash);
            
            // Try to get revert reason from the node
            try {
                const tx = await ethers.provider.getTransaction(error.receipt.transactionHash);
                const code = await ethers.provider.call(tx, tx.blockNumber);
                console.log("Revert code:", code);
            } catch (e) {
                console.log("Could not get revert reason");
            }
        } else {
            console.log("Error:", error.reason || error.message);
        }
    }
}

main().catch(console.error);
