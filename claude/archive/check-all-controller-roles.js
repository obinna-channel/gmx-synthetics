const { ethers } = require("hardhat");

async function main() {
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // CONTROLLER role hash
    const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
    console.log("CONTROLLER role hash:", CONTROLLER_ROLE);

    // Check contracts
    const contracts = [
        ["0xB6840dd443CD484Ff8F89cF7D766549b768DB21F", "DataStore"],
        ["0xcA051377254B642bE843DeD131de48206db63f94", "OracleStore"], 
        ["0x2b44fd56615FFA5F2980cA624871716340762238", "Oracle"],
    ];

    console.log("\nChecking if contracts themselves have CONTROLLER role:");
    console.log("======================================================");

    for (const [address, label] of contracts) {
        const hasRole = await roleStore.hasRole(address, CONTROLLER_ROLE);
        const status = hasRole ? "✅ HAS CONTROLLER" : "❌ NO CONTROLLER";
        console.log(`${address} (${label}): ${status}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
