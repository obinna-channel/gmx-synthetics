const { ethers } = require("hardhat");
const { execSync } = require("child_process");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit (Simple) ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    
    // Deposit key from our created deposit
    const depositKey = "0xbb7aa6074f7af48a394d7267a6630640d3f332027231b0fd89bdca8612cbe3e1";

    console.log("\n📝 Deposit Details:");
    console.log("  Key:", depositKey);
    console.log("  Handler:", DEPOSIT_HANDLER);

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
        console.log("❌ Deposit not found in DEPOSIT_LIST!");
        console.log("The deposit may have been executed or cancelled.");
        return;
    }
    console.log("✅ Deposit found");

    // Step 2: Set fresh prices
    console.log("\n📍 Step 2: Setting fresh oracle prices...");
    try {
        console.log("Running price setting script...");
        execSync("npx hardhat run claude/scripts/set-fresh-prices.js --network arbitrumSepolia", {
            stdio: 'inherit'
        });
        console.log("✅ Prices set successfully");
    } catch (error) {
        console.log("❌ Failed to set prices:", error.message);
        return;
    }

    // Step 3: Use EMPTY oracle params (like previous successful deployment)
    console.log("\n📍 Step 3: Preparing execution with EMPTY oracle params...");

    console.log("  Using approach from previous successful deployment:");
    console.log("  - Empty tokens array");
    console.log("  - Empty providers array");
    console.log("  - Empty data array");
    console.log("  - Prices already set via setPrimaryPrice()");

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("  ✅ Using empty oracle params");
    console.log("  MIN_ORACLE_SIGNERS: 0 (testing mode)");

    // Step 4: Execute deposit
    console.log("\n📍 Step 4: Executing deposit...");
    console.log("  Simulating first...");
    
    try {
        // Try to simulate - expect EndOfOracleSimulation error
        let estimatedGas;
        try {
            estimatedGas = await depositHandler.estimateGas.executeDeposit(
                depositKey,
                oracleParams
            );
            console.log("  ✅ Simulation passed!");
            console.log("  Estimated gas:", estimatedGas.toString());
        } catch (simError) {
            // Check if it's EndOfOracleSimulation (good) or another error (bad)
            if (simError.error && simError.error.data) {
                const errorSig = simError.error.data.slice(0, 10);
                if (errorSig === "0xdd51dc73") {
                    console.log("  ✅ Oracle simulation successful (EndOfOracleSimulation)");
                    console.log("  This means the transaction should work!");
                    // Use a high gas limit since estimation failed
                    estimatedGas = ethers.BigNumber.from("5000000");
                } else {
                    throw simError; // Re-throw if it's a different error
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
            const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

            console.log("\n🎉 SUCCESS! Deposit executed!");
            console.log("  Market tokens minted to address(1):", ethers.utils.formatEther(address1Balance));
            console.log("\n✅ The market now has its first liquidity!");
        } else {
            console.log("\n❌ Transaction failed. Check the logs.");
        }

    } catch (error) {
        console.log("❌ Execution failed:", error.message);
        
        if (error.error && error.error.data) {
            console.log("\nError data:", error.error.data);
            
            // Decode common errors
            const errorSig = error.error.data.slice(0, 10);
            const errorMessages = {
                "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired - Prices too old",
                "0xa35b150b": "Unauthorized - Missing required role",
                "0x01af8c24": "EmptyDepositAmounts",
                "0x3c6be8c0": "InsufficientWntAmountForExecutionFee"
            };
            
            if (errorMessages[errorSig]) {
                console.log("Decoded:", errorMessages[errorSig]);
            }
        }
    }
}

main().catch(console.error);