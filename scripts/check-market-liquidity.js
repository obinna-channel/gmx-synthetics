const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking USDTARS Market Liquidity ===\n");

    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";

    const mUSDToken = await ethers.getContractAt("IERC20", mUSD);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const reader = await ethers.getContractAt("Reader", READER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Market:", MARKET);
    console.log("mUSD Token:", mUSD);

    // Check mUSD balance of the market token contract
    const marketBalance = await mUSDToken.balanceOf(MARKET);
    console.log("\n💰 Direct Token Balance:");
    console.log("   Market's mUSD balance:", ethers.utils.formatUnits(marketBalance, 6), "mUSD");

    // Check market token supply
    const marketTokenSupply = await marketToken.totalSupply();
    console.log("   Market Token Supply:", ethers.utils.formatUnits(marketTokenSupply, 18));

    // Get market info from Reader
    console.log("\n🏦 Market Info from Reader:");
    const market = await reader.getMarket(DATA_STORE, MARKET);
    console.log("   Index Token:", market.indexToken);
    console.log("   Long Token:", market.longToken);
    console.log("   Short Token:", market.shortToken);

    // Try different pool amount keys
    console.log("\n🔍 Checking Pool Amount Keys:");
    
    // Key 1: POOL_AMOUNT with market and token
    const poolAmountKey1 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT")),
                MARKET,
                mUSD
            ]
        )
    );
    const poolAmount1 = await dataStore.getUint(poolAmountKey1);
    console.log("   Key 1 (POOL_AMOUNT + market + mUSD):", ethers.utils.formatUnits(poolAmount1, 6), "mUSD");

    // Key 2: Just market token balance key
    const poolAmountKey2 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["string", "address"],
            ["POOL_AMOUNT", MARKET]
        )
    );
    const poolAmount2 = await dataStore.getUint(poolAmountKey2);
    console.log("   Key 2 (POOL_AMOUNT + market):", ethers.utils.formatUnits(poolAmount2, 6), "mUSD");

    // Get reserved amounts
    console.log("\n📊 Reserved Amounts:");
    const reservedKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESERVED_USD")),
                MARKET,
                mUSD,
                false  // for shorts
            ]
        )
    );
    const reservedUsd = await dataStore.getUint(reservedKey);
    console.log("   Reserved USD (shorts):", ethers.utils.formatUnits(reservedUsd, 30), "USD");

    // Get open interest
    console.log("\n📈 Open Interest:");
    const openInterestKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPEN_INTEREST")),
                MARKET,
                mUSD,
                false  // for shorts
            ]
        )
    );
    const openInterest = await dataStore.getUint(openInterestKey);
    console.log("   Open Interest (shorts):", ethers.utils.formatUnits(openInterest, 30), "USD");

    // Check if there are any deposits in the market
    console.log("\n💵 Available vs Reserved:");
    const available = marketBalance.sub(poolAmount1);
    console.log("   Total in Market:", ethers.utils.formatUnits(marketBalance, 6), "mUSD");
    console.log("   Pool Amount:", ethers.utils.formatUnits(poolAmount1, 6), "mUSD");
    console.log("   Available (Total - Pool):", ethers.utils.formatUnits(available, 6), "mUSD");
}

main().catch(console.error);
