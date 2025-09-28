const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing mUSD Deposit with Mock Oracle Provider ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";
    const MARKET = "0xb0D93252624e03138a261689eDE446F6BEd768BF"; // mNGN/mUSD/mNGN market
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Read deposit key
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-musd-deposit-key.txt", "utf8").trim();
        console.log("Deposit Key:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key");
        console.log("  Please run: npx hardhat run scripts/create-musd-first-deposit.js --network arbitrumSepolia");
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
        tokens: [mUSD, mNGN],
        providers: [MOCK_PROVIDER, MOCK_PROVIDER], // Same provider for both tokens
        data: ["0x", "0x"] // Empty data since mock provider doesn't need it
    };

    console.log("  Tokens:", oracleParams.tokens);
    console.log("  Providers:", oracleParams.providers);
    console.log("  Data:", oracleParams.data);

    console.log("\n💱 Exchange Rate Pricing:");
    console.log("  1 mUSD = 1500 NGN");
    console.log("  1 mNGN = 1 NGN");
    console.log("  Deposit: 1 mUSD + 1,500 mNGN = 3,000 NGN total");

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

        // Check market token supply
        const marketToken = await ethers.getContractAt("MarketToken", MARKET);
        const totalSupply = await marketToken.totalSupply();
        const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

        console.log("\n🎯 Market Token Status:");
        console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
        console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));

        if (totalSupply.gt(0)) {
            console.log("\n🎉 SUCCESS! First deposit completed!");
            console.log("  Exchange rate pricing worked with minimal liquidity (3,000 NGN)");
            console.log("\n📈 This proves:");
            console.log("  • Exchange rate pricing CAN work");
            console.log("  • The issue was likely the large initial amount (3M NGN)");
            console.log("  • Starting small is the key!");
        } else if (receipt.status === 1) {
            console.log("\n⚠️ Transaction succeeded but no market tokens minted");
            console.log("  Deposit may have been cancelled internally");
            console.log("  Even 3,000 NGN might be hitting some limit");
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
            }
        }
    }
}

main().catch(console.error);