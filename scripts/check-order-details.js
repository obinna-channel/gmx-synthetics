const { ethers } = require("hardhat");

async function main() {
    // The order key from your latest attempt
    const orderKey = "0xa9cf201cf5603a4fefd787a90be0c576a0b39a122bc4c284860a7bbe880c1171";

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("=== Checking Order Details ===\n");
    console.log("Order Key:", orderKey);

    // Helper function to generate storage keys
    const getOrderDataKey = (field) => {
        const fieldHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], [field])
        );
        return ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "bytes32"],
                [orderKey, fieldHash]
            )
        );
    };

    // Check if order exists
    const ORDER_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
    );

    const orderExists = await dataStore.containsBytes32(ORDER_LIST, orderKey);
    console.log("Order exists:", orderExists);

    if (!orderExists) {
        console.log("\nOrder has been executed or cancelled and removed from storage.");
        console.log("Checking transaction logs would be more informative.");
        return;
    }

    // Fetch order details
    console.log("\n📊 Order Details:");

    // Order Type
    const orderTypeKey = getOrderDataKey("ORDER_TYPE");
    const orderType = await dataStore.getUint(orderTypeKey);
    console.log("  Order Type:", orderType.toString());

    // Decrease Position Swap Type - THIS IS THE KEY FIELD
    const swapTypeKey = getOrderDataKey("DECREASE_POSITION_SWAP_TYPE");
    const swapType = await dataStore.getUint(swapTypeKey);
    console.log("  Decrease Position Swap Type:", swapType.toString());

    const swapTypeNames = ["NoSwap", "SwapPnlTokenToCollateralToken", "SwapCollateralTokenToPnlToken"];
    console.log(`    → ${swapTypeNames[swapType.toNumber()] || "Unknown"}`);

    // Size Delta
    const sizeDeltaKey = getOrderDataKey("SIZE_DELTA_USD");
    const sizeDelta = await dataStore.getUint(sizeDeltaKey);
    console.log("  Size Delta USD:", ethers.utils.formatUnits(sizeDelta, 30), "USD");

    // Collateral Amount
    const collateralKey = getOrderDataKey("INITIAL_COLLATERAL_DELTA_AMOUNT");
    const collateralAmount = await dataStore.getUint(collateralKey);
    console.log("  Initial Collateral Delta:", ethers.utils.formatUnits(collateralAmount, 6), "USDT");

    // Is Long
    const isLongKey = getOrderDataKey("IS_LONG");
    const isLong = await dataStore.getBool(isLongKey);
    console.log("  Is Long:", isLong);

    // Market
    const marketKey = getOrderDataKey("MARKET");
    const market = await dataStore.getAddress(marketKey);
    console.log("  Market:", market);

    // Collateral Token
    const collateralTokenKey = getOrderDataKey("INITIAL_COLLATERAL_TOKEN");
    const collateralToken = await dataStore.getAddress(collateralTokenKey);
    console.log("  Collateral Token:", collateralToken);
    console.log(`    → ${collateralToken.toLowerCase() === "0x5fe0ca3af9cf758d7f4159295fd1cd6a05562bb6".toLowerCase() ? "USDT" : "Other"}`);

    // Check swap path if any
    const swapPathLengthKey = getOrderDataKey("SWAP_PATH_LENGTH");
    const swapPathLength = await dataStore.getUint(swapPathLengthKey);
    console.log("  Swap Path Length:", swapPathLength.toString());
}

main().catch(console.error);