const { ethers } = require("hardhat");

async function main() {
    console.log("=== Comparing Current State vs Last Working Simulation ===\n");

    const [signer] = await ethers.getSigners();
    
    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    console.log("1️⃣ DEPOSIT DETAILS:");
    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        console.log("  Account:", deposit.addresses.account);
        console.log("  Receiver:", deposit.addresses.receiver);
        console.log("  Market:", deposit.addresses.market);
        console.log("  Initial Long Token:", deposit.addresses.initialLongToken);
        console.log("  Initial Short Token:", deposit.addresses.initialShortToken);
        console.log("  Long Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
        console.log("  Short Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
        console.log("  Execution Fee:", deposit.numbers.executionFee.toString());
        console.log("  Min Market Tokens:", deposit.numbers.minMarketTokens.toString());
        
        // Check deposit timestamp
        const updatedAt = deposit.numbers.updatedAtTime;
        const currentTime = Math.floor(Date.now() / 1000);
        console.log("  Updated At:", updatedAt.toString());
        console.log("  Current Time:", currentTime);
        console.log("  Age (seconds):", currentTime - updatedAt);
    } catch (e) {
        console.log("  ❌ Error reading deposit:", e.message);
    }

    console.log("\n2️⃣ ORACLE STATE:");
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT price: ✅", ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch {
        console.log("  USDT price: ❌ Not set");
    }
    
    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN price: ✅", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch {
        console.log("  sNGN price: ❌ Not set");
    }
    
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    const currentTime = Math.floor(Date.now() / 1000);
    console.log("  Min timestamp:", minTs.toString());
    console.log("  Max timestamp:", maxTs.toString());
    console.log("  Current time:", currentTime);
    console.log("  Timestamp age:", currentTime - minTs.toNumber(), "seconds");

    console.log("\n3️⃣ CONFIGURATION:");
    
    // MIN_ORACLE_SIGNERS
    const MIN_ORACLE_SIGNERS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS);
    console.log("  MIN_ORACLE_SIGNERS:", minSigners.toString());
    
    // REQUEST_EXPIRATION_TIME
    const REQUEST_EXPIRATION_TIME = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
    );
    const expirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME);
    console.log("  REQUEST_EXPIRATION_TIME:", expirationTime.toString());
    
    // MAX_PNL_FACTOR_FOR_DEPOSITS
    const MAX_PNL_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
    );
    
    const pnlKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR, MARKET, true]
        )
    );
    const pnlKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR, MARKET, false]
        )
    );
    
    const longFactor = await dataStore.getUint(pnlKeyLong);
    const shortFactor = await dataStore.getUint(pnlKeyShort);
    console.log("  MAX_PNL_FACTOR (longs):", longFactor.eq(0) ? "❌ 0" : "✅ " + ethers.utils.formatUnits(longFactor, 30));
    console.log("  MAX_PNL_FACTOR (shorts):", shortFactor.eq(0) ? "❌ 0" : "✅ " + ethers.utils.formatUnits(shortFactor, 30));

    console.log("\n4️⃣ BALANCES:");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6));
    
    const marketBalance = await usdt.balanceOf(MARKET);
    console.log("  Market USDT:", ethers.utils.formatUnits(marketBalance, 6));

    console.log("\n5️⃣ FEATURE FLAGS:");
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const EXECUTE_DEPOSIT_DISABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["EXECUTE_DEPOSIT_FEATURE_DISABLED"])
    );
    const executeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [EXECUTE_DEPOSIT_DISABLED, DEPOSIT_HANDLER]
        )
    );
    const isDisabled = await dataStore.getBool(executeKey);
    console.log("  Execute deposit disabled:", isDisabled ? "❌ YES" : "✅ NO");

    console.log("\n\n📊 COMPARISON WITH LAST WORKING STATE:");
    console.log("  Last working simulation had:");
    console.log("  - Same deposit key format");
    console.log("  - Oracle prices set (USDT: $1, sNGN: 1500)");
    console.log("  - MIN_ORACLE_SIGNERS = 0");
    console.log("  - REQUEST_EXPIRATION_TIME = 3600");
    console.log("  - But MAX_PNL_FACTOR was NOT set (0)");
    console.log("\n  Current state:");
    console.log("  - MAX_PNL_FACTOR now set to 50%");
    console.log("  - Everything else should be the same");
    console.log("\n  🤔 The error 0x95b66fe9 is mysterious - not in the codebase");
}

main().catch(console.error);
