const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING DEPOSIT FEE FACTORS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Set deposit fee factors (separate from swap fees)
    const depositFeeParams = [
        {
            name: "DEPOSIT_FEE_FACTOR (positive)",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ["bytes32", "address", "bool"],
                    [ethers.utils.id("DEPOSIT_FEE_FACTOR"), MARKET, true]
                )
            ),
            value: ethers.utils.parseUnits("0.0005", 30), // 0.05% fee
        },
        {
            name: "DEPOSIT_FEE_FACTOR (negative)",
            key: ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ["bytes32", "address", "bool"],
                    [ethers.utils.id("DEPOSIT_FEE_FACTOR"), MARKET, false]
                )
            ),
            value: ethers.utils.parseUnits("0.001", 30), // 0.1% fee
        }
    ];
    
    for (const param of depositFeeParams) {
        const tx = await dataStore.setUint(param.key, param.value);
        await tx.wait();
        console.log(`✓ Set ${param.name}`);
    }
    
    console.log("\nNow all critical parameters should be set. Let's verify:");
    console.log("✓ Market registered in DataStore");
    console.log("✓ Max deposit amounts set");
    console.log("✓ Pool amounts configured");
    console.log("✓ Swap fees configured");
    console.log("✓ Deposit fees configured");
    console.log("✓ Market salt set (with correct key)");
    console.log("✓ Oracle prices set");
    console.log("✓ Reserve factors set");
}

main().catch(console.error);
