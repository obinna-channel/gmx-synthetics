const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING DEPOSIT WITH CORRECT PARAMS ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
    };

    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    // CreateDepositParams structure (as expected by the contract)
    const depositParams = {
        receiver: deployer.address,
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: ADDRESSES.MARKET,
        initialLongToken: ADDRESSES.USDT,
        initialShortToken: ethers.constants.AddressZero,
        longTokenSwapPath: [],
        shortTokenSwapPath: [],
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0
    };

    try {
        console.log("Creating deposit for 100 USDT (already in vault)...");
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            { value: ethers.utils.parseEther("0.001") }
        );
        
        const receipt = await tx.wait();
        console.log("✓ Deposit created! Tx:", receipt.transactionHash);
        
        // Look for DepositCreated event
        const depositCreatedEvent = receipt.events?.find(e => 
            e.topics[0] === ethers.utils.id("DepositCreated(bytes32,address,(address,address,address,address,address,address,address[],address[],uint256,uint256,uint256,uint256,uint256,uint256,bool))")
        );
        
        if (depositCreatedEvent) {
            const depositKey = depositCreatedEvent.topics[1];
            console.log("Deposit Key:", depositKey);
        }
        
    } catch (error) {
        console.log("❌ Error:", error.reason || error.message);
    }
}

main().catch(console.error);
