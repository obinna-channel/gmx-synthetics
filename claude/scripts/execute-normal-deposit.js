const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Normal Deposit with Mock Oracle Provider ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";

    // Read mock provider address from deployment file
    let MOCK_PROVIDER;
    try {
        const deploymentInfo = JSON.parse(fs.readFileSync("mock-oracle-provider-deployment.json", "utf8"));
        MOCK_PROVIDER = deploymentInfo.mockOracleProvider;
        console.log("Using Mock Provider:", MOCK_PROVIDER);
    } catch (e) {
        console.log("❌ Could not read mock provider deployment info");
        console.log("  Please run: npx hardhat run claude/scripts/deploy-and-configure-mock-provider.js --network arbitrumSepolia");
        return;
    }

    // Read deposit key
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-normal-deposit-key.txt", "utf8").trim();
        console.log("Deposit Key:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key");
        console.log("  Please run: npx hardhat run claude/scripts/create-normal-deposit.js --network arbitrumSepolia");
        return;
    }

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Verify deposit exists
    console.log("\n📍 Verifying deposit exists...");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);

    if (!isInList) {
        console.log("❌ Deposit not found!");
        console.log("  The deposit might have already been executed or cancelled");
        return;
    }
    console.log("✅ Deposit found");

    // Build oracle params with provider
    console.log("\n📍 Building oracle params with mock provider...");
    const oracleParams = {
        tokens: [USDT, sNGN],
        providers: [MOCK_PROVIDER, MOCK_PROVIDER], // Same provider for both tokens
        data: ["0x", "0x"] // Empty data since mock provider doesn't need it
    };

    console.log("  Tokens:", oracleParams.tokens);
    console.log("  Providers:", oracleParams.providers);
    console.log("  Data:", oracleParams.data);

    // Execute deposit
    console.log("\n📍 Executing deposit...");

    try {
        // Simulate first
        console.log("  Simulating...");
        const estimatedGas = await depositHandler.estimateGas.executeDeposit(
            depositKey,
            oracleParams
        );
        console.log("  ✅ Simulation passed! Gas:", estimatedGas.toString());

        // Execute
        const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
            gasLimit: estimatedGas.mul(120).div(100) // 20% buffer
        });

        console.log("  TX sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check market token balance for the depositor
        const marketToken = await ethers.getContractAt("MarketToken", MARKET);
        const totalSupply = await marketToken.totalSupply();
        const userBalance = await marketToken.balanceOf(signer.address);

        console.log("\n🎯 Market Token Status:");
        console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
        console.log("  Your Balance:", ethers.utils.formatEther(userBalance));

        if (userBalance.gt(0)) {
            console.log("\n🎉 SUCCESS! You received market tokens!");
            console.log("  This confirms liquidity was successfully added to the market");
        } else if (receipt.status === 1) {
            console.log("\n⚠️  Transaction succeeded but no market tokens received");
            console.log("  This might indicate the deposit was cancelled internally");
        }

        console.log("\nView on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("❌ Execution failed:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);

            // Try to decode the error
            const errorSignatures = {
                "0x68b49e6c": "InvalidOracleProvider",
                "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired",
                "0x01af8c24": "EmptyDepositAmounts",
                "0x6c3e27f2": "MinMarketTokens"
            };

            const errorData = error.error.data.substring(0, 10);
            if (errorSignatures[errorData]) {
                console.log("\n📝 Error type:", errorSignatures[errorData]);

                if (errorData === "0x68b49e6c") {
                    console.log("  Solution: Run claude/scripts/set-token-providers.js to configure token providers");
                } else if (errorData === "0xd84b8ee8") {
                    console.log("  Solution: Deposit has timed out, create a new deposit");
                }
            }
        }
    }
}

main().catch(console.error);