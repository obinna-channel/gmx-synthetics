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
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit with Compacted Oracle Format ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // USDT market

    // Read deposit key from file
    const fs = require("fs");
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-deposit-key-new-market.txt", "utf8").trim();
        console.log("Deposit Key:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key from latest-deposit-key-new-market.txt");
        console.log("   Please run create-deposit-new-market.js first");
        return;
    }

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Step 1: Verify deposit exists
    console.log("\n📍 Step 1: Verifying deposit exists...");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);

    if (!isInList) {
        console.log("❌ Deposit not found!");
        console.log("   Please run create-deposit-new-market.js first");
        return;
    }
    console.log("✅ Deposit found");

    // Step 2: Build oracle params with compacted format
    console.log("\n📍 Step 2: Building compacted oracle parameters...");

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

    console.log("\n📋 Oracle Params Structure:");
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

    // Step 3: Check market token supply
    console.log("\n📍 Step 3: Checking market token supply...");
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    const currentSupply = await marketToken.totalSupply();
    console.log("  Current market token supply:", ethers.utils.formatEther(currentSupply));

    if (currentSupply.eq(0)) {
        console.log("  ✅ This is the first deposit");
    }

    // Step 4: Simulate execution
    console.log("\n📍 Step 4: Simulating execution...");

    // Convert compacted params to SetPricesParams format for executeDeposit
    const setPricesParams = {
        tokens: oracleParams.tokens,
        providers: [],  // Empty for signerless mode
        data: []        // Empty for signerless mode
    };

    try {
        let estimatedGas;
        try {
            estimatedGas = await depositHandler.estimateGas.executeDeposit(
                depositKey,
                setPricesParams
            );
            console.log("  ✅ Simulation passed!");
            console.log("  Estimated gas:", estimatedGas.toString());
        } catch (simError) {
            // Check if it's EndOfOracleSimulation (expected) or another error
            if (simError.error && simError.error.data) {
                const errorSig = simError.error.data.slice(0, 10);
                if (errorSig === "0xdd51dc73") {
                    console.log("  ✅ Oracle simulation successful (EndOfOracleSimulation)");
                    estimatedGas = ethers.BigNumber.from("5000000");
                } else {
                    console.log("  ❌ Simulation failed:", simError.error.data);

                    // Decode common errors
                    const errors = {
                        "0x01af8c24": "EmptyDepositAmounts",
                        "0x6c3e27f2": "MinMarketTokens",
                        "0xfe99dc66": "EmptyDepositAmountsAfterSwap",
                        "0xb2ddc979": "InsufficientPoolValue",
                        "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired",
                        "0x5fb7d0dd": "EmptyPrimaryPrice",
                        "0xbfcb0325": "MaxRefPriceDeviationExceeded",
                        "0x3257a639": "InvalidSignature",
                        "0xa35b150b": "Unauthorized"
                    };

                    if (errors[errorSig]) {
                        console.log("  Error:", errors[errorSig]);
                    }
                    return;
                }
            } else {
                throw simError;
            }
        }

        // Step 5: Execute for real
        console.log("\n🚀 Step 5: Executing deposit transaction...");

        const tx = await depositHandler.executeDeposit(depositKey, setPricesParams, {
            gasLimit: estimatedGas.mul(120).div(100) // Add 20% buffer
        });

        console.log("  TX sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n  Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");
        console.log("  Gas used:", receipt.gasUsed.toString());

        if (receipt.status) {
            // Check if market tokens were minted
            const totalSupplyAfter = await marketToken.totalSupply();
            const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

            console.log("\n🎯 Market Token Status:");
            console.log("  Total Supply:", ethers.utils.formatEther(totalSupplyAfter));
            console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));

            if (totalSupplyAfter.gt(0)) {
                console.log("\n🎉 SUCCESS! First liquidity added to the USDT-indexed market!");
                console.log("The market is now live with ~$2000 in liquidity!");
            } else {
                console.log("\n⚠️  Transaction succeeded but no tokens minted");
                console.log("Deposit may have been cancelled internally");
            }
        }

        console.log("\nView on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("❌ Execution failed:", error.message);

        if (error.error && error.error.data) {
            console.log("\nError data:", error.error.data);

            // Decode common error signatures
            const errorSig = error.error.data.slice(0, 10);
            const errors = {
                "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired",
                "0x5fb7d0dd": "EmptyPrimaryPrice",
                "0xded099de": "EmptyPrimaryPrice",
                "0xa35b150b": "Unauthorized",
                "0x01af8c24": "EmptyDepositAmounts",
                "0x6c3e27f2": "MinMarketTokens",
                "0xbfcb0325": "MaxRefPriceDeviationExceeded",
                "0x3257a639": "InvalidSignature"
            };

            if (errors[errorSig]) {
                console.log("Decoded error:", errors[errorSig]);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });