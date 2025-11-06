const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    console.log("=== Understanding the Liquidity Calculation ===\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const musdToken = await ethers.getContractAt("IERC20", mUSD);

    // Get actual mUSD balance in market
    const actualBalance = await musdToken.balanceOf(MARKET);
    console.log("Actual mUSD in Market:", ethers.utils.formatUnits(actualBalance, 6), "mUSD");
    console.log("  (in 6 decimals):", actualBalance.toString(), "\n");

    // Get pool amount from DataStore
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Pool Amount (DataStore):", ethers.utils.formatUnits(poolAmount, 6), "mUSD");
    console.log("  (in 6 decimals):", poolAmount.toString(), "\n");

    // Get OI in tokens
    const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

    const shortOIInTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS_KEY, MARKET, mUSD, false]
        )
    );
    const shortOIInTokens = await dataStore.getUint(shortOIInTokensKey);

    const longOIInTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS_KEY, MARKET, mUSD, true]
        )
    );
    const longOIInTokens = await dataStore.getUint(longOIInTokensKey);

    console.log("SHORT OI in Tokens (DataStore):", ethers.utils.formatUnits(shortOIInTokens, 30));
    console.log("  (in 30 decimals):", shortOIInTokens.toString());
    console.log("  Converted to 6 decimals:", ethers.utils.formatUnits(shortOIInTokens.div(ethers.BigNumber.from(10).pow(24)), 6), "mUSD\n");

    console.log("LONG OI in Tokens (DataStore):", ethers.utils.formatUnits(longOIInTokens, 30));
    console.log("  (in 30 decimals):", longOIInTokens.toString());
    console.log("  Converted to 6 decimals:", ethers.utils.formatUnits(longOIInTokens.div(ethers.BigNumber.from(10).pow(24)), 6), "mUSD\n");

    // Total OI in tokens (converted to token decimals)
    const totalOIInTokens6dp = shortOIInTokens.add(longOIInTokens).div(ethers.BigNumber.from(10).pow(24));
    console.log("Total OI (both sides, 6dp):", ethers.utils.formatUnits(totalOIInTokens6dp, 6), "mUSD");
    console.log("  Raw:", totalOIInTokens6dp.toString(), "\n");

    // Calculate "available" - THIS IS THE KEY
    console.log("=".repeat(80));
    console.log("\n🔍 LIQUIDITY CALCULATION:\n");

    // GMX compares pool amount (6dp) with OI in tokens, but OI is in 30dp!
    // Let's see what happens if we do the wrong comparison:
    console.log("❌ WRONG WAY (comparing different precisions):");
    console.log(`  poolAmount (6dp): ${poolAmount.toString()}`);
    console.log(`  shortOIInTokens (30dp): ${shortOIInTokens.toString()}`);
    console.log(`  If we subtract: ${poolAmount.toString()} - ${shortOIInTokens.toString()}`);
    console.log(`  Result: MASSIVELY NEGATIVE (underflow or huge negative)\n`);

    // Correct way - convert OI to same precision as pool
    console.log("✅ CORRECT WAY (same precision):");
    const shortOI6dp = shortOIInTokens.div(ethers.BigNumber.from(10).pow(24));
    console.log(`  poolAmount (6dp): ${poolAmount.toString()} = ${ethers.utils.formatUnits(poolAmount, 6)} mUSD`);
    console.log(`  shortOI (6dp): ${shortOI6dp.toString()} = ${ethers.utils.formatUnits(shortOI6dp, 6)} mUSD`);

    if (poolAmount.gte(shortOI6dp)) {
        const available = poolAmount.sub(shortOI6dp);
        console.log(`  Available: ${available.toString()} = ${ethers.utils.formatUnits(available, 6)} mUSD`);
        console.log(`  ✅ SUFFICIENT LIQUIDITY!`);
    } else {
        console.log(`  ❌ INSUFFICIENT! Pool < OI`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n💡 HYPOTHESIS:\n");
    console.log("GMX might be comparing poolAmount (6dp) directly with OI (30dp)");
    console.log("without converting to the same precision, causing the validation to fail!\n");
}

main().catch(console.error);
