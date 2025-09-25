const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING CRITICAL POOL PARAMETERS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // These are critical parameters that MUST be set for deposits to work
    const paramsToSet = [
        {
            name: "MAX_POOL_AMOUNT",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address", "address"], 
                [ethers.utils.id("MAX_POOL_AMOUNT"), MARKET, USDT])
            ),
            value: ethers.utils.parseUnits("10000000", 6), // 10M USDT
            description: "Maximum pool amount for USDT"
        },
        {
            name: "MAX_POOL_USD_FOR_DEPOSIT", 
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address", "address"],
                [ethers.utils.id("MAX_POOL_USD_FOR_DEPOSIT"), MARKET, USDT])
            ),
            value: ethers.utils.parseUnits("10000000", 30), // $10M with 30 decimals
            description: "Maximum pool USD for deposits"
        },
        {
            name: "SWAP_FEE_FACTOR",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address", "bool"],
                [ethers.utils.id("SWAP_FEE_FACTOR"), MARKET, false])
            ),
            value: ethers.utils.parseUnits("0.001", 30), // 0.1% fee (30 decimals)
            description: "Swap fee factor for negative impact"
        },
        {
            name: "SWAP_FEE_FACTOR",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address", "bool"],
                [ethers.utils.id("SWAP_FEE_FACTOR"), MARKET, true])
            ),
            value: ethers.utils.parseUnits("0.0005", 30), // 0.05% fee (30 decimals)
            description: "Swap fee factor for positive impact"
        },
        {
            name: "MIN_COLLATERAL_FACTOR",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address"],
                [ethers.utils.id("MIN_COLLATERAL_FACTOR"), MARKET])
            ),
            value: ethers.utils.parseUnits("0.01", 30), // 1% (30 decimals)
            description: "Minimum collateral factor"
        },
        {
            name: "RESERVE_FACTOR",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address", "bool"],
                [ethers.utils.id("RESERVE_FACTOR"), MARKET, true])
            ),
            value: ethers.utils.parseUnits("0.25", 30), // 25% for longs (30 decimals)
            description: "Reserve factor for longs"
        },
        {
            name: "RESERVE_FACTOR",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(["bytes32", "address", "bool"],
                [ethers.utils.id("RESERVE_FACTOR"), MARKET, false])
            ),
            value: ethers.utils.parseUnits("0.25", 30), // 25% for shorts (30 decimals)
            description: "Reserve factor for shorts"
        }
    ];
    
    for (const param of paramsToSet) {
        try {
            const currentValue = await dataStore.getUint(param.key);
            if (currentValue.eq(0)) {
                console.log(`Setting ${param.name}: ${param.description}`);
                const tx = await dataStore.setUint(param.key, param.value);
                await tx.wait();
                console.log("  ✓ Set");
            } else {
                console.log(`${param.name} already set:`, currentValue.toString());
            }
        } catch (e) {
            console.log(`Error setting ${param.name}:`, e.message);
        }
    }
    
    console.log("\n✅ Critical parameters set!");
}

main().catch(console.error);
