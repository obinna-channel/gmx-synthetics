const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit on USDT Market ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // USDT market

    // Deposit key from creation
    const depositKey = "0x45157cd48486f4f3d4f44545b8db4c3a0ef001160e0b0eff459402ae8f3fa1fb";

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
    // USDT: $1.00 with 6 token decimals
    // Formula: price * 10^(30 - tokenDecimals) = 1 * 10^(30 - 6) = 10^24
    const usdtPrice = ethers.BigNumber.from(10).pow(30 - 6); // 1e24

    // sNGN: $1/1500 with 18 token decimals
    // Formula: price * 10^(30 - tokenDecimals) = (1/1500) * 10^(30 - 18) = 10^12 / 1500
    const sngnPrice = ethers.BigNumber.from(10).pow(30 - 18).div(1500); // ≈ 666,666,666

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
    // Set both timestamps to current or future to ensure they're newer than deposit
    const timestampTx = await oracle.setTimestamps(blockTimestamp, blockTimestamp + 60);
    await timestampTx.wait();
    console.log("  ✅ Timestamps set");
    console.log("    Block number:", currentBlock.number);
    console.log("    Block timestamp:", blockTimestamp);
    console.log("    Min:", blockTimestamp, "(current time)");
    console.log("    Max:", blockTimestamp + 60, "(+60 seconds)");

    // Verify prices
    console.log("\n  Verifying prices...");
    const usdtPriceData = await oracle.primaryPrices(USDT);
    const sngnPriceData = await oracle.primaryPrices(sNGN);

    const usdtInDollars = ethers.utils.formatUnits(usdtPriceData.min, 24);
    const sngnInDollars = ethers.utils.formatUnits(sngnPriceData.min, 30) * 1000000000000000000; // Adjust for 18 decimals

    console.log("  USDT price: $", usdtInDollars);
    console.log("  sNGN price: $", (1/1500).toFixed(6), "(approximately)");

    // Check deposit update time and oracle timestamps
    console.log("\n📍 Step 3.5: Checking deposit data and oracle timestamps...");

    // Read deposit data to get updatedAtTime
    const ACCOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"])
    );
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, ACCOUNT])
    );
    const depositAccount = await dataStore.getAddress(accountKey);

    // Check deposit amounts
    const INITIAL_LONG_TOKEN_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN_AMOUNT"])
    );
    const longAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_LONG_TOKEN_AMOUNT])
    );
    const initialLongTokenAmount = await dataStore.getUint(longAmountKey);

    const INITIAL_SHORT_TOKEN_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN_AMOUNT"])
    );
    const shortAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_SHORT_TOKEN_AMOUNT])
    );
    const initialShortTokenAmount = await dataStore.getUint(shortAmountKey);

    console.log("\n  📌 Checking for EmptyDepositAmountsAfterSwap:");
    console.log("  Initial USDT (long) amount:", ethers.utils.formatUnits(initialLongTokenAmount, 6));
    console.log("  Initial sNGN (short) amount:", ethers.utils.formatUnits(initialShortTokenAmount, 18));

    if (initialLongTokenAmount.eq(0) && initialShortTokenAmount.eq(0)) {
        console.log("  ❌ Both amounts are 0! This will cause EmptyDepositAmountsAfterSwap!");
    } else if (initialLongTokenAmount.eq(0) || initialShortTokenAmount.eq(0)) {
        console.log("  ⚠️  One amount is 0, but the other isn't. Deposit might still process.");
    } else {
        console.log("  ✅ Both amounts are non-zero. EmptyDepositAmountsAfterSwap will NOT occur.");
    }

    // Check minMarketTokens
    const MIN_MARKET_TOKENS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS"])
    );
    const minMarketTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, MIN_MARKET_TOKENS])
    );
    const minMarketTokens = await dataStore.getUint(minMarketTokensKey);

    console.log("\n  📌 Checking for MinMarketTokens:");
    console.log("  Deposit minMarketTokens:", minMarketTokens.toString());

    if (minMarketTokens.gt(0)) {
        console.log("  ⚠️  minMarketTokens > 0. If receivedMarketTokens < this, deposit will revert.");
        console.log("     For first deposit, this should be 0!");
    } else {
        console.log("  ✅ minMarketTokens = 0. Won't revert unless receivedMarketTokens is also 0.");
        console.log("     Note: receivedMarketTokens could still be 0 if pool value calculation fails!");
    }

    // Also check market token supply to see if this is truly first deposit
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    const currentSupply = await marketToken.totalSupply();
    console.log("  Current market token supply:", ethers.utils.formatEther(currentSupply));

    // Check receiver address
    const RECEIVER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER"])
    );
    const receiverKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, RECEIVER])
    );
    const receiver = await dataStore.getAddress(receiverKey);
    console.log("  Deposit receiver:", receiver);

    if (currentSupply.eq(0)) {
        console.log("  ✅ This is the first deposit (supply = 0)");
        console.log("     First deposit special rules apply:");
        console.log("     - Must use receiver = address(1)");
        console.log("     - Must have minMarketTokens = 0");

        if (receiver !== "0x0000000000000000000000000000000000000001") {
            console.log("  ❌ ERROR: First deposit receiver is NOT address(1)!");
            console.log("     This will cause InvalidReceiverForFirstDeposit!");
        } else {
            console.log("  ✅ Receiver is correctly set to address(1)");
        }
    } else {
        console.log("  ❌ This is NOT the first deposit! Supply > 0");
    }

    const UPDATED_AT_TIME = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["UPDATED_AT_TIME"])
    );
    const updatedAtTimeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, UPDATED_AT_TIME])
    );
    const depositUpdatedAtTime = await dataStore.getUint(updatedAtTimeKey);

    // Get oracle timestamps
    const oracleMinTimestamp = await oracle.minTimestamp();
    const oracleMaxTimestamp = await oracle.maxTimestamp();

    console.log("  Deposit account:", depositAccount);
    console.log("  Deposit updatedAtTime:", depositUpdatedAtTime.toString());
    console.log("  Oracle minTimestamp:", oracleMinTimestamp.toString());
    console.log("  Oracle maxTimestamp:", oracleMaxTimestamp.toString());

    // Check the condition
    if (oracleMinTimestamp.lt(depositUpdatedAtTime)) {
        console.log("  ❌ WARNING: Oracle minTimestamp < deposit updatedAtTime!");
        console.log("     This will cause OracleTimestampsAreSmallerThanRequired error");
    } else {
        console.log("  ✅ Oracle timestamps are newer than deposit");
    }

    // Check expiration - THIS CAUSES: OracleTimestampsAreLargerThanRequestExpirationTime
    const REQUEST_EXPIRATION_TIME_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
    );
    const requestExpirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY);
    console.log("\n  📌 Checking for OracleTimestampsAreLargerThanRequestExpirationTime:");
    console.log("  Request expiration time:", requestExpirationTime.toString(), "seconds");

    const expirationTimestamp = depositUpdatedAtTime.add(requestExpirationTime);
    console.log("  Deposit updatedAtTime:", depositUpdatedAtTime.toString());
    console.log("  + Request expiration:", requestExpirationTime.toString());
    console.log("  = Expiration timestamp:", expirationTimestamp.toString());
    console.log("  Oracle maxTimestamp:", oracleMaxTimestamp.toString());

    console.log("\n  Checking: Is", oracleMaxTimestamp.toString(), ">", expirationTimestamp.toString(), "?");

    if (oracleMaxTimestamp.gt(expirationTimestamp)) {
        console.log("  ❌ YES! This will cause OracleTimestampsAreLargerThanRequestExpirationTime!");
        console.log("     Deposit WILL BE REVERTED due to expiration");
    } else {
        const timeLeft = expirationTimestamp.sub(oracleMaxTimestamp);
        console.log("  ✅ NO - Deposit still valid for", timeLeft.toString(), "more seconds");
        console.log("     This error will NOT occur");
    }

    // Step 4: Calculate expected pool value
    console.log("\n📊 Expected pool value:");
    console.log("  1000 USDT @ $1 = $1000");
    console.log("  1,500,000 sNGN @ $1/1500 = $1000");
    console.log("  Total = $2000");
    console.log("  Should mint ~2000 market tokens");

    // Step 5: Execute deposit
    console.log("\n📍 Step 5: Executing deposit...");

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
                    console.log("  ✅ Oracle simulation successful (EndOfOracleSimulation)");
                    estimatedGas = ethers.BigNumber.from("5000000");
                } else {
                    console.log("  ❌ Simulation failed:", simError.error.data);

                    // Decode common errors
                    const errors = {
                        "0x01af8c24": "EmptyDepositAmounts",
                        "0x6c3e27f2": "MinMarketTokens",
                        "0xfe99dc66": "EmptyDepositAmounts",
                        "0xb2ddc979": "InsufficientPoolValue",
                        "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired"
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