const { ethers } = require("hardhat");

async function main() {
    const errorData = "0xee919dd900000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000002c6abfeb134408ddc779a86a2200000000000000000000000000000000000000000c9f2c9cd04674edea400000000000000000000000000000000000000000001b3d9bfa507af632998bca0000000000000000000000000000000000000000000000000000000000000000000000";

    console.log("=== Decoding Liquidation Error ===\n");
    console.log("Error Data:", errorData);
    console.log();

    const selector = errorData.slice(0, 10);
    console.log("Error Selector:", selector);
    console.log();

    // Try to decode with common GMX error signatures
    const commonErrors = [
        "error InsufficientCollateralUsd(uint256 remainingCollateralUsd)",
        "error MinCollateralUsd(uint256 minCollateralUsd, uint256 collateralUsd)",
        "error MinCollateralUsdForLeverage(uint256 minCollateralUsd, uint256 collateralUsd)",
        "error LiquidatablePosition(bytes32 key, uint256 remainingCollateralUsd, uint256 minCollateralUsd, uint256 minCollateralUsdForLeverage)",
    ];

    for (const errorSig of commonErrors) {
        try {
            const iface = new ethers.utils.Interface([errorSig]);
            const decoded = iface.parseError(errorData);

            console.log("✅ Decoded Error:", errorSig);
            console.log();
            console.log("Parameters:");
            for (const [key, value] of Object.entries(decoded.args)) {
                if (isNaN(key)) {  // Only show named parameters
                    if (ethers.BigNumber.isBigNumber(value)) {
                        console.log(`  ${key}:`, value.toString());
                        // Try to format as USD if it looks like a USD value
                        if (key.toLowerCase().includes('usd') || key.toLowerCase().includes('collateral')) {
                            const formatted = parseFloat(ethers.utils.formatUnits(value, 30));
                            console.log(`         => $${formatted.toFixed(2)}`);
                        }
                    } else {
                        console.log(`  ${key}:`, value);
                    }
                }
            }
            return;
        } catch (e) {
            // Try next error signature
        }
    }

    console.log("⚠️  Could not decode with common error signatures");
    console.log("Trying raw decode...");

    // Decode as raw uint256 values
    try {
        const params = ethers.utils.defaultAbiCoder.decode(
            ['uint256', 'uint256', 'uint256', 'uint256'],
            '0x' + errorData.slice(10)
        );

        console.log("\nRaw uint256 values:");
        params.forEach((param, i) => {
            console.log(`  [${i}]:`, param.toString());
            const asUsd = parseFloat(ethers.utils.formatUnits(param, 30));
            if (asUsd > 0 && asUsd < 1000000) {
                console.log(`       => $${asUsd.toFixed(2)} (if precision 30)`);
            }
        });
    } catch (e) {
        console.log("Could not decode as uint256 values");
    }
}

main().catch(console.error);
