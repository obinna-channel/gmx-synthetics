const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Impact Pool Amounts for NEW USDT-Indexed Market ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // NEW USDT-indexed market
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Market:", MARKET);
    console.log("Index Token: USDT\n");

    // 1. Check impact pool amounts
    console.log("=� Impact Pool Amounts:");

    // Position impact pool amount
    // Matching Keys.sol: bytes32 public constant POSITION_IMPACT_POOL_AMOUNT = keccak256(abi.encode("POSITION_IMPACT_POOL_AMOUNT"));
    const POSITION_IMPACT_POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_IMPACT_POOL_AMOUNT"])
    );
    // Matching Keys.sol: keccak256(abi.encode(POSITION_IMPACT_POOL_AMOUNT, market))
    const positionImpactPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [POSITION_IMPACT_POOL_AMOUNT_KEY, MARKET]
        )
    );
    const positionImpactPoolAmount = await dataStore.getUint(positionImpactPoolKey);
    console.log("  Position Impact Pool Amount:", positionImpactPoolAmount.toString());

    // Swap impact pool amount
    const SWAP_IMPACT_POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SWAP_IMPACT_POOL_AMOUNT"])
    );
    const swapImpactPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [SWAP_IMPACT_POOL_AMOUNT_KEY, MARKET]
        )
    );
    const swapImpactPoolAmount = await dataStore.getUint(swapImpactPoolKey);
    console.log("  Swap Impact Pool Amount:", swapImpactPoolAmount.toString());

    // Lent position impact pool amount
    const LENT_POSITION_IMPACT_POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LENT_POSITION_IMPACT_POOL_AMOUNT"])
    );
    const lentImpactPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [LENT_POSITION_IMPACT_POOL_AMOUNT_KEY, MARKET]
        )
    );
    const lentImpactPoolAmount = await dataStore.getUint(lentImpactPoolKey);
    console.log("  Lent Impact Pool Amount:", lentImpactPoolAmount.toString());

    // 2. Check current pool amounts
    console.log("\n=� Current Pool Amounts:");

    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const usdtPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );
    const usdtPoolAmount = await dataStore.getUint(usdtPoolKey);
    console.log("  USDT Pool Amount:", ethers.utils.formatUnits(usdtPoolAmount, 6));

    const sngnPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, sNGN]
        )
    );
    const sngnPoolAmount = await dataStore.getUint(sngnPoolKey);
    console.log("  sNGN Pool Amount:", ethers.utils.formatUnits(sngnPoolAmount, 18));

    // 3. Check open interest (should be 0 for empty market)
    console.log("\n=� Open Interest (should be 0 for empty market):");

    const OPEN_INTEREST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );

    // Check long open interest
    const longOpenInterestKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_KEY, MARKET, USDT, true] // collateralToken, isLong=true
        )
    );
    const longOpenInterest = await dataStore.getUint(longOpenInterestKey);
    console.log("  Long Open Interest (USDT):", longOpenInterest.toString());

    // Check short open interest
    const shortOpenInterestKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_KEY, MARKET, USDT, false] // collateralToken, isLong=false
        )
    );
    const shortOpenInterest = await dataStore.getUint(shortOpenInterestKey);
    console.log("  Short Open Interest (USDT):", shortOpenInterest.toString());

    // 4. Analysis
    console.log("\n=� Analysis:");

    const netImpactPool = positionImpactPoolAmount.sub(lentImpactPoolAmount);
    console.log("  Net Impact Pool (position - lent):", netImpactPool.toString());

    if (netImpactPool.gt(0) && usdtPoolAmount.eq(0) && sngnPoolAmount.eq(0)) {
        console.log("\nL PROBLEM FOUND!");
        console.log("  Empty pool but positive net impact pool amount!");
        console.log("  This will cause poolValue to be NEGATIVE.");
        console.log("  Pool value = 0 - " + netImpactPool.toString() + " = -" + netImpactPool.toString());
        console.log("\n  This triggers: InvalidPoolValueForDeposit error!");
    } else if (netImpactPool.eq(0)) {
        console.log("   Net impact pool is 0, shouldn't cause negative pool value");
    }

    // Check MAX_PNL_FACTOR_FOR_DEPOSITS
    // First get the keys
    const MAX_PNL_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR"])
    );
    const MAX_PNL_FACTOR_FOR_DEPOSITS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
    );

    console.log("\n  MAX_PNL_FACTOR settings:");

    // Check for long side
    const maxPnlFactorLongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "address", "bool"],
            [MAX_PNL_FACTOR, MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, true]
        )
    );
    const maxPnlFactorLong = await dataStore.getUint(maxPnlFactorLongKey);
    console.log("    For Longs:", maxPnlFactorLong.toString());

    // Check for short side
    const maxPnlFactorShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "address", "bool"],
            [MAX_PNL_FACTOR, MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, false]
        )
    );
    const maxPnlFactorShort = await dataStore.getUint(maxPnlFactorShortKey);
    console.log("    For Shorts:", maxPnlFactorShort.toString());

    if (maxPnlFactorLong.eq(0) && maxPnlFactorShort.eq(0)) {
        console.log("    ⚠️  Both are 0 - this might cause issues!");
    }
}

main().catch(console.error);