const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Debugging Pool Value Calculation ===");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("\n=== You're Right - Price Shouldn't Matter ===");
    console.log("The system should work with ANY index token price.");
    console.log("Let's find what's actually causing the negative pool value.");

    // Check what tokens the market expects
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"))]
        )
    );
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LONG_TOKEN"))]
        )
    );
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SHORT_TOKEN"))]
        )
    );

    const indexToken = await dataStore.getAddress(indexTokenKey);
    const longToken = await dataStore.getAddress(longTokenKey);
    const shortToken = await dataStore.getAddress(shortTokenKey);

    console.log("\n=== Market Token Configuration ===");
    console.log("INDEX_TOKEN:", indexToken);
    console.log("LONG_TOKEN:", longToken);
    console.log("SHORT_TOKEN:", shortToken);

    // Check pool amounts for BOTH long and short tokens
    console.log("\n=== Pool Amounts (Key to Pool Value) ===");

    const poolAmountLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, longToken, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmountLong = await dataStore.getUint(poolAmountLongKey);
    console.log("Long token pool amount:", poolAmountLong.toString());

    const poolAmountShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, shortToken, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmountShort = await dataStore.getUint(poolAmountShortKey);
    console.log("Short token pool amount:", poolAmountShort.toString());

    // Since long and short are both USDT, these should be the same key
    console.log("\nNote: Since both long and short tokens are USDT, they share the same pool");

    // Check borrowing fees
    console.log("\n=== Borrowing Fees (Added to Pool Value) ===");

    const borrowingFeeLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32", "bool"],
            [MARKET, longToken, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TOTAL_BORROWING")), true]
        )
    );
    const borrowingFeeLong = await dataStore.getUint(borrowingFeeLongKey);
    console.log("Long borrowing fees:", borrowingFeeLong.toString());

    const borrowingFeeShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32", "bool"],
            [MARKET, shortToken, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TOTAL_BORROWING")), false]
        )
    );
    const borrowingFeeShort = await dataStore.getUint(borrowingFeeShortKey);
    console.log("Short borrowing fees:", borrowingFeeShort.toString());

    // Check open interest (for PnL calculation)
    console.log("\n=== Open Interest (For PnL Calculation) ===");

    const openInterestLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bool", "bytes32"],
            [MARKET, longToken, true, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPEN_INTEREST"))]
        )
    );
    const openInterestLong = await dataStore.getUint(openInterestLongKey);
    console.log("Long open interest:", openInterestLong.toString());

    const openInterestShortKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bool", "bytes32"],
            [MARKET, shortToken, false, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPEN_INTEREST"))]
        )
    );
    const openInterestShort = await dataStore.getUint(openInterestShortKey);
    console.log("Short open interest:", openInterestShort.toString());

    // Check market token supply
    console.log("\n=== Market Token Supply ===");
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const totalSupply = await marketToken.totalSupply();
    console.log("Market token total supply:", totalSupply.toString());

    console.log("\n=== Pool Value Calculation Should Be ===");
    console.log("Pool Value = ");
    console.log("  + Long token amount × Long token price");
    console.log("  + Short token amount × Short token price");
    console.log("  + Total borrowing fees");
    console.log("  - Net PnL (long PnL + short PnL)");
    console.log("  - Position impact pool × Index token price");
    console.log("  + Lent impact pool × Index token price");

    console.log("\n=== For First Deposit ===");
    console.log("With no positions and empty pool:");
    console.log("- Open interest = 0 → PnL = 0");
    console.log("- Borrowing fees = 0");
    console.log("- Impact pools should be 0");
    console.log("- Pool amount = amount we're trying to deposit");
    console.log("\nBut the calculation happens BEFORE the deposit is added!");
    console.log("So pool value = 0 at calculation time");

    console.log("\n=== The Real Problem ===");
    console.log("The deposit execution calculates pool value BEFORE adding the deposit funds.");
    console.log("For first deposit: pool value = 0");
    console.log("GMX checks: if (poolValue < 0) revert");
    console.log("Also checks: if (poolValue == 0 && marketTokenSupply > 0) revert");
    console.log("\nSince both are 0, it should pass these checks.");
    console.log("The error might be coming from a different validation!");

    // Let's check if there's a minimum deposit requirement
    const minMarketTokensKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT")), MARKET]
        )
    );
    const minMarketTokens = await dataStore.getUint(minMarketTokensKey);
    console.log("\n=== Minimum First Deposit Requirement ===");
    console.log("MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT:", minMarketTokens.toString());

    if (minMarketTokens.gt(0)) {
        console.log("⚠️  There's a minimum first deposit requirement!");
        console.log("This might be blocking the deposit.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });