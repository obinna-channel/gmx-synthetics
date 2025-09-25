const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";  // Correct Oracle from deployment
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    
    // Deposit key from our created deposit
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    // Token addresses
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("\n📋 Execution Details:");
    console.log("  Deposit Key:", depositKey);
    console.log("  DepositHandler:", DEPOSIT_HANDLER);
    console.log("  Oracle:", ORACLE);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Step 1: Verify deposit exists
    console.log("\n📍 STEP 1: Verifying deposit exists...");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    
    if (!isInList) {
        console.log("❌ Deposit not found in DEPOSIT_LIST!");
        return;
    }
    console.log("✅ Deposit found in DEPOSIT_LIST");

    // Step 2: Check MIN_ORACLE_SIGNERS
    console.log("\n📍 STEP 2: Checking oracle configuration...");
    const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    const minOracleSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
    console.log("  MIN_ORACLE_SIGNERS:", minOracleSigners.toString());
    
    if (minOracleSigners.gt(0)) {
        console.log("  ⚠️  Warning: Oracle signatures required. This script uses mock prices.");
    } else {
        console.log("  ✅ No oracle signatures required (testing mode)");
    }

    // Step 3: Set fresh oracle prices using setPrices with proper block numbers
    console.log("\n📍 STEP 3: Setting fresh oracle prices...");

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("  Current block:", currentBlock.number);
    console.log("  Current timestamp:", currentBlock.timestamp);

    // Price calculations
    // USDT: $1.00 = 10^24
    const usdtPrice = ethers.BigNumber.from(10).pow(24);
    // sNGN: $1/1500 = 666666666
    const sngnPrice = ethers.BigNumber.from(10).pow(9).mul(2).div(3);

    console.log("\n📊 Setting Prices:");
    console.log("  USDT: $1.00 (10^24)");
    console.log("  sNGN: $1/1500 = $0.000666... (666666666)");

    try {
        // Clear existing prices first
        console.log("\n  Clearing old prices...");
        await oracle.clearAllPrices();
        console.log("  ✅ Old prices cleared");

        // Build SetPricesParams for oracle.setPrices
        // This should properly set block numbers and timestamps
        const tokens = [USDT, sNGN];
        const providers = []; // Empty - we're setting directly as CONTROLLER

        // Encode the price data with block number and timestamp
        const blockNumber = currentBlock.number;
        const timestamp = currentBlock.timestamp;

        // Create compacted price data for each token
        // Format: [min price, max price] with precision bits
        const usdtData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "uint256", "uint256"],
            [usdtPrice, usdtPrice, blockNumber, timestamp]
        );

        const sngnData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "uint256", "uint256"],
            [sngnPrice, sngnPrice, blockNumber, timestamp]
        );

        const data = [usdtData, sngnData];

        // Use setPrices instead of setPrimaryPrice
        console.log("\n  Setting prices with block numbers...");
        const setPricesParams = {
            tokens: tokens,
            providers: providers,
            data: data
        };

        const tx = await oracle.setPrices(setPricesParams);
        console.log("  Transaction sent:", tx.hash);
        await tx.wait();
        console.log("  ✅ Prices set with current block numbers!");

        console.log("\n  ✅ Fresh prices ready with block:", blockNumber);
    } catch (error) {
        console.log("\n❌ Error setting prices:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }

        // Fall back to simple setPrimaryPrice approach
        console.log("\n  Trying fallback: setPrimaryPrice without block numbers...");
        try {
            const usdtPriceStruct = { min: usdtPrice, max: usdtPrice };
            const sngnPriceStruct = { min: sngnPrice, max: sngnPrice };

            await oracle.setPrimaryPrice(USDT, usdtPriceStruct);
            await oracle.setPrimaryPrice(sNGN, sngnPriceStruct);

            // Try to update timestamps
            await oracle.setTimestamps(timestamp, timestamp + 60);

            console.log("  ✅ Fallback prices set");
        } catch (fallbackError) {
            console.log("  ❌ Fallback also failed:", fallbackError.message);
            return;
        }
    }

    // Step 4: Build OracleUtils.SetPricesParams
    console.log("\n📍 STEP 4: Building oracle parameters...");

    // Since we already set primary prices directly in the Oracle,
    // we can pass empty SetPricesParams to executeDeposit
    // The Oracle will use the prices we already set

    const oracleParams = {
        tokens: [],      // Empty - prices already set
        providers: [],   // Empty - prices already set
        data: []        // Empty - prices already set
    };

    console.log("\n📝 Oracle Params:");
    console.log("  Using pre-set primary prices in Oracle");
    console.log("  No additional price updates needed");
    console.log("  MIN_ORACLE_SIGNERS:", minOracleSigners.toString());

    // Step 5: Calculate expected values
    console.log("\n📍 STEP 5: Calculating deposit values...");

    // Our deposit amounts
    console.log("\n💰 Deposit amounts:");
    console.log("  USDT: 1 token (1000000 with 6 decimals)");
    console.log("  sNGN: 1500 tokens (1500000000000000000000 with 18 decimals)");

    // With our prices
    console.log("\n💵 USD values (with set prices):");
    console.log("  USDT: 1 * $1.00 = $1.00");
    console.log("  sNGN: 1500 * $0.000666... = $1.00");
    console.log("  Total deposit value: $2.00");
    console.log("  ✅ Perfectly balanced deposit!");

    // Simulate the transaction
    console.log("\n🔮 Simulating transaction...");
    try {
        const estimatedGas = await depositHandler.estimateGas.executeDeposit(
            depositKey,
            oracleParams
        );
        console.log("  ✅ Simulation PASSED!");
        console.log("  Estimated gas:", estimatedGas.toString());
        console.log("  Estimated cost:", ethers.utils.formatEther(estimatedGas.mul(await signer.getGasPrice())), "ETH");

        console.log("\n✅ Simulation successful! The transaction should succeed.");
    } catch (error) {
        console.log("  ❌ Simulation FAILED!");
        console.log("  Error:", error.message);

        if (error.error && error.error.data) {
            console.log("\n  Attempting to decode error...");
            const errorData = error.error.data;

            // Common error signatures
            const errorSignatures = {
                "0x01af8c24": "EmptyDepositAmounts",
                "0x3c6be8c0": "InsufficientWntAmountForExecutionFee",
                "0x8a68c1dc": "OracleBlockNumbersAreSmallerThanRequired",
                "0x2e7ba6ef": "Unauthorized",
                "0x9f678cca": "DisabledFeature"
            };

            const errorSig = errorData.slice(0, 10);
            if (errorSignatures[errorSig]) {
                console.log("  Decoded error:", errorSignatures[errorSig]);
            }
        }

        console.log("\n⚠️  The transaction would fail. Please check the error above.");
        return;
    }

    // Step 6: Execute deposit (if simulation passed)
    console.log("\n📍 STEP 6: Ready to execute deposit...");
    console.log("\n⚠️  EXECUTION DISABLED - Uncomment code below to execute");
    console.log("\nWhat will happen when executed:");
    console.log("  1. DepositHandler.executeDeposit() will be called");
    console.log("  2. Oracle will use pre-set prices (USDT: $1.00, sNGN: $0.000666...)");
    console.log("  3. Deposit will be processed with perfectly balanced values");
    console.log("  4. Market tokens will be minted to address(1)");
    console.log("  5. The market will have its first liquidity!");
    
    // EXECUTION CODE - CURRENTLY DISABLED FOR SAFETY
    // Uncomment the following to actually execute:
    /*
    try {
        console.log("\n🚀 Executing deposit...");
        const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
            gasLimit: 5000000 // High gas limit for complex execution
        });
        
        console.log("\n  Transaction sent:", tx.hash);
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
            const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");
            
            console.log("\n🎉 SUCCESS! Deposit executed!");
            console.log("  Market tokens minted to address(1):", ethers.utils.formatEther(address1Balance));
            console.log("\n✅ The market now has its first liquidity!");
        }
        
    } catch (error) {
        console.log("\n❌ Execution failed:", error.message);
        
        // Try to decode the error
        if (error.data) {
            console.log("\nError data:", error.data);
        }
    }
    */
}

main().catch(console.error);