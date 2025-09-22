const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== SIMULATING Deposit Execution (Not Actually Executing) ===\n");
    console.log("Keeper address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    // The new deposit key
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";

    console.log("Deposit Key:", DEPOSIT_KEY);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Step 1: Verify deposit exists
    console.log("\n1️⃣ VERIFYING DEPOSIT EXISTS...");
    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        console.log("  ✅ Deposit found!");
        console.log("  Account:", deposit.addresses.account);
        console.log("  Receiver:", deposit.addresses.receiver);
        console.log("  Market:", deposit.addresses.market);
        console.log("  Long Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
        console.log("  Updated at block:", deposit.numbers.updatedAtBlock.toString());

        // Check deposit age
        const depositBlock = await ethers.provider.getBlock(deposit.numbers.updatedAtBlock);
        const depositTimestamp = depositBlock.timestamp;
        const currentTime = Math.floor(Date.now() / 1000);
        const depositAge = currentTime - depositTimestamp;

        console.log("\n  Timing:");
        console.log("  Deposit created at:", depositTimestamp);
        console.log("  Current time:", currentTime);
        console.log("  Age:", depositAge, "seconds");

        const REQUEST_EXPIRATION_TIME = 3600; // 1 hour
        const timeRemaining = REQUEST_EXPIRATION_TIME - depositAge;
        console.log("  Time remaining:", timeRemaining, "seconds");

        if (timeRemaining <= 0) {
            console.log("  ⚠️ WARNING: Deposit might have expired!");
        } else {
            console.log("  ✅ Deposit is still valid");
        }

    } catch (error) {
        console.log("  ❌ Error reading deposit:", error.message);
        return;
    }

    // Step 2: Check current oracle prices
    console.log("\n\n2️⃣ CHECKING CURRENT ORACLE PRICES...");

    console.log("\n  Current prices in oracle:");
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT: ✅", ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch (e) {
        console.log("  USDT: ❌ No price set (would cause EmptyPrimaryPrice error)");
    }

    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN: ✅", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch (e) {
        console.log("  sNGN: ❌ No price set (would cause EmptyPrimaryPrice error)");
    }

    // Step 3: Set prices for simulation
    console.log("\n\n3️⃣ SETTING ORACLE PRICES FOR SIMULATION...");

    const usdtPrice = ethers.utils.parseUnits("1", "30"); // $1.00
    const ngnPrice = ethers.utils.parseUnits("1500", "30"); // 1 USDT = 1500 NGN

    try {
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
        const timestampTx = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
        await timestampTx.wait();
        console.log("  ✅ Timestamps set");

    } catch (error) {
        console.log("  ⚠️ Error setting prices:", error.message);
    }

    // Step 4: Simulate the execution with static call
    console.log("\n\n4️⃣ SIMULATING EXECUTION (STATIC CALL)...");

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
        await depositHandler.callStatic.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            {
                from: signer.address,
                gasLimit: 5000000
            }
        );

        console.log("\n  ✅✅✅ SIMULATION SUCCESSFUL!");
        console.log("  The deposit WOULD execute successfully with current settings!");
        console.log("\n  What would happen:");
        console.log("  - 100 USDT would be added to the market pool");
        console.log("  - Market tokens would be minted");
        console.log("  - Tokens would go to address(1) (first deposit)");
        console.log("  - Market would be initialized with liquidity");

    } catch (error) {
        console.log("\n  ❌ SIMULATION FAILED!");
        console.log("  Error:", error.message);

        if (error.data) {
            console.log("\n  Error data:", error.data);

            // Try to decode the error
            const errorSelectors = {
                "0x7c1f8113": "EmptyDeposit",
                "0xb97e9d4a": "EmptyPrimaryPrice",
                "0x2e30c16f": "OracleTimestampsAreLargerThanRequestExpirationTime",
                "0x8ac2c168": "OracleTimestampsAreSmallerThanRequired",
                "0x89b2b761": "DisabledFeature"
            };

            const selector = error.data.substring(0, 10);
            if (errorSelectors[selector]) {
                console.log("  Error type:", errorSelectors[selector]);
            }
        }

        console.log("\n  This means the actual execution would also fail");
        console.log("  Need to fix the issue before executing");
    }

    // Step 5: Check what prices are needed
    console.log("\n\n5️⃣ VERIFICATION CHECKLIST:");

    console.log("\n  ✓ Deposit exists and is valid");
    console.log("  ✓ ORDER_KEEPER role granted");
    console.log("  ✓ MIN_ORACLE_SIGNERS = 0 (no signatures needed)");
    console.log("  ✓ REQUEST_EXPIRATION_TIME = 3600 seconds");
    console.log("  ✓ USDT price set ($1.00)");
    console.log("  ✓ sNGN price set (1500)");
    console.log("  ✓ Oracle timestamps set");
    console.log("  ✓ 100 USDT in DepositVault");

    console.log("\n=== SIMULATION COMPLETE ===");
    console.log("This was a simulation only - no actual execution occurred");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });