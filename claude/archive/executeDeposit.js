const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== GMX V2 Deposit Execution ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    // Contract addresses from deployments
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C"; // Correct Oracle from deployments
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778"; // Correct RoleStore from deployments

    // Get deposit key from file
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    console.log("\nDeposit Key:", depositKey);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Get DepositStoreUtils to read deposit
    const DEPOSIT_STORE_UTILS = "0xc7F59Fbc2b2d1F8132B76e749A5B3656453d0402"; // from deployments
    const depositStoreUtils = await ethers.getContractAt("DepositStoreUtils", DEPOSIT_STORE_UTILS);

    // Check if deposit exists
    console.log("\n=== Checking Deposit ===");
    const deposit = await depositStoreUtils.get(dataStore.address, depositKey);
    console.log("Deposit exists:", deposit.addresses.account !== ethers.constants.AddressZero);
    console.log("Deposit account:", deposit.addresses.account);
    console.log("Deposit market:", deposit.addresses.market);
    console.log("Deposit initialLongToken:", deposit.addresses.initialLongToken);
    console.log("Deposit initialShortToken:", deposit.addresses.initialShortToken);
    console.log("Deposit longTokenAmount:", deposit.numbers.initialLongTokenAmount.toString());
    console.log("Deposit shortTokenAmount:", deposit.numbers.initialShortTokenAmount.toString());
    console.log("Deposit executionFee:", deposit.numbers.executionFee.toString());

    // Check ORDER_KEEPER role
    console.log("\n=== Checking Roles ===");
    const ORDER_KEEPER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_KEEPER"));
    const hasOrderKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER_ROLE);
    console.log("Signer has ORDER_KEEPER role:", hasOrderKeeperRole);

    if (!hasOrderKeeperRole) {
        console.log("ERROR: Signer doesn't have ORDER_KEEPER role!");
        console.log("Granting ORDER_KEEPER role...");
        const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER_ROLE);
        await tx.wait();
        console.log("ORDER_KEEPER role granted!");
    }

    // Get sNGN token address from market config
    console.log("\n=== Getting Market Token Configuration ===");
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"))]
        )
    );
    const sNGN = await dataStore.getAddress(indexTokenKey);
    console.log("sNGN (Index Token):", sNGN);

    // Set oracle prices with proper validation
    console.log("\n=== Setting Oracle Prices ===");

    try {
        // Clear any existing prices first
        console.log("Clearing existing prices...");
        await oracle.clearAllPrices();

        // Set primary prices
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        const timestamp = block.timestamp;

        console.log("Current block:", blockNumber);
        console.log("Current timestamp:", timestamp);

        // USDT price: $1 with 30 decimals
        const usdtPrice = {
            min: ethers.utils.parseUnits("1", 30),
            max: ethers.utils.parseUnits("1", 30)
        };

        // sNGN price: 1 NGN = 0.000606 USD with 30 decimals
        const sNgnPrice = {
            min: ethers.utils.parseUnits("0.000606", 30),
            max: ethers.utils.parseUnits("0.000606", 30)
        };

        console.log("Setting USDT price: $1.00");
        console.log("  Min:", usdtPrice.min.toString());
        console.log("  Max:", usdtPrice.max.toString());

        const setUsdtTx = await oracle.setPrices(
            dataStore.address,
            [USDT],
            [usdtPrice],
            [usdtPrice]
        );
        await setUsdtTx.wait();
        console.log("USDT price set!");

        console.log("\nSetting sNGN price: $0.000606");
        console.log("  Min:", sNgnPrice.min.toString());
        console.log("  Max:", sNgnPrice.max.toString());

        const setSNgnTx = await oracle.setPrices(
            dataStore.address,
            [sNGN],
            [sNgnPrice],
            [sNgnPrice]
        );
        await setSNgnTx.wait();
        console.log("sNGN price set!");

        // Validate prices are set
        const usdtPrimaryPrice = await oracle.getPrimaryPrice(USDT);
        const sNgnPrimaryPrice = await oracle.getPrimaryPrice(sNGN);

        console.log("\n=== Validating Oracle Prices ===");
        console.log("USDT primary price:");
        console.log("  Min:", usdtPrimaryPrice.min.toString());
        console.log("  Max:", usdtPrimaryPrice.max.toString());
        console.log("sNGN primary price:");
        console.log("  Min:", sNgnPrimaryPrice.min.toString());
        console.log("  Max:", sNgnPrimaryPrice.max.toString());

    } catch (error) {
        console.log("Error setting oracle prices:", error.message);
        console.log("This might be okay if prices are already set.");
    }

    // Execute the deposit
    console.log("\n=== Executing Deposit ===");

    try {
        // Create oracle params
        const oracleParams = {
            signerInfo: 0, // No signature validation for keeper execution
            tokens: [USDT, sNGN], // Both tokens needed for price validation
            providers: [ORACLE, ORACLE], // Use same oracle for both
            data: [] // Empty data for keeper execution
        };

        console.log("\nOracle Params:");
        console.log("  Signer Info:", oracleParams.signerInfo);
        console.log("  Tokens:", oracleParams.tokens);
        console.log("  Providers:", oracleParams.providers);
        console.log("  Data length:", oracleParams.data.length);

        console.log("\nCalling executeDeposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            {
                gasLimit: 5000000 // Provide sufficient gas
            }
        );

        console.log("\nTransaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ DEPOSIT EXECUTED SUCCESSFULLY!");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Block:", receipt.blockNumber);

        // Check for events
        console.log("\n=== Events ===");
        for (const log of receipt.logs) {
            console.log("Event at:", log.address);
            console.log("Topics:", log.topics);
        }

    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("Error:", error.message);

        if (error.data) {
            console.log("\nError data:", error.data);

            // Try to decode the error
            try {
                const errorInterface = new ethers.utils.Interface([
                    "error EmptyDeposit()",
                    "error InvalidPrices()",
                    "error DisabledFeature(bytes32 key)",
                    "error InvalidBlockNumber(uint256 blockNumber)",
                    "error MaxOracleBlockNumbersLengthExceeded(uint256 length, uint256 maxLength)",
                    "error EmptyPrimaryPrice(address token)",
                    "error OracleError(string reason)"
                ]);

                const decodedError = errorInterface.parseError(error.data);
                console.log("\nDecoded error:", decodedError.name);
                if (decodedError.args.length > 0) {
                    console.log("Error args:", decodedError.args);
                }
            } catch (e) {
                console.log("Could not decode error");
            }
        }

        // Additional debugging
        console.log("\n=== Debugging Information ===");

        // Check if market is enabled
        const isMarketDisabledKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IS_MARKET_DISABLED"))]
            )
        );
        const isMarketDisabled = await dataStore.getBool(isMarketDisabledKey);
        console.log("Market disabled:", isMarketDisabled);

        // Check deposit feature
        const depositFeatureDisabledKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IS_DEPOSIT_DISABLED"));
        const isDepositDisabled = await dataStore.getBool(depositFeatureDisabledKey);
        console.log("Deposits disabled:", isDepositDisabled);

        // Check max PnL factor
        const maxPnlFactorKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32", "bool"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), false] // false for long
            )
        );
        const maxPnlFactor = await dataStore.getUint(maxPnlFactorKey);
        console.log("Max PnL Factor (long):", maxPnlFactor.toString());
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });