const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING DEPOSIT WITH ZERO EXECUTION FEE ===\n");
    console.log("(We know this works in simulation)\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [signer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);

    // Check vault balance
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault has:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("(From previous attempts - this will be used for the deposit)");

    // Create deposit with ZERO execution fee
    const depositParams = {
        addresses: {
            receiver: signer.address,
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
        executionFee: 0,  // ZERO FEE!
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== CREATING DEPOSIT ===");
    console.log("Market:", ADDRESSES.MARKET);
    console.log("Tokens in vault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("Execution fee: 0 ETH (keeper will pay gas)");

    try {
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            { gasLimit: 3000000 }  // No value sent
        );

        console.log("\n✅ Transaction sent!");
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed");
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        if (receipt.status === 1) {
            console.log("\n🎉 DEPOSIT CREATED SUCCESSFULLY!");

            // Look for deposit key in logs
            const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
            const depositEvent = receipt.logs?.find(log =>
                log.topics[0] === depositCreatedTopic
            );

            if (depositEvent) {
                const depositKey = depositEvent.topics[1];
                console.log("\n=== SUCCESS ===");
                console.log("Deposit Key:", depositKey);
                console.log("\nThe deposit has been created!");
                console.log("Since executionFee = 0, a keeper must pay the gas to execute it.");
                console.log("Or you can execute it yourself with the ORDER_KEEPER role.");
            }
        } else {
            console.log("\n❌ Transaction reverted");
        }

    } catch (error) {
        console.log("\n❌ Error creating deposit");
        console.log("Error:", error.message);
    }
}

main().catch(console.error);