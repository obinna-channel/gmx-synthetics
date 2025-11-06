const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mUSDTARS = "0xed6890bE2409F0db06a00C809a298E2E06553BE1";
    const ACCOUNT = "0x49e082bdda2865a36ed2294819d3c214709cdbaa";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";

    console.log("=== Simulating Decrease Order ===\n");

    const reader = await ethers.getContractAt("Reader", READER);

    // Get the position
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [ACCOUNT, MARKET, mUSD, false]
        )
    );

    const position = await reader.getPosition(DATA_STORE, positionKey);

    console.log("Current Position:");
    console.log("  Size:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30), "USD");
    console.log("  Size in Tokens:", ethers.utils.formatUnits(position.numbers.sizeInTokens, 30));
    console.log("  Collateral:", ethers.utils.formatUnits(position.numbers.collateralAmount, 6), "mUSD");
    console.log("  Borrowing Factor:", position.numbers.borrowingFactor.toString());
    console.log("  Funding Fee Per Size:", position.numbers.fundingFeeAmountPerSize.toString());

    // Try to create a decrease order and see what happens
    console.log("\n📝 Creating test decrease order (10% of position)...");

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const decreaseAmount = position.numbers.sizeInUsd.div(10); // 10%
    const collateralAmount = position.numbers.collateralAmount.div(10);

    const orderParams = {
        addresses: {
            receiver: ACCOUNT,
            cancellationReceiver: ACCOUNT,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialCollateralToken: mUSD,
            swapPath: []
        },
        numbers: {
            sizeDeltaUsd: decreaseAmount,
            initialCollateralDeltaAmount: collateralAmount,
            triggerPrice: 0,
            acceptablePrice: ethers.constants.MaxUint256,
            executionFee: ethers.utils.parseEther("0.001"),
            callbackGasLimit: 0,
            minOutputAmount: 0,
            validFromTime: 0
        },
        orderType: 4, // MarketDecrease
        decreasePositionSwapType: 0, // NoSwap
        isLong: false,
        shouldUnwrapNativeToken: false,
        autoCancel: false
    };

    console.log("  Size Delta:", ethers.utils.formatUnits(decreaseAmount, 30), "USD");
    console.log("  Collateral Delta:", ethers.utils.formatUnits(collateralAmount, 6), "mUSD");

    // Try to estimate gas (this will fail and show us the error)
    try {
        console.log("\n🔍 Attempting static call to see what error occurs...");

        // We can't actually call this without having the tokens/ETH, but we can try
        // to get the revert reason by calling with wrong parameters
        const result = await exchangeRouter.callStatic.createOrder(
            orderParams,
            { value: orderParams.numbers.executionFee, from: ACCOUNT }
        );

        console.log("✅ Order would succeed!");
        console.log("Result:", result);
    } catch (error) {
        console.log("\n❌ Order would fail with error:");

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }

        // Try to decode the error
        const errorMessage = error.message;
        console.log("Error message:", errorMessage);

        // Look for specific GMX errors
        if (errorMessage.includes("InsufficientReservedUsd")) {
            console.log("\n⚠️  Issue: InsufficientReservedUsd - Not enough reserved USD in pool");
        } else if (errorMessage.includes("InsufficientLiquidity")) {
            console.log("\n⚠️  Issue: InsufficientLiquidity - Pool doesn't have enough tokens");
        } else if (errorMessage.includes("InvalidDecreaseOrderSize")) {
            console.log("\n⚠️  Issue: InvalidDecreaseOrderSize - Size delta exceeds position size");
        } else if (errorMessage.includes("EmptyDecrease")) {
            console.log("\n⚠️  Issue: EmptyDecrease - Both size and collateral deltas are zero");
        }
    }

    // Also check the actual market state
    console.log("\n📊 Market State Check:");
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);

    const oiInTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS_KEY, MARKET, mUSD, false]
        )
    );
    const oiInTokens = await dataStore.getUint(oiInTokensKey);

    console.log("  Pool Amount:", ethers.utils.formatUnits(poolAmount, 6), "mUSD");
    console.log("  OI in Tokens (shorts):", ethers.utils.formatUnits(oiInTokens, 6), "mUSD");
    console.log("  Available:", ethers.utils.formatUnits(poolAmount.sub(oiInTokens), 6), "mUSD");

    // Check if the corrupted OI is the issue
    if (oiInTokens.gt(ethers.utils.parseUnits("1000000", 6))) {
        console.log("\n🚨 FOUND ISSUE: Open Interest in Tokens is CORRUPTED!");
        console.log("   Value is way too high:", oiInTokens.toString());
        console.log("   This causes available liquidity to be negative");
        console.log("   Decrease orders are failing because pool thinks it has no liquidity");
    }
}

main().catch(console.error);
