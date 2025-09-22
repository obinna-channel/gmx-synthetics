const { ethers } = require("hardhat");

async function main() {
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // CONTROLLER role hash
    const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
    console.log("CONTROLLER role hash:", CONTROLLER_ROLE);

    // Known addresses from the deployment logs
    const addressesToCheck = [
        ["0xBaB0D0892Bf8563B731f8e8970fE856ce9308292", "YOUR DEPLOYER"],
        ["0xC84f3398eDf6336E1Ef55b50Ca3F9f9f96B8b504", "Keeper 1"],
        ["0xFb11f15f206bdA02c224EDC744b0E50E46137046", "Keeper 2"],
        ["0xb38302e27bAe8932536A84ab362c3d1013420Cb4", "Keeper 3"],
        ["0xc9e1CE91d3f782499cFe787b6F1d2AF0Ca76C049", "Keeper 4"],
        ["0x9f7198eb1b9Ccc0Eb7A07eD228d8FbC12963ea33", "Keeper 5"],
        ["0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0", "Keeper 6"],
        ["0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3", "Keeper 7"],
        ["0xcA051377254B642bE843DeD131de48206db63f94", "OracleStore"],
        ["0x2b44fd56615FFA5F2980cA624871716340762238", "Oracle"],
    ];

    console.log("\nChecking CONTROLLER role for addresses:");
    console.log("=========================================");

    for (const [address, label] of addressesToCheck) {
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
