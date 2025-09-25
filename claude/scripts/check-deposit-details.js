const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Details ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const depositKey = "0x4ffbc318404c90ca995a37aa52f2574ac8bf9f711bbb4de730da7a8fdc27272a";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Check if deposit exists
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
    const depositNumbers = await dataStore.getUintArray(depositDataKey);

    if (depositAddresses.length > 0) {
        console.log("Deposit found with key:", depositKey);
        console.log("\nDeposit details:");
        console.log("  Account:", depositAddresses[0]);
        console.log("  Receiver:", depositAddresses[1]);
        console.log("  Market:", depositAddresses[4]);
        console.log("  Initial Long Token:", depositAddresses[5]);
        console.log("  Initial Short Token:", depositAddresses[6]);
        
        if (depositNumbers.length > 0) {
            console.log("\nDeposit amounts:");
            console.log("  Long Token Amount:", depositNumbers[0]?.toString() || "0");
            console.log("  Short Token Amount:", depositNumbers[1]?.toString() || "0");
            console.log("  Execution Fee:", depositNumbers[4] ? ethers.utils.formatEther(depositNumbers[4]) : "0");
            const updatedAt = depositNumbers[3];
            if (updatedAt) {
                const currentTime = Math.floor(Date.now() / 1000);
                const age = currentTime - updatedAt.toNumber();
                console.log("  Created at:", new Date(updatedAt.toNumber() * 1000).toISOString());
                console.log("  Age:", age, "seconds");
            }
        }

        // Check min cancellation delay
        const MIN_CANCELLATION_DELAY_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_CANCELLATION_DELAY"])
        );
        const minCancellationDelay = await dataStore.getUint(MIN_CANCELLATION_DELAY_KEY);
        console.log("\nMin cancellation delay:", minCancellationDelay.toString(), "seconds");
        
        if (depositNumbers[3] && minCancellationDelay.gt(0)) {
            const currentTime = Math.floor(Date.now() / 1000);
            const depositAge = currentTime - depositNumbers[3].toNumber();
            if (depositAge < minCancellationDelay.toNumber()) {
                console.log("\n⚠️  WARNING: Deposit cannot be cancelled yet!");
                console.log("  Must wait:", minCancellationDelay.toNumber() - depositAge, "more seconds");
            } else {
                console.log("\n✅ Deposit can be cancelled (age > min delay)");
            }
        }
    } else {
        console.log("❌ No deposit found with key:", depositKey);
        console.log("The deposit may have been executed or cancelled already.");
    }

    // Check vault balances
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    
    console.log("\nVault balances:");
    console.log("  USDT:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(vaultSngnBalance, 18));
}

main().catch(console.error);