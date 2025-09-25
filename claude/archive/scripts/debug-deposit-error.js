const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING DEPOSIT ERROR ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    
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
    
    console.log("Attempting to simulate transaction to get error details...\n");
    
    try {
        // Use eth_call to simulate and get the revert reason
        const callData = exchangeRouter.interface.encodeFunctionData("createDeposit", [params]);
        
        const result = await ethers.provider.call({
            to: EXCHANGE_ROUTER,
            from: deployer.address,
            data: callData,
            value: ethers.utils.parseEther("0.001")
        });
        
        console.log("Unexpected success in simulation:", result);
        
    } catch (error) {
        console.log("Raw error:", error.reason || error.message);
        
        // Try to extract the revert reason
        if (error.data) {
            try {
                // Try decoding as a string
                const reason = ethers.utils.toUtf8String("0x" + error.data.substr(138));
                console.log("\n📍 REVERT REASON:", reason);
            } catch (e) {
                // Try another approach
                try {
                    // Standard Error(string) selector: 0x08c379a0
                    if (error.data.startsWith("0x08c379a0")) {
                        const reasonHex = "0x" + error.data.substr(10);
                        const reason = ethers.utils.defaultAbiCoder.decode(["string"], reasonHex);
                        console.log("\n📍 REVERT REASON:", reason[0]);
                    } else {
                        console.log("Error data:", error.data);
                    }
                } catch (e2) {
                    console.log("Could not decode error:", e2.message);
                    console.log("Raw error data:", error.data);
                }
            }
        }
        
        // Also check if it's a custom error
        if (error.errorName) {
            console.log("\nCustom error:", error.errorName);
            console.log("Error args:", error.errorArgs);
        }
    }
}

main().catch(console.error);
