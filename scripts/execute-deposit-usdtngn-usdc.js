const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit for mUSDTNGN [USDC-USDC] Market ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDC = "0xe73B11Fb1e3eeEe8AF2a23079A4410Fe1B370548";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73";
    const MARKET = "0x0A9aaD88Ee9548b9aAe0526277982E730d2fBD38"; // Market 19: mUSDTNGN/USDC/USDC
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Read deposit key
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-deposit-key-usdtngn-usdc.txt", "utf8").trim();
        console.log("Deposit Key:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key from latest-deposit-key-usdtngn-usdc.txt");
        console.log("   Please run create-first-deposit-usdtngn-usdc.js first");
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
        console.log("   Please run create-first-deposit-usdtngn-usdc.js first");
        return;
    }
    console.log("✅ Deposit found");

    // Step 2: Build oracle params with mock provider
    console.log("\n📍 Step 2: Building oracle parameters with mock provider...");

    // For single-token market: index token (mUSDTNGN) + collateral token (USDC)
    const oracleParams = {
        tokens: [mUSDTNGN, USDC],
        providers: [MOCK_PROVIDER, MOCK_PROVIDER], // Same provider for both tokens
        data: ["0x", "0x"] // Empty data since mock provider doesn't need it
    };

    console.log("\n📋 Oracle Params:");
    console.log("  Tokens:", oracleParams.tokens);
    console.log("  Providers:", oracleParams.providers);
    console.log("  Data:", oracleParams.data);

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

    try {
        const estimatedGas = await depositHandler.estimateGas.executeDeposit(
            depositKey,
            oracleParams
        );
        console.log("  ✅ Simulation passed!");
        console.log("  Estimated gas:", estimatedGas.toString());
    } catch (simError) {
        console.log("  ❌ Simulation failed!");
        console.log("  Error:", simError.message);
        if (simError.error && simError.error.data) {
            console.log("  Error data:", simError.error.data);
        }
        return;
    }

    // Step 5: Execute for real
    console.log("\n🚀 Step 5: Executing deposit transaction...");

    try {
        const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
            gasLimit: 5000000 // Add buffer
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
                console.log("\n🎉 SUCCESS! Liquidity added to the mUSDTNGN [USDC-USDC] market!");
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
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
