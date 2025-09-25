const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING DEPOSIT WITH ADDRESS(1) AS RECEIVER ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const ROUTER = "0x200882043647295a21F9202f9C1535BfB2A2f127";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Based on README: "The first deposit in any market must go to the RECEIVER_FOR_FIRST_DEPOSIT"
    // RECEIVER_FOR_FIRST_DEPOSIT = address(1)
    console.log("README requirement: First deposit receiver must be address(1)\n");

    // Step 1: Approve Router
    const amount = ethers.utils.parseUnits("50", 6);
    console.log("1. Approving Router for 50 USDT...");
    const approveTx = await usdt.approve(ROUTER, amount);
    await approveTx.wait();
    console.log("   ✅ Approved");

    // Step 2: Prepare multicall with address(1) as receiver
    console.log("\n2. Preparing multicall with receiver = address(1)...");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // ADDRESS(1) - REQUIRED!
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    // Encode calls
    const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        amount
    ]);

    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);

    console.log("   Call 1: sendTokens -> DepositVault");
    console.log("   Call 2: createDeposit with receiver = address(1)");

    // Step 3: Execute
    console.log("\n3. Executing multicall...");
    try {
        const tx = await exchangeRouter.multicall(
            [sendTokensData, createDepositData],
            { gasLimit: 2000000 }
        );

        console.log("   Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("   ✅ Transaction confirmed!");
        console.log("   Block:", receipt.blockNumber);
        console.log("   Gas used:", receipt.gasUsed.toString());

        // Step 4: Check if deposit was created
        console.log("\n4. Checking if deposit was created...");
        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

        // Look for deposit in logs
        let depositKey = null;
        for (const log of receipt.logs) {
            if (log.topics.length > 3 && log.topics[1] && log.topics[1].length === 66) {
                const potentialKey = log.topics[1];

                // Check if this key exists in DataStore
                const accountKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ["bytes32", "bytes32"],
                        [potentialKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
                    )
                );

                const account = await dataStore.getAddress(accountKey);
                if (account !== ethers.constants.AddressZero) {
                    depositKey = potentialKey;
                    console.log("   ✅ FOUND DEPOSIT!");
                    console.log("   Deposit key:", depositKey);
                    console.log("   Account:", account);

                    // Check receiver
                    const receiverKey = ethers.utils.keccak256(
                        ethers.utils.solidityPack(
                            ["bytes32", "bytes32"],
                            [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RECEIVER"))]
                        )
                    );
                    const receiver = await dataStore.getAddress(receiverKey);
                    console.log("   Receiver:", receiver);
                    if (receiver === "0x0000000000000000000000000000000000000001") {
                        console.log("   ✅ Receiver is correctly set to address(1)!");
                    }
                    break;
                }
            }
        }

        if (!depositKey) {
            console.log("   ❌ No deposit found in DataStore");
            console.log("   Even with address(1), deposit creation failed");
        }

    } catch (error) {
        console.log("\n❌ Transaction failed:", error.message);
    }

    console.log("\n=== CONCLUSION ===");
    console.log("If this fails even with address(1) as receiver,");
    console.log("then the issue is NOT the first deposit requirement.");
    console.log("The ExchangeRouter's createDeposit is fundamentally broken.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });