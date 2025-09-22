const { ethers } = require("hardhat");

async function main() {
    console.log("=== GRANTING ROUTER_PLUGIN ROLE TO EXCHANGE ROUTER ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";

    const [signer] = await ethers.getSigners();
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    const ROUTER_PLUGIN = ethers.utils.id("ROUTER_PLUGIN");
    console.log("ROUTER_PLUGIN hash:", ROUTER_PLUGIN);
    console.log("ExchangeRouter:", EXCHANGE_ROUTER);

    // Check current status
    const hasBefore = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);
    console.log("\nCurrent status: ExchangeRouter has ROUTER_PLUGIN role?", hasBefore);

    if (hasBefore) {
        console.log("✅ Already has the role!");
        return;
    }

    // Grant the role
    console.log("\nGranting ROUTER_PLUGIN role...");
    try {
        const tx = await roleStore.grantRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log("Block:", receipt.blockNumber);

        // Verify
        const hasAfter = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);
        console.log("\nVerification: ExchangeRouter has ROUTER_PLUGIN role?", hasAfter);

        if (hasAfter) {
            console.log("\n🎉 SUCCESS! ROUTER_PLUGIN role granted to ExchangeRouter!");
            console.log("This should fix the deposit creation issue.");
        } else {
            console.log("❌ Role was not granted properly");
        }
    } catch (error) {
        console.log("❌ Failed to grant role:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });