const { ethers } = require("hardhat");
const axios = require("axios");

async function main() {
    // Contract addresses
    const LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B";
    const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Market and token addresses for TSLA
    const TSLA_MARKET = "0x8ae559448a1482faffC925eF6a233276588348Df";
    const mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    // Target position
    const TARGET_ACCOUNT = "0x0E64500a73Ca057f6a002b55757EcC1Df31BfBfD";
    const IS_LONG = false; // SHORT position

    console.log("=== Liquidating TSLA SHORT Position ===\n");
    console.log("Account:", TARGET_ACCOUNT);
    console.log("Market: TSLA");
    console.log("Side: SHORT\n");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Liquidating with account:", signer.address);
    console.log();

    // Get contracts
    const liquidationHandler = await ethers.getContractAt("LiquidationHandler", LIQUIDATION_HANDLER);

    // MockOracleProvider ABI
    const mockProviderAbi = [
        "function setPriceWithPrecision(address token, uint256 price) external"
    ];
    const mockProvider = new ethers.Contract(MOCK_ORACLE_PROVIDER, mockProviderAbi, signer);

    // Fetch current TSLA price from marks-server
    const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
    let tslaPrice;

    console.log("📊 Fetching current TSLA price from marks-server...");
    try {
        const priceResponse = await axios.get(`${PRICE_SERVER}/api/v1/price/current/TSLA`, {
            timeout: 10000
        });
        tslaPrice = priceResponse.data.price;
        console.log(`   Current TSLA Price: $${tslaPrice}\n`);
    } catch (error) {
        console.log(`   ❌ Failed to fetch price from server: ${error.message}`);
        console.log(`   Cannot proceed without valid price data!`);
        return;
    }

    // Step 1: Update prices in MockOracleProvider
    console.log("📝 Step 1: Updating prices in MockOracleProvider...\n");

    // For TSLA stock market (single-token with mUSD/mUSD):
    // - indexToken (mTSLA): int(price * 10^12) - precision 30-18=12
    // - longToken/shortToken (mUSD): 1 * 10^24 - precision 30-6=24
    const indexPrice = ethers.BigNumber.from(Math.floor(tslaPrice * 1e12));
    const stablePrice = ethers.BigNumber.from("1000000000000000000000000"); // 1 * 10^24

    console.log(`   mTSLA price: ${indexPrice.toString()} (precision 12)`);
    console.log(`   mUSD price: ${stablePrice.toString()} (precision 24)\n`);

    try {
        console.log(`   ⏳ Updating mTSLA price...`);
        const updateTx1 = await mockProvider.setPriceWithPrecision(mTSLA, indexPrice, {
            gasLimit: 200000
        });
        await updateTx1.wait();
        console.log(`   ✅ mTSLA price updated (tx: ${updateTx1.hash})`);

        console.log(`   ⏳ Updating mUSD price...`);
        const updateTx2 = await mockProvider.setPriceWithPrecision(mUSD, stablePrice, {
            gasLimit: 200000
        });
        await updateTx2.wait();
        console.log(`   ✅ mUSD price updated (tx: ${updateTx2.hash})\n`);
    } catch (error) {
        console.log(`   ❌ Error updating prices: ${error.message}`);
        if (error.reason) console.log(`   Reason: ${error.reason}`);
        console.log("\n⚠️  Cannot proceed without updated prices!");
        return;
    }

    // Step 2: Build oracle params
    console.log("📝 Step 2: Building oracle parameters...\n");

    // Deduplicated tokens: indexToken (mTSLA), longToken (mUSD)
    // shortToken is also mUSD, so it's deduplicated
    const oracleParams = {
        tokens: [mTSLA, mUSD],
        providers: [MOCK_ORACLE_PROVIDER, MOCK_ORACLE_PROVIDER],
        data: [
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [indexPrice, indexPrice]),
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [stablePrice, stablePrice])
        ]
    };

    console.log("   Tokens:", oracleParams.tokens);
    console.log("   Providers:", oracleParams.providers);
    console.log();

    // Step 3: Execute liquidation
    console.log("📝 Step 3: Executing liquidation...\n");

    try {
        // Estimate gas first
        console.log("   ⏳ Estimating gas...");
        const gasEstimate = await liquidationHandler.estimateGas.executeLiquidation(
            TARGET_ACCOUNT,
            TSLA_MARKET,
            mUSD,
            IS_LONG,
            oracleParams
        );
        console.log(`   Gas estimate: ${gasEstimate.toString()}`);

        // Add 20% buffer
        const gasLimit = gasEstimate.mul(120).div(100);
        console.log(`   Gas limit (with 20% buffer): ${gasLimit.toString()}\n`);

        // Execute liquidation
        console.log("   ⚡ Submitting liquidation transaction...");
        const tx = await liquidationHandler.executeLiquidation(
            TARGET_ACCOUNT,
            TSLA_MARKET,
            mUSD,
            IS_LONG,
            oracleParams,
            { gasLimit: gasLimit }
        );

        console.log(`   📤 Transaction submitted: ${tx.hash}`);
        console.log(`   ⏳ Waiting for confirmation...\n`);

        // Wait for confirmation
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`   ✅ LIQUIDATION SUCCESSFUL!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`   View on Arbiscan: https://sepolia.arbiscan.io/tx/${tx.hash}`);
        } else {
            console.log(`   ❌ Transaction failed (status: ${receipt.status})`);
        }

    } catch (error) {
        console.log(`   ❌ Liquidation failed!`);
        console.log(`   Error: ${error.message}`);

        if (error.reason) {
            console.log(`   Reason: ${error.reason}`);
        }

        // Try to decode error data
        if (error.error && error.error.data) {
            console.log(`   Error data: ${error.error.data}`);
        }
    }

    console.log("\n" + "=".repeat(80));
}

main().catch(console.error);
