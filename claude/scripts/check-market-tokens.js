const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Token Configuration ===\n");

    const ORIGINAL_MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D"; // Original sNGN market
    const NEW_MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // New USDT market
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Market keys
    const MARKET_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_TOKEN"])
    );
    const INDEX_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INDEX_TOKEN"])
    );
    const LONG_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LONG_TOKEN"])
    );
    const SHORT_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SHORT_TOKEN"])
    );

    console.log("📍 ORIGINAL sNGN Market:", ORIGINAL_MARKET);

    // Get market token - CORRECTED: market address comes FIRST
    const originalMarketTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [ORIGINAL_MARKET, MARKET_TOKEN]
        )
    );
    const originalMarketToken = await dataStore.getAddress(originalMarketTokenKey);
    console.log("  Market Token:", originalMarketToken);

    // Get index token
    const originalIndexTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [ORIGINAL_MARKET, INDEX_TOKEN]
        )
    );
    const originalIndexToken = await dataStore.getAddress(originalIndexTokenKey);
    console.log("  Index Token:", originalIndexToken);

    // Get long token
    const originalLongTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [ORIGINAL_MARKET, LONG_TOKEN]
        )
    );
    const originalLongToken = await dataStore.getAddress(originalLongTokenKey);
    console.log("  Long Token:", originalLongToken);

    // Get short token
    const originalShortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [ORIGINAL_MARKET, SHORT_TOKEN]
        )
    );
    const originalShortToken = await dataStore.getAddress(originalShortTokenKey);
    console.log("  Short Token:", originalShortToken);

    // Check token names
    console.log("\n  Token Details:");
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    if (originalIndexToken === USDT) console.log("    Index: USDT");
    else if (originalIndexToken === sNGN) console.log("    Index: sNGN");
    else console.log("    Index: Unknown -", originalIndexToken);

    if (originalLongToken === USDT) console.log("    Long: USDT");
    else if (originalLongToken === sNGN) console.log("    Long: sNGN");
    else console.log("    Long: Unknown -", originalLongToken);

    if (originalShortToken === USDT) console.log("    Short: USDT");
    else if (originalShortToken === sNGN) console.log("    Short: sNGN");
    else console.log("    Short: Unknown -", originalShortToken);

    console.log("\n📍 NEW USDT Market:", NEW_MARKET);

    // Get market token - CORRECTED: market address comes FIRST
    const newMarketTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [NEW_MARKET, MARKET_TOKEN]
        )
    );
    const newMarketToken = await dataStore.getAddress(newMarketTokenKey);
    console.log("  Market Token:", newMarketToken);

    // Get index token
    const newIndexTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [NEW_MARKET, INDEX_TOKEN]
        )
    );
    const newIndexToken = await dataStore.getAddress(newIndexTokenKey);
    console.log("  Index Token:", newIndexToken);

    // Get long token
    const newLongTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [NEW_MARKET, LONG_TOKEN]
        )
    );
    const newLongToken = await dataStore.getAddress(newLongTokenKey);
    console.log("  Long Token:", newLongToken);

    // Get short token
    const newShortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32"],
            [NEW_MARKET, SHORT_TOKEN]
        )
    );
    const newShortToken = await dataStore.getAddress(newShortTokenKey);
    console.log("  Short Token:", newShortToken);

    // Check token names for new market
    console.log("\n  Token Details:");
    if (newIndexToken === USDT) console.log("    Index: USDT");
    else if (newIndexToken === sNGN) console.log("    Index: sNGN");
    else console.log("    Index: Unknown -", newIndexToken);

    if (newLongToken === USDT) console.log("    Long: USDT");
    else if (newLongToken === sNGN) console.log("    Long: sNGN");
    else console.log("    Long: Unknown -", newLongToken);

    if (newShortToken === USDT) console.log("    Short: USDT");
    else if (newShortToken === sNGN) console.log("    Short: sNGN");
    else console.log("    Short: Unknown -", newShortToken);

    // Compare the two markets
    console.log("\n📊 Comparison:");
    console.log("  Original Market (sNGN):");
    console.log("    Market itself:", ORIGINAL_MARKET);
    console.log("    Market Token (GM):", originalMarketToken === ORIGINAL_MARKET ? "Same as market address" : "Different");

    console.log("\n  New Market (USDT):");
    console.log("    Market itself:", NEW_MARKET);
    console.log("    Market Token (GM):", newMarketToken === NEW_MARKET ? "Same as market address" : "Different");
}

main().catch(console.error);