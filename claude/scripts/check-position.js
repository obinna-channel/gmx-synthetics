const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking Position Status ===\n");

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0x953E10D802fF5E85deEBE17c8Fc2417675227207"; // From Reader.json
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Your address (the account that created the order)
    const account = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";

    console.log("Account:", account);
    console.log("Market:", MARKET);

    // Calculate position key
    // Position key = keccak256(abi.encode(account, market, collateralToken, isLong))
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const isLong = true;

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [account, MARKET, USDT, isLong]
        )
    );

    console.log("\n📍 Position Key:", positionKey);

    // Check if position exists in POSITION_LIST
    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    console.log("Position exists:", positionExists ? "✅ YES" : "❌ NO");

    if (positionExists) {
        console.log("\n📊 Fetching Position Details...");

        // Helper function to get position data
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
            return key;
        };

        // Get position size in USD
        const sizeInUsdKey = await getPositionData("SIZE_IN_USD");
        const sizeInUsd = await dataStore.getUint(sizeInUsdKey);

        // Get position size in tokens
        const sizeInTokensKey = await getPositionData("SIZE_IN_TOKENS");
        const sizeInTokens = await dataStore.getUint(sizeInTokensKey);

        // Get collateral amount
        const collateralAmountKey = await getPositionData("COLLATERAL_AMOUNT");
        const collateralAmount = await dataStore.getUint(collateralAmountKey);

        // Get last updated time
        const updatedAtTimeKey = await getPositionData("UPDATED_AT_TIME");
        const updatedAtTime = await dataStore.getUint(updatedAtTimeKey);

        // Get increased at time
        const increasedAtTimeKey = await getPositionData("INCREASED_AT_TIME");
        const increasedAtTime = await dataStore.getUint(increasedAtTimeKey);

        console.log("\n🎯 Position Details:");
        console.log("   Size in USD:", ethers.utils.formatUnits(sizeInUsd, 30), "USD");
        console.log("   Size in Tokens:", ethers.utils.formatUnits(sizeInTokens, 18));
        console.log("   Collateral (USDT):", ethers.utils.formatUnits(collateralAmount, 6), "USDT");

        if (increasedAtTime.gt(0)) {
            const date = new Date(increasedAtTime.toNumber() * 1000);
            console.log("   Opened at:", date.toLocaleString());
        }

        if (updatedAtTime.gt(0)) {
            const date = new Date(updatedAtTime.toNumber() * 1000);
            console.log("   Last updated:", date.toLocaleString());
        }

        console.log("\n✅ Position is ACTIVE!");
    } else {
        console.log("\n❌ No active position found for this account/market/token combination");

        // Check for open orders instead
        console.log("\n📝 Checking for open orders...");

        const ORDER_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
        );

        // This would need the order key to check specifically
        // For now, let's just note this
        console.log("   To check specific orders, you need the order key");
    }

    // Also check account's open position count
    console.log("\n📈 Account Statistics:");

    const accountPositionCountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_POSITION_COUNT"])),
                account
            ]
        )
    );

    const positionCount = await dataStore.getUint(accountPositionCountKey);
    console.log("   Total open positions for account:", positionCount.toString());

    // Check account order count
    const accountOrderCountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_ORDER_COUNT"])),
                account
            ]
        )
    );

    const orderCount = await dataStore.getUint(accountOrderCountKey);
    console.log("   Total open orders for account:", orderCount.toString());
}

main().catch(console.error);