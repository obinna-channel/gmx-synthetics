const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING DEPOSIT WITH CORRECT STRUCTURE ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
    };

    const [deployer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);

    // Check vault balance
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    
    if (vaultBalance.eq(0)) {
        console.log("Vault is empty, skipping deposit creation");
        return;
    }

    // Correct CreateDepositParams structure
    const depositParams = {
        addresses: {
            receiver: deployer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ethers.constants.AddressZero,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []  // Empty bytes32 array
    };

    try {
        console.log("\nCreating deposit...");
        console.log("  Market:", ADDRESSES.MARKET);
        console.log("  Long token (USDT):", ADDRESSES.USDT);
        console.log("  Receiver:", deployer.address);
        
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            { value: ethers.utils.parseEther("0.001") }
        );
        
        console.log("Transaction sent, waiting for confirmation...");
        const receipt = await tx.wait();
        
        console.log("\n✅ Deposit created successfully!");
        console.log("  Transaction hash:", receipt.transactionHash);
        console.log("  Gas used:", receipt.gasUsed.toString());
        
        // Find the DepositCreated event
        for (const event of receipt.events || []) {
            if (event.event === "DepositCreated") {
                console.log("\nDeposit Created Event:");
                console.log("  Key:", event.args.key);
                console.log("  Account:", event.args.account);
                break;
            }
        }
        
    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.reason || error.message);
        
        if (error.error && error.error.data) {
            console.log("Raw error data:", error.error.data);
        }
    }
}

main().catch(console.error);
