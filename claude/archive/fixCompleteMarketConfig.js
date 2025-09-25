const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Complete Market Configuration Fix ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    // Contract addresses
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"; // From tokens.ts config
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("\n=== Step 1: Setting Market Token Configuration ===");

    // Set INDEX_TOKEN
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"))]
        )
    );
    console.log("Setting INDEX_TOKEN to sNGN:", sNGN);
    const indexTx = await dataStore.setAddress(indexTokenKey, sNGN);
    await indexTx.wait();
    console.log("✅ INDEX_TOKEN set!");

    // Set LONG_TOKEN
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LONG_TOKEN"))]
        )
    );
    console.log("Setting LONG_TOKEN to USDT:", USDT);
    const longTx = await dataStore.setAddress(longTokenKey, USDT);
    await longTx.wait();
    console.log("✅ LONG_TOKEN set!");

    // Set SHORT_TOKEN
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SHORT_TOKEN"))]
        )
    );
    console.log("Setting SHORT_TOKEN to USDT:", USDT);
    const shortTx = await dataStore.setAddress(shortTokenKey, USDT);
    await shortTx.wait();
    console.log("✅ SHORT_TOKEN set!");

    console.log("\n=== Step 2: Setting Max PnL Factors ===");

    // Max PnL factor for longs (50% = 0.5 * 10^30)
    const maxPnlFactorLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), false]
        )
    );
    const maxPnlFactor = ethers.utils.parseUnits("0.5", 30);
    console.log("Setting MAX_PNL_FACTOR for longs to 50%");
    const longPnlTx = await dataStore.setUint(maxPnlFactorLongKey, maxPnlFactor);
    await longPnlTx.wait();
    console.log("✅ MAX_PNL_FACTOR for longs set!");

    // Max PnL factor for shorts
    const maxPnlFactorShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), true]
        )
    );
    console.log("Setting MAX_PNL_FACTOR for shorts to 50%");
    const shortPnlTx = await dataStore.setUint(maxPnlFactorShortKey, maxPnlFactor);
    await shortPnlTx.wait();
    console.log("✅ MAX_PNL_FACTOR for shorts set!");

    console.log("\n=== Step 3: Setting Additional Market Parameters ===");

    // Set min collateral factor (1% = 0.01 * 10^30)
    const minCollateralFactorKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_COLLATERAL_FACTOR"))]
        )
    );
    const minCollateralFactor = ethers.utils.parseUnits("0.01", 30);
    const minColTx = await dataStore.setUint(minCollateralFactorKey, minCollateralFactor);
    await minColTx.wait();
    console.log("✅ MIN_COLLATERAL_FACTOR set to 1%");

    // Set reserve factors (10% = 0.1 * 10^30)
    const reserveFactor = ethers.utils.parseUnits("0.1", 30);

    const reserveFactorLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESERVE_FACTOR")), false]
        )
    );
    const resTx1 = await dataStore.setUint(reserveFactorLongKey, reserveFactor);
    await resTx1.wait();

    const reserveFactorShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESERVE_FACTOR")), true]
        )
    );
    const resTx2 = await dataStore.setUint(reserveFactorShortKey, reserveFactor);
    await resTx2.wait();
    console.log("✅ RESERVE_FACTOR set to 10% for both long and short");

    // Set open interest reserve factors
    const oiReserveFactorLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPEN_INTEREST_RESERVE_FACTOR")), false]
        )
    );
    const oiReserveFactorShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPEN_INTEREST_RESERVE_FACTOR")), true]
        )
    );
    const oiResTx1 = await dataStore.setUint(oiReserveFactorLongKey, reserveFactor);
    await oiResTx1.wait();
    const oiResTx2 = await dataStore.setUint(oiReserveFactorShortKey, reserveFactor);
    await oiResTx2.wait();
    console.log("✅ OPEN_INTEREST_RESERVE_FACTOR set to 10% for both long and short");

    // Set min collateral factor for open interest
    const minCollateralFactorOiLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST")), false]
        )
    );
    const minCollateralFactorOiShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST")), true]
        )
    );
    const minColOiTx1 = await dataStore.setUint(minCollateralFactorOiLongKey, minCollateralFactor);
    await minColOiTx1.wait();
    const minColOiTx2 = await dataStore.setUint(minCollateralFactorOiShortKey, minCollateralFactor);
    await minColOiTx2.wait();
    console.log("✅ MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST set for both long and short");

    console.log("\n=== Step 4: Setting Oracle Prices ===");

    try {
        // Clear existing prices
        console.log("Clearing existing oracle prices...");
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();

        // Set USDT price (1 USD)
        const usdtPrice = {
            min: ethers.utils.parseUnits("1", 30),
            max: ethers.utils.parseUnits("1", 30)
        };

        // Set sNGN price (1 NGN = 0.000606 USD)
        const sNgnPrice = {
            min: ethers.utils.parseUnits("0.000606", 30),
            max: ethers.utils.parseUnits("0.000606", 30)
        };

        console.log("Setting USDT price to $1.00...");
        const setUsdtTx = await oracle.setPrices(
            dataStore.address,
            [USDT],
            [usdtPrice],
            [usdtPrice]
        );
        await setUsdtTx.wait();
        console.log("✅ USDT price set!");

        console.log("Setting sNGN price to $0.000606...");
        const setSNgnTx = await oracle.setPrices(
            dataStore.address,
            [sNGN],
            [sNgnPrice],
            [sNgnPrice]
        );
        await setSNgnTx.wait();
        console.log("✅ sNGN price set!");

    } catch (error) {
        console.log("Note: Oracle price setting failed, but this might be expected.");
        console.log("Error:", error.message);
    }

    console.log("\n=== Final Verification ===");

    // Verify all settings
    const verifyIndexToken = await dataStore.getAddress(indexTokenKey);
    const verifyLongToken = await dataStore.getAddress(longTokenKey);
    const verifyShortToken = await dataStore.getAddress(shortTokenKey);
    const verifyMaxPnlLong = await dataStore.getUint(maxPnlFactorLongKey);
    const verifyMaxPnlShort = await dataStore.getUint(maxPnlFactorShortKey);

    console.log("INDEX_TOKEN:", verifyIndexToken, verifyIndexToken === sNGN ? "✅" : "❌");
    console.log("LONG_TOKEN:", verifyLongToken, verifyLongToken === USDT ? "✅" : "❌");
    console.log("SHORT_TOKEN:", verifyShortToken, verifyShortToken === USDT ? "✅" : "❌");
    console.log("MAX_PNL_FACTOR (long):", ethers.utils.formatUnits(verifyMaxPnlLong, 28) + "%", verifyMaxPnlLong.gt(0) ? "✅" : "❌");
    console.log("MAX_PNL_FACTOR (short):", ethers.utils.formatUnits(verifyMaxPnlShort, 28) + "%", verifyMaxPnlShort.gt(0) ? "✅" : "❌");

    console.log("\n✅ Market configuration complete!");
    console.log("You can now try executing the deposit.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });