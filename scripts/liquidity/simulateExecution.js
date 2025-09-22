const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Simulating Deposit Execution to Get Exact Error ===");

    const [signer] = await ethers.getSigners();

    // Contract addresses
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Set prices
    console.log("Setting oracle prices...");
    await oracle.clearAllPrices();
    await oracle.setPrimaryPrice(sNGN, {
        min: ethers.utils.parseUnits("1500", 30),
        max: ethers.utils.parseUnits("1500", 30)
    });
    console.log("sNGN price set to 1500");

    console.log("\n=== Attempting Static Call to Get Exact Error ===");

    // Try different oracle param configurations to see which works
    const configurations = [
        {
            name: "Only sNGN",
            params: {
                signerInfo: 0,
                tokens: [sNGN],
                providers: [ORACLE],
                data: []
            }
        },
        {
            name: "Both tokens (USDT first)",
            params: {
                signerInfo: 0,
                tokens: [USDT, sNGN],
                providers: [ORACLE, ORACLE],
                data: []
            }
        },
        {
            name: "Both tokens (sNGN first)",
            params: {
                signerInfo: 0,
                tokens: [sNGN, USDT],
                providers: [ORACLE, ORACLE],
                data: []
            }
        },
        {
            name: "Empty oracle params",
            params: {
                signerInfo: 0,
                tokens: [],
                providers: [],
                data: []
            }
        }
    ];

    for (const config of configurations) {
        console.log(`\nTrying configuration: ${config.name}`);
        console.log("Tokens:", config.params.tokens);

        try {
            // Use callStatic to simulate without sending transaction
            await depositHandler.callStatic.executeDeposit(depositKey, config.params);
            console.log(`✅ ${config.name} - Static call succeeded!`);

            // If static call succeeds, try the actual transaction
            console.log("Attempting actual transaction...");
            const tx = await depositHandler.executeDeposit(
                depositKey,
                config.params,
                { gasLimit: 10000000 }
            );

            const receipt = await tx.wait();
            console.log("\n🎉 SUCCESS! Deposit executed!");
            console.log("Transaction:", receipt.transactionHash);
            console.log("Gas used:", receipt.gasUsed.toString());

            return; // Exit on success

        } catch (error) {
            console.log(`❌ ${config.name} - Failed`);

            // Extract specific error information
            if (error.reason) {
                console.log("  Reason:", error.reason);
            }
            if (error.errorName) {
                console.log("  Error name:", error.errorName);
            }
            if (error.errorArgs) {
                console.log("  Error args:", error.errorArgs);
            }
            if (error.message && error.message.includes("0x")) {
                // Try to extract error selector
                const match = error.message.match(/0x[a-fA-F0-9]{8}/);
                if (match) {
                    console.log("  Error selector:", match[0]);
                }
            }
        }
    }

    console.log("\n=== Checking with simulateExecuteDeposit ===");

    // Try the simulation function if available
    try {
        const simulateParams = {
            primaryTokens: [sNGN],
            primaryPrices: [
                { min: ethers.utils.parseUnits("1500", 30), max: ethers.utils.parseUnits("1500", 30) }
            ],
            minTimestamp: 0,
            maxTimestamp: Math.floor(Date.now() / 1000) + 3600
        };

        console.log("Calling simulateExecuteDeposit...");
        await depositHandler.callStatic.simulateExecuteDeposit(depositKey, simulateParams);
        console.log("✅ Simulation succeeded!");

    } catch (error) {
        console.log("❌ Simulation failed");
        console.log("Error:", error.reason || error.message);

        // Try to decode the error
        if (error.data) {
            console.log("\nRaw error data:", error.data);

            // Try decoding with known error signatures
            const errorSignatures = {
                "0xf9996e9f": "InvalidPoolValueForDeposit(int256)",
                "0x2354600f": "EmptyPrimaryPrice(address)",
                "0x8baa579f": "EmptyDeposit()",
                "0x5c2c30a5": "DisabledFeature(bytes32)",
                "0x9954eddd": "InsufficientPoolAmount(uint256,uint256)",
                "0x7c1f8113": "InvalidSwapOutputToken(address,address)",
                "0x4c4fa3e3": "InvalidMarketTokenAmount(uint256)",
                "0x0ac76f01": "MinMarketTokens(uint256,uint256)"
            };

            const selector = error.data.slice(0, 10);
            if (errorSignatures[selector]) {
                console.log("Decoded error:", errorSignatures[selector]);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });