const { ethers } = require("hardhat");

async function main() {
    console.log("=== Deep Dive: Why Deposit Keeps Getting Cancelled ===\n");

    const [signer] = await ethers.getSigners();

    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    console.log("1️⃣ CHECKING DEPOSIT DETAILS...");

    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        console.log("  Account:", deposit.addresses.account);
        console.log("  Receiver:", deposit.addresses.receiver);
        console.log("  Market:", deposit.addresses.market);
        console.log("  Initial Long Token:", deposit.addresses.initialLongToken);
        console.log("  Initial Short Token:", deposit.addresses.initialShortToken);
        console.log("  Long Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
        console.log("  Short Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
    } catch (error) {
        console.log("  Error reading deposit:", error.message);
    }

    console.log("\n2️⃣ CHECKING MARKET CONFIGURATION...");

    const market = await reader.getMarket(DATA_STORE, MARKET);
    console.log("  Market Token:", market.marketToken);
    console.log("  Index Token:", market.indexToken);
    console.log("  Long Token:", market.longToken);
    console.log("  Short Token:", market.shortToken);

    // Check if tokens match
    if (market.indexToken === sNGN) {
        console.log("  ✅ Index token is sNGN");
    }
    if (market.longToken === USDT && market.shortToken === USDT) {
        console.log("  ✅ Long and short tokens are USDT");
    }

    console.log("\n3️⃣ CHECKING ORACLE PRICES...");

    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price:", ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch {
        console.log("  ❌ USDT price not set");
    }

    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price:", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch {
        console.log("  ❌ sNGN price not set");
    }

    // Check oracle timestamps
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    console.log("  Oracle timestamps:", minTs.toString(), "-", maxTs.toString());

    console.log("\n4️⃣ CHECKING SPECIAL FIRST DEPOSIT SETTINGS...");

    // Check MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT
    const MIN_MARKET_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT"])
    );

    const minMarketTokens = await dataStore.getUint(MIN_MARKET_TOKENS_KEY);
    console.log("  MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT:", minMarketTokens.toString());

    if (minMarketTokens.gt(0)) {
        console.log("  ⚠️  This could be blocking first deposit!");
    }

    console.log("\n5️⃣ SIMULATING TO GET EXACT ERROR...");

    // Try to simulate and catch the specific error
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    try {
        // First try simulateExecuteDeposit if available
        console.log("\n  Attempting simulation...");

        const simulateData = depositHandler.interface.encodeFunctionData("executeDeposit", [
            DEPOSIT_KEY,
            oracleParams
        ]);

        // Use eth_call to simulate
        const result = await signer.provider.call({
            to: DEPOSIT_HANDLER,
            data: simulateData,
            from: signer.address
        });

        console.log("  Simulation result:", result);

    } catch (error) {
        console.log("\n  ❌ Simulation error caught!");

        // Try to extract error data
        if (error.data) {
            const errorData = error.data;
            console.log("  Error data:", errorData);

            // Known error selectors
            const errorSelectors = {
                "0x7c1f8113": "EmptyDeposit",
                "0xb97e9d4a": "EmptyPrimaryPrice",
                "0x2e30c16f": "OracleTimestampsAreLargerThanRequestExpirationTime",
                "0x8ac2c168": "OracleTimestampsAreSmallerThanRequired",
                "0xd84b8ee8": "OracleTimestamp validation",
                "0x5c7470bc": "InvalidMinMarketTokensForFirstDeposit",
                "0x8a68c6dc": "InvalidPoolValueForDeposit",
                "0x4c14cc4c": "EmptyDepositAmountsAfterSwap"
            };

            const selector = errorData.substring(0, 10);
            if (errorSelectors[selector]) {
                console.log("  ❗ ERROR TYPE:", errorSelectors[selector]);
            } else {
                console.log("  ❓ Unknown error selector:", selector);
            }
        } else {
            console.log("  Error message:", error.message);
        }
    }

    console.log("\n6️⃣ CHECKING MARKET POOL VALUE...");

    // The issue might be related to pool value calculation for first deposit
    try {
        // Try to get market token price (might fail for uninitialized market)
        const marketTokenPrice = await reader.getMarketTokenPrice(
            DATA_STORE,
            market,
            ethers.utils.parseUnits("1500", 30), // NGN price
            ethers.utils.parseUnits("1", 30), // USDT price
            ethers.utils.parseUnits("1", 30), // USDT price
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR_FOR_DEPOSITS")),
            true
        );

        console.log("  Market token price:", ethers.utils.formatUnits(marketTokenPrice[0], 30));
        console.log("  Pool value:", ethers.utils.formatUnits(marketTokenPrice[1].poolValue, 30));

    } catch (error) {
        console.log("  ❌ Cannot calculate market token price - likely because pool is empty");
        console.log("  This could be the issue - first deposit special handling might be failing");
    }

    console.log("\n7️⃣ CHECKING MAX_PNL_FACTORS...");

    // Check PNL factors that might block deposits
    const MAX_PNL_FACTOR_FOR_DEPOSITS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
    );

    const pnlKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, true] // true for longs
        )
    );

    const maxPnlFactor = await dataStore.getUint(pnlKey);
    console.log("  MAX_PNL_FACTOR_FOR_DEPOSITS:", maxPnlFactor.toString());

    if (maxPnlFactor.eq(0)) {
        console.log("  ⚠️  MAX_PNL_FACTOR not set - this could block deposits!");
    }

    console.log("\n\n💡 LIKELY ISSUES:");
    console.log("  1. First deposit validation failing (receiver = address(1))");
    console.log("  2. Pool value calculation issues for empty market");
    console.log("  3. Missing configuration for MAX_PNL_FACTOR_FOR_DEPOSITS");
    console.log("  4. Market token price calculation failing for uninitialized market");
}

main().catch(console.error);