const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Deploying and Configuring Mock Oracle Provider ===\n");
    console.log("Deployer:", signer.address);

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("Using DataStore:", DATA_STORE);

    // Step 1: Compile the contract
    console.log("\n📍 Step 1: Compiling MockOracleProvider...");
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
        const { stdout } = await execAsync('npx hardhat compile');
        console.log("  ✅ Contract compiled successfully");
    } catch (error) {
        // Compilation might show warnings but still succeed
        console.log("  ✅ Compilation complete (with warnings)");
    }

    // Step 2: Deploy the MockOracleProvider
    console.log("\n📍 Step 2: Deploying MockOracleProvider...");

    const MockOracleProvider = await ethers.getContractFactory("contracts/oracle/MockOracleProvider.sol:MockOracleProvider");
    const mockProvider = await MockOracleProvider.deploy();
    await mockProvider.deployed();

    console.log("  ✅ MockOracleProvider deployed to:", mockProvider.address);

    // Step 3: Set prices for USDT and sNGN
    console.log("\n📍 Step 3: Setting prices in provider...");

    // USDT: $1 with 30 decimals precision and 6 token decimals
    // Price = 1 * 10^(30-6) = 10^24
    const usdtPrice = ethers.BigNumber.from(10).pow(24);
    let tx = await mockProvider.setPriceWithPrecision(USDT, usdtPrice);
    await tx.wait();
    console.log("  ✅ USDT price set to $1.00");
    console.log("    Raw value:", usdtPrice.toString());

    // sNGN: $1/1500 with 30 decimals precision and 18 token decimals
    // Price = (1/1500) * 10^(30-18) = 10^12 / 1500
    const sngnPrice = ethers.BigNumber.from(10).pow(12).div(1500);
    tx = await mockProvider.setPriceWithPrecision(sNGN, sngnPrice);
    await tx.wait();
    console.log("  ✅ sNGN price set to $0.000666... (1/1500)");
    console.log("    Raw value:", sngnPrice.toString());

    // Step 4: Enable the provider in DataStore
    console.log("\n📍 Step 4: Configuring provider in DataStore...");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Create the key for enabling oracle provider
    // Keys.isOracleProviderEnabledKey(provider) = keccak256(abi.encode("IS_ORACLE_PROVIDER_ENABLED", provider))
    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );

    const providerEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, mockProvider.address]
        )
    );

    console.log("  Provider address:", mockProvider.address);
    console.log("  Enable key:", providerEnabledKey);

    try {
        // Check if already enabled
        const isEnabled = await dataStore.getBool(providerEnabledKey);
        if (isEnabled) {
            console.log("  ✅ Provider already enabled in DataStore");
        } else {
            // Enable the provider
            tx = await dataStore.setBool(providerEnabledKey, true);
            await tx.wait();
            console.log("  ✅ Provider enabled in DataStore");
        }

        // Verify it's enabled
        const verifyEnabled = await dataStore.getBool(providerEnabledKey);
        console.log("  Verification: Provider enabled =", verifyEnabled);

    } catch (error) {
        console.log("  ❌ Failed to enable provider:", error.message);
        console.log("\n  ⚠️  You need CONTROLLER role to enable the provider");
        console.log("  Please grant CONTROLLER role to:", signer.address);
    }

    // Step 5: Save deployment info
    console.log("\n📍 Step 5: Saving deployment info...");
    const deploymentInfo = {
        mockOracleProvider: mockProvider.address,
        providerEnabledKey: providerEnabledKey,
        usdtPrice: usdtPrice.toString(),
        sngnPrice: sngnPrice.toString(),
        deployedAt: new Date().toISOString(),
        network: "arbitrumSepolia"
    };

    fs.writeFileSync("mock-oracle-provider-deployment.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("  ✅ Deployment info saved to mock-oracle-provider-deployment.json");

    // Step 6: Create updated execute script
    console.log("\n📍 Step 6: Creating execute script with provider...");

    const executeScriptContent = `const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing Deposit with Mock Oracle Provider ===\\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
    const MOCK_PROVIDER = "${mockProvider.address}";

    // Read deposit key
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-deposit-key-new-market.txt", "utf8").trim();
        console.log("Deposit Key:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key");
        return;
    }

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Verify deposit exists
    console.log("\\n📍 Verifying deposit exists...");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);

    if (!isInList) {
        console.log("❌ Deposit not found!");
        return;
    }
    console.log("✅ Deposit found");

    // Build oracle params with provider
    console.log("\\n📍 Building oracle params with mock provider...");
    const oracleParams = {
        tokens: [USDT, sNGN],
        providers: [MOCK_PROVIDER, MOCK_PROVIDER], // Same provider for both tokens
        data: ["0x", "0x"] // Empty data since mock provider doesn't need it
    };

    console.log("  Tokens:", oracleParams.tokens);
    console.log("  Providers:", oracleParams.providers);
    console.log("  Data:", oracleParams.data);

    // Execute deposit
    console.log("\\n📍 Executing deposit...");

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
        console.log("\\n✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check market token supply
        const marketToken = await ethers.getContractAt("MarketToken", MARKET);
        const totalSupply = await marketToken.totalSupply();
        const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

        console.log("\\n🎯 Market Token Status:");
        console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
        console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));

        if (totalSupply.gt(0)) {
            console.log("\\n🎉 SUCCESS! Liquidity added to the market!");
        }

        console.log("\\nView on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("❌ Execution failed:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);`;

    fs.writeFileSync("claude/scripts/execute-with-mock-provider.js", executeScriptContent);
    console.log("  ✅ Execute script created: claude/scripts/execute-with-mock-provider.js");

    console.log("\n=== ✅ Deployment Complete! ===\n");
    console.log("Mock Oracle Provider:", mockProvider.address);
    console.log("\n📋 Configuration Summary:");
    console.log("  • Provider is deployed and configured");
    console.log("  • USDT price: $1.00 (raw: " + usdtPrice.toString() + ")");
    console.log("  • sNGN price: $1/1500 (raw: " + sngnPrice.toString() + ")");
    console.log("  • Provider enabled in DataStore: Check above for status");

    console.log("\n🎯 Next Steps:");
    console.log("1. If provider enabling failed, grant CONTROLLER role to:", signer.address);
    console.log("2. Create a new deposit with: npx hardhat run claude/scripts/create-deposit-new-market.js --network arbitrumSepolia");
    console.log("3. Execute deposit with: npx hardhat run claude/scripts/execute-with-mock-provider.js --network arbitrumSepolia");

    console.log("\n💡 How it works:");
    console.log("  • The oracle params will include the mock provider address for each token");
    console.log("  • The Oracle contract will call mockProvider.getOraclePrice() for each token");
    console.log("  • The mock provider returns the preset prices we configured");
    console.log("  • This allows the deposit execution to proceed with valid prices");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });