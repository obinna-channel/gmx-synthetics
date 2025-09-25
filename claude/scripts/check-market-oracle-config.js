const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle Configuration for Markets ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ORACLE_STORE = "0x659A3D114f45b970FdeBD05d19Ef3c697b75963B";

    const NEW_MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // NEW USDT-indexed market
    const OLD_MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D"; // Original sNGN market

    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracleStore = await ethers.getContractAt("OracleStore", ORACLE_STORE);

    console.log("📍 Checking NEW USDT-indexed Market:", NEW_MARKET);
    console.log("   Index Token: USDT");
    console.log("   Long Token: USDT");
    console.log("   Short Token: sNGN\n");

    // Check oracle providers for tokens
    console.log("Oracle Providers for tokens:");

    // Check USDT providers using signers (since we don't have oracle providers)
    try {
        const usdtSignerCount = await oracleStore.getSignerCount(USDT);
        console.log("\n  USDT signers count:", usdtSignerCount.toString());
        if (usdtSignerCount.gt(0)) {
            for (let i = 0; i < usdtSignerCount.toNumber(); i++) {
                const signer = await oracleStore.getSignerAt(USDT, i);
                console.log(`    Signer ${i}:`, signer);
            }
        }
    } catch(e) {
        console.log("\n  USDT signers: Could not fetch (no signers configured)");
    }

    // Check sNGN providers using signers
    try {
        const sngnSignerCount = await oracleStore.getSignerCount(sNGN);
        console.log("\n  sNGN signers count:", sngnSignerCount.toString());
        if (sngnSignerCount.gt(0)) {
            for (let i = 0; i < sngnSignerCount.toNumber(); i++) {
                const signer = await oracleStore.getSignerAt(sNGN, i);
                console.log(`    Signer ${i}:`, signer);
            }
        }
    } catch(e) {
        console.log("\n  sNGN signers: Could not fetch (no signers configured)");
    }

    // Check MIN_ORACLE_SIGNERS
    const MIN_ORACLE_SIGNERS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS);
    console.log("\n📊 MIN_ORACLE_SIGNERS:", minSigners.toString());

    // Check if market is enabled
    console.log("\n📍 Market Status:");

    const IS_MARKET_DISABLED_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_MARKET_DISABLED"])
    );

    const newMarketDisabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_MARKET_DISABLED_KEY, NEW_MARKET]
        )
    );
    const isNewMarketDisabled = await dataStore.getBool(newMarketDisabledKey);
    console.log("  NEW market disabled:", isNewMarketDisabled ? "YES ❌" : "NO ✅");

    const oldMarketDisabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_MARKET_DISABLED_KEY, OLD_MARKET]
        )
    );
    const isOldMarketDisabled = await dataStore.getBool(oldMarketDisabledKey);
    console.log("  OLD market disabled:", isOldMarketDisabled ? "YES ❌" : "NO ✅");

    // Check if deposits are disabled
    const IS_DEPOSIT_DISABLED_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_DEPOSIT_DISABLED"])
    );

    const newMarketDepositDisabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_DEPOSIT_DISABLED_KEY, NEW_MARKET]
        )
    );
    const isNewDepositDisabled = await dataStore.getBool(newMarketDepositDisabledKey);
    console.log("\n  NEW market deposits disabled:", isNewDepositDisabled ? "YES ❌" : "NO ✅");

    // Check oracle type for markets
    const ORACLE_TYPE_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_TYPE"])
    );

    const newMarketOracleTypeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ORACLE_TYPE_KEY, NEW_MARKET]
        )
    );
    const newMarketOracleType = await dataStore.getBytes32(newMarketOracleTypeKey);
    console.log("\n  NEW market oracle type:", newMarketOracleType);

    // Check if prices are set in primary prices
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    console.log("\n📍 Current Oracle Primary Prices:");

    const usdtPrice = await oracle.primaryPrices(USDT);
    console.log("  USDT price min:", usdtPrice.min.toString());
    console.log("  USDT price max:", usdtPrice.max.toString());

    const sngnPrice = await oracle.primaryPrices(sNGN);
    console.log("  sNGN price min:", sngnPrice.min.toString());
    console.log("  sNGN price max:", sngnPrice.max.toString());

    console.log("\n💡 Analysis:");
    console.log("Since MIN_ORACLE_SIGNERS = 0, we can use setPrimaryPrice directly");
    console.log("No oracle signers/providers are required when MIN_ORACLE_SIGNERS = 0");

    if (isNewMarketDisabled || isNewDepositDisabled) {
        console.log("❌ Market or deposits are disabled!");
    }
}

main().catch(console.error);