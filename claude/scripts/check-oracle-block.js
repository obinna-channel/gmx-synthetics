const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle Block Configuration ===\n");

    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ORACLE_STORE = "0x659A3D114f45b970FdeBD05d19Ef3c697b75963B";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const oracleStore = await ethers.getContractAt("OracleStore", ORACLE_STORE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("Current Blockchain:");
    console.log("  Block Number:", currentBlock.number);
    console.log("  Block Timestamp:", currentBlock.timestamp);
    console.log("  Time:", new Date(currentBlock.timestamp * 1000).toISOString());

    // Get oracle timestamps
    console.log("\n📍 Oracle Timestamps:");
    const minTimestamp = await oracle.minTimestamp();
    const maxTimestamp = await oracle.maxTimestamp();
    console.log("  Min Timestamp:", minTimestamp.toString());
    console.log("  Max Timestamp:", maxTimestamp.toString());

    // Oracle doesn't store block numbers directly - they come from price reports
    // The oracle validates that reported block numbers are old enough
    console.log("\n📍 Oracle Block Number Requirements:")

    // Check primary prices
    console.log("\n📍 Primary Prices:");
    const usdtPrice = await oracle.primaryPrices(USDT);
    const sngnPrice = await oracle.primaryPrices(sNGN);

    console.log("  USDT:");
    console.log("    Min:", usdtPrice.min.toString());
    console.log("    Max:", usdtPrice.max.toString());

    console.log("  sNGN:");
    console.log("    Min:", sngnPrice.min.toString());
    console.log("    Max:", sngnPrice.max.toString());

    // Check MIN_ORACLE_BLOCK_CONFIRMATIONS
    const MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_BLOCK_CONFIRMATIONS"])
    );
    const minConfirmations = await dataStore.getUint(MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY);
    console.log("\n📍 MIN_ORACLE_BLOCK_CONFIRMATIONS:", minConfirmations.toString());

    // Check MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR
    const MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR"])
    );
    const maxDeviation = await dataStore.getUint(MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR_KEY);
    console.log("\n📍 MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR:", maxDeviation.toString());

    // Check if oracle providers are configured
    console.log("\n📍 Checking Oracle Provider Configuration:");
    const signerInfo0Key = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
    );
    const signerInfo0 = await oracleStore.getSignerInfo(0);
    console.log("  Signer 0:", signerInfo0);

    // Check MIN_ORACLE_SIGNERS
    const minSigners = await oracleStore.minOracleSigners();
    console.log("  MIN_ORACLE_SIGNERS:", minSigners.toString());

    // Check if any oracle provider is set
    const oracleProviderEnabled = await dataStore.getBool(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
        )
    );
    console.log("  Oracle Provider Enabled:", oracleProviderEnabled);

    console.log("\n💡 Analysis:");
    if (minConfirmations.gt(0)) {
        console.log("  ⚠️  Block confirmations required:", minConfirmations.toString());
        console.log("  This means when oracle providers submit prices,");
        console.log("  the block numbers in their reports must be at least", minConfirmations.toString(), "blocks old.");
        console.log("  Current block:", currentBlock.number);
        console.log("  Maximum acceptable oracle block:", currentBlock.number - minConfirmations.toNumber());
        console.log("\n  🔴 CRITICAL: With MIN_ORACLE_BLOCK_CONFIRMATIONS = 255,");
        console.log("     oracle prices must reference blocks that are 255+ blocks old!");
        console.log("     This is likely causing the OracleBlockNumbersAreSmallerThanRequired error.");
    } else {
        console.log("  ✅ No block confirmation requirement (MIN_ORACLE_BLOCK_CONFIRMATIONS = 0)");
    }

    // Let's also check what block number would be acceptable
    if (minConfirmations.gt(0)) {
        const acceptableBlock = currentBlock.number - minConfirmations.toNumber();
        console.log("\n📍 To fix the issue:");
        console.log("  Either:");
        console.log("  1. Set MIN_ORACLE_BLOCK_CONFIRMATIONS to 0 (for testing)");
        console.log("  2. When calling setPrices, ensure oracle block numbers are <= " + acceptableBlock);
    }
}

main().catch(console.error);