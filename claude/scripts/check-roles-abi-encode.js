const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking Roles with Correct Hash (abi.encode) ===\n");
    console.log("Your address:", signer.address);

    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Using keccak256(abi.encode("ROLE_NAME")) as per Role.sol
    const roles = [
        { name: "CONTROLLER", hash: "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b" },
        { name: "ORDER_KEEPER", hash: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])) },
        { name: "MARKET_KEEPER", hash: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_KEEPER"])) },
        { name: "ROLE_ADMIN", hash: "0x56908b85b56869d7c69cd020749874f238259af9646ca930287866cdd660b7d9" },
        { name: "CONFIG_KEEPER", hash: "0x901fb3de937a1dcb6ecaf26886fda47a088e74f36232a0673eade97079dc225b" },
    ];

    console.log("Role Name          | Has Role | Role Hash");
    console.log("-------------------|----------|------------------------------------------");
    
    for (const role of roles) {
        const hasRole = await roleStore.hasRole(signer.address, role.hash);
        console.log(
            role.name.padEnd(18) + " | " + 
            (hasRole ? "✅ YES  " : "❌ NO   ") + " | " + 
            role.hash.substring(0, 20) + "..."
        );
    }
    
    // Check CONTROLLER role specifically
    const CONTROLLER = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);
    
    if (hasController) {
        console.log("\n🎉 EXCELLENT! You have CONTROLLER role!");
        console.log("You can execute deposits directly.");
    }
    
    // Also check DepositHandler's CONTROLLER role
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const depositHandlerHasController = await roleStore.hasRole(DEPOSIT_HANDLER, CONTROLLER);
    console.log("\nDepositHandler has CONTROLLER:", depositHandlerHasController ? "✅ YES" : "❌ NO");
}

main().catch(console.error);