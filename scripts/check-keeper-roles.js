const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING KEEPER ROLES ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Querying with account:", signer.address);
    console.log();

    // Contract addresses from marks-arbitrumSepolia-deployments.md
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Get contracts
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Calculate role hashes using the SAME method as in Role.sol
    // Role.sol uses: keccak256(abi.encode("ROLE_NAME"))
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    const LIQUIDATION_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LIQUIDATION_KEEPER"])
    );
    const ROLE_ADMIN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
    );

    console.log("Contract Addresses:");
    console.log("  RoleStore:             ", ROLE_STORE);
    console.log("  MockOracleProvider:    ", MOCK_ORACLE_PROVIDER);
    console.log();

    console.log("Role Hashes (keccak256(abi.encode(\"ROLE_NAME\"))):");
    console.log("  ORDER_KEEPER:          ", ORDER_KEEPER);
    console.log("  LIQUIDATION_KEEPER:    ", LIQUIDATION_KEEPER);
    console.log("  ROLE_ADMIN:            ", ROLE_ADMIN);
    console.log();

    // Check ORDER_KEEPER role
    console.log("📋 ORDER_KEEPER Role:");
    const orderKeeperCount = await roleStore.getRoleMemberCount(ORDER_KEEPER);
    console.log("  Number of members:     ", orderKeeperCount.toString());

    if (orderKeeperCount > 0) {
        const orderKeepers = await roleStore.getRoleMembers(ORDER_KEEPER, 0, orderKeeperCount);
        console.log("  Members:");
        for (let i = 0; i < orderKeepers.length; i++) {
            console.log(`    ${i + 1}. ${orderKeepers[i]}`);
        }
    } else {
        console.log("  ⚠️  No members found!");
    }
    console.log();

    // Check LIQUIDATION_KEEPER role
    console.log("💀 LIQUIDATION_KEEPER Role:");
    const liquidationKeeperCount = await roleStore.getRoleMemberCount(LIQUIDATION_KEEPER);
    console.log("  Number of members:     ", liquidationKeeperCount.toString());

    if (liquidationKeeperCount > 0) {
        const liquidationKeepers = await roleStore.getRoleMembers(LIQUIDATION_KEEPER, 0, liquidationKeeperCount);
        console.log("  Members:");
        for (let i = 0; i < liquidationKeepers.length; i++) {
            console.log(`    ${i + 1}. ${liquidationKeepers[i]}`);
        }
    } else {
        console.log("  ⚠️  No members found!");
    }
    console.log();

    // Check ROLE_ADMIN (for reference)
    console.log("👑 ROLE_ADMIN Role (for reference):");
    const roleAdminCount = await roleStore.getRoleMemberCount(ROLE_ADMIN);
    console.log("  Number of members:     ", roleAdminCount.toString());

    if (roleAdminCount > 0) {
        const roleAdmins = await roleStore.getRoleMembers(ROLE_ADMIN, 0, roleAdminCount);
        console.log("  Members:");
        for (let i = 0; i < roleAdmins.length; i++) {
            console.log(`    ${i + 1}. ${roleAdmins[i]}`);
        }
    }
    console.log();

    // Get current keeper wallet from .env
    console.log("🔑 Current Keeper Wallet (from UPDATER_PRIVATE_KEY in .env):");
    if (process.env.UPDATER_PRIVATE_KEY) {
        const keeperWallet = new ethers.Wallet(process.env.UPDATER_PRIVATE_KEY);
        console.log("  Address:               ", keeperWallet.address);

        const hasOrderKeeper = await roleStore.hasRole(keeperWallet.address, ORDER_KEEPER);
        const hasLiquidationKeeper = await roleStore.hasRole(keeperWallet.address, LIQUIDATION_KEEPER);

        console.log("  Has ORDER_KEEPER:      ", hasOrderKeeper ? "✅ YES" : "❌ NO");
        console.log("  Has LIQUIDATION_KEEPER:", hasLiquidationKeeper ? "✅ YES" : "❌ NO");
    } else {
        console.log("  ⚠️  UPDATER_PRIVATE_KEY not found in .env");
    }
    console.log();

    // Check MockOracleProvider owner
    console.log("🔒 MockOracleProvider Ownership:");
    const mockProvider = await ethers.getContractAt("contracts/oracle/MockOracleProvider.sol:MockOracleProvider", MOCK_ORACLE_PROVIDER);
    const owner = await mockProvider.owner();
    console.log("  Current owner:         ", owner);

    if (process.env.UPDATER_PRIVATE_KEY) {
        const keeperWallet = new ethers.Wallet(process.env.UPDATER_PRIVATE_KEY);
        const isOwner = owner.toLowerCase() === keeperWallet.address.toLowerCase();
        console.log("  Keeper is owner:       ", isOwner ? "✅ YES" : "❌ NO");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
