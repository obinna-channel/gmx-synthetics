const { ethers } = require("hardhat");

async function main() {
    console.log("Debugging Oracle setup and permissions...\n");
    
    // Contract addresses
    const roleStoreAddress = "0x81FBD321168655914C895ec63583140aB3eB2341";
    const oracleAddress = "0x1bFA17439e7f91Ee7F7d464FB8B5666D454492E7";
    const oracleStoreAddress = ethers.utils.getAddress("0x8644aB2924A5Be1bD6389aA4593dbb277089cd1e".toLowerCase());
    const dataStoreAddress = "0xE0bf5B90c1d6B1381Ca28BBdb849641C18bcFdf5";
    const deployerAddress = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Current signer:", signer.address);
    
    // Get contracts
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    const oracleStore = await ethers.getContractAt("OracleStore", oracleStoreAddress);
    
    // Check if we can get the Oracle contract
    console.log("=== ORACLE CONTRACT CHECKS ===");
    
    // Minimal Oracle ABI for checking
    const oracleABI = [
        "function dataStore() view returns (address)",
        "function oracleStore() view returns (address)",
        "function eventEmitter() view returns (address)",
        "function roleStore() view returns (address)",
        "function getPrimaryPrice(address token) view returns (tuple(uint256 min, uint256 max))"
    ];
    
    const oracle = await ethers.getContractAt(oracleABI, oracleAddress);
    
    // Check Oracle's dependencies
    try {
        const oracleDataStore = await oracle.dataStore();
        console.log("Oracle's DataStore:", oracleDataStore);
        console.log("Expected DataStore:", dataStoreAddress);
        console.log("Match:", oracleDataStore.toLowerCase() === dataStoreAddress.toLowerCase());
    } catch (e) {
        console.log("Error getting DataStore:", e.message);
    }
    
    try {
        const oracleOracleStore = await oracle.oracleStore();
        console.log("Oracle's OracleStore:", oracleOracleStore);
        console.log("Expected OracleStore:", oracleStoreAddress);
        console.log("Match:", oracleOracleStore.toLowerCase() === oracleStoreAddress.toLowerCase());
    } catch (e) {
        console.log("Error getting OracleStore:", e.message);
    }
    
    console.log("\n=== ROLE CHECKS ===");
    
    // CORRECT CONTROLLER role hash
    const CONTROLLER_ROLE = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
    
    // Check roles
    const deployerHasController = await roleStore.hasRole(deployerAddress, CONTROLLER_ROLE);
    const oracleHasController = await roleStore.hasRole(oracleAddress, CONTROLLER_ROLE);
    const oracleStoreHasController = await roleStore.hasRole(oracleStoreAddress, CONTROLLER_ROLE);
    
    console.log("Deployer has CONTROLLER:", deployerHasController);
    console.log("Oracle has CONTROLLER:", oracleHasController);
    console.log("OracleStore has CONTROLLER:", oracleStoreHasController);
    
    // Check if Oracle needs CONTROLLER role
    if (!oracleHasController) {
        console.log("\n⚠️  Oracle contract doesn't have CONTROLLER role!");
        console.log("Granting CONTROLLER role to Oracle...");
        
        try {
            const tx = await roleStore.grantRole(oracleAddress, CONTROLLER_ROLE);
            console.log("Transaction hash:", tx.hash);
            await tx.wait();
            console.log("✅ CONTROLLER role granted to Oracle!");
        } catch (e) {
            console.log("Error granting role:", e.message);
        }
    }
    
    console.log("\n=== SIGNER CHECKS ===");
    
    // Check signers in OracleStore
    const signerCount = await oracleStore.getSignerCount();
    console.log("Signer count:", signerCount.toString());
    
    if (signerCount > 0) {
        for (let i = 0; i < signerCount; i++) {
            const signer = await oracleStore.getSigner(i);
            console.log(`Signer ${i}:`, signer);
            console.log("  Is deployer?", signer.toLowerCase() === deployerAddress.toLowerCase());
        }
    }
    
    // Check DataStore for MIN_ORACLE_SIGNERS
    console.log("\n=== DATASTORE CHECKS ===");
    
    const dataStore = await ethers.getContractAt("DataStore", dataStoreAddress);
    
    // MIN_ORACLE_SIGNERS key = keccak256(abi.encode("MIN_ORACLE_SIGNERS"))
    const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    
    try {
        const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
        console.log("MIN_ORACLE_SIGNERS:", minSigners.toString());
        
        if (minSigners.gt(signerCount)) {
            console.log("⚠️  Not enough signers! Need at least", minSigners.toString());
        }
        
        // If min signers is > 1 but we only have 1 signer, we need to set it to 1
        if (minSigners.gt(1) && signerCount.eq(1)) {
            console.log("\n=== FIXING MIN_ORACLE_SIGNERS ===");
            console.log("Setting MIN_ORACLE_SIGNERS to 1...");
            
            try {
                const tx = await dataStore.setUint(MIN_ORACLE_SIGNERS_KEY, 1);
                console.log("Transaction hash:", tx.hash);
                await tx.wait();
                console.log("✅ MIN_ORACLE_SIGNERS set to 1!");
            } catch (e) {
                console.log("Error setting MIN_ORACLE_SIGNERS:", e.message);
                console.log("You may need CONFIG_KEEPER role to change this");
            }
        }
    } catch (e) {
        console.log("Error getting MIN_ORACLE_SIGNERS:", e.message);
    }
    
    console.log("\n=== TEST PRICE READ ===");
    
    // Try to read a price
    const testToken = "0x0000000000000000000000000000000000000001"; // NGN
    try {
        const price = await oracle.getPrimaryPrice(testToken);
        console.log("Current NGN price (min):", price[0].toString());
        console.log("Current NGN price (max):", price[1].toString());
    } catch (e) {
        console.log("No price set yet or error:", e.message);
    }
    
    console.log("\n=== SUMMARY ===");
    console.log("Issues found:");
    
    if (!oracleHasController) {
        console.log("- Oracle needs CONTROLLER role");
    }
    if (signerCount.eq(0)) {
        console.log("- No signers in OracleStore");
    }
    if (!deployerHasController) {
        console.log("- Deployer needs CONTROLLER role");
    }
    
    console.log("\nFor the keeper to work:");
    console.log("1. Oracle must have CONTROLLER role ✓");
    console.log("2. Deployer must be a signer in OracleStore ✓");
    console.log("3. MIN_ORACLE_SIGNERS must be <= actual signer count");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });