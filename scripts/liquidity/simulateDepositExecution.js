const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMULATING DEPOSIT EXECUTION ===\n");

    // Addresses from deployments
    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        ROLE_STORE: "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778"
    };

    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const depositHandler = await ethers.getContractAt("DepositHandler", ADDRESSES.DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const roleStore = await ethers.getContractAt("RoleStore", ADDRESSES.ROLE_STORE);

    console.log("Deposit key to execute:", depositKey);

    // ========================================
    // VERIFY DEPOSIT EXISTS
    // ========================================
    console.log("\n=== VERIFYING DEPOSIT ===");

    const accountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "bytes32"],
            [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
        )
    );

    const depositAccount = await dataStore.getAddress(accountKey);
    if (depositAccount === ethers.constants.AddressZero) {
        console.log("❌ Deposit does not exist!");
        return;
    }

    console.log("✅ Deposit exists for account:", depositAccount);

    // Get deposit amount
    const amountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "bytes32"],
            [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INITIAL_LONG_TOKEN_AMOUNT"))]
        )
    );
    const amount = await dataStore.getUint(amountKey);
    console.log("Deposit amount:", ethers.utils.formatUnits(amount, 6), "USDT");

    // ========================================
    // CHECK ORDER_KEEPER ROLE
    // ========================================
    console.log("\n=== CHECKING KEEPER ROLE ===");
    const ORDER_KEEPER = ethers.utils.id("ORDER_KEEPER");
    const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);

    if (!hasKeeperRole) {
        console.log("⚠️ You don't have ORDER_KEEPER role");
        console.log("Granting role for simulation...");
        try {
            const grantTx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
            await grantTx.wait();
            console.log("✅ ORDER_KEEPER role granted");
        } catch (error) {
            console.log("Could not grant role:", error.message);
        }
    } else {
        console.log("✅ You have ORDER_KEEPER role");
    }

    // ========================================
    // TRY DIFFERENT PRICE SCENARIOS
    // ========================================
    console.log("\n=== TESTING DIFFERENT PRICE SCENARIOS ===");

    const priceScenarios = [
        {
            name: "Scenario 1: As per DEPOSIT_ISSUE_UPDATE",
            usdtPrice: "1",
            ngnPrice: "0.000606",  // 1 NGN = $0.000606
            description: "USDT = $1, sNGN = $0.000606"
        },
        {
            name: "Scenario 2: Alternative NGN price",
            usdtPrice: "1",
            ngnPrice: "0.000667",  // 1 NGN = $0.000667 (1/1500)
            description: "USDT = $1, sNGN = $0.000667"
        },
        {
            name: "Scenario 3: NGN as exchange rate",
            usdtPrice: "1",
            ngnPrice: "1500",  // Direct exchange rate
            description: "USDT = $1, sNGN = 1500"
        }
    ];

    for (const scenario of priceScenarios) {
        console.log(`\n--- ${scenario.name} ---`);
        console.log(scenario.description);

        // Clear and set oracle prices
        await oracle.clearAllPrices();

        const usdtPrice = ethers.utils.parseUnits(scenario.usdtPrice, 30);
        await oracle.setPrimaryPrice(ADDRESSES.USDT, {
            min: usdtPrice,
            max: usdtPrice
        });

        const ngnPrice = ethers.utils.parseUnits(scenario.ngnPrice, 30);
        await oracle.setPrimaryPrice(ADDRESSES.sNGN, {
            min: ngnPrice,
            max: ngnPrice
        });

        console.log("Oracle prices set");

        // Build oracle params
        const oracleParams = {
            signerInfo: 0,
            tokens: [ADDRESSES.USDT, ADDRESSES.sNGN],
            providers: [ADDRESSES.ORACLE, ADDRESSES.ORACLE],
            data: []
        };

        // Simulate execution
        console.log("Simulating deposit execution...");

        try {
            // Use callStatic to simulate without executing
            const result = await depositHandler.callStatic.executeDeposit(
                depositKey,
                oracleParams,
                { gasLimit: 10000000 }
            );

            console.log("✅ SIMULATION SUCCESSFUL!");
            console.log("This price configuration works!");
            console.log("\nUsing these prices:");
            console.log("- USDT:", scenario.usdtPrice);
            console.log("- sNGN:", scenario.ngnPrice);
            break; // Stop at first successful scenario

        } catch (error) {
            console.log("❌ Simulation failed");

            if (error.data) {
                const selector = error.data.slice(0, 10);
                console.log("Error selector:", selector);

                const errorTypes = {
                    "0xf9996e9f": "InvalidPoolValueForDeposit",
                    "0x7c946ed7": "EmptyDeposit",
                    "0x5e7b1938": "Unauthorized"
                };

                if (errorTypes[selector]) {
                    console.log("Error type:", errorTypes[selector]);

                    if (selector === "0xf9996e9f") {
                        console.log("Pool value calculation resulted in negative value");
                        console.log("This price configuration doesn't work");
                    }
                }
            } else {
                console.log("Error:", error.message.substring(0, 100));
            }
        }
    }

    // ========================================
    // CHECK POOL STATE
    // ========================================
    console.log("\n=== CHECKING POOL STATE ===");

    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [ADDRESSES.MARKET, ADDRESSES.USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Current pool amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

    const marketToken = await ethers.getContractAt("IERC20", ADDRESSES.MARKET);
    const totalSupply = await marketToken.totalSupply();
    console.log("Market token supply:", ethers.utils.formatEther(totalSupply), "GM");

    // Check impact pools
    const impactPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_IMPACT_POOL_AMOUNT")), ADDRESSES.MARKET]
        )
    );
    const impactPoolAmount = await dataStore.getUint(impactPoolAmountKey);
    console.log("Position impact pool:", impactPoolAmount.toString());

    if (poolAmount.eq(0) && totalSupply.eq(0) && impactPoolAmount.eq(0)) {
        console.log("✅ Clean state for first deposit");
    } else {
        console.log("⚠️ Not a clean first deposit state");
    }

    console.log("\n=== SIMULATION COMPLETE ===");
    console.log("Review the results above to determine:");
    console.log("1. Which oracle prices work");
    console.log("2. Whether the deposit is ready for execution");
    console.log("3. Any potential issues to address");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });