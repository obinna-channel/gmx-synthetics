const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Verifying Market Setup and Configuration ===");

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

    console.log("\n=== Checking Market Token Configuration ===");

    // Check INDEX_TOKEN
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"))]
        )
    );
    const storedIndexToken = await dataStore.getAddress(indexTokenKey);
    console.log("Expected INDEX_TOKEN (sNGN):", sNGN);
    console.log("Stored INDEX_TOKEN:", storedIndexToken);
    console.log("INDEX_TOKEN correctly set:", storedIndexToken.toLowerCase() === sNGN.toLowerCase());

    // Check LONG_TOKEN
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LONG_TOKEN"))]
        )
    );
    const storedLongToken = await dataStore.getAddress(longTokenKey);
    console.log("\nExpected LONG_TOKEN (USDT):", USDT);
    console.log("Stored LONG_TOKEN:", storedLongToken);
    console.log("LONG_TOKEN correctly set:", storedLongToken.toLowerCase() === USDT.toLowerCase());

    // Check SHORT_TOKEN
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SHORT_TOKEN"))]
        )
    );
    const storedShortToken = await dataStore.getAddress(shortTokenKey);
    console.log("\nExpected SHORT_TOKEN (USDT):", USDT);
    console.log("Stored SHORT_TOKEN:", storedShortToken);
    console.log("SHORT_TOKEN correctly set:", storedShortToken.toLowerCase() === USDT.toLowerCase());

    console.log("\n=== Checking Max PnL Factors ===");

    // Check Max PnL factor for longs
    const maxPnlFactorLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), false]
        )
    );
    const maxPnlFactorLong = await dataStore.getUint(maxPnlFactorLongKey);
    console.log("MAX_PNL_FACTOR (long):", maxPnlFactorLong.toString());
    console.log("MAX_PNL_FACTOR (long) as percentage:", maxPnlFactorLong.gt(0) ? ethers.utils.formatUnits(maxPnlFactorLong, 28) + "%" : "NOT SET");

    // Check Max PnL factor for shorts
    const maxPnlFactorShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), true]
        )
    );
    const maxPnlFactorShort = await dataStore.getUint(maxPnlFactorShortKey);
    console.log("\nMAX_PNL_FACTOR (short):", maxPnlFactorShort.toString());
    console.log("MAX_PNL_FACTOR (short) as percentage:", maxPnlFactorShort.gt(0) ? ethers.utils.formatUnits(maxPnlFactorShort, 28) + "%" : "NOT SET");

    console.log("\n=== Checking Oracle Prices ===");

    // Check if sNGN has a price set
    try {
        const sNgnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("sNGN oracle price:");
        console.log("  Min:", ethers.utils.formatUnits(sNgnPrice.min, 30), "USD");
        console.log("  Max:", ethers.utils.formatUnits(sNgnPrice.max, 30), "USD");
    } catch (error) {
        console.log("sNGN oracle price: NOT SET or error:", error.message);
    }

    // Check if USDT has a price set
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("\nUSDT oracle price:");
        console.log("  Min:", ethers.utils.formatUnits(usdtPrice.min, 30), "USD");
        console.log("  Max:", ethers.utils.formatUnits(usdtPrice.max, 30), "USD");
    } catch (error) {
        console.log("USDT oracle price: NOT SET or error:", error.message);
    }

    console.log("\n=== Configuration Issues ===");

    const issues = [];

    if (storedIndexToken === ethers.constants.AddressZero) {
        issues.push("❌ INDEX_TOKEN is not set (0x0000...)");
    } else if (storedIndexToken.toLowerCase() !== sNGN.toLowerCase()) {
        issues.push("❌ INDEX_TOKEN is set to wrong address");
    }

    if (storedLongToken === ethers.constants.AddressZero) {
        issues.push("❌ LONG_TOKEN is not set");
    }

    if (storedShortToken === ethers.constants.AddressZero) {
        issues.push("❌ SHORT_TOKEN is not set");
    }

    if (maxPnlFactorLong.eq(0)) {
        issues.push("❌ MAX_PNL_FACTOR for longs is not set");
    }

    if (maxPnlFactorShort.eq(0)) {
        issues.push("❌ MAX_PNL_FACTOR for shorts is not set");
    }

    if (issues.length === 0) {
        console.log("✅ All configurations look correct!");
    } else {
        console.log("Issues found:");
        issues.forEach(issue => console.log(issue));
        console.log("\nNeed to fix these issues before deposit can be executed.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });