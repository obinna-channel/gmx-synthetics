const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Finding All Roles for Your Address ===\n");
    console.log("Your address:", signer.address);

    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    
    // Get RoleStore contract and check for RoleGranted events
    const provider = ethers.provider;
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // Get the contract creation block (approximate)
    const fromBlock = 197000000; // Adjust based on when contracts were deployed
    const toBlock = "latest";
    
    console.log("\nSearching for RoleGranted events...");
    
    try {
        // RoleGranted event signature: RoleGranted(address indexed account, bytes32 indexed role, address indexed sender)
        const filter = roleStore.filters.RoleGranted(signer.address, null, null);
        const events = await roleStore.queryFilter(filter, fromBlock, toBlock);
        
        if (events.length > 0) {
            console.log(`\nFound ${events.length} role(s) granted to your address:");
            console.log("\nRole Hash                                                         | Block     | Granted By");
            console.log("------------------------------------------------------------------|-----------|--------------------------------------------");
            
            for (const event of events) {
                const roleHash = event.args.roleKey;
                const grantedBy = event.args.sender;
                const block = event.blockNumber;
                
                // Check if role is still active
                const stillActive = await roleStore.hasRole(signer.address, roleHash);
                const status = stillActive ? "✅" : "❌";
                
                console.log(`${roleHash} | ${block} | ${grantedBy} ${status}`);
            }
            
            // Try to decode the role names
            console.log("\nAttempting to identify roles...");
            for (const event of events) {
                const roleHash = event.args.roleKey;
                const stillActive = await roleStore.hasRole(signer.address, roleHash);
                if (stillActive) {
                    // Check against known role hashes
                    const knownRoles = {
                        "0x71a9859d7dd21b24504a6f306077ffc2d510b4d4b61128e931fe937441ad1836": "KEEPER",
                        "0x0be09b8b74e7d3c385e6563f3cba4102535281ebac3d93a9b80af207a0d586d0": "ORDER_KEEPER",
                        "0x54bd8f83066932877f5b857305b4b57c82827c4de380d93407681a60a22d88ac": "MARKET_KEEPER",
                        "0x70546d1c92f8c2132ae23a23f5177aa8526356051c7510df99f50e012d221529": "CONTROLLER",
                        "0x2172861495e7b85edac73e3cd5fbb42dd675baadf627720e687bcfdaca025096": "ROLE_ADMIN",
                    };
                    
                    const roleName = knownRoles[roleHash] || "UNKNOWN";
                    console.log(`  ${roleHash} = ${roleName}`);
                }
            }
        } else {
            console.log("\nNo roles found for your address.");
        }
    } catch (error) {
        console.log("\nError querying events:", error.message);
        console.log("\nLet's try a different approach - checking role membership directly...");
        
        // Alternative: Check roleMembers for common roles
        const commonRoles = [
            "KEEPER",
            "ORDER_KEEPER",
            "MARKET_KEEPER",
            "CONTROLLER"
        ];
        
        for (const roleName of commonRoles) {
            const roleHash = ethers.utils.id(roleName);
            const hasRole = await roleStore.hasRole(signer.address, roleHash);
            if (hasRole) {
                console.log(`✅ You have ${roleName} role!`);
            }
        }
    }
}

main().catch(console.error);