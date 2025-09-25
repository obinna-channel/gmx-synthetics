const { ethers } = require("hardhat");

async function main() {
    console.log("Setting MIN_ORACLE_SIGNERS to 1...\n");
    
    const dataStoreAddress = "0xE0bf5B90c1d6B1381Ca28BBdb849641C18bcFdf5";
    const roleStoreAddress = "0x81FBD321168655914C895ec63583140aB3eB2341";
    
    const [signer] = await ethers.getSigners();
    console.log("Current signer:", signer.address);
    
    const dataStore = await ethers.getContractAt("DataStore", dataStoreAddress);
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    
    // Check if we have CONFIG_KEEPER role
    const CONFIG_KEEPER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONFIG_KEEPER"])
    );
    
    const hasConfigKeeper = await roleStore.hasRole(signer.address, CONFIG_KEEPER_ROLE);
    console.log("Signer has CONFIG_KEEPER role:", hasConfigKeeper);
    
    if (!hasConfigKeeper) {
        console.log("Granting CONFIG_KEEPER role to signer...");
        
        // Check if we have ROLE_ADMIN to grant it
        const ROLE_ADMIN = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
        );
        
        const hasRoleAdmin = await roleStore.hasRole(signer.address, ROLE_ADMIN);
        if (!hasRoleAdmin) {
            console.log("ERROR: Need ROLE_ADMIN to grant CONFIG_KEEPER role");
            return;
        }
        
        const tx = await roleStore.grantRole(signer.address, CONFIG_KEEPER_ROLE);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ CONFIG_KEEPER role granted!");
    }
    
    // MIN_ORACLE_SIGNERS key = keccak256(abi.encode("MIN_ORACLE_SIGNERS"))
    const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    
    // Check current value
    const currentValue = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
    console.log("\nCurrent MIN_ORACLE_SIGNERS:", currentValue.toString());
    
    if (currentValue.eq(0)) {
        console.log("Setting MIN_ORACLE_SIGNERS to 1...");
        
        try {
            const tx = await dataStore.setUint(MIN_ORACLE_SIGNERS_KEY, 1);
            console.log("Transaction hash:", tx.hash);
            await tx.wait();
            
            // Verify
            const newValue = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
            console.log("✅ MIN_ORACLE_SIGNERS set to:", newValue.toString());
        } catch (e) {
            console.log("Error setting value:", e.message);
        }
    } else {
        console.log("MIN_ORACLE_SIGNERS already set to:", currentValue.toString());
    }
    
    console.log("\n✅ Oracle configuration complete!");
    console.log("You can now run the keeper to update prices.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });