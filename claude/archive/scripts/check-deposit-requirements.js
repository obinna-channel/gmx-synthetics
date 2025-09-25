const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING DEPOSIT REQUIREMENTS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("1. Checking if deposits are enabled globally...");
    const isDepositDisabledKey = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("IS_DEPOSIT_DISABLED")
    );
    const depositsDisabled = await dataStore.getBool(isDepositDisabledKey);
    console.log("   Deposits disabled globally:", depositsDisabled);
    
    console.log("\n2. Checking if market deposits are enabled...");
    const isMarketDisabledKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["IS_MARKET_DISABLED", MARKET])
    );
    const marketDisabled = await dataStore.getBool(isMarketDisabledKey);
    console.log("   Market disabled:", marketDisabled);
    
    console.log("\n3. Checking max deposit amounts...");
    const maxLongDepositKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address", "address"], ["MAX_DEPOSIT_AMOUNT", MARKET, USDT])
    );
    const maxDeposit = await dataStore.getUint(maxLongDepositKey);
    console.log("   Max USDT deposit:", maxDeposit.toString());
    
    console.log("\n4. Checking deposit fees...");
    const depositFeeKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["DEPOSIT_FEE", MARKET])
    );
    const depositFee = await dataStore.getUint(depositFeeKey);
    console.log("   Deposit fee:", depositFee.toString());
    
    console.log("\n5. Checking min collateral...");
    const minCollateralKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MIN_COLLATERAL_USD", MARKET])
    );
    const minCollateral = await dataStore.getUint(minCollateralKey);
    console.log("   Min collateral USD:", minCollateral.toString());
    
    console.log("\n6. Checking if single-token deposits allowed...");
    const allowSingleKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["ALLOW_SINGLE_SIDED_DEPOSIT", MARKET])
    );
    const allowSingle = await dataStore.getBool(allowSingleKey);
    console.log("   Single-sided deposits allowed:", allowSingle);
    
    // Check if we need both tokens
    console.log("\n7. Checking market token configuration...");
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", MARKET])
    );
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["SHORT_TOKEN", MARKET])
    );
    
    const longToken = await dataStore.getAddress(longTokenKey);
    const shortToken = await dataStore.getAddress(shortTokenKey);
    
    console.log("   Long token:", longToken);
    console.log("   Short token:", shortToken);
    console.log("   Same token market:", longToken === shortToken);
    
    if (maxDeposit.eq(0)) {
        console.log("\n⚠️  Max deposit is 0! Need to set max deposit amount.");
    }
    
    if (!allowSingle && longToken !== shortToken) {
        console.log("\n⚠️  Single-sided deposits not allowed for this market!");
        console.log("     Need to deposit both long and short tokens.");
    }
}

main().catch(console.error);
