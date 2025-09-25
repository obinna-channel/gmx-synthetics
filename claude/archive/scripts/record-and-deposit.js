const { ethers } = require("hardhat");

async function main() {
    console.log("=== RECORDING AMOUNT AND CREATING DEPOSIT ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const [deployer] = await ethers.getSigners();
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Try to record the deposit amount manually
    const depositAmount = ethers.utils.parseUnits("100", 6);
    
    // The key for recording deposit amount
    const depositKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["string", "address", "address"],
            ["ACCOUNT_DEPOSIT_AMOUNT", deployer.address, USDT]
        )
    );
    
    console.log("Attempting to record deposit amount of 100 USDT...");
    
    try {
        const tx = await dataStore.setUint(depositKey, depositAmount);
        await tx.wait();
        console.log("✓ Recorded deposit amount");
        
        // Verify
        const recorded = await dataStore.getUint(depositKey);
        console.log("Verified amount:", ethers.utils.formatUnits(recorded, 6), "USDT");
        
    } catch (e) {
        console.log("Could not record manually:", e.message);
    }
    
    // Now try the deposit
    console.log("\nAttempting deposit creation...");
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    
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
    
    try {
        const tx = await exchangeRouter.createDeposit(
            params,
            { value: ethers.utils.parseEther("0.001") }
        );
        
        const receipt = await tx.wait();
        console.log("\n✅ DEPOSIT CREATED!");
        console.log("Transaction:", receipt.transactionHash);
        
    } catch (error) {
        console.log("❌ Still failing:", error.reason || error.message);
    }
}

main().catch(console.error);
