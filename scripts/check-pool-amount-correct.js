const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Pool Amounts with Correct Keys ===\n");

    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // This is how Keys.poolAmountKey(market, token) works:
    // keccak256(abi.encode(POOL_AMOUNT_CONSTANT, market, token))
    // where POOL_AMOUNT_CONSTANT = keccak256(abi.encode("POOL_AMOUNT"))
    
    const POOL_AMOUNT_CONSTANT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    console.log("POOL_AMOUNT constant:", POOL_AMOUNT_CONSTANT);
    
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_CONSTANT, MARKET, mUSD]
        )
    );
    
    console.log("Pool Amount Key:", poolAmountKey);
    
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("\n💧 Pool Amount (mUSD):", ethers.utils.formatUnits(poolAmount, 6), "mUSD");
    
    // Also check max pool amount
    const MAX_POOL_AMOUNT_CONSTANT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_POOL_AMOUNT"])
    );
    
    const maxPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [MAX_POOL_AMOUNT_CONSTANT, MARKET, mUSD]
        )
    );
    
    const maxPoolAmount = await dataStore.getUint(maxPoolAmountKey);
    console.log("Max Pool Amount (mUSD):", ethers.utils.formatUnits(maxPoolAmount, 6), "mUSD");
    
    // Check position impact pool
    const POSITION_IMPACT_POOL_AMOUNT_CONSTANT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_IMPACT_POOL_AMOUNT"])
    );
    
    const positionImpactPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [POSITION_IMPACT_POOL_AMOUNT_CONSTANT, MARKET]
        )
    );
    
    const positionImpactPool = await dataStore.getUint(positionImpactPoolKey);
    console.log("Position Impact Pool:", ethers.utils.formatUnits(positionImpactPool, 18));
    
    // Check open interest for shorts
    const OPEN_INTEREST_CONSTANT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );
    
    const openInterestKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_CONSTANT, MARKET, mUSD, false] // false = shorts
        )
    );
    
    const openInterest = await dataStore.getUint(openInterestKey);
    console.log("\n📊 Open Interest (shorts):", ethers.utils.formatUnits(openInterest, 30), "USD");
    
    // Check reserved USD
    const RESERVED_USD_CONSTANT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["RESERVED_USD"])
    );
    
    const reservedUsdKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [RESERVED_USD_CONSTANT, MARKET, mUSD, false] // false = shorts
        )
    );
    
    const reservedUsd = await dataStore.getUint(reservedUsdKey);
    console.log("Reserved USD (shorts):", ethers.utils.formatUnits(reservedUsd, 30), "USD");
    
    console.log("\n✅ If pool amount is now showing correctly, the issue is elsewhere!");
}

main().catch(console.error);
