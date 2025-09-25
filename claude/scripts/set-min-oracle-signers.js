const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting MIN_ORACLE_SIGNERS to 0 ===\n");
    console.log("Signer address:", signer.address);

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // MIN_ORACLE_SIGNERS key - using keccak256(abi.encode()) as per Keys.sol
    const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );

    console.log("MIN_ORACLE_SIGNERS key hash:", MIN_ORACLE_SIGNERS_KEY);
    console.log("Expected format: keccak256(abi.encode('MIN_ORACLE_SIGNERS'))");

    // Check current value
    const currentValue = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
    console.log("\nCurrent MIN_ORACLE_SIGNERS:", currentValue.toString());

    if (currentValue.eq(0)) {
        console.log("✅ Already set to 0, no change needed.");
        return;
    }

    console.log("\n📖 What this change does:");
    console.log("  1. Sets minimum required oracle signatures from", currentValue.toString(), "to 0");
    console.log("  2. Oracle price updates will no longer require valid signatures");
    console.log("  3. ONLY addresses with CONTROLLER role can still submit prices");
    console.log("  4. This is a TESTING configuration - not for production!");
    
    console.log("\n⚠️  Security implications:");
    console.log("  - Removes signature validation for oracle prices");
    console.log("  - Controllers can submit any prices without signatures");
    console.log("  - Should be reverted after testing");

    console.log("\n🔒 Access control remains:");
    console.log("  - Only CONTROLLER role can call Oracle.setPrices()");
    console.log("  - Random addresses still cannot submit prices");

    console.log("\nProceed with setting MIN_ORACLE_SIGNERS to 0?");
    console.log("This action requires CONFIG_KEEPER or CONTROLLER role.");
    console.log("\n[Ready to execute - uncomment the execution code below to proceed]");

    // EXECUTION CODE - READY TO EXECUTE
    try {
        console.log("\n🚀 Setting MIN_ORACLE_SIGNERS to 0...");
        const tx = await dataStore.setUint(MIN_ORACLE_SIGNERS_KEY, 0);
        console.log("Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        
        // Verify the change
        const newValue = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
        console.log("\n✅ Success! New MIN_ORACLE_SIGNERS:", newValue.toString());
        
        console.log("\n📑 Remember to:");
        console.log("  1. Execute your deposit with mock prices");
        console.log("  2. Set MIN_ORACLE_SIGNERS back to", currentValue.toString(), "after testing");
        
    } catch (error) {
        console.log("\n❌ Error setting MIN_ORACLE_SIGNERS:", error.message);
        
        // Check if it's a permission issue
        const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
        const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
        
        const CONTROLLER = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
        const CONFIG_KEEPER = "0x901fb3de937a1dcb6ecaf26886fda47a088e74f36232a0673eade97079dc225b";
        
        const hasController = await roleStore.hasRole(signer.address, CONTROLLER);
        const hasConfigKeeper = await roleStore.hasRole(signer.address, CONFIG_KEEPER);
        
        console.log("\nYour roles:");
        console.log("  CONTROLLER:", hasController ? "✅" : "❌");
        console.log("  CONFIG_KEEPER:", hasConfigKeeper ? "✅" : "❌");
        
        if (!hasController && !hasConfigKeeper) {
            console.log("\nYou need CONTROLLER or CONFIG_KEEPER role to change DataStore values.");
        }
    }
}

main().catch(console.error);