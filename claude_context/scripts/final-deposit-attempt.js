const { ethers } = require("hardhat");

async function main() {
    console.log("=== FINAL DEPOSIT ATTEMPT WITH PROPER AMOUNTS ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);
    
    // Check vault balance
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Vault has:", ethers.utils.formatUnits(vaultBalance, 6), "USDT ready");
    
    // The issue might be that we need to specify amounts in a different structure
    // Let me check the exact ABI for createDeposit
    const abi = exchangeRouter.interface.functions["createDeposit((address,address,address,address,address,address,address[],address[]),uint256,bool,uint256,uint256,bytes32[])"];
    console.log("\nFunction expects these parameters:");
    console.log("1. addresses (struct)");
    console.log("2. minMarketTokens (uint256)");
    console.log("3. shouldUnwrapNativeToken (bool)");
    console.log("4. executionFee (uint256)");
    console.log("5. callbackGasLimit (uint256)");
    console.log("6. dataList (bytes32[])");
    
    // Since the amounts are in the vault, we need to tell the contract how much to use
    // This might be done through the dataList parameter
    const depositAmount = ethers.utils.parseUnits("100", 6);
    
    // Encode the deposit amount as bytes32
    const amountData = ethers.utils.hexZeroPad(depositAmount.toHexString(), 32);
    
    const params = {
        addresses: {
            receiver: deployer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT, // Same token market
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: [amountData, amountData] // Long and short amounts
    };
    
    console.log("\nAttempting deposit with amount data in dataList...");
    
    try {
        const tx = await exchangeRouter.createDeposit(
            params,
            { value: ethers.utils.parseEther("0.001") }
        );
        
        const receipt = await tx.wait();
        console.log("\n✅ SUCCESS!");
        console.log("Transaction:", receipt.transactionHash);
        
    } catch (error) {
        console.log("❌ Failed:", error.reason || error.message);
        
        // The issue is we're not specifying the actual deposit amounts
        // They should be in DepositVault already, but the contract needs to know how much
        console.log("\nThe problem seems to be that createDeposit doesn't know");
        console.log("how much USDT from the vault to use for the deposit.");
        console.log("\nWe need to check how deposit amounts are specified.");
    }
}

main().catch(console.error);
