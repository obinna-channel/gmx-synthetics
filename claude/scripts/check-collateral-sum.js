const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb"; // mUSDTNGN
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const token = await ethers.getContractAt("IERC20", mUSD);

    // Get raw balance
    const rawBalance = await token.balanceOf(MARKET);

    // Get pool amount
    const POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    const poolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT, MARKET, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolKey);

    // Get collateral sum
    const COLLATERAL_SUM = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["COLLATERAL_SUM"])
    );

    const collateralLongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [COLLATERAL_SUM, MARKET, mUSD, true]
        )
    );
    const collateralLong = await dataStore.getUint(collateralLongKey);

    const collateralShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [COLLATERAL_SUM, MARKET, mUSD, false]
        )
    );
    const collateralShort = await dataStore.getUint(collateralShortKey);

    // Note: Need to divide by 2 for same-token markets
    const totalCollateral = collateralLong.add(collateralShort).div(2);

    console.log("═══════════════════════════════════════════════");
    console.log("  Collateral Analysis for mUSDTNGN");
    console.log("═══════════════════════════════════════════════");
    console.log(`Raw mUSD Balance:     ${ethers.utils.formatUnits(rawBalance, 6)} mUSD`);
    console.log(`Pool Amount:          ${ethers.utils.formatUnits(poolAmount, 6)} mUSD`);
    console.log(`Collateral Sum (Long):${ethers.utils.formatUnits(collateralLong, 6)} mUSD`);
    console.log(`Collateral Sum (Short):${ethers.utils.formatUnits(collateralShort, 6)} mUSD`);
    console.log(`Total Collateral:     ${ethers.utils.formatUnits(totalCollateral, 6)} mUSD`);
    console.log(`\nDifference (raw - pool): ${ethers.utils.formatUnits(rawBalance.sub(poolAmount), 6)} mUSD`);
    console.log(`Expected (collateral):   ${ethers.utils.formatUnits(totalCollateral, 6)} mUSD`);
    console.log(`Match: ${rawBalance.sub(poolAmount).eq(totalCollateral) ? '✅ YES' : '❌ NO'}`);
}

main().catch(console.error);
