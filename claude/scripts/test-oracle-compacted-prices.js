const { ethers } = require("hardhat");

// helpers
const BN = (x) => ethers.BigNumber.from(x);
const pack = (vals, bits) => vals.reduce((acc, v) => acc.shl(bits).or(BN(v)), BN(0));
const chunk = (arr, n) => arr.length ? [arr.slice(0,n), ...chunk(arr.slice(n), n)] : [];

/**
 * Compute (price32, decimalMultiplier) so price32 * 10^decimalMultiplier = price30.
 * price30 is "USD price per base unit" with 30 decimals.
 */
function encodePrice30({ usdPrice, tokenDecimals, desiredPrecision }) {
  // decimalMultiplier = 30 - tokenDecimals - desiredPrecision
  const decimalMultiplier = 30 - tokenDecimals - desiredPrecision; // uint8
  if (decimalMultiplier < 0) throw new Error("desiredPrecision too large");

  // price30 = usdPrice * 10^30 / 10^tokenDecimals
  let price30;
  if (usdPrice.type === "ONE") {
    price30 = BN(10).pow(30 - tokenDecimals);
  } else if (usdPrice.type === "FRAC") {
    // numerator / denominator
    price30 = BN(10).pow(30 - tokenDecimals).mul(usdPrice.num).div(usdPrice.den);
  } else {
    throw new Error("Supply ONE or FRAC for usdPrice");
  }

  // price32 = floor(price30 / 10^decimalMultiplier)
  const price32 = price30.div(BN(10).pow(decimalMultiplier));
  if (price32.gte(BN(2).pow(32))) {
    throw new Error("price32 does not fit uint32; increase decimalMultiplier by lowering desiredPrecision");
  }

  return {
    price32: price32.toNumber(),  // uint32
    decimalMultiplier              // uint8
  };
}

async function buildOracleParams({
  provider,
  tokens, // [{addr, tokenDecimals, usdPrice:{type:"ONE"}|{type:"FRAC",num,den}, desiredPrecision}]
  blockWindow = { ahead: 0, span: 3 }, // [minBlock = now+ahead, maxBlock = minBlock+span]
  timestampWindowSec = 60,              // minTs = now, maxTs = now + timestampWindowSec
  signerInfo = 0,                       // 0 signers in demo mode
  signatures = [],                      // []
  priceFeedTokens = []                  // []
}) {
  const latest = await provider.getBlock("latest");
  const minBlk = latest.number + blockWindow.ahead;
  const maxBlk = minBlk + blockWindow.span;

  const minTs = latest.timestamp;
  const maxTs = latest.timestamp + timestampWindowSec;

  const N = tokens.length;

  // ---- pack 64-bit things (4 per word) ----
  const minBlocks64 = chunk(Array.from({length:N}, () => minBlk), 4).map(g => pack(g, 64));
  const maxBlocks64 = chunk(Array.from({length:N}, () => maxBlk), 4).map(g => pack(g, 64));
  const ts64        = chunk(Array.from({length:N}, (_,i)=> i===N-1?maxTs:minTs), 4).map(g => pack(g, 64));

  // ---- pack 8-bit decimals (32 per word) ----
  const decBytes = tokens.map(t => {
    const { decimalMultiplier } = encodePrice30(t);
    return decimalMultiplier; // uint8
  });
  const decimals8 = chunk(decBytes, 32).map(g => pack(g, 8));

  // ---- pack 32-bit prices (8 per word) ----
  const minPriceRows = [];
  const maxPriceRows = [];
  {
    const p32s = tokens.map(t => encodePrice30(t).price32);
    const minWords = chunk(p32s, 8).map(g => pack(g, 32));
    const maxWords = chunk(p32s, 8).map(g => pack(g, 32));
    minPriceRows.push(...minWords);
    maxPriceRows.push(...maxWords);
  }

  // ---- price index bytes (8-bit indexes selecting a price in each 32-bit table) ----
  const idxBytes = Array.from({length:N}, () => 0);
  const minIdx8  = chunk(idxBytes, 32).map(g => pack(g, 8));
  const maxIdx8  = chunk(idxBytes, 32).map(g => pack(g, 8));

  return {
    signerInfo,                                    // uint256
    tokens: tokens.map(t => t.addr),              // address[]
    compactedMinOracleBlockNumbers: minBlocks64,  // uint256[]
    compactedMaxOracleBlockNumbers: maxBlocks64,  // uint256[]
    compactedOracleTimestamps: ts64,              // uint256[]
    compactedDecimals: decimals8,                 // uint256[]
    compactedMinPrices: minPriceRows,             // uint256[]
    compactedMinPricesIndexes: minIdx8,           // uint256[]
    compactedMaxPrices: maxPriceRows,             // uint256[]
    compactedMaxPricesIndexes: maxIdx8,           // uint256[]
    signatures,                                    // bytes[]
    priceFeedTokens                               // address[]
  };
}

async function main() {
    console.log("=== Testing Oracle Compacted Price Format ===\n");

    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("📊 Building oracle params with compacted format...\n");

    // Build the oracle params
    const oracleParams = await buildOracleParams({
        provider: ethers.provider,
        tokens: [
            // USDT @ $1.00, 6 decimals
            {
                addr: USDT,
                tokenDecimals: 6,
                usdPrice: { type: "ONE" },
                desiredPrecision: 6  // -> decimalMultiplier = 30-6-6 = 18, price32 = 1_000_000
            },
            // sNGN @ $1/1500, 18 decimals
            {
                addr: sNGN,
                tokenDecimals: 18,
                usdPrice: { type: "FRAC", num: 1, den: 1500 },
                desiredPrecision: 12  // -> decimalMultiplier = 30-18-12 = 0, price32 ≈ 666_666_666
            }
        ],
        blockWindow: { ahead: 0, span: 3 },
        timestampWindowSec: 60
    });

    console.log("📋 Oracle Params Structure:");
    console.log("  signerInfo:", oracleParams.signerInfo);
    console.log("  tokens:", oracleParams.tokens);
    console.log("  compactedMinOracleBlockNumbers:", oracleParams.compactedMinOracleBlockNumbers.map(bn => bn.toString()));
    console.log("  compactedMaxOracleBlockNumbers:", oracleParams.compactedMaxOracleBlockNumbers.map(bn => bn.toString()));
    console.log("  compactedOracleTimestamps:", oracleParams.compactedOracleTimestamps.map(bn => bn.toString()));
    console.log("  compactedDecimals:", oracleParams.compactedDecimals.map(bn => bn.toString()));
    console.log("  compactedMinPrices:", oracleParams.compactedMinPrices.map(bn => bn.toString()));
    console.log("  compactedMinPricesIndexes:", oracleParams.compactedMinPricesIndexes.map(bn => bn.toString()));
    console.log("  compactedMaxPrices:", oracleParams.compactedMaxPrices.map(bn => bn.toString()));
    console.log("  compactedMaxPricesIndexes:", oracleParams.compactedMaxPricesIndexes.map(bn => bn.toString()));
    console.log("  signatures:", oracleParams.signatures);
    console.log("  priceFeedTokens:", oracleParams.priceFeedTokens);

    console.log("\n💡 Price Encoding Details:");

    // USDT details
    const usdtEncoded = encodePrice30({
        usdPrice: { type: "ONE" },
        tokenDecimals: 6,
        desiredPrecision: 6
    });
    console.log("\n  USDT:");
    console.log("    price30 (full precision):", BN(10).pow(24).toString()); // 10^(30-6) = 10^24
    console.log("    price32 (compacted):", usdtEncoded.price32);
    console.log("    decimalMultiplier:", usdtEncoded.decimalMultiplier);
    console.log("    Reconstructed: price32 * 10^decimalMultiplier =",
                BN(usdtEncoded.price32).mul(BN(10).pow(usdtEncoded.decimalMultiplier)).toString());

    // sNGN details
    const sngnEncoded = encodePrice30({
        usdPrice: { type: "FRAC", num: 1, den: 1500 },
        tokenDecimals: 18,
        desiredPrecision: 12
    });
    console.log("\n  sNGN:");
    console.log("    price30 (full precision):", BN(10).pow(12).div(1500).toString()); // 10^(30-18) / 1500
    console.log("    price32 (compacted):", sngnEncoded.price32);
    console.log("    decimalMultiplier:", sngnEncoded.decimalMultiplier);
    console.log("    Reconstructed: price32 * 10^decimalMultiplier =",
                BN(sngnEncoded.price32).mul(BN(10).pow(sngnEncoded.decimalMultiplier)).toString());

    console.log("\n🔍 Testing oracle.setPrices() with compacted format...");

    try {
        // Clear existing prices first
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("  ✅ Cleared existing prices");

        // Try to set prices using the compacted format
        // The Oracle.setPrices function expects these exact parameters
        const setPricesTx = await oracle.setPrices(
            oracleParams.tokens,
            oracleParams.signerInfo,
            oracleParams.compactedMinOracleBlockNumbers,
            oracleParams.compactedMaxOracleBlockNumbers,
            oracleParams.compactedOracleTimestamps,
            oracleParams.compactedDecimals,
            oracleParams.compactedMinPrices,
            oracleParams.compactedMinPricesIndexes,
            oracleParams.compactedMaxPrices,
            oracleParams.compactedMaxPricesIndexes,
            oracleParams.signatures,
            oracleParams.priceFeedTokens
        );

        console.log("  📤 Transaction sent:", setPricesTx.hash);
        console.log("  ⏳ Waiting for confirmation...");
        const receipt = await setPricesTx.wait();

        console.log("  ✅ Prices set successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Try to read back the prices
        console.log("\n📖 Reading back prices from Oracle...");

        try {
            const usdtPrice = await oracle.primaryPrices(USDT);
            console.log("  USDT primary price:");
            console.log("    min:", usdtPrice.min.toString());
            console.log("    max:", usdtPrice.max.toString());
        } catch (e) {
            console.log("  Could not read USDT price:", e.message);
        }

        try {
            const sngnPrice = await oracle.primaryPrices(sNGN);
            console.log("  sNGN primary price:");
            console.log("    min:", sngnPrice.min.toString());
            console.log("    max:", sngnPrice.max.toString());
        } catch (e) {
            console.log("  Could not read sNGN price:", e.message);
        }

    } catch (error) {
        console.log("\n❌ Error setting prices:", error.message);
        if (error.data) {
            console.log("  Error data:", error.data);

            // Try to decode common Oracle errors
            const errorSigs = {
                "0x5fb7d0dd": "EmptyPrimaryPrice",
                "0xbfcb0325": "MaxRefPriceDeviationExceeded",
                "0x3257a639": "InvalidSignature",
                "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired",
                "0xa35b150b": "Unauthorized"
            };

            const sig = error.data.slice(0, 10);
            if (errorSigs[sig]) {
                console.log("  Decoded error:", errorSigs[sig]);
            }
        }
    }

    console.log("\n✅ Test complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });