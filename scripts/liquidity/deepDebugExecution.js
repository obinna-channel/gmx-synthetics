const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Deep Debug of Deposit Execution ===");

    const [signer] = await ethers.getSigners();

    // Contract addresses
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Attempting Simulation ===");

    // First set prices - only sNGN, USDT should default to $1 as a stablecoin
    await oracle.clearAllPrices();
    // USDT is a stablecoin and should be handled automatically as $1
    // Only set sNGN price
    await oracle.setPrimaryPrice(sNGN, {
        min: ethers.utils.parseUnits("1500", 30),
        max: ethers.utils.parseUnits("1500", 30)
    });
    console.log("Price set: sNGN=1500 (USDT defaults to $1 as stablecoin)");

    // Try to simulate the execution
    try {
        console.log("\nTrying simulateExecuteDeposit if available...");

        const simulateParams = {
            primaryTokens: [sNGN], // Only sNGN, USDT handled as stablecoin
            primaryPrices: [
                { min: ethers.utils.parseUnits("1500", 30), max: ethers.utils.parseUnits("1500", 30) }
            ],
            minTimestamp: 0,
            maxTimestamp: Math.floor(Date.now() / 1000) + 3600
        };

        await depositHandler.simulateExecuteDeposit(depositKey, simulateParams);
        console.log("✅ Simulation succeeded!");
    } catch (error) {
        console.log("Simulation failed:", error.reason || error.message);

        // Try to extract error details
        if (error.errorName) {
            console.log("Error name:", error.errorName);
        }
        if (error.errorArgs) {
            console.log("Error arguments:", error.errorArgs);
        }
    }

    console.log("\n=== Checking Additional Required Configurations ===");

    // Check max leverage
    const maxLeverageKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_LEVERAGE"))]
        )
    );
    const maxLeverage = await dataStore.getUint(maxLeverageKey);
    console.log("Max leverage:", maxLeverage.toString());

    if (maxLeverage.eq(0)) {
        console.log("Setting max leverage to 100x...");
        const leverage = ethers.utils.parseUnits("100", 30);
        await dataStore.setUint(maxLeverageKey, leverage);
        console.log("✅ Max leverage set!");
    }

    // Check virtual market ID
    const virtualMarketIdKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VIRTUAL_MARKET_ID"))]
        )
    );
    const virtualMarketId = await dataStore.getBytes32(virtualMarketIdKey);
    console.log("Virtual market ID:", virtualMarketId);

    // Check virtual token IDs
    const virtualTokenIdForIndexKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VIRTUAL_TOKEN_ID"))]
        )
    );
    const virtualTokenId = await dataStore.getBytes32(virtualTokenIdForIndexKey);
    console.log("Virtual token ID:", virtualTokenId);

    console.log("\n=== Final Execution Attempt ===");

    try {
        const oracleParams = {
            signerInfo: 0,
            tokens: [sNGN], // Only sNGN, USDT handled as stablecoin
            providers: [ORACLE],
            data: []
        };

        console.log("Executing deposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 8000000 } // Higher gas limit
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        console.log("\n✅ SUCCESS! Deposit executed!");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Events:", receipt.logs.length);

    } catch (error) {
        console.log("\n❌ Still failing. Error:", error.message);

        // Check if it's a specific revert reason
        if (error.data) {
            try {
                // Common GMX errors
                const iface = new ethers.utils.Interface([
                    "error EmptyDeposit()",
                    "error InvalidPoolValueForDeposit(int256 poolValue)",
                    "error InvalidAdjustedMarketTokenAmount(uint256 marketTokenAmount, uint256 adjustedMarketTokenAmount)",
                    "error MinMarketTokens(uint256 received, uint256 expected)",
                    "error InsufficientPoolAmount(uint256 amount, uint256 poolAmount)",
                    "error InvalidSwapOutputToken(address tokenIn, address tokenOut)",
                    "error InvalidMarketTokenAmount(uint256 marketTokenAmount)",
                    "error InvalidMarketTokenAmountForDeposit(uint256 marketTokenAmount)",
                    "error InvalidRequestCancellationReceiver(address receiver, address expectedReceiver)"
                ]);

                const decoded = iface.parseError(error.data);
                console.log("\n🔍 Decoded error:", decoded.name);
                if (decoded.args && decoded.args.length > 0) {
                    console.log("Arguments:", decoded.args.map(a => a.toString()));
                }
            } catch (e) {
                console.log("Could not decode error data");
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