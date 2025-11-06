const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Closing PKR Position ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const ORDER_VAULT = "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    // Market and tokens
    const MARKET = "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383"; // Market 14: mPKR/mUSD/mUSD
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mPKR = "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD";

    console.log("📍 Market 14 (PKR):", MARKET);
    console.log("   Index Token: mPKR");
    console.log("   Long Token: mUSD");
    console.log("   Short Token: mUSD (single-token market)\n");

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check for long position
    const isLong = true;
    const collateralToken = mUSD;

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, MARKET, collateralToken, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);

    if (!positionExists) {
        console.log("❌ No long position exists to close");
        return;
    }

    // Get position size and collateral
    const getPositionData = async (field) => {
        const fieldHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], [field])
        );
        const key = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "bytes32"],
                [positionKey, fieldHash]
            )
        );
        return dataStore.getUint(key);
    };

    const sizeInUsd = await getPositionData("SIZE_IN_USD");
    const collateralAmount = await getPositionData("COLLATERAL_AMOUNT");

    console.log("📊 Current Position:");
    console.log("  Type: LONG PKR");
    console.log("  Size:", ethers.utils.formatUnits(sizeInUsd, 30), "USD");
    console.log("  Collateral:", ethers.utils.formatUnits(collateralAmount, 6), "mUSD");

    if (collateralAmount.gt(0)) {
        const leverage = parseFloat(ethers.utils.formatUnits(sizeInUsd, 30)) /
                        parseFloat(ethers.utils.formatUnits(collateralAmount, 6));
        console.log("  Leverage:", leverage.toFixed(2) + "x");
    }

    console.log("\n🔴 Closing entire position...\n");

    const executionFee = ethers.utils.parseEther("0.001");

    // Build multicall data
    const multicallData = [];

    // 1. Send execution fee
    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("sendWnt", [
            ORDER_VAULT,
            executionFee
        ])
    );

    // 2. Create market decrease order to close position
    const orderParams = {
        addresses: {
            receiver: signer.address,
            cancellationReceiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialCollateralToken: mUSD,
            swapPath: []
        },
        numbers: {
            sizeDeltaUsd: sizeInUsd, // Close entire position
            initialCollateralDeltaAmount: collateralAmount, // Withdraw all collateral
            triggerPrice: 0,
            acceptablePrice: ethers.utils.parseUnits("200", 12), // Min acceptable price for closing long (200 PKR per USDT)
            executionFee: executionFee,
            callbackGasLimit: 0,
            minOutputAmount: 0,
            validFromTime: 0
        },
        orderType: 4, // MarketDecrease
        decreasePositionSwapType: 0, // NoSwap
        isLong: true,
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: ethers.constants.HashZero,
        dataList: []
    };

    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("createOrder", [orderParams])
    );

    // Execute transaction
    console.log("📍 Creating close order...");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee,
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Close order created successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Find order key from events
        const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
        const ORDER_CREATED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));

        let orderKey = null;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase() &&
                log.topics[0] === EVENT_LOG2_SIG &&
                log.topics[1] === ORDER_CREATED_HASH) {
                orderKey = log.topics[2];
                break;
            }
        }

        if (orderKey) {
            console.log("\n🔑 CLOSE ORDER KEY:", orderKey);

            // Save to file
            const fs = require("fs");
            fs.writeFileSync("latest-close-order-key-pkr.txt", orderKey);
            console.log("📝 Saved order key to: latest-close-order-key-pkr.txt");
        }

        console.log("\n🎯 Close order created! Your keeper should now:");
        console.log("  1. Detect the OrderCreated event");
        console.log("  2. Execute the order via OrderHandler.executeOrder()");
        console.log("  3. Position will be closed and collateral returned");

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error creating close order:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);
