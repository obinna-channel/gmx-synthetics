const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Testing deposit creation with higher execution fee...\n");

    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

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
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.01"), // Try 10x higher fee
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Execution fee:", ethers.utils.formatEther(depositParams.executionFee), "ETH");

    try {
        // Try with manual gas limit
        const depositTx = await exchangeRouter.createDeposit(depositParams, {
            value: depositParams.executionFee,
            gasLimit: 5000000
        });
        console.log("Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("✅ SUCCESS! Gas used:", receipt.gasUsed.toString());

    } catch (error) {
        console.log("❌ Error:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);
