const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69"; // Market 12: mUSDTARS [mUSD-mUSD]
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mUSDTARS = "0xed6890bE2409F0db06a00C809a298E2E06553BE1";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";

    console.log("=== Checking Market Liquidity (Proper Method) ===\n");
    console.log("Market:", MARKET);

    // Get the actual token balances held by the Market Token contract
    const musdToken = await ethers.getContractAt("IERC20", mUSD);
    const marketMusdBalance = await musdToken.balanceOf(MARKET);

    console.log("\n💰 Actual Token Balances (held by Market Token):");
    console.log("  mUSD balance in Market:", ethers.utils.formatUnits(marketMusdBalance, 6));

    // Use Reader to get market info
    const reader = await ethers.getContractAt("Reader", READER);

    try {
        const marketInfo = await reader.getMarket(DATA_STORE, MARKET);
        console.log("\n📊 Market Info from Reader:");
        console.log("  Market Token:", marketInfo.marketToken);
        console.log("  Index Token:", marketInfo.indexToken);
        console.log("  Long Token:", marketInfo.longToken);
        console.log("  Short Token:", marketInfo.shortToken);
    } catch (e) {
        console.log("Error getting market info:", e.message);
    }

    // Get DataStore
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check pool amount using correct key construction
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.id("POOL_AMOUNT"), MARKET, mUSD]
        )
    );

    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("\n📝 DataStore Pool Amount:");
    console.log("  Pool Amount (from DataStore):", ethers.utils.formatUnits(poolAmount, 6), "mUSD");

    // Check open interest
    const shortOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [ethers.utils.id("OPEN_INTEREST"), MARKET, mUSD, false]
        )
    );
    const shortOI = await dataStore.getUint(shortOIKey);
    console.log("  Short OI (mUSD collateral):", ethers.utils.formatUnits(shortOI, 30), "USD");

    const longOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [ethers.utils.id("OPEN_INTEREST"), MARKET, mUSD, true]
        )
    );
    const longOI = await dataStore.getUint(longOIKey);
    console.log("  Long OI (mUSD collateral):", ethers.utils.formatUnits(longOI, 30), "USD");

    // Check open interest in tokens
    const shortOIInTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [ethers.utils.id("OPEN_INTEREST_IN_TOKENS"), MARKET, mUSD, false]
        )
    );
    const shortOIInTokens = await dataStore.getUint(shortOIInTokensKey);
    console.log("  Short OI in tokens:", ethers.utils.formatUnits(shortOIInTokens, 6), "mUSD");

    // Check reserved USD
    const reservedUsdKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [ethers.utils.id("RESERVED_USD"), MARKET, false]
        )
    );
    const reservedUsd = await dataStore.getUint(reservedUsdKey);
    console.log("  Reserved USD (shorts):", ethers.utils.formatUnits(reservedUsd, 30), "USD");

    // Check max pool amount
    const maxPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.id("MAX_POOL_AMOUNT"), MARKET, mUSD]
        )
    );
    const maxPoolAmount = await dataStore.getUint(maxPoolAmountKey);
    console.log("\n⚙️  Market Configuration:");
    console.log("  Max Pool Amount:", ethers.utils.formatUnits(maxPoolAmount, 6), "mUSD");

    // Check if there's sufficient liquidity for withdrawal
    console.log("\n🔍 Liquidity Analysis:");
    console.log("  Available for withdrawal:", ethers.utils.formatUnits(poolAmount.sub(reservedUsd.div(ethers.BigNumber.from(10).pow(24))), 6), "mUSD (approx)");
}

main().catch(console.error);
