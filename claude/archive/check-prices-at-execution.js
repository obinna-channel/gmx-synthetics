const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Prices at Execution Time ===\n");

    // Contract addresses
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Get market configuration
    console.log("📊 Market Configuration:");
    const market = await reader.getMarket(DATA_STORE, MARKET);
    console.log("  Index Token:", market.indexToken);
    console.log("  Long Token:", market.longToken);
    console.log("  Short Token:", market.shortToken);

    console.log("\n🔍 Checking Oracle Prices:");

    // Check current prices
    console.log("\n1. Current Primary Prices:");

    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT Price:");
        console.log("    Min:", ethers.utils.formatUnits(usdtPrice.min, 30));
        console.log("    Max:", ethers.utils.formatUnits(usdtPrice.max, 30));
    } catch (e) {
        console.log("  USDT: ❌ No price (EmptyPrimaryPrice)");
    }

    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN Price:");
        console.log("    Min:", ethers.utils.formatUnits(ngnPrice.min, 30));
        console.log("    Max:", ethers.utils.formatUnits(ngnPrice.max, 30));
    } catch (e) {
        console.log("  sNGN: ❌ No price (EmptyPrimaryPrice)");
    }

    // Check tokens with prices
    console.log("\n2. Tokens with prices in Oracle:");
    const tokensCount = await oracle.getTokensWithPricesCount();
    console.log("  Total tokens with prices:", tokensCount.toString());

    if (tokensCount.gt(0)) {
        const tokensWithPrices = await oracle.getTokensWithPrices(0, tokensCount);
        for (const token of tokensWithPrices) {
            console.log("  -", token);
            if (token.toLowerCase() === USDT.toLowerCase()) {
                console.log("    (USDT)");
            }
            if (token.toLowerCase() === sNGN.toLowerCase()) {
                console.log("    (sNGN)");
            }
        }
    }

    console.log("\n3. Oracle Timestamps:");
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    console.log("  Min Timestamp:", minTs.toString());
    console.log("  Max Timestamp:", maxTs.toString());

    console.log("\n\n💡 DIAGNOSIS:");
    console.log("\nThe deposit execution needs prices for:");
    console.log("  1. Index Token (sNGN): Used for market valuation");
    console.log("  2. Long Token (USDT): Used for deposit amount calculation");
    console.log("  3. Short Token (USDT): Same as long token in this market");

    console.log("\n❌ LIKELY FAILURE REASON:");
    console.log("  The oracle.clearAllPrices() call in execute-deposit-now.js cleared ALL prices");
    console.log("  Then we only set timestamps, but didn't re-set the token prices");
    console.log("  When ExecuteDepositUtils tried to get market prices, it failed with EmptyPrimaryPrice");
    console.log("  This triggered the error handler which cancelled the deposit and refunded USDT");

    console.log("\n✅ SOLUTION:");
    console.log("  1. Set both USDT and sNGN prices using setPrimaryPrice");
    console.log("  2. Set appropriate oracle timestamps");
    console.log("  3. Create a NEW deposit (the old one is cancelled)");
    console.log("  4. Execute the new deposit without clearing prices");
}

main().catch(console.error);