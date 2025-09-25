const { ethers } = require("hardhat");

async function main() {
    console.log("Checking OracleStore permissions and configuration...\n");
    
    // Contract addresses
    const roleStoreAddress = "0x81FBD321168655914C895ec63583140aB3eB2341";
    const oracleStoreAddress = "0x8644aB2924A5Be1bD6389aA4593dbB277089cD1E";
    const oracleAddress = "0x1bFA17439e7f91Ee7F7d464FB8B5666D454492E7";
    const deployerAddress = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    // Get signers
    const [signer] = await ethers.getSigners();
    console.log("Current signer:", signer.address);
    console.log("Expected deployer:", deployerAddress);
    console.log("Match:", signer.address.toLowerCase() === deployerAddress.toLowerCase());
    console.log();
    
    // Get RoleStore contract
    console.log("=== ROLESTORE CHECKS ===");
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    
    // CONTROLLER role hash
    const CONTROLLER_ROLE = ethers.utils.id("CONTROLLER"); // keccak256("CONTROLLER")
    console.log("CONTROLLER role hash:", CONTROLLER_ROLE);
    
    // Check if deployer has CONTROLLER role
    const hasControllerRole = await roleStore.hasRole(deployerAddress, CONTROLLER_ROLE);
    console.log("Deployer has CONTROLLER role:", hasControllerRole);
    
    // Check if Oracle has CONTROLLER role
    const oracleHasRole = await roleStore.hasRole(oracleAddress, CONTROLLER_ROLE);
    console.log("Oracle has CONTROLLER role:", oracleHasRole);
    
    // Check if OracleStore has CONTROLLER role
    const oracleStoreHasRole = await roleStore.hasRole(oracleStoreAddress, CONTROLLER_ROLE);
    console.log("OracleStore has CONTROLLER role:", oracleStoreHasRole);
    console.log();
    
    // Get OracleStore contract
    console.log("=== ORACLESTORE CHECKS ===");
    const oracleStore = await ethers.getContractAt("OracleStore", oracleStoreAddress);
    
    // Check which RoleStore the OracleStore is using
    const connectedRoleStore = await oracleStore.roleStore();
    console.log("OracleStore's RoleStore:", connectedRoleStore);
    console.log("Matches expected RoleStore:", connectedRoleStore.toLowerCase() === roleStoreAddress.toLowerCase());
    console.log();
    
    // Check current signer configuration
    console.log("=== SIGNER CONFIGURATION ===");
    try {
        const signerCount = await oracleStore.getSignerCount();
        console.log("Current signer count:", signerCount.toString());
        
        // If there are signers, list them
        if (signerCount.gt(0)) {
            console.log("Existing signers:");
            for (let i = 0; i < signerCount.toNumber(); i++) {
                const signer = await oracleStore.getSigner(i);
                console.log(`  [${i}]: ${signer}`);
            }
        }
    } catch (e) {
        console.log("Error getting signer count:", e.message);
    }
    console.log();
    
    // Try to add a signer
    console.log("=== ATTEMPTING TO ADD SIGNER ===");
    const signerToAdd = deployerAddress;
    console.log("Attempting to add signer:", signerToAdd);
    
    try {
        // First, estimate gas to see if the transaction would succeed
        const gasEstimate = await oracleStore.estimateGas.addSigner(signerToAdd);
        console.log("Gas estimate successful:", gasEstimate.toString());
        
        // If gas estimation works, try the actual transaction
        console.log("Sending transaction...");
        const tx = await oracleStore.addSigner(signerToAdd);
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Transaction mined!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Verify the signer was added
        const newSignerCount = await oracleStore.getSignerCount();
        console.log("New signer count:", newSignerCount.toString());
        
    } catch (error) {
        console.log("\nError adding signer:");
        console.log("Message:", error.message);
        
        // Try to decode the error
        if (error.data) {
            console.log("Error data:", error.data);
            
            // Try to decode as Unauthorized error
            // The error signature for Unauthorized(address,string) is 0xa35b150b
            if (error.data.startsWith("0xa35b150b")) {
                console.log("\nThis is an Unauthorized error!");
                console.log("The transaction is reverting with role check failure.");
                
                // Decode the error data if possible
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
        
        if (error.error && error.error.data) {
            console.log("Revert data:", error.error.data);
        }
    }
    
    console.log("\n=== SUMMARY ===");
    console.log("1. Deployer has CONTROLLER role:", hasControllerRole);
    console.log("2. OracleStore uses correct RoleStore:", connectedRoleStore.toLowerCase() === roleStoreAddress.toLowerCase());
    console.log("3. Current signer count:", await oracleStore.getSignerCount());
    
    if (!hasControllerRole) {
        console.log("\n⚠️  Issue: Deployer doesn't have CONTROLLER role");
        console.log("Solution: Grant CONTROLLER role to deployer in RoleStore");
    } else {
        console.log("\n⚠️  Deployer has CONTROLLER role but still can't add signer");
        console.log("This suggests there might be an issue with how the role check is being performed");
        console.log("or there might be additional requirements in the addSigner function");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });