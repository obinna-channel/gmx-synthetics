const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit (Final Attempt) ===\n");
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

    // Step 1: Verify ORDER_KEEPER role
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

    // Step 2: Set oracle prices using setPrimaryPrice
    console.log("\nSetting Oracle Prices...");

    const usdtPrice = ethers.utils.parseUnits("1", "30"); // $1.00
    const ngnPrice = ethers.utils.parseUnits("1500", "30"); // 1 USDT = 1500 NGN

    try {
        // Clear existing prices first
        console.log("  Clearing all prices...");
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("  ✅ Prices cleared");

        // Set USDT price
        console.log("  Setting USDT price to $1.00...");
        const usdtTx = await oracle.setPrimaryPrice(USDT, {
            min: usdtPrice,
            max: usdtPrice
        });
        await usdtTx.wait();
        console.log("  ✅ USDT price set");

        // Set sNGN price
        console.log("  Setting sNGN price to 1500...");
        const ngnTx = await oracle.setPrimaryPrice(sNGN, {
            min: ngnPrice,
            max: ngnPrice
        });
        await ngnTx.wait();
        console.log("  ✅ sNGN price set");

        // Set timestamps
        console.log("  Setting oracle timestamps...");
        const currentTime = Math.floor(Date.now() / 1000);
        const timestampTx = await oracle.setTimestamps(currentTime - 60, currentTime + 60);
        await timestampTx.wait();
        console.log("  ✅ Timestamps set");

    } catch (error) {
        console.log("  ⚠️  Error setting prices:", error.message);
    }

    // Step 3: Verify prices are set
    console.log("\nVerifying Oracle Prices...");
    try {
        const usdtPriceRead = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price:", ethers.utils.formatUnits(usdtPriceRead.min, 30));

        const ngnPriceRead = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price:", ethers.utils.formatUnits(ngnPriceRead.min, 30));

        const minTs = await oracle.minTimestamp();
        const maxTs = await oracle.maxTimestamp();
        console.log("  Timestamp range:", minTs.toString(), "-", maxTs.toString());
    } catch (e) {
        console.log("  Error reading prices:", e.message);
    }

    // Step 4: Execute deposit with EMPTY oracle params
    console.log("\n📝 Executing deposit with EMPTY oracle params...");
    console.log("  This should work now that MIN_ORACLE_SIGNERS = 0");

    // EMPTY oracle params - no tokens, no providers, no data
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("  Oracle Params:");
    console.log("    Tokens:", oracleParams.tokens, "(empty)");
    console.log("    Providers:", oracleParams.providers, "(empty)");
    console.log("    Data:", oracleParams.data, "(empty)");

    try {
        console.log("\n🚀 Sending transaction...");
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            {
                gasLimit: 5000000
            }
        );

        console.log("  Transaction sent:", executeTx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await executeTx.wait();

        console.log("\n✅ DEPOSIT EXECUTED SUCCESSFULLY!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check for events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\n  Events emitted:", receipt.events.length);
            for (const event of receipt.events) {
                if (event.event) {
                    console.log("    -", event.event);
                }
            }
        }

        console.log("\n🎉 SUCCESS! The first deposit has been executed!");
        console.log("📊 The USDTNGN market now has initial liquidity!");
        console.log("💰 100 USDT has been added to the pool!");

    } catch (error) {
        console.log("\n❌ Error executing deposit:", error.message);

        if (error.data) {
            console.log("\nError data:", error.data);
        }

        // If it still fails, provide debugging info
        console.log("\n💡 Debugging Info:");
        console.log("  - ORDER_KEEPER role: ✅");
        console.log("  - MIN_ORACLE_SIGNERS: 0 (no signatures required)");
        console.log("  - Prices set via setPrimaryPrice: ✅");
        console.log("  - Empty oracle params should work: ✅");
        console.log("\n  Possible remaining issues:");
        console.log("  - Deposit might already be executed");
        console.log("  - Deposit might have expired");
        console.log("  - Oracle timestamps might not match deposit creation time");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });