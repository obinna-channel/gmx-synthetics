const { ethers } = require("hardhat");
const axios = require("axios");

async function main() {
    const LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B";
    const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const TSLA_MARKET = "0x8ae559448a1482faffC925eF6a233276588348Df";
    const mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const TARGET_ACCOUNT = "0x702ed966717452CFFfd97101C243F6018ee3b9E2";
    const IS_LONG = true;

    console.log("=== Liquidating TSLA LONG Position ===\n");
    console.log("Account:", TARGET_ACCOUNT);
    console.log("Market: TSLA");
    console.log("Side: LONG\n");

    const [signer] = await ethers.getSigners();
    console.log("Liquidating with account:", signer.address);
    console.log();

    const liquidationHandler = await ethers.getContractAt("LiquidationHandler", LIQUIDATION_HANDLER);
    const mockProviderAbi = ["function setPriceWithPrecision(address token, uint256 price) external"];
    const mockProvider = new ethers.Contract(MOCK_ORACLE_PROVIDER, mockProviderAbi, signer);

    const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
    let tslaPrice;

    console.log("📊 Fetching current TSLA price from marks-server...");
    try {
        const priceResponse = await axios.get(`${PRICE_SERVER}/api/v1/price/current/TSLA`, { timeout: 10000 });
        tslaPrice = priceResponse.data.price;
        console.log(`   Current TSLA Price: $${tslaPrice}\n`);
    } catch (error) {
        console.log(`   ❌ Failed to fetch price from server: ${error.message}`);
        return;
    }

    console.log("📝 Step 1: Updating prices in MockOracleProvider...\n");
    const indexPrice = ethers.BigNumber.from(Math.floor(tslaPrice * 1e12));
    const stablePrice = ethers.BigNumber.from("1000000000000000000000000");

    try {
        const updateTx1 = await mockProvider.setPriceWithPrecision(mTSLA, indexPrice, { gasLimit: 200000 });
        await updateTx1.wait();
        console.log(`   ✅ mTSLA price updated`);

        const updateTx2 = await mockProvider.setPriceWithPrecision(mUSD, stablePrice, { gasLimit: 200000 });
        await updateTx2.wait();
        console.log(`   ✅ mUSD price updated\n`);
    } catch (error) {
        console.log(`   ❌ Error updating prices: ${error.message}`);
        return;
    }

    console.log("📝 Step 2: Building oracle parameters...\n");
    const oracleParams = {
        tokens: [mTSLA, mUSD],
        providers: [MOCK_ORACLE_PROVIDER, MOCK_ORACLE_PROVIDER],
        data: [
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [indexPrice, indexPrice]),
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [stablePrice, stablePrice])
        ]
    };

    console.log("📝 Step 3: Executing liquidation...\n");

    try {
        const gasEstimate = await liquidationHandler.estimateGas.executeLiquidation(
            TARGET_ACCOUNT, TSLA_MARKET, mUSD, IS_LONG, oracleParams
        );
        const gasLimit = gasEstimate.mul(120).div(100);

        const tx = await liquidationHandler.executeLiquidation(
            TARGET_ACCOUNT, TSLA_MARKET, mUSD, IS_LONG, oracleParams,
            { gasLimit: gasLimit }
        );

        console.log(`   📤 Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`   ✅ LIQUIDATION SUCCESSFUL!`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`   View: https://sepolia.arbiscan.io/tx/${tx.hash}`);
        } else {
            console.log(`   ❌ Transaction failed`);
        }
    } catch (error) {
        console.log(`   ❌ Liquidation failed: ${error.message}`);
        if (error.reason) console.log(`   Reason: ${error.reason}`);
        if (error.data) {
            console.log(`   Error data: ${error.data}`);
            // Try to decode
            try {
                const selector = error.data.slice(0, 10);
                if (selector !== '0x' && error.data.length > 10) {
                    const params = ethers.utils.defaultAbiCoder.decode(
                        ['bytes32', 'uint256', 'uint256', 'uint256'],
                        '0x' + error.data.slice(10)
                    );
                    console.log(`\n   Decoded Error:`);
                    console.log(`      Position Key: ${params[0]}`);
                    console.log(`      Remaining Collateral: $${ethers.utils.formatUnits(params[1], 30)}`);
                    console.log(`      Min Collateral: $${ethers.utils.formatUnits(params[2], 30)}`);
                    console.log(`      Min for Leverage: $${ethers.utils.formatUnits(params[3], 30)}`);
                }
            } catch (e) {
                // Ignore decode errors
            }
        }
    }
}

main().catch(console.error);
