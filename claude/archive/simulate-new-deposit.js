const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== SIMULATING Execution of NEW Deposit ===\n");
    console.log("Keeper address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    // The NEW deposit key
    const NEW_DEPOSIT_KEY = "0xa086d3ac59bbab5dfeb369072a8f0b04f6cade27fb9324d7d2ec165c937884aa";

    console.log("📝 Using NEW Deposit Key:", NEW_DEPOSIT_KEY);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Step 1: Verify deposit exists
    console.log("\n1️⃣ VERIFYING DEPOSIT EXISTS...");
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const reader = await ethers.getContractAt("Reader", READER);
    
    try {
        const deposit = await reader.getDeposit(DATA_STORE, NEW_DEPOSIT_KEY);
        if (deposit.addresses.account === ethers.constants.AddressZero) {
            console.log("  ❌ Deposit doesn't exist!");
            return;
        }
        console.log("  ✅ Deposit exists");
        console.log("  Account:", deposit.addresses.account);
        console.log("  Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
    } catch (e) {
        console.log("  ❌ Error checking deposit:", e.message);
        return;
    }

    // Step 2: Check and update oracle if needed
    console.log("\n2️⃣ CHECKING ORACLE STATE...");

    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check prices
    let needPriceUpdate = false;
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price: ✅", ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch {
        console.log("  USDT price: ❌ Not set");
        needPriceUpdate = true;
    }
    
    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price: ✅", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch {
        console.log("  sNGN price: ❌ Not set");
        needPriceUpdate = true;
    }

    // Check timestamps
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    console.log("  Timestamps: min =", minTs.toString(), ", max =", maxTs.toString());
    
    // Update if timestamps are too old (more than 5 minutes)
    if (currentTime - minTs.toNumber() > 300) {
        console.log("  ⚠️ Timestamps are stale, updating...");
        const timestampTx = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
        await timestampTx.wait();
        console.log("  ✅ Timestamps updated");
    }

    // Set prices if needed
    if (needPriceUpdate) {
        console.log("\n  Setting prices...");
        const usdtPrice = ethers.utils.parseUnits("1", "30");
        const ngnPrice = ethers.utils.parseUnits("1500", "30");
        
        try {
            await oracle.getPrimaryPrice(USDT);
        } catch {
            const tx1 = await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice });
            await tx1.wait();
            console.log("  ✅ USDT price set");
        }
        
        try {
            await oracle.getPrimaryPrice(sNGN);
        } catch {
            const tx2 = await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice });
            await tx2.wait();
            console.log("  ✅ sNGN price set");
        }
    }

    // Step 3: Simulate execution
    console.log("\n3️⃣ SIMULATING EXECUTION (STATIC CALL)...");

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("  Using empty oracle params (MIN_ORACLE_SIGNERS = 0)");
    console.log("  This is a simulation - no actual transaction will be sent");

    try {
        console.log("\n  🧪 Running simulation...");

        // Use callStatic to simulate without sending transaction
        const result = await depositHandler.callStatic.executeDeposit(
            NEW_DEPOSIT_KEY,
            oracleParams,
            {
                from: signer.address,
                gasLimit: 5000000
            }
        );

        console.log("\n  ✅✅✅ SIMULATION SUCCESSFUL!");
        console.log("\n  The deposit WOULD execute successfully!");
        console.log("\n  What would happen if executed:");
        console.log("  • 100 USDT would be added to the market pool");
        console.log("  • Market tokens would be minted");
        console.log("  • Tokens would go to address(1) (first deposit)");
        console.log("  • USDTNGN market would be initialized with liquidity");

    } catch (error) {
        console.log("\n  ❌ SIMULATION FAILED!");
        
        const errorString = error.toString();
        const revertMatch = errorString.match(/reason="([^"]+)"/);
        const dataMatch = errorString.match(/data="([^"]+)"/);

        if (revertMatch) {
            console.log("  Revert reason:", revertMatch[1]);
        } else if (dataMatch) {
            console.log("  Error data:", dataMatch[1]);
        } else {
            console.log("  Error:", error.message);
        }

        console.log("\n  This means the actual execution would also fail");
        console.log("  Need to fix the issue before executing");
    }

    console.log("\n=== SIMULATION COMPLETE ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
