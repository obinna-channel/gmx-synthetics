const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Token Decimals On-Chain ===\n");

    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    // Get token contracts
    const usdt = await ethers.getContractAt("IERC20Metadata", USDT);
    const sngn = await ethers.getContractAt("IERC20Metadata", sNGN);

    // Get decimals
    const usdtDecimals = await usdt.decimals();
    const sngnDecimals = await sngn.decimals();

    console.log("📊 Token Decimals:");
    console.log("  USDT decimals:", usdtDecimals);
    console.log("  sNGN decimals:", sngnDecimals);

    // Get additional info
    const usdtName = await usdt.name();
    const usdtSymbol = await usdt.symbol();
    const sngnName = await sngn.name();
    const sngnSymbol = await sngn.symbol();

    console.log("\n📝 Token Info:");
    console.log("  USDT:");
    console.log("    Name:", usdtName);
    console.log("    Symbol:", usdtSymbol);
    console.log("    Decimals:", usdtDecimals);
    console.log("    Address:", USDT);

    console.log("\n  sNGN:");
    console.log("    Name:", sngnName);
    console.log("    Symbol:", sngnSymbol);
    console.log("    Decimals:", sngnDecimals);
    console.log("    Address:", sNGN);

    // Show how prices should be calculated
    console.log("\n💡 Price Calculation Guide:");
    console.log("  GMX uses 30 decimals of precision for all prices");
    console.log("  Price formula: price_with_30_decimals = actual_price * 10^(30 - token_decimals)");

    console.log("\n  For USDT (", usdtDecimals, "decimals):");
    console.log("    $1 USDT = 1 * 10^(30 -", usdtDecimals, ") = 10^", (30 - usdtDecimals));
    console.log("    Value:", ethers.BigNumber.from(10).pow(30 - usdtDecimals).toString());

    console.log("\n  For sNGN (", sngnDecimals, "decimals):");
    console.log("    $1/1500 sNGN = (10^(30 -", sngnDecimals, ")) / 1500");
    console.log("    = 10^", (30 - sngnDecimals), "/ 1500");
    const sngnPriceCalculated = ethers.BigNumber.from(10).pow(30 - sngnDecimals).div(1500);
    console.log("    Value:", sngnPriceCalculated.toString());

    // Check what was used in the script
    console.log("\n🔍 Comparing with script values:");
    console.log("  Script USDT price: 10^(30 - 6) = 10^24 =", ethers.BigNumber.from(10).pow(24).toString());
    console.log("  Script sNGN price: 10^(30 - 18) / 1500 = 10^12 / 1500 =", ethers.BigNumber.from(10).pow(12).div(1500).toString());

    console.log("\n✅ Verification:");
    if (usdtDecimals === 6) {
        console.log("  USDT decimals match expected (6) ✓");
    } else {
        console.log("  ⚠️ USDT decimals DON'T match! Expected 6, got", usdtDecimals);
    }

    if (sngnDecimals === 18) {
        console.log("  sNGN decimals match expected (18) ✓");
    } else {
        console.log("  ⚠️ sNGN decimals DON'T match! Expected 18, got", sngnDecimals);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });