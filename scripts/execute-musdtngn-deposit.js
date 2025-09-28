const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Executing mUSDTNGN Market Deposit with Mock Oracle Provider ===\n");
    console.log("Executor address:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"; // Index token
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";
    const MARKET = "0x5E63276Caae0FF49b2762b98A1d37941AA50F804"; // Market 9: mUSDTNGN/mUSD/mNGN
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Read deposit key
    let depositKey;
    try {
        depositKey = fs.readFileSync("latest-musdtngn-deposit-key.txt", "utf8").trim();
        console.log("Deposit Key:", depositKey);
    } catch (e) {
        console.log("❌ Could not read deposit key");
        console.log("  Please run: npx hardhat run scripts/create-musdtngn-first-deposit.js --network arbitrumSepolia");
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

    // Build oracle params with provider for three tokens (index, long, short)
    console.log("\n📍 Building oracle params with mock provider...");
    const oracleParams = {
        tokens: [mUSDTNGN, mUSD, mNGN],
        providers: [MOCK_PROVIDER, MOCK_PROVIDER, MOCK_PROVIDER], // Same provider for all tokens
        data: ["0x", "0x", "0x"] // Empty data since mock provider doesn't need it
    };

    console.log("  Tokens:");
    console.log("    - mUSDTNGN (index):", mUSDTNGN);
    console.log("    - mUSD (long):", mUSD);
    console.log("    - mNGN (short):", mNGN);
    console.log("  Providers:", oracleParams.providers);
    console.log("  Data:", oracleParams.data);

    console.log("\n💱 Oracle Pricing:");
    console.log("  mUSDTNGN = 1500 (USDT/NGN exchange rate)");
    console.log("  mUSD = 1 USD");
    console.log("  mNGN = 0.000666667 USD (1/1500)");
    console.log("  Deposit: 100 mUSD + 150,000 mNGN = 300,000 NGN total");

    // Get market token contract to check balances
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    const totalSupplyBefore = await marketToken.totalSupply();
    const userBalanceBefore = await marketToken.balanceOf(signer.address);

    console.log("\n📊 Market Status Before:");
    console.log("  Total Supply:", ethers.utils.formatEther(totalSupplyBefore));
    console.log("  Your Balance:", ethers.utils.formatEther(userBalanceBefore));

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

        // Check market token balances after
        const totalSupplyAfter = await marketToken.totalSupply();
        const userBalanceAfter = await marketToken.balanceOf(signer.address);

        console.log("\n🎯 Market Token Status After:");
        console.log("  Total Supply:", ethers.utils.formatEther(totalSupplyAfter));
        console.log("  Your Balance:", ethers.utils.formatEther(userBalanceAfter));

        const tokensReceived = userBalanceAfter.sub(userBalanceBefore);
        const supplyIncrease = totalSupplyAfter.sub(totalSupplyBefore);

        if (tokensReceived.gt(0) || supplyIncrease.gt(0)) {
            console.log("\n🎉 SUCCESS! First deposit completed!");
            console.log("  Market tokens received:", ethers.utils.formatEther(tokensReceived));
            console.log("  Total supply increased by:", ethers.utils.formatEther(supplyIncrease));
            console.log("\n💰 The market now has initial liquidity!");
            console.log("  Users can now deposit normally using their own address as receiver");
        } else if (receipt.status === 1) {
            console.log("\n⚠️ Transaction succeeded but no market tokens received");
            console.log("  This is normal for first deposit with special receiver");
            console.log("  The market should now have liquidity");
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