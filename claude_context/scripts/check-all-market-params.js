const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING ALL MARKET PARAMETERS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    const params = [
        ["DEPOSIT_GAS_LIMIT", ["string", "address"], ["DEPOSIT_GAS_LIMIT", MARKET]],
        ["MIN_COLLATERAL_FACTOR", ["string", "address"], ["MIN_COLLATERAL_FACTOR", MARKET]], 
        ["MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST_MULTIPLIER", ["string", "address"], ["MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST_MULTIPLIER", MARKET]],
        ["RESERVE_FACTOR", ["string", "address"], ["RESERVE_FACTOR", MARKET]],
        ["MAX_PNL_FACTOR", ["string", "address", "bool"], ["MAX_PNL_FACTOR", MARKET, true]],
        ["MAX_PNL_FACTOR", ["string", "address", "bool"], ["MAX_PNL_FACTOR", MARKET, false]],
        ["MIN_PNL_FACTOR_AFTER_ADL", ["string", "address", "bool"], ["MIN_PNL_FACTOR_AFTER_ADL", MARKET, true]],
        ["SWAP_FEE_FACTOR", ["string", "address"], ["SWAP_FEE_FACTOR", MARKET]],
        ["SWAP_IMPACT_FACTOR", ["string", "address"], ["SWAP_IMPACT_FACTOR", MARKET]],
        ["CREATE_DEPOSIT_FEATURE_DISABLED", ["string", "address"], ["CREATE_DEPOSIT_FEATURE_DISABLED", MARKET]],
        ["EXECUTE_DEPOSIT_FEATURE_DISABLED", ["string", "address"], ["EXECUTE_DEPOSIT_FEATURE_DISABLED", MARKET]],
        ["EXECUTE_DEPOSIT_FEE_FACTOR", ["string", "address"], ["EXECUTE_DEPOSIT_FEE_FACTOR", MARKET]],
        ["DEPOSIT_FEE_FACTOR", ["string", "address"], ["DEPOSIT_FEE_FACTOR", MARKET]],
    ];
    
    for (const [name, types, values] of params) {
        try {
            const key = ethers.utils.keccak256(
                ethers.utils.solidityPack(types, values)
            );
            const value = await dataStore.getUint(key);
            
            if (!value.eq(0)) {
                console.log(`${name}: ${value.toString()}`);
            }
        } catch (e) {
            // Try as bool
            try {
                const key = ethers.utils.keccak256(
                    ethers.utils.solidityPack(types, values)
                );
                const value = await dataStore.getBool(key);
                if (value) {
                    console.log(`${name}: ${value}`);
                }
            } catch (e2) {
                // Skip
            }
        }
    }
    
    // Check critical missing params
    console.log("\n=== CRITICAL CHECKS ===");
    
    // Pool amount
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address", "address"], ["POOL_AMOUNT", MARKET, USDT])
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Pool amount:", poolAmount.toString());
    
    // Market salt (required for market creation)
    const marketSaltKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MARKET_SALT", MARKET])
    );
    const marketSalt = await dataStore.getBytes32(marketSaltKey);
    console.log("Market salt:", marketSalt);
    
    if (marketSalt === ethers.constants.HashZero) {
        console.log("\n⚠️  Market salt is not set! This might be the issue.");
    }
}

main().catch(console.error);
