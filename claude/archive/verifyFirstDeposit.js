const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFYING FIRST DEPOSIT EXISTS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    console.log("Deposit key:", depositKey);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check deposit properties
    const properties = [
        { name: "ACCOUNT", key: "ACCOUNT" },
        { name: "RECEIVER", key: "RECEIVER" },
        { name: "CALLBACK_CONTRACT", key: "CALLBACK_CONTRACT" },
        { name: "MARKET", key: "MARKET" },
        { name: "INITIAL_LONG_TOKEN", key: "INITIAL_LONG_TOKEN" },
        { name: "INITIAL_SHORT_TOKEN", key: "INITIAL_SHORT_TOKEN" },
        { name: "INITIAL_LONG_TOKEN_AMOUNT", key: "INITIAL_LONG_TOKEN_AMOUNT" },
        { name: "INITIAL_SHORT_TOKEN_AMOUNT", key: "INITIAL_SHORT_TOKEN_AMOUNT" },
        { name: "CREATED_AT_TIME", key: "CREATED_AT_TIME" },
        { name: "UPDATED_AT_BLOCK", key: "UPDATED_AT_BLOCK" },
        { name: "EXECUTION_FEE", key: "EXECUTION_FEE" }
    ];

    console.log("\n=== DEPOSIT PROPERTIES ===");
    let depositExists = false;

    for (const prop of properties) {
        const storageKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(prop.key))]
            )
        );

        try {
            // Try as address
            if (["ACCOUNT", "RECEIVER", "CALLBACK_CONTRACT", "MARKET", "INITIAL_LONG_TOKEN", "INITIAL_SHORT_TOKEN"].includes(prop.name)) {
                const value = await dataStore.getAddress(storageKey);
                if (value !== ethers.constants.AddressZero) {
                    console.log(`${prop.name}: ${value}`);
                    depositExists = true;

                    // Check if receiver is address(1)
                    if (prop.name === "RECEIVER" && value === "0x0000000000000000000000000000000000000001") {
                        console.log("  ✅ Receiver is correctly set to address(1)!");
                    }
                }
            } else {
                // Try as uint
                const value = await dataStore.getUint(storageKey);
                if (value.gt(0)) {
                    if (prop.name.includes("AMOUNT")) {
                        console.log(`${prop.name}: ${ethers.utils.formatUnits(value, 6)} USDT`);
                    } else if (prop.name === "EXECUTION_FEE") {
                        console.log(`${prop.name}: ${ethers.utils.formatEther(value)} ETH`);
                    } else {
                        console.log(`${prop.name}: ${value.toString()}`);
                    }
                    depositExists = true;
                }
            }
        } catch (error) {
            // Skip errors
        }
    }

    console.log("\n=== RESULT ===");
    if (depositExists) {
        console.log("✅ DEPOSIT EXISTS IN DATASTORE!");
        console.log("Ready to be executed with oracle prices.");
    } else {
        console.log("❌ DEPOSIT NOT FOUND IN DATASTORE");
        console.log("The deposit was not properly created.");
    }

    // Check DepositVault balance
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);

    console.log("\n=== VAULT STATE ===");
    console.log("DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("(This includes USDT from this and previous deposits)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });