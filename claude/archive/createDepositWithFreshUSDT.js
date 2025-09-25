const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING ACTUAL DEPOSIT WITH FRESH USDT ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    console.log("=== CURRENT STATE ===");
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Vault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("(Including fresh 100 USDT we just transferred)\n");

    console.log("=== CREATING DEPOSIT ===");

    // Exact params that worked in simulation
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,  // Both USDT - critical!
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // Zero fee - critical!
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Parameters:");
    console.log("- Market:", ADDRESSES.MARKET);
    console.log("- Both tokens: USDT");
    console.log("- Execution fee: 0");
    console.log("- Using fresh 100 USDT in vault\n");

    try {
        console.log("Sending transaction...");
        const createTx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: 0,  // No ETH
                gasLimit: 1000000
            }
        );

        console.log("✅ Transaction sent!");
        console.log("Tx hash:", createTx.hash);
        console.log("\nWaiting for confirmation...");

        const receipt = await createTx.wait();

        console.log("\n🎉 🎉 🎉 DEPOSIT CREATED SUCCESSFULLY! 🎉 🎉 🎉");
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");

        // Extract deposit key
        console.log("\n=== EXTRACTING DEPOSIT KEY ===");

        let depositKey;

        // Method 1: Look for EventLog2 with DepositCreated (as per DEPOSIT_ISSUE_UPDATE)
        const eventLog2Topic = ethers.utils.id("EventLog2(address,address,string,bytes32,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))");
        const depositCreatedHash = ethers.utils.id("DepositCreated");

        for (const log of receipt.logs) {
            if (log.topics[0] === eventLog2Topic && log.topics.length >= 3) {
                if (log.topics[2] === depositCreatedHash) {
                    depositKey = log.topics[1];
                    console.log("✅ Deposit key found (EventLog2 method):", depositKey);
                    break;
                }
            }
        }

        // Method 2: If not found, try direct DepositCreated event
        if (!depositKey) {
            const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
            for (const log of receipt.logs) {
                if (log.topics[0] === depositCreatedTopic) {
                    depositKey = log.topics[1];
                    console.log("✅ Deposit key found (direct event):", depositKey);
                    break;
                }
            }
        }

        // Method 3: Any topic that looks like a key
        if (!depositKey) {
            for (const log of receipt.logs) {
                if (log.topics.length > 1 && log.topics[1].length === 66) {
                    depositKey = log.topics[1];
                    console.log("✅ Deposit key found (fallback):", depositKey);
                    break;
                }
            }
        }

        if (depositKey) {
            // Save to file
            const fs = require('fs');
            const filename = 'fresh-100usdt-deposit-key.txt';
            fs.writeFileSync(filename, depositKey);
            console.log(`\n✅ Deposit key saved to ${filename}`);

            console.log("\n=== SUCCESS SUMMARY ===");
            console.log("✅ Deposit created successfully!");
            console.log("✅ Transaction hash:", receipt.transactionHash);
            console.log("✅ Deposit key:", depositKey);

            console.log("\n=== NEXT STEPS ===");
            console.log("1. Set oracle prices:");
            console.log("   - USDT = $1.00");
            console.log("   - sNGN = $0.000606 (as per DEPOSIT_ISSUE_UPDATE)");
            console.log("2. Execute deposit with DepositHandler.executeDeposit()");
            console.log("3. You should receive GM tokens!");

        } else {
            console.log("\n⚠️ Deposit created but couldn't extract key automatically");
            console.log("Transaction hash:", receipt.transactionHash);
            console.log("Please check the transaction on the explorer to find the deposit key");
        }

    } catch (error) {
        console.log("\n❌ Failed to create deposit");
        console.log("Error:", error.message);

        if (error.data) {
            console.log("Error data:", error.data);
        }

        // This shouldn't happen since simulation worked
        console.log("\nThis is unexpected - the simulation was successful!");
        console.log("Possible causes:");
        console.log("- Network issues");
        console.log("- State changed between simulation and execution");
        console.log("- Gas estimation issues");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });