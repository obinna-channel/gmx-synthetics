const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Listing All Deposits ===\n");
    console.log("Account:", signer.address);

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check account deposits
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer.address]
        )
    );

    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("\nTotal deposits for account:", depositCount.toString());

    if (depositCount.gt(0)) {
        const deposits = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        console.log("\nDeposit keys:");
        for (let i = 0; i < deposits.length; i++) {
            const depositKey = deposits[i];
            console.log(`\n  ${i + 1}. ${depositKey}`);
            
            // Check if this deposit still exists
            const DEPOSIT = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])
            );
            const depositDataKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "bytes32"],
                    [DEPOSIT, depositKey]
                )
            );
            
            const depositAddresses = await dataStore.getAddressArray(depositDataKey);
            if (depositAddresses.length > 0) {
                console.log(`     Status: ACTIVE`);
                console.log(`     Receiver: ${depositAddresses[1]}`);
            } else {
                console.log(`     Status: EXECUTED/CANCELLED`);
            }
        }
    }

    // Check global deposit list
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const globalDepositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
    console.log("\nTotal global deposits:", globalDepositCount.toString());

    // Check vault balances
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);
    
    console.log("\nVault state:");
    console.log("  USDT actual balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN actual balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));
    
    if (vaultUsdtBalance.gt(0) || vaultSngnBalance.gt(0)) {
        if (globalDepositCount.eq(0)) {
            console.log("\n⚠️  WARNING: Tokens in vault but no active deposits!");
            console.log("The tokens may be stuck from a failed/executed deposit.");
        }
    }
}

main().catch(console.error);