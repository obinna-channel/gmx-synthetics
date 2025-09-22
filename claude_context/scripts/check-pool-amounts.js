const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING POOL AMOUNTS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    
    // Check actual pool amount stored
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address", "address"],
            [ethers.utils.id("POOL_AMOUNT"), MARKET, USDT]
        )
    );
    
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Current POOL_AMOUNT for USDT:", poolAmount.toString());
    console.log("In USDT:", ethers.utils.formatUnits(poolAmount, 6));
    
    // Check vault balance
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("\nDepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    
    if (poolAmount.eq(0)) {
        console.log("\n❌ CRITICAL: Pool amount is 0!");
        console.log("This is likely why deposits are failing.");
        console.log("\nIn GMX v2, the pool needs initial liquidity before deposits can work.");
        console.log("The first deposit might need special handling or the pool needs seeding.");
        
        // Check if there's a minimum pool amount requirement
        const minPoolAmountKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "address"],
                [ethers.utils.id("MIN_POOL_AMOUNT"), MARKET]
            )
        );
        const minPoolAmount = await dataStore.getUint(minPoolAmountKey);
        console.log("\nMIN_POOL_AMOUNT:", minPoolAmount.toString());
    }
    
    // Check if market has ever had liquidity
    const marketTokenSupplyKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.id("MARKET_TOKEN_SUPPLY"), MARKET]
        )
    );
    const marketTokenSupply = await dataStore.getUint(marketTokenSupplyKey);
    console.log("\nMarket token supply:", marketTokenSupply.toString());
    
    if (marketTokenSupply.eq(0)) {
        console.log("No market tokens have been minted yet.");
        console.log("This is a virgin market that needs initial seeding.");
    }
}

main().catch(console.error);
