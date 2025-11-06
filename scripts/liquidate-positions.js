const { ethers } = require("hardhat");
const axios = require("axios");

async function main() {
    // Contract addresses (from order_keeper_v2.py)
    const LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B";
    const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    // Market and token addresses
    const USDTARS_MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSDTARS_INDEX = "0xed6890bE2409F0db06a00C809a298E2E06553BE1";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // Collateral token

    // Positions to liquidate
    const positions = [
        {
            account: "0x0D7F7fe4b4B01293482a535737d1909E166d30Da",
            market: USDTARS_MARKET,
            collateralToken: mUSD,
            isLong: false, // SHORT position
            name: "Position 1"
        },
        {
            account: "0x49e082bdda2865A36eD2294819d3C214709CdBAA",
            market: USDTARS_MARKET,
            collateralToken: mUSD,
            isLong: false, // SHORT position
            name: "Position 2 (Your Account)"
        }
    ];

    console.log("=== Liquidating Positions ===\n");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Liquidating with account:", signer.address);

    // Get contracts
    const liquidationHandler = await ethers.getContractAt("LiquidationHandler", LIQUIDATION_HANDLER);

    // MockOracleProvider ABI - use setPriceWithPrecision like the keeper
    const mockProviderAbi = [
        "function setPriceWithPrecision(address token, uint256 price) external"
    ];
    const mockProvider = new ethers.Contract(MOCK_ORACLE_PROVIDER, mockProviderAbi, signer);

    // Fetch current price
    const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
    const priceResponse = await axios.get(`${PRICE_SERVER}/api/v1/price/current/USDTARS`);
    const currentPrice = priceResponse.data.price;
    console.log(`Current USDTARS Price: $${currentPrice}\n`);

    // Step 1: Update prices in MockOracleProvider (EXACTLY as keeper does it)
    console.log("📝 Step 1: Updating prices in MockOracleProvider...\n");

    // For single-token market (USDTARS with mUSD/mUSD):
    // - indexToken: int(price * 10^12)
    // - longToken/shortToken: 1 * 10^24
    const indexPrice = ethers.BigNumber.from(Math.floor(currentPrice * 10**12));
    const stablePrice = ethers.BigNumber.from("1000000000000000000000000"); // 1 * 10^24

    try {
        const updateTx1 = await mockProvider.setPriceWithPrecision(mUSDTARS_INDEX, indexPrice);
        console.log(`   ⏳ Updating ${mUSDTARS_INDEX} (mUSDTARS) to ${indexPrice.toString()}...`);
        await updateTx1.wait();
        console.log(`   ✅ mUSDTARS price updated`);

        const updateTx2 = await mockProvider.setPriceWithPrecision(mUSD, stablePrice);
        console.log(`   ⏳ Updating ${mUSD} (mUSD) to ${stablePrice.toString()}...`);
        await updateTx2.wait();
        console.log(`   ✅ mUSD price updated\n`);
    } catch (error) {
        console.log(`   ❌ Error updating prices: ${error.message}\n`);
        return;
    }

    // Step 2: Build oracle params using MockOracleProvider (matching keeper format)
    const oracleParams = {
        tokens: [mUSDTARS_INDEX, mUSD],  // Deduplicated: indexToken, longToken (mUSD only once since long==short)
        providers: [MOCK_ORACLE_PROVIDER, MOCK_ORACLE_PROVIDER],
        data: [
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [indexPrice, indexPrice]),  // min, max for index
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [stablePrice, stablePrice])  // min, max for mUSD
        ]
    };

    console.log("📝 Step 2: Executing liquidations...\n");

    for (const position of positions) {
        console.log(`📍 Liquidating ${position.name}:`);
        console.log(`   Account: ${position.account}`);
        console.log(`   Market: ${position.market}`);
        console.log(`   Side: ${position.isLong ? 'LONG' : 'SHORT'}`);

        try {
            // Execute liquidation
            const tx = await liquidationHandler.executeLiquidation(
                position.account,
                position.market,
                position.collateralToken,
                position.isLong,
                oracleParams,
                { gasLimit: 5000000 }  // Match keeper's gas limit
            );

            console.log(`   ⏳ Transaction submitted: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`   ✅ Liquidation executed! Gas used: ${receipt.gasUsed.toString()}`);
            console.log();

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            if (error.reason) {
                console.log(`   Reason: ${error.reason}`);
            }
            console.log();
        }
    }

    console.log("=== Liquidation Complete ===");
}

main().catch(console.error);
