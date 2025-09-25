const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING DEPOSIT WITH TOKENS ALREADY IN VAULT ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    
    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    
    // Check unrecorded balance
    const actualBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const recordedBalance = await depositVault.tokenBalances(USDT);
    const unrecorded = actualBalance.sub(recordedBalance);
    
    console.log("Unrecorded USDT in vault:", ethers.utils.formatUnits(unrecorded, 6));
    
    if (unrecorded.gt(0)) {
        console.log("Good! There are unrecorded tokens to use for deposit.\n");
        
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
        
        console.log("Attempting createDeposit...");
        
        try {
            const tx = await exchangeRouter.createDeposit(
                params,
                { value: ethers.utils.parseEther("0.001") }
            );
            
            console.log("Transaction sent!");
            const receipt = await tx.wait();
            
            console.log("\n✅ DEPOSIT CREATED SUCCESSFULLY!");
            console.log("Transaction:", receipt.transactionHash);
            console.log("Gas used:", receipt.gasUsed.toString());
            
            // Check for events
            for (const event of receipt.events || []) {
                if (event.event === "DepositCreated") {
                    console.log("\nDeposit Key:", event.args.key);
                }
            }
            
        } catch (error) {
            console.log("❌ Still failing:", error.reason || error.message);
        }
    }
}

main().catch(console.error);
