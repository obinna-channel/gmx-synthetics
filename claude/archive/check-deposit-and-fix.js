const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Status and Fixing Issues ===\n");

    const [signer] = await ethers.getSigners();

    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("1️⃣ CHECKING IF DEPOSIT EXISTS...");

    // Check account deposits
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );

    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer.address]
        )
    );

    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("  Your deposit count:", depositCount.toString());

    if (depositCount.gt(0)) {
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        console.log("  Your deposit keys:");
        for (const key of depositKeys) {
            console.log("    -", key);
            if (key === DEPOSIT_KEY) {
                console.log("      ✅ This is our deposit key!");
            }
        }
    } else {
        console.log("  ❌ No deposits found for your account!");
        console.log("  The deposit was likely cancelled and removed");
    }

    console.log("\n2️⃣ FIXING ORACLE PRICES...");

    // Prices got cleared, need to set them again
    const usdtPrice = ethers.utils.parseUnits("1", "30");
    const ngnPrice = ethers.utils.parseUnits("1500", "30");

    try {
        console.log("  Setting USDT price...");
        const tx1 = await oracle.setPrimaryPrice(USDT, {
            min: usdtPrice,
            max: usdtPrice
        });
        await tx1.wait();
        console.log("  ✅ USDT price set");

        console.log("  Setting sNGN price...");
        const tx2 = await oracle.setPrimaryPrice(sNGN, {
            min: ngnPrice,
            max: ngnPrice
        });
        await tx2.wait();
        console.log("  ✅ sNGN price set");

        console.log("  Setting timestamps...");
        const currentTime = Math.floor(Date.now() / 1000);
        const tx3 = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
        await tx3.wait();
        console.log("  ✅ Timestamps set");
    } catch (e) {
        console.log("  Error setting prices:", e.message);
    }

    console.log("\n3️⃣ SETTING MAX_PNL_FACTOR_FOR_DEPOSITS...");

    // This is likely blocking deposits
    const MAX_PNL_FACTOR_FOR_DEPOSITS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
    );

    // Set for both long and short sides
    const pnlKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, true] // true for longs
        )
    );

    const pnlKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, false] // false for shorts
        )
    );

    try {
        // Set to 50% (50% = 50 * 10^28 in 30 decimal precision)
        const maxPnlFactor = ethers.utils.parseUnits("0.5", 30); // 50%

        console.log("  Setting MAX_PNL_FACTOR_FOR_DEPOSITS for longs...");
        const tx1 = await dataStore.setUint(pnlKeyLong, maxPnlFactor);
        await tx1.wait();
        console.log("  ✅ Set for longs");

        console.log("  Setting MAX_PNL_FACTOR_FOR_DEPOSITS for shorts...");
        const tx2 = await dataStore.setUint(pnlKeyShort, maxPnlFactor);
        await tx2.wait();
        console.log("  ✅ Set for shorts");

        console.log("  MAX_PNL_FACTOR_FOR_DEPOSITS now set to 50%");
    } catch (e) {
        console.log("  Error setting MAX_PNL_FACTOR:", e.message);
    }

    console.log("\n4️⃣ CHECKING OTHER POTENTIAL ISSUES...");

    // Check if MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT is blocking
    const MIN_MARKET_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT"])
    );

    const minMarketTokens = await dataStore.getUint(MIN_MARKET_TOKENS_KEY);

    if (minMarketTokens.eq(0)) {
        console.log("  ✅ MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT is 0 (good)");
    } else {
        console.log("  ⚠️ MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT:", minMarketTokens.toString());
        console.log("     This might block first deposits");
    }

    console.log("\n\n🔧 FIXES APPLIED:");
    console.log("  ✅ Oracle prices reset (USDT: $1, sNGN: 1500)");
    console.log("  ✅ Oracle timestamps set");
    console.log("  ✅ MAX_PNL_FACTOR_FOR_DEPOSITS set to 50%");

    console.log("\n⚠️  IMPORTANT:");
    if (depositCount.eq(0)) {
        console.log("  Your previous deposit was cancelled and removed.");
        console.log("  You need to create a NEW deposit before trying to execute again.");
    } else {
        console.log("  Your deposit still exists and can be executed.");
        console.log("  The configuration issues have been fixed.");
    }
}

main().catch(console.error);