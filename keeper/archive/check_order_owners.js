const { ethers } = require("hardhat");

async function main() {
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get ORDER_LIST
    const ORDER_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
    );

    const orderCount = await dataStore.getBytes32Count(ORDER_LIST);
    console.log(`Total orders: ${orderCount}\n`);

    // Check first 5 orders
    const getOrderDataKey = (orderKey, field) => {
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

    console.log("Checking order owners:");
    const owners = new Set();

    for (let i = 0; i < Math.min(10, orderCount); i++) {
        const orderKeys = await dataStore.getBytes32ValuesAt(ORDER_LIST, i, i + 1);
        const orderKey = orderKeys[0];

        const accountKey = getOrderDataKey(orderKey, "ACCOUNT");
        const account = await dataStore.getAddress(accountKey);

        owners.add(account);

        console.log(`Order ${i + 1}: ${orderKey.substring(0, 16)}... owned by ${account}`);
    }

    console.log(`\nUnique owners: ${owners.size}`);
    console.log("Owners:", Array.from(owners));
}

main().catch(console.error);
