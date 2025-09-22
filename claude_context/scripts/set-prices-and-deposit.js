const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING PRICES AND USING MULTICALL ===\n");

    const ADDRESSES = {
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };
    
    const [deployer] = await ethers.getSigners();
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    
    console.log("1. Setting oracle prices in DataStore...");
    
    // Set USDT price ($1 with 30 decimals precision)
    const usdtPrice = ethers.utils.parseUnits("1", 30);
    const usdtPriceKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["PRIMARY_PRICE", ADDRESSES.USDT])
    );
    
    try {
        await dataStore.setUint(usdtPriceKey, usdtPrice);
        console.log("✓ USDT price set: $1.00");
    } catch (e) {
        console.log("Error setting USDT price:", e.message);
    }
    
    // Set sNGN price (1650 NGN = 1 USD, so 1 NGN = 1/1650 USD)
    const ngnPriceInUsd = ethers.utils.parseUnits("1", 30).div(1650);
    const ngnPriceKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["PRIMARY_PRICE", ADDRESSES.sNGN])
    );
    
    try {
        await dataStore.setUint(ngnPriceKey, ngnPriceInUsd);
        console.log("✓ sNGN price set: $0.000606 (1/1650)");
    } catch (e) {
        console.log("Error setting sNGN price:", e.message);
    }
    
    console.log("\n2. Using multicall for deposit...");
    
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);
    
    // First approve fresh tokens
    const depositAmount = ethers.utils.parseUnits("10", 6); // 10 USDT
    console.log("Approving Router for 10 USDT...");
    await usdt.approve(ADDRESSES.ROUTER, depositAmount);
    
    // Encode sendTokens call
    const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        ADDRESSES.USDT,
        ADDRESSES.DEPOSIT_VAULT, 
        depositAmount
    ]);
    
    // Encode createDeposit call
    const depositParams = {
        addresses: {
            receiver: deployer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };
    
    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [depositParams]);
    
    console.log("\n3. Executing multicall...");
    
    try {
        const tx = await exchangeRouter.multicall(
            [sendTokensData, createDepositData],
            { value: ethers.utils.parseEther("0.001") }
        );
        
        const receipt = await tx.wait();
        console.log("\n✅ SUCCESS!");
        console.log("Transaction:", receipt.transactionHash);
        console.log("Gas used:", receipt.gasUsed.toString());
        
    } catch (error) {
        console.log("❌ Multicall failed:", error.reason || error.message);
    }
}

main().catch(console.error);
