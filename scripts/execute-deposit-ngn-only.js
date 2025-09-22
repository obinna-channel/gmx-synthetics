const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit (NGN Price Only) ===\n");
    console.log("Keeper address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    // The deposit key we need to execute
    const DEPOSIT_KEY = "0x3772b0c5ec95382c48668749a697d7586df957e3d46b97658950d33d9daa5910";

    console.log("Deposit Key:", DEPOSIT_KEY);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Check ORDER_KEEPER role
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );

    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("Has ORDER_KEEPER role:", hasRole);

    if (!hasRole) {
        console.log("❌ Account does not have ORDER_KEEPER role!");
        return;
    }

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    const timestamp = Math.floor(Date.now() / 1000);

    console.log("\nCurrent block:", currentBlock.number);
    console.log("Timestamp:", timestamp);

    // Price values (30 decimal precision)
    const ngnPrice = ethers.utils.parseUnits("1500", "30"); // 1 USDT = 1500 NGN

    console.log("\n⚠️  ONLY setting NGN price (not USDT):");
    console.log("  sNGN: 1500 (1 USDT = 1500 NGN)");

    // Clear any existing prices first
    console.log("\nClearing all oracle prices first...");
    try {
        const clearTx = await oracle.clearAllPrices();
        console.log("Clear prices tx:", clearTx.hash);
        await clearTx.wait();
        console.log("✅ Prices cleared");
    } catch (error) {
        console.log("Could not clear prices:", error.message);
    }

    // Set ONLY NGN price
    console.log("\nSetting ONLY sNGN price...");
    try {
        const ngnPriceTx = await oracle.setPrimaryPrice(sNGN, {
            min: ngnPrice,
            max: ngnPrice
        });
        console.log("sNGN price tx:", ngnPriceTx.hash);
        await ngnPriceTx.wait();
        console.log("✅ sNGN price set to 1500");
    } catch (error) {
        console.log("❌ Could not set sNGN price:", error.message);
    }

    // Verify what prices are set
    console.log("\nVerifying oracle prices:");
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price min:", usdtPrice.min.toString());
        console.log("  USDT price max:", usdtPrice.max.toString());
        if (usdtPrice.min.eq(0)) {
            console.log("  ✅ USDT price is NOT set (as intended)");
        }
    } catch (e) {
        console.log("  Could not read USDT price");
    }

    try {
        const ngnPriceRead = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price min:", ethers.utils.formatUnits(ngnPriceRead.min, 30));
        console.log("  sNGN price max:", ethers.utils.formatUnits(ngnPriceRead.max, 30));
        if (ngnPriceRead.min.gt(0)) {
            console.log("  ✅ sNGN price IS set");
        }
    } catch (e) {
        console.log("  Could not read sNGN price");
    }

    // Oracle parameters for executeDeposit
    // Only include sNGN in the tokens array
    const oracleParams = {
        tokens: [sNGN], // ONLY sNGN, no USDT
        providers: [oracle.address],
        data: []
    };

    // Execute the deposit
    console.log("\n📝 Executing deposit with ONLY sNGN price...");
    console.log("  Deposit Key:", DEPOSIT_KEY);
    console.log("  Oracle Params:");
    console.log("    Tokens:", oracleParams.tokens);
    console.log("    Providers:", oracleParams.providers);

    try {
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            {
                gasLimit: 5000000
            }
        );

        console.log("\n🚀 Transaction sent:", executeTx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await executeTx.wait();
        console.log("\n✅ Deposit executed successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        if (receipt.events && receipt.events.length > 0) {
            console.log("\nEvents emitted:");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log("  -", event.event);
                }
            }
        }

        console.log("\n🎉 SUCCESS! The deposit was executed with ONLY sNGN price!");

    } catch (error) {
        console.log("\n❌ Error executing deposit:", error.message);

        if (error.data) {
            console.log("\nError data:", error.data);
        }

        console.log("\n💡 This error likely indicates:");
        console.log("  - USDT price IS required even though it's always $1");
        console.log("  - The system needs both collateral token prices");
        console.log("  - Or there's another oracle validation issue");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });