const { ethers } = require("hardhat");

async function main() {
    console.log("=== UNDERSTANDING DEPOSIT STORAGE ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    
    // Check vault balance
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("DepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    
    // Check if there's a recorded amount for the user
    const [deployer] = await ethers.getSigners();
    
    // The deposit system tracks amounts per account
    const accountDepositKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["string", "address", "address"],
            ["ACCOUNT_DEPOSIT_AMOUNT", deployer.address, USDT]
        )
    );
    
    const recordedAmount = await dataStore.getUint(accountDepositKey);
    console.log("Recorded deposit amount for account:", recordedAmount.toString());
    
    // The issue is that sendTokens just moves tokens to the vault
    // but doesn't record the deposit amount for the account
    
    console.log("\nThe workflow should be:");
    console.log("1. Send tokens to DepositVault ✓ (we did this)");
    console.log("2. Record the amount for the account ✗ (missing)");
    console.log("3. Create the deposit order ✗ (fails because no amount recorded)");
    
    console.log("\nWe need to call a different function that records the amount!");
}

main().catch(console.error);
