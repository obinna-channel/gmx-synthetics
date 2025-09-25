const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle Permissions ===\n");
    
    const [signer] = await ethers.getSigners();
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // Check if we have CONTROLLER role (needed to set prices)
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    const hasControllerRole = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("Your address:", signer.address);
    console.log("Has CONTROLLER role:", hasControllerRole ? "✅ YES" : "❌ NO");
    
    if (!hasControllerRole) {
        console.log("\n❌ You can't set oracle prices without CONTROLLER role!");
    }
    
    // Check current prices
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    console.log("\nCurrent Oracle State:");
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price:", ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch (e) {
        console.log("  USDT price: Not set");
    }
    
    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price:", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch (e) {
        console.log("  sNGN price: Not set");
    }
    
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    console.log("  Timestamps:", minTs.toString(), "-", maxTs.toString());
}

main().catch(console.error);
