const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x0636d3255bc9cdaef52c30003e3d7497cc25ca88620ad5088b75812ba193e078";
    console.log("=== Tracing Decrease Order Execution ===\n");
    console.log("Transaction:", TX_HASH);

    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
    
    // Contract addresses
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const ORDER_VAULT = "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F";
    const DEPOSIT_VAULT = "0xfC427E0B0DE2e44693EC72CFAc8bC9501F5d0565";
    const WITHDRAWAL_VAULT = "0xDB2AB1D4c87D01BeaD587c0b5a046b6c8E3217ba";
    const account = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";

    console.log("\n📊 Looking for USDT transfers in the transaction:");
    
    // ERC20 Transfer event signature
    const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");
    
    let foundTransfers = false;
    
    for (const log of receipt.logs) {
        // Check if it's a Transfer event from USDT
        if (log.address.toLowerCase() === USDT.toLowerCase() && 
            log.topics[0] === TRANSFER_SIG) {
            
            foundTransfers = true;
            const from = '0x' + log.topics[1].slice(-40);
            const to = '0x' + log.topics[2].slice(-40);
            const amount = ethers.BigNumber.from(log.data);
            
            console.log("\n💸 USDT Transfer:");
            console.log("  From:", from);
            console.log("  To:", to);
            console.log("  Amount:", ethers.utils.formatUnits(amount, 6), "USDT");
            
            // Identify the addresses
            if (from.toLowerCase() === account.toLowerCase()) {
                console.log("  (Your wallet → somewhere)");
            }
            if (to.toLowerCase() === account.toLowerCase()) {
                console.log("  (Somewhere → YOUR WALLET) ✅");
            }
            if (to.toLowerCase() === ORDER_VAULT.toLowerCase()) {
                console.log("  (To OrderVault)");
            }
            if (from.toLowerCase() === ORDER_VAULT.toLowerCase()) {
                console.log("  (From OrderVault)");
            }
            if (to.toLowerCase() === DEPOSIT_VAULT.toLowerCase()) {
                console.log("  (To DepositVault)");
            }
            if (to.toLowerCase() === WITHDRAWAL_VAULT.toLowerCase()) {
                console.log("  (To WithdrawalVault)");
            }
        }
    }
    
    if (!foundTransfers) {
        console.log("❌ No USDT transfers found in this transaction!");
        console.log("\nThis means the decrease didn't actually withdraw any collateral.");
    }

    // Also check for any WithdrawalCreated events
    console.log("\n\n📋 Checking for withdrawal events:");
    
    const WITHDRAWAL_CREATED = ethers.utils.id("WithdrawalCreated");
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    
    for (const log of receipt.logs) {
        if (log.topics[0] === EVENT_LOG2_SIG && 
            log.topics[1] === WITHDRAWAL_CREATED) {
            console.log("✅ WithdrawalCreated event found!");
            console.log("  Key:", log.topics[2]);
            console.log("\n  💡 A withdrawal was created but needs to be executed separately!");
            return;
        }
    }
    
    console.log("❌ No withdrawal events found either.");
    
    console.log("\n\n💡 Conclusion:");
    console.log("The decrease order reduced your position size but did NOT:");
    console.log("1. Transfer any USDT back to you");
    console.log("2. Create a withdrawal for you to claim");
    console.log("\nThe collateral remains locked in the position.");
    console.log("You now have a smaller position with the same collateral (lower leverage).");
}

main().catch(console.error);
