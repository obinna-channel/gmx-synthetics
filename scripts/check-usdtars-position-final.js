const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking USDTARS Short Position ===\n");

    // Correct addresses from deployments
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69"; // USDTARS market

    const reader = await ethers.getContractAt("Reader", READER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Your address (from the logs)
    const account = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const collateralToken = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // mUSD
    const isLong = false; // SHORT position

    console.log("Account:", account);
    console.log("Market:", MARKET);
    console.log("Collateral Token:", collateralToken, "(mUSD)");
    console.log("Position Type: SHORT");

    // Calculate position key
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [account, MARKET, collateralToken, isLong]
        )
    );

    console.log("\n📍 Position Key:", positionKey);

    try {
        const position = await reader.getPosition(DATA_STORE, positionKey);
        
        console.log("\n🎯 Position Details:");
        console.log("   Account:", position.addresses.account);
        console.log("   Market:", position.addresses.market);
        console.log("   Collateral Token:", position.addresses.collateralToken);
        
        const sizeInUsd = ethers.utils.formatUnits(position.numbers.sizeInUsd, 30);
        const sizeInTokens = ethers.utils.formatUnits(position.numbers.sizeInTokens, 18);
        const collateralAmount = ethers.utils.formatUnits(position.numbers.collateralAmount, 6);
        
        console.log("\n💰 Position Amounts:");
        console.log("   Size in USD:", sizeInUsd, "USD");
        console.log("   Size in Tokens:", sizeInTokens);
        console.log("   Collateral (mUSD):", collateralAmount, "mUSD");
        console.log("   Borrowing Factor:", ethers.utils.formatUnits(position.numbers.borrowingFactor, 30));
        console.log("   Funding Fee Per Size:", ethers.utils.formatUnits(position.numbers.fundingFeeAmountPerSize, 30));
        
        console.log("\n⏰ Timestamps:");
        if (position.numbers.increasedAtTime > 0) {
            const date = new Date(position.numbers.increasedAtTime * 1000);
            console.log("   Opened at:", date.toLocaleString());
        }
        if (position.numbers.decreasedAtTime > 0) {
            const date = new Date(position.numbers.decreasedAtTime * 1000);
            console.log("   Last decreased:", date.toLocaleString());
        }

        console.log("\n📈 Position Type:");
        console.log("   Is Long:", position.flags.isLong ? "YES (LONG)" : "NO (SHORT)");

        // Get market info
        console.log("\n🏦 Market Info:");
        const market = await reader.getMarket(DATA_STORE, MARKET);
        console.log("   Market Token:", market.marketToken);
        console.log("   Index Token:", market.indexToken);
        console.log("   Long Token:", market.longToken);
        console.log("   Short Token:", market.shortToken);

        // Get pool amounts
        const longTokenPoolKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT")),
                    MARKET,
                    market.longToken
                ]
            )
        );
        const shortTokenPoolKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT")),
                    MARKET,
                    market.shortToken
                ]
            )
        );

        const longTokenPool = await dataStore.getUint(longTokenPoolKey);
        const shortTokenPool = await dataStore.getUint(shortTokenPoolKey);

        console.log("\n💧 Pool Liquidity:");
        console.log("   Long Token Pool (mUSD):", ethers.utils.formatUnits(longTokenPool, 6), "mUSD");
        console.log("   Short Token Pool (mUSD):", ethers.utils.formatUnits(shortTokenPool, 6), "mUSD");
        console.log("   Total Pool:", ethers.utils.formatUnits(longTokenPool.add(shortTokenPool), 6), "mUSD");

        // Calculate leverage
        const leverage = parseFloat(sizeInUsd) / parseFloat(collateralAmount);
        console.log("\n📊 Position Metrics:");
        console.log("   Leverage:", leverage.toFixed(2) + "x");
        
        console.log("\n✅ Position is ACTIVE!");

    } catch (error) {
        console.log("\n❌ Position not found or error:", error.message);
    }
}

main().catch(console.error);
