const { ethers } = require("hardhat");

async function main() {
    console.log("Granting OracleStore the CONTROLLER role...\n");
    
    // Contract addresses (fixing checksum for OracleStore)
    const roleStoreAddress = "0x81FBD321168655914C895ec63583140aB3eB2341";
    // The correct checksummed address for OracleStore
    const oracleStoreAddress = "0x8644aB2924A5Be1bD6389aA4593dbB277089cD1E".toLowerCase();
    const oracleStoreChecksummed = ethers.utils.getAddress(oracleStoreAddress);
    const deployerAddress = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Current signer:", signer.address);
    
    // Get RoleStore contract
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    
    // CORRECT CONTROLLER role hash (from GMX's Role.sol)
    const CONTROLLER_ROLE = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
    
    console.log("=== CHECKING ROLES ===");
    
    // Check OracleStore's role
    const oracleStoreHasRole = await roleStore.hasRole(oracleStoreChecksummed, CONTROLLER_ROLE);
    console.log("OracleStore has CONTROLLER role:", oracleStoreHasRole);
    
    if (!oracleStoreHasRole) {
        console.log("\n=== GRANTING CONTROLLER ROLE TO ORACLESTORE ===");
        
        // Grant CONTROLLER role to OracleStore
        console.log("Granting CONTROLLER role to OracleStore contract...");
        const tx = await roleStore.grantRole(oracleStoreChecksummed, CONTROLLER_ROLE);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ CONTROLLER role granted to OracleStore!");
        
        // Verify
        const nowHasRole = await roleStore.hasRole(oracleStoreChecksummed, CONTROLLER_ROLE);
        console.log("Verification - OracleStore now has CONTROLLER role:", nowHasRole);
    }
    
    // Now try to add signer to OracleStore
    console.log("\n=== ADDING SIGNER TO ORACLESTORE ===");
    const oracleStore = await ethers.getContractAt("OracleStore", oracleStoreChecksummed);
    
    try {
        // Check current signer count
        const currentCount = await oracleStore.getSignerCount();
        console.log("Current signer count:", currentCount.toString());
        
        console.log("Adding signer:", deployerAddress);
        const tx = await oracleStore.addSigner(deployerAddress);
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("✅ Signer added successfully!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Verify
        const signerCount = await oracleStore.getSignerCount();
        console.log("New signer count:", signerCount.toString());
        
        if (signerCount > 0) {
            const firstSigner = await oracleStore.getSigner(0);
            console.log("First signer:", firstSigner);
        }
        
        console.log("\n✅ SUCCESS! OracleStore is now configured with a signer.");
        console.log("You can now proceed with Oracle price updates.");
        
    } catch (error) {
        console.log("❌ Error adding signer:", error.message);
        
        if (error.data) {
            console.log("Error data:", error.data);
            
            // Try to decode the error
            if (error.data.startsWith("0xa35b150b")) {
                try {
                    const iface = new ethers.utils.Interface([
                        "error Unauthorized(address account, string role)"
                    ]);
                    const decoded = iface.parseError(error.data);
                    console.log("Unauthorized account:", decoded.args[0]);
                    console.log("Required role:", decoded.args[1]);
                } catch (e) {
                    console.log("Could not decode error parameters");
                }
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });