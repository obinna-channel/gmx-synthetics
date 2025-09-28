const { ethers } = require("hardhat");

async function main() {
    // Use the latest order key as default
    const orderKey = "0x66c7ce2641db441c9b861263f5d6cbe33f8392f0bc229fb8858c0d6db196791f";

    console.log("=== Debugging Order Storage ===");
    console.log("Order Key:", orderKey);
    console.log("");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Test different key generation methods
    console.log("Testing storage key generation methods:");
    console.log("-".repeat(60));

    // Method 1: Direct field name (what Python is doing now)
    const accountKey1 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [orderKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"]))]
        )
    );
    console.log("\nMethod 1 - With nested keccak256:");
    console.log("Key:", accountKey1);
    let value1 = await dataStore.getAddress(accountKey1);
    console.log("Value:", value1);

    // Method 2: Direct concatenation
    const accountKey2 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "string"],
            [orderKey, "ACCOUNT"]
        )
    );
    console.log("\nMethod 2 - Direct string:");
    console.log("Key:", accountKey2);
    let value2 = await dataStore.getAddress(accountKey2);
    console.log("Value:", value2);

    // Method 3: What GMX actually uses (from OrderStoreUtils)
    // First calculate the constant
    const ACCOUNT_CONSTANT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"])
    );
    console.log("\nMethod 3 - GMX method:");
    console.log("ACCOUNT constant:", ACCOUNT_CONSTANT);

    // Then use it with the order key
    const accountKey3 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [orderKey, ACCOUNT_CONSTANT]
        )
    );
    console.log("Storage key:", accountKey3);
    let value3 = await dataStore.getAddress(accountKey3);
    console.log("Value:", value3);

    console.log("\n" + "=".repeat(60));

    // Let's also check if the order exists in the ORDER_LIST
    const ORDER_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
    );
    const isInList = await dataStore.containsBytes32(ORDER_LIST, orderKey);
    console.log("\nOrder exists in ORDER_LIST:", isInList);

    // If it exists, try to get some data
    if (isInList || true) { // Force check anyway
        console.log("\nTrying to fetch order data with GMX method...");

        // Calculate all the constants like GMX does
        const constants = {
            ACCOUNT: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"])),
            MARKET: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"])),
            ORDER_TYPE: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_TYPE"])),
            SIZE_DELTA_USD: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SIZE_DELTA_USD"])),
            IS_LONG: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["IS_LONG"]))
        };

        for (const [name, constant] of Object.entries(constants)) {
            const key = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [orderKey, constant])
            );

            let value;
            if (name === "ACCOUNT" || name === "MARKET") {
                value = await dataStore.getAddress(key);
            } else if (name === "IS_LONG") {
                value = await dataStore.getBool(key);
            } else {
                value = await dataStore.getUint(key);
                // Convert ORDER_TYPE to readable
                if (name === "ORDER_TYPE") {
                    const types = ["MarketSwap", "LimitSwap", "MarketIncrease", "LimitIncrease",
                                   "MarketDecrease", "LimitDecrease", "StopLossDecrease", "Liquidation"];
                    const typeName = types[value] || `Unknown(${value})`;
                    value = `${value} (${typeName})`;
                } else if (name === "SIZE_DELTA_USD" && value > 0) {
                    value = `${value} (${ethers.utils.formatUnits(value, 30)} USD)`;
                }
            }

            console.log(`  ${name}: ${value}`);
        }
    }

    // Let's also try the OrderStoreUtils.get method through a contract call
    console.log("\n" + "=".repeat(60));
    console.log("\nDirect OrderStoreUtils check:");

    // We need to interact with a contract that has the get function
    // For now, let's at least verify the order was created
    const recentBlock = await ethers.provider.getBlockNumber();
    console.log("Current block:", recentBlock);
    console.log("Check if order was recently created (within last 100 blocks)");
}

main().catch(console.error);