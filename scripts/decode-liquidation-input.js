const { ethers } = require("hardhat");

async function main() {
    // The input data from the failed transaction
    const inputData = "0x109ebc490000000000000000000000000e64500a73ca057f6a002b55757ecc1df31bfbfd0000000000000000000000008ae559448a1482faffc925ef6a233276588348df00000000000000000000000085bf04b07a6df0172372b959c1c73f3e90f73faf000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000200000000000000000000000077d4ddd2e847592fb7710e342c0492a4b85655f400000000000000000000000085bf04b07a6df0172372b959c1c73f3e90f73faf00000000000000000000000000000000000000000000000000000000000000020000000000000000000000005d85d4acd35ffd0dad76c5eb0da3d7e53e20ccc50000000000000000000000005d85d4acd35ffd0dad76c5eb0da3d7e53e20ccc50000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000170a9e6c27c00000000000000000000000000000000000000000000000000000170a9e6c27c00000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000d3c21bcecceda100000000000000000000000000000000000000000000000000d3c21bcecceda1000000";

    console.log("=== Decoding Liquidation Input Data ===\n");

    // Function signature: executeLiquidation(address,address,address,bool,(address[],address[],bytes[]))
    const functionInterface = new ethers.utils.Interface([
        "function executeLiquidation(address account, address market, address collateralToken, bool isLong, tuple(address[] tokens, address[] providers, bytes[] data) oracleParams)"
    ]);

    try {
        const decoded = functionInterface.parseTransaction({ data: inputData });

        console.log("Function:", decoded.name);
        console.log();

        console.log("📊 Parameters:");
        console.log();

        console.log("1. Account:", decoded.args.account);
        console.log("2. Market:", decoded.args.market);
        console.log("3. Collateral Token:", decoded.args.collateralToken);
        console.log("4. Is Long:", decoded.args.isLong);
        console.log();

        console.log("5. Oracle Params:");
        const oracleParams = decoded.args.oracleParams;

        console.log("\n   Tokens:");
        for (let i = 0; i < oracleParams.tokens.length; i++) {
            console.log(`     [${i}] ${oracleParams.tokens[i]}`);
        }

        console.log("\n   Providers:");
        for (let i = 0; i < oracleParams.providers.length; i++) {
            console.log(`     [${i}] ${oracleParams.providers[i]}`);
        }

        console.log("\n   Data (encoded prices):");
        for (let i = 0; i < oracleParams.data.length; i++) {
            console.log(`     [${i}] ${oracleParams.data[i]}`);

            // Try to decode as (uint256, uint256) for min/max prices
            try {
                const decoded = ethers.utils.defaultAbiCoder.decode(
                    ['uint256', 'uint256'],
                    oracleParams.data[i]
                );
                console.log(`         Min: ${decoded[0].toString()}`);
                console.log(`         Max: ${decoded[1].toString()}`);

                // Convert to human-readable
                // Token 0 is likely index token (12 decimals for stocks)
                // Token 1 is likely mUSD (24 decimals)
                if (i === 0) {
                    const price = parseFloat(ethers.utils.formatUnits(decoded[0], 12));
                    console.log(`         => $${price.toFixed(2)} (assuming 12 decimals)`);
                } else if (i === 1) {
                    const price = parseFloat(ethers.utils.formatUnits(decoded[0], 24));
                    console.log(`         => $${price.toFixed(2)} (assuming 24 decimals)`);
                }
            } catch (e) {
                console.log("         (Could not decode)");
            }
        }

        console.log("\n" + "=".repeat(80));
        console.log("\n📝 Summary:\n");

        console.log("Attempting to liquidate:");
        console.log(`  Account: ${decoded.args.account}`);
        console.log(`  Market: ${decoded.args.market} (TSLA)`);
        console.log(`  Position: ${decoded.args.isLong ? 'LONG' : 'SHORT'}`);
        console.log(`  Collateral Token: ${decoded.args.collateralToken} (mUSD)`);
        console.log();
        console.log(`  Tokens in oracle params: ${oracleParams.tokens.length}`);
        console.log(`  Providers in oracle params: ${oracleParams.providers.length}`);
        console.log(`  Data entries in oracle params: ${oracleParams.data.length}`);

    } catch (error) {
        console.log("❌ Error decoding:", error.message);
    }
}

main().catch(console.error);
