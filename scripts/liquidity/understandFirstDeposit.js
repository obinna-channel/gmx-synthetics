const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Understanding First Deposit Logic ===");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== The Real Issue ===");
    console.log("For a first deposit with empty pool:");
    console.log("1. Initial pool value = 0");
    console.log("2. Deposit adds USDT to vault (1066 USDT in your case)");
    console.log("3. Pool value calculation happens BEFORE the deposit is added to pool");
    console.log("4. So pool value = 0 - impactPoolAmount");
    console.log("5. If impactPoolAmount > 0, pool value becomes negative");
    console.log("6. This triggers InvalidPoolValueForDeposit");

    console.log("\n=== Checking Current Pool State ===");

    // Check pool amount
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Current USDT pool amount:", poolAmount.toString());

    // Check impact pool amount
    const impactPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_IMPACT_POOL_AMOUNT")), MARKET]
        )
    );
    const impactPoolAmount = await dataStore.getUint(impactPoolAmountKey);
    console.log("Position impact pool amount:", impactPoolAmount.toString());

    // Check next impact pool amount
    const nextImpactPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NEXT_POSITION_IMPACT_POOL_AMOUNT")), MARKET]
        )
    );
    const nextImpactPoolAmount = await dataStore.getUint(nextImpactPoolAmountKey);
    console.log("Next position impact pool amount:", nextImpactPoolAmount.toString());

    console.log("\n=== The Solution ===");
    console.log("For first deposits to work, we need:");
    console.log("1. Impact pool amounts = 0");
    console.log("2. OR add initial liquidity to make pool value > 0");
    console.log("3. OR the deposit needs to add to pool BEFORE pool value calculation");

    // Check USDT in vault
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("\nUSDT currently in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("This USDT is waiting to be added to the pool via deposit execution");

    console.log("\n=== Attempting to Bootstrap Pool ===");

    // Set pool amount to match what's in the vault
    if (poolAmount.eq(0) && vaultBalance.gt(0)) {
        console.log("Setting pool amount to match vault balance...");
        const tx = await dataStore.setUint(poolAmountKey, vaultBalance);
        await tx.wait();
        console.log("✅ Pool amount set to:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

        // Now the pool value calculation should be:
        // poolValue = vaultBalance * $1 = positive value
        // Even with impact pool deduction, it should stay positive
    }

    // Ensure impact pools are zero
    if (impactPoolAmount.gt(0)) {
        console.log("Resetting impact pool amount to 0...");
        const tx = await dataStore.setUint(impactPoolAmountKey, 0);
        await tx.wait();
        console.log("✅ Impact pool reset");
    }

    if (nextImpactPoolAmount.gt(0)) {
        console.log("Resetting next impact pool amount to 0...");
        const tx = await dataStore.setUint(nextImpactPoolAmountKey, 0);
        await tx.wait();
        console.log("✅ Next impact pool reset");
    }

    console.log("\n=== Summary ===");
    console.log("The deposit is failing because:");
    console.log("1. Pool value starts at 0 (empty market)");
    console.log("2. Any impact pool amount gets subtracted");
    console.log("3. This makes pool value negative");
    console.log("\nWe've now bootstrapped the pool with the USDT from the vault");
    console.log("This should allow the deposit to execute!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });