const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const userAddress = "0xddb6f14b176De88A196b7Ac292f9A87c8Af3Cb8A";
    const marketAddress = "0x8ae559448a1482faffC925eF6a233276588348Df"; // TSLA market
    const collateralToken = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // mUSD
    const isLong = true;

    console.log("=== Checking Auto-Cancel Orders for User ===");
    console.log("User:", userAddress);
    console.log("Market:", marketAddress);

    // Load contracts
    const dataStorePath = "./deployments/marks/arbitrumSepolia/DataStore.json";
    const dataStoreData = JSON.parse(fs.readFileSync(dataStorePath));
    const dataStore = new ethers.Contract(dataStoreData.address, dataStoreData.abi, ethers.provider);

    // Compute position key
    const abiCoder = new ethers.utils.AbiCoder();
    const positionKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["address", "address", "address", "bool"],
            [userAddress, marketAddress, collateralToken, isLong]
        )
    );
    console.log("\nPosition Key:", positionKey);

    // Check current position size
    const sizeInUsdKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["bytes32", "bytes32"],
            [positionKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SIZE_IN_USD"))]
        )
    );
    const sizeInUsd = await dataStore.getUint(sizeInUsdKey);
    console.log("Current Position Size (USD):", ethers.utils.formatUnits(sizeInUsd, 30));

    // Get auto-cancel order keys
    // Key: keccak256(abi.encode("AUTO_CANCEL_ORDER_LIST", positionKey))
    const autoCancelListKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["bytes32", "bytes32"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AUTO_CANCEL_ORDER_LIST")), positionKey]
        )
    );

    // Get count of auto-cancel orders
    const countKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["bytes32", "string"],
            [autoCancelListKey, "count"]
        )
    );

    // Try to get the list count
    const orderCount = await dataStore.getUint(autoCancelListKey);
    console.log("\nAuto-Cancel Order Count:", orderCount.toString());

    // Also check MIN_HANDLE_EXECUTION_ERROR_GAS
    const minHandleGasKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_HANDLE_EXECUTION_ERROR_GAS"));
    const minHandleGas = await dataStore.getUint(minHandleGasKey);
    console.log("\nMIN_HANDLE_EXECUTION_ERROR_GAS:", minHandleGas.toString());

    // Check if the Reader contract can help us get auto-cancel orders
    const readerPath = "./deployments/marks/arbitrumSepolia/Reader.json";
    const readerData = JSON.parse(fs.readFileSync(readerPath));
    const reader = new ethers.Contract(readerData.address, readerData.abi, ethers.provider);

    // Try getting account orders
    try {
        const orders = await reader.getAccountOrders(
            dataStore.address,
            userAddress,
            0,  // start
            100 // end
        );
        console.log("\n=== User's Orders ===");
        console.log("Total orders:", orders.length);

        for (const order of orders) {
            // order is a tuple with order properties
            const orderType = order.numbers?.orderType || order[1]?.orderType;
            const market = order.addresses?.market || order[0]?.market;

            if (market && market.toLowerCase() === marketAddress.toLowerCase()) {
                console.log("\nOrder in TSLA market:");
                console.log("  Market:", market);
                console.log("  Type:", orderType?.toString());
                console.log("  Size Delta USD:", order.numbers?.sizeDeltaUsd?.toString() || order[1]?.sizeDeltaUsd?.toString());
            }
        }
    } catch (e) {
        console.log("Error getting orders:", e.message);
    }

    // Check the gas parameters
    console.log("\n=== Gas Configuration ===");

    const estimatedGasBase = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1"));
    const baseAmount = await dataStore.getUint(estimatedGasBase);
    console.log("ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1:", baseAmount.toString());

    const gasPerOracle = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ESTIMATED_GAS_FEE_PER_ORACLE_PRICE"));
    const perOracle = await dataStore.getUint(gasPerOracle);
    console.log("ESTIMATED_GAS_FEE_PER_ORACLE_PRICE:", perOracle.toString());
}

main().catch(console.error);
