const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("=== Checking Pending Orders ===\n");
    console.log("User:", signer.address);
    console.log("Time:", new Date().toISOString());

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check ORDER_LIST for any pending orders
    const ORDER_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
    );

    // Get the count of orders in the list
    const orderCountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32"],
            [ORDER_LIST]
        )
    );

    try {
        const orderCount = await dataStore.getBytes32Count(ORDER_LIST);
        console.log("\n📊 Total orders in system:", orderCount.toString());

        if (orderCount.gt(0)) {
            console.log("\n📋 Checking orders...\n");

            // Get all order keys
            for (let i = 0; i < orderCount.toNumber(); i++) {
                const orderKey = await dataStore.getBytes32ValuesAt(ORDER_LIST, i, i + 1);
                console.log(`Order ${i + 1}: ${orderKey[0]}`);

                // Try to get order details
                const getOrderDataKey = (field) => {
                    const fieldHash = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(["string"], [field])
                    );
                    return ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes32", "bytes32"],
                            [orderKey[0], fieldHash]
                        )
                    );
                };

                // Get account (order creator)
                const accountKey = getOrderDataKey("ACCOUNT");
                const account = await dataStore.getAddress(accountKey);

                // Get order type
                const orderTypeKey = getOrderDataKey("ORDER_TYPE");
                const orderType = await dataStore.getUint(orderTypeKey);

                // Get market
                const marketKey = getOrderDataKey("MARKET");
                const market = await dataStore.getAddress(marketKey);

                // Get size
                const sizeDeltaKey = getOrderDataKey("SIZE_DELTA_USD");
                const sizeDelta = await dataStore.getUint(sizeDeltaKey);

                // Get is long
                const isLongKey = getOrderDataKey("IS_LONG");
                const isLong = await dataStore.getBool(isLongKey);

                console.log(`  Account: ${account}`);
                console.log(`  Type: ${orderType} (${getOrderTypeName(orderType.toNumber())})`);
                console.log(`  Market: ${market}`);
                console.log(`  Size: ${ethers.utils.formatUnits(sizeDelta, 30)} USD`);
                console.log(`  Direction: ${isLong ? "LONG" : "SHORT"}`);

                if (account.toLowerCase() === signer.address.toLowerCase()) {
                    console.log(`  ⭐ THIS IS YOUR ORDER`);
                }

                console.log("");
            }
        } else {
            console.log("\n✅ No pending orders in the system");
        }

        // Also check for user's specific positions
        console.log("\n=== Checking Your Positions ===\n");

        const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
        const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

        // Check long position
        const longPositionKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "bool"],
                [signer.address, MARKET, USDT, true]
            )
        );

        const POSITION_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
        );

        const hasLongPosition = await dataStore.containsBytes32(POSITION_LIST, longPositionKey);

        if (hasLongPosition) {
            const sizeKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "bytes32"],
                    [longPositionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SIZE_IN_USD"]))]
                )
            );
            const size = await dataStore.getUint(sizeKey);
            console.log(`📈 LONG Position: ${ethers.utils.formatUnits(size, 30)} USD`);
        } else {
            console.log("📈 LONG Position: None");
        }

        // Check short position
        const shortPositionKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "bool"],
                [signer.address, MARKET, USDT, false]
            )
        );

        const hasShortPosition = await dataStore.containsBytes32(POSITION_LIST, shortPositionKey);

        if (hasShortPosition) {
            const sizeKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "bytes32"],
                    [shortPositionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SIZE_IN_USD"]))]
                )
            );
            const size = await dataStore.getUint(sizeKey);
            console.log(`📉 SHORT Position: ${ethers.utils.formatUnits(size, 30)} USD`);
        } else {
            console.log("📉 SHORT Position: None");
        }

    } catch (error) {
        console.log("Error checking orders:", error.message);
    }
}

function getOrderTypeName(type) {
    const names = {
        0: "MarketSwap",
        1: "LimitSwap",
        2: "MarketIncrease",
        3: "LimitIncrease",
        4: "MarketDecrease",
        5: "LimitDecrease",
        6: "StopLossDecrease",
        7: "Liquidation"
    };
    return names[type] || "Unknown";
}

main().catch(console.error);