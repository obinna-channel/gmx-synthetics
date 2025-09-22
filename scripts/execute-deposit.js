const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit ===\n");
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

    // Step 1: Check if we have ORDER_KEEPER role
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

    // Step 2: Prepare oracle parameters
    console.log("\nPreparing oracle parameters...");

    // For GMX V2, we need to provide prices through the oracle system
    // The prices need to be signed by an oracle signer

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    const timestamp = Math.floor(Date.now() / 1000);

    console.log("Current block:", currentBlock.number);
    console.log("Timestamp:", timestamp);

    // Price values (30 decimal precision)
    const PRICE_PRECISION = ethers.utils.parseUnits("1", "30");
    const usdtPrice = PRICE_PRECISION; // $1.00
    const ngnPrice = ethers.utils.parseUnits("1500", "30"); // 1 USDT = 1500 NGN

    console.log("\nPrices:");
    console.log("  USDT: $1.00");
    console.log("  sNGN: 1500 (1 USDT = 1500 NGN)");

    // Oracle parameters structure for executeDeposit
    // This is a simplified version - in production, these would be signed by oracle nodes
    const oracleParams = {
        tokens: [USDT, sNGN],
        providers: [oracle.address, oracle.address], // Using the oracle as provider
        data: [] // Empty data array for simplified oracle
    };

    // Step 3: Try the simplified approach first - set prices directly on oracle
    console.log("\nSetting oracle prices directly...");

    try {
        // Set USDT price
        const usdtPriceTx = await oracle.setPrimaryPrice(USDT, {
            min: usdtPrice,
            max: usdtPrice
        });
        console.log("USDT price tx:", usdtPriceTx.hash);
        await usdtPriceTx.wait();
        console.log("✅ USDT price set");

        // Set sNGN price
        const ngnPriceTx = await oracle.setPrimaryPrice(sNGN, {
            min: ngnPrice,
            max: ngnPrice
        });
        console.log("sNGN price tx:", ngnPriceTx.hash);
        await ngnPriceTx.wait();
        console.log("✅ sNGN price set");

    } catch (error) {
        console.log("Note: Could not set prices directly (expected if not oracle signer)");
    }

    // Step 4: Execute the deposit
    console.log("\n📝 Executing deposit...");
    console.log("  Deposit Key:", DEPOSIT_KEY);
    console.log("  Oracle Params:");
    console.log("    Tokens:", oracleParams.tokens);
    console.log("    Providers:", oracleParams.providers);

    try {
        // Call executeDeposit
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            {
                gasLimit: 5000000 // Set high gas limit to ensure execution
            }
        );

        console.log("\n🚀 Transaction sent:", executeTx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await executeTx.wait();
        console.log("\n✅ Deposit executed successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check for events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\nEvents emitted:");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log("  -", event.event);
                }
            }
        }

        console.log("\n🎉 SUCCESS! The first deposit has been executed!");
        console.log("The USDTNGN market should now have initial liquidity.");

    } catch (error) {
        console.log("\n❌ Error executing deposit:", error.message);

        // Try to decode the error
        if (error.data) {
            console.log("\nError data:", error.data);
            try {
                // Common GMX error signatures
                const errorSignatures = {
                    "0x6a2af665": "UnauthorizedKeeper",
                    "0x7c1f8113": "EmptyDeposit",
                    "0x0a81dcb3": "InvalidPrices",
                    "0x8ac2c168": "OracleTimestampsAreSmallerThanRequired",
                    "0x2e30c16f": "OracleTimestampsAreLargerThanRequestExpirationTime"
                };

                const selector = error.data.substring(0, 10);
                if (errorSignatures[selector]) {
                    console.log("Error type:", errorSignatures[selector]);
                }
            } catch (e) {
                // Ignore decode errors
            }
        }

        console.log("\n💡 Troubleshooting tips:");
        console.log("1. Ensure ORDER_KEEPER role is granted");
        console.log("2. Oracle prices may need to be signed by authorized signers");
        console.log("3. Check if deposit still exists (wasn't already executed/cancelled)");
        console.log("4. Verify oracle timestamp requirements");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });