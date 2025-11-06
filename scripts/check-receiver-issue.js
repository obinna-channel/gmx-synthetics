const { ethers } = require("hardhat");

async function main() {
    const account = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const collateralToken = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    
    console.log("=== Checking Why Transfer Failed ===\n");
    
    // Check if the account is a contract
    const code = await ethers.provider.getCode(account);
    const isContract = code !== "0x";
    
    console.log("Account:", account);
    console.log("Is Contract:", isContract);
    console.log("Code Length:", code.length);
    
    if (isContract) {
        console.log("\n⚠️  The account is a smart contract!");
        console.log("This could fail token transfers if:");
        console.log("  1. The contract doesn't have a receive/fallback function");
        console.log("  2. The contract's receive function reverts");
        console.log("  3. The contract's receive function uses too much gas");
        console.log("  4. The contract is a token that doesn't accept other tokens");
    } else {
        console.log("\n✓ The account is an EOA (Externally Owned Account)");
        console.log("  Transfer should normally work for EOAs");
    }
    
    // Check the token
    const token = await ethers.getContractAt("IERC20", collateralToken);
    console.log("\nCollateral Token:", collateralToken);
    
    try {
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log("Token Symbol:", symbol);
        console.log("Token Decimals:", decimals);
        
        // Check token balance of account
        const balance = await token.balanceOf(account);
        console.log("Account Token Balance:", ethers.utils.formatUnits(balance, decimals));
    } catch (e) {
        console.log("Could not read token details:", e.message);
    }
    
    // Check the DataStore for holding address
    const dataStoreAddress = "0xD4e917e95BFBcdb12a50E842C4fE80Ba81FD1e89";
    const dataStore = await ethers.getContractAt("DataStore", dataStoreAddress);
    
    const holdingAddressKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("HOLDING_ADDRESS"));
    const holdingAddress = await dataStore.getAddress(holdingAddressKey);
    
    console.log("\n=== DataStore Configuration ===");
    console.log("Holding Address Key:", holdingAddressKey);
    console.log("Holding Address:", holdingAddress);
    
    if (holdingAddress === ethers.constants.AddressZero) {
        console.log("\n❌ HOLDING ADDRESS IS NOT SET!");
        console.log("This is why you're getting the EmptyHoldingAddress error.");
    } else {
        console.log("\n✓ Holding address is configured");
    }
    
    // Check token transfer gas limit
    const tokenTransferGasLimitKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TOKEN_TRANSFER_GAS_LIMIT")), collateralToken]
        )
    );
    
    const gasLimit = await dataStore.getUint(tokenTransferGasLimitKey);
    console.log("\nToken Transfer Gas Limit:", gasLimit.toString());
    
    if (gasLimit.eq(0)) {
        console.log("⚠️  Gas limit is 0 - this will cause issues!");
    }
}

main().catch(console.error);
