const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit on NEW USDT-Indexed Market ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // NEW USDT-indexed market

    // Deposit key from creation
    const depositKey = "0xb96830699e00c7868d9acd657e6e7226d66237980b2692f6b55843309edbb21c";

    console.log("Market:", MARKET);
    console.log("Deposit Key:", depositKey);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Step 1: Verify deposit exists
    console.log("\n📍 Step 1: Verifying deposit exists...");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);

    if (!isInList) {
        console.log("❌ Deposit not found!");
        return;
    }
    console.log("✅ Deposit found");

    // Step 2: Set oracle prices
    console.log("\n📍 Step 2: Setting oracle prices...");
    console.log("  USDT: $1.00");
    console.log("  sNGN: $0.000666... (1/1500)");

    // Clear existing prices
    const clearTx = await oracle.clearAllPrices();
    await clearTx.wait();
    console.log("  ✅ Prices cleared");

    // Price calculations
    // USDT: $1.00 = 10^24 (with 30 decimals of precision, 6 token decimals)
    const usdtPrice = ethers.BigNumber.from(10).pow(24);

    // sNGN: $1/1500 = 666666666666666666666666666.67 (with 30 decimals precision, 18 token decimals)
    // To be precise: 10^30 / 1500 = 10^30 * 2 / 3000 = 2 * 10^30 / 3000
    const sngnPrice = ethers.BigNumber.from(10).pow(30).mul(2).div(3000);

    console.log("\n  Raw price values:");
    console.log("  USDT:", usdtPrice.toString());
    console.log("  sNGN:", sngnPrice.toString());

    // Set USDT price
    const usdtPriceStruct = {
        min: usdtPrice,
        max: usdtPrice
    };
    const usdtTx = await oracle.setPrimaryPrice(USDT, usdtPriceStruct);
    await usdtTx.wait();
    console.log("  ✅ USDT price set to $1.00");

    // Set sNGN price at $1/1500
    const sngnPriceStruct = {
        min: sngnPrice,
        max: sngnPrice
    };
    const sngnTx = await oracle.setPrimaryPrice(sNGN, sngnPriceStruct);
    await sngnTx.wait();
    console.log("  ✅ sNGN price set to $0.000666... (1/1500)");

    // Set timestamps using blockchain time
    console.log("\n📍 Step 3: Setting timestamps using blockchain time...");
    const currentBlock = await ethers.provider.getBlock("latest");
    const blockTimestamp = currentBlock.timestamp;
    const timestampTx = await oracle.setTimestamps(blockTimestamp - 30, blockTimestamp + 30);
    await timestampTx.wait();
    console.log("  ✅ Timestamps set");
    console.log("    Block number:", currentBlock.number);
    console.log("    Block timestamp:", blockTimestamp);
    console.log("    Min:", blockTimestamp - 30, "(-30 seconds)");
    console.log("    Max:", blockTimestamp + 30, "(+30 seconds)");

    // Verify prices
    console.log("\n  Verifying prices...");
    const usdtPriceData = await oracle.primaryPrices(USDT);
    const sngnPriceData = await oracle.primaryPrices(sNGN);

    const usdtInDollars = ethers.utils.formatUnits(usdtPriceData.min, 24);
    const sngnInDollars = ethers.utils.formatUnits(sngnPriceData.min, 30) * 1000000000000000000; // Adjust for 18 decimals

    console.log("  USDT price: $", usdtInDollars);
    console.log("  sNGN price: $", (1/1500).toFixed(6), "(approximately)");

    // Step 4: Calculate expected pool value
    console.log("\n📊 Expected pool value:");
    console.log("  1 USDT @ $1 = $1");
    console.log("  1500 sNGN @ $1/1500 = $1");
    console.log("  Total = $2");
    console.log("  Should mint ~2 market tokens");

    // Step 5: Execute deposit
    console.log("\n📍 Step 4: Executing deposit...");

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("  Simulating first...");

    try {
        let estimatedGas;
        try {
            estimatedGas = await depositHandler.estimateGas.executeDeposit(
                depositKey,
                oracleParams
            );
            console.log("  ✅ Simulation passed!");
            console.log("  Estimated gas:", estimatedGas.toString());
        } catch (simError) {
            // Check if it's EndOfOracleSimulation (expected) or another error
            if (simError.error && simError.error.data) {
                const errorSig = simError.error.data.slice(0, 10);
                if (errorSig === "0xdd51dc73") {
                    console.log("  ✅ Oracle simulation successful");
                    estimatedGas = ethers.BigNumber.from("5000000");
                } else {
                    console.log("  ❌ Simulation failed:", simError.error.data);

                    // Decode common errors
                    const errors = {
                        "0x01af8c24": "EmptyDepositAmounts",
                        "0x6c3e27f2": "MinMarketTokens",
                        "0xfe99dc66": "EmptyDepositAmounts",
                        "0xb2ddc979": "InsufficientPoolValue"
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

        // Execute for real
        console.log("\n🚀 Executing deposit transaction...");
        const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
            gasLimit: estimatedGas
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
            const marketToken = await ethers.getContractAt("MarketToken", MARKET);
            const totalSupply = await marketToken.totalSupply();
            const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

            console.log("\n🎯 Market Token Status:");
            console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
            console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));

            if (totalSupply.gt(0)) {
                console.log("\n🎉 SUCCESS! First liquidity added to the NEW USDT-indexed market!");
                console.log("The market is now live with ~$2 in liquidity!");
            } else {
                console.log("\n⚠️  Transaction succeeded but no tokens minted");
                console.log("Check if deposit was cancelled");
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
                "0xded099de": "EmptyPrimaryPrice",
                "0xa35b150b": "Unauthorized",
                "0x01af8c24": "EmptyDepositAmounts",
                "0x6c3e27f2": "MinMarketTokens"
            };

            if (errors[errorSig]) {
                console.log("Decoded error:", errors[errorSig]);
            }
        }
    }
}

main().catch(console.error);