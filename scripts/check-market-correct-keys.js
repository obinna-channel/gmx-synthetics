const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69"; // Market 12: mUSDTARS [mUSD-mUSD]
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ACCOUNT = "0x49e082bdda2865a36ed2294819d3c214709cdbaa";

    console.log("=== Checking Market with CORRECT Key Hashing ===\n");
    console.log("Market:", MARKET);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const musdToken = await ethers.getContractAt("IERC20", mUSD);

    // Actual balance
    const marketMusdBalance = await musdToken.balanceOf(MARKET);
    console.log("\n💰 Actual mUSD in Market:", ethers.utils.formatUnits(marketMusdBalance, 6));

    // CORRECT way to hash keys (using abi.encode, not toUtf8Bytes)
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    const OPEN_INTEREST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );
    const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );
    const RESERVED_USD_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["RESERVED_USD"])
    );
    const MAX_POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_POOL_AMOUNT"])
    );

    console.log("\n📝 Key Hashes (for verification):");
    console.log("  POOL_AMOUNT_KEY:", POOL_AMOUNT_KEY);
    console.log("  OPEN_INTEREST_KEY:", OPEN_INTEREST_KEY);

    // Pool Amount
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("\n📊 Pool Amount (CORRECT):", ethers.utils.formatUnits(poolAmount, 6), "mUSD");

    // Open Interest - Short
    const shortOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_KEY, MARKET, mUSD, false]
        )
    );
    const shortOI = await dataStore.getUint(shortOIKey);
    console.log("  Short OI (mUSD collateral):", ethers.utils.formatUnits(shortOI, 30), "USD");

    // Open Interest - Long
    const longOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_KEY, MARKET, mUSD, true]
        )
    );
    const longOI = await dataStore.getUint(longOIKey);
    console.log("  Long OI (mUSD collateral):", ethers.utils.formatUnits(longOI, 30), "USD");

    // Open Interest in Tokens
    const shortOIInTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS_KEY, MARKET, mUSD, false]
        )
    );
    const shortOIInTokens = await dataStore.getUint(shortOIInTokensKey);
    console.log("  Short OI in tokens:", ethers.utils.formatUnits(shortOIInTokens, 6), "mUSD");

    // Reserved USD
    const reservedUsdKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [RESERVED_USD_KEY, MARKET, false]
        )
    );
    const reservedUsd = await dataStore.getUint(reservedUsdKey);
    console.log("  Reserved USD (shorts):", ethers.utils.formatUnits(reservedUsd, 30), "USD");

    // Max Pool Amount
    const maxPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [MAX_POOL_AMOUNT_KEY, MARKET, mUSD]
        )
    );
    const maxPoolAmount = await dataStore.getUint(maxPoolAmountKey);
    console.log("\n⚙️  Max Pool Amount:", ethers.utils.formatUnits(maxPoolAmount, 6), "mUSD");

    // Calculate available liquidity
    const availableLiquidity = poolAmount.sub(shortOIInTokens);
    console.log("\n💧 Available Liquidity:");
    console.log("  Pool - Reserved:", ethers.utils.formatUnits(availableLiquidity, 6), "mUSD");

    // Check the actual position
    const reader = await ethers.getContractAt("Reader", "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8");
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [ACCOUNT, MARKET, mUSD, false] // SHORT position
        )
    );

    const position = await reader.getPosition(DATA_STORE, positionKey);
    if (position && position.numbers && position.numbers.sizeInUsd && position.numbers.sizeInUsd.gt(0)) {
        console.log("\n📍 User's SHORT Position:");
        console.log("  Size:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30), "USD");
        console.log("  Collateral:", ethers.utils.formatUnits(position.numbers.collateralAmount, 6), "mUSD");

        // Check if there's enough liquidity to close
        const needsLiquidity = position.numbers.collateralAmount;
        const hasEnough = availableLiquidity.gte(needsLiquidity);
        console.log("\n🔍 Can Close Position?");
        console.log("  Needs:", ethers.utils.formatUnits(needsLiquidity, 6), "mUSD");
        console.log("  Available:", ethers.utils.formatUnits(availableLiquidity, 6), "mUSD");
        console.log("  Status:", hasEnough ? "✅ YES" : "❌ NO - INSUFFICIENT LIQUIDITY");
    }
}

main().catch(console.error);
