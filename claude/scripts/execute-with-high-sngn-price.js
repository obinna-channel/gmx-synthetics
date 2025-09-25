const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit with sNGN at $1500 ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    // Latest deposit key
    const depositKey = "0xb308f9afa62b7974ac11422ca29d0caddb9260cfb61be8c0349ca54a86118527";

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

    // Step 2: Set oracle prices with sNGN at $1500
    console.log("\n📍 Step 2: Setting oracle prices...");
    console.log("  USDT: $1.00");
    console.log("  sNGN: $1500.00 🚀");
    
    // Clear existing prices
    const clearTx = await oracle.clearAllPrices();
    await clearTx.wait();
    console.log("  ✅ Prices cleared");
    
    // Price calculations
    // USDT: $1.00 = 10^24 (with 30 decimals of precision, 6 token decimals)
    const usdtPrice = ethers.BigNumber.from(10).pow(24);
    
    // sNGN: $1500 = 1500 * 10^30 / 10^18 = 1500 * 10^12
    // With 30 decimals of precision and 18 token decimals
    const sngnPrice = ethers.BigNumber.from(1500).mul(ethers.BigNumber.from(10).pow(12));
    
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
    
    // Set sNGN price at $1500
    const sngnPriceStruct = {
        min: sngnPrice,
        max: sngnPrice
    };
    const sngnTx = await oracle.setPrimaryPrice(sNGN, sngnPriceStruct);
    await sngnTx.wait();
    console.log("  ✅ sNGN price set to $1500.00");
    
    // Set timestamps
    const currentBlock = await ethers.provider.getBlock("latest");
    const blockTimestamp = currentBlock.timestamp;
    const timestampTx = await oracle.setTimestamps(blockTimestamp - 30, blockTimestamp + 30);
    await timestampTx.wait();
    console.log("  ✅ Timestamps set");
    
    // Verify prices
    console.log("\n  Verifying prices...");
    const usdtPriceData = await oracle.primaryPrices(USDT);
    const sngnPriceData = await oracle.primaryPrices(sNGN);
    
    const usdtInDollars = ethers.utils.formatUnits(usdtPriceData.min, 24);
    const sngnInDollars = ethers.utils.formatUnits(sngnPriceData.min, 12);
    
    console.log("  USDT price: $", usdtInDollars);
    console.log("  sNGN price: $", sngnInDollars);
    
    // Step 3: Calculate expected pool value
    console.log("\n📊 Expected pool value:");
    console.log("  100 USDT @ $1 = $100");
    console.log("  0.1 sNGN @ $1500 = $150");
    console.log("  Total = $250");
    console.log("  Should mint ~250 market tokens");

    // Step 4: Execute deposit
    console.log("\n📍 Step 3: Executing deposit...");
    
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
            const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
            const marketToken = await ethers.getContractAt("MarketToken", MARKET);
            const totalSupply = await marketToken.totalSupply();
            const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

            console.log("\n🎯 Market Token Status:");
            console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
            console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));
            
            if (totalSupply.gt(0)) {
                console.log("\n🎉 SUCCESS! First liquidity added to the market!");
                console.log("The market is now live with ~$250 in liquidity!");
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
        }
    }
}

main().catch(console.error);