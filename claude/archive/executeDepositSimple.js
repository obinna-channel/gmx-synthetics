const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== GMX V2 Deposit Execution (Simplified) ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    // Contract addresses from deployments
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";

    // Get deposit key from file
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    console.log("\nDeposit Key:", depositKey);

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

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

    // Set oracle prices
    console.log("\n=== Setting Oracle Prices ===");

    try {
        // Clear any existing prices first
        console.log("Clearing existing prices...");
        const clearTx = await oracle.clearAllPrices();
        await clearTx.wait();
        console.log("Prices cleared!");

        // Set primary prices
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log("Current block:", blockNumber);

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

        console.log("\nSetting USDT price: $1.00");
        const setUsdtTx = await oracle.setPrices(
            dataStore.address,
            [USDT],
            [usdtPrice],
            [usdtPrice]
        );
        await setUsdtTx.wait();
        console.log("USDT price set!");

        console.log("\nSetting sNGN price: $0.000606");
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
        console.log("USDT price - Min:", ethers.utils.formatUnits(usdtPrimaryPrice.min, 30), "Max:", ethers.utils.formatUnits(usdtPrimaryPrice.max, 30));
        console.log("sNGN price - Min:", ethers.utils.formatUnits(sNgnPrimaryPrice.min, 30), "Max:", ethers.utils.formatUnits(sNgnPrimaryPrice.max, 30));

    } catch (error) {
        console.log("Error setting oracle prices:", error.message);
    }

    // Execute the deposit
    console.log("\n=== Executing Deposit ===");

    try {
        // Create oracle params with minimal setup
        const oracleParams = {
            signerInfo: 0,
            tokens: [USDT, sNGN],
            providers: [ORACLE, ORACLE],
            data: []
        };

        console.log("\nOracle Params:");
        console.log("  Tokens:", oracleParams.tokens);
        console.log("  Providers:", oracleParams.providers);

        console.log("\nCalling executeDeposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            {
                gasLimit: 5000000
            }
        );

        console.log("\nTransaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ DEPOSIT EXECUTED SUCCESSFULLY!");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Block:", receipt.blockNumber);

    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("Error:", error.message);

        if (error.data) {
            console.log("\nError data:", error.data);

            // Try to decode the error
            try {
                const errorInterface = new ethers.utils.Interface([
                    "error EmptyDeposit()",
                    "error EmptyPrimaryPrice(address token)",
                    "error InvalidBlockNumber(uint256 blockNumber)",
                    "error DisabledFeature(bytes32 key)",
                    "error OracleError(string reason)",
                    "error Unauthorized(address msgSender)",
                    "error InsufficientExecutionFee(uint256 provided, uint256 required)"
                ]);

                const decodedError = errorInterface.parseError(error.data);
                console.log("\nDecoded error:", decodedError.name);
                if (decodedError.args && decodedError.args.length > 0) {
                    console.log("Error args:", decodedError.args);
                }
            } catch (e) {
                // Could not decode
            }
        }

        // Check some common issues
        console.log("\n=== Debugging Information ===");

        // Check if deposits are disabled
        const depositFeatureDisabledKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IS_DEPOSIT_DISABLED"));
        const isDepositDisabled = await dataStore.getBool(depositFeatureDisabledKey);
        console.log("Deposits disabled globally:", isDepositDisabled);

        // Check if market is disabled
        const isMarketDisabledKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IS_MARKET_DISABLED"))]
            )
        );
        const isMarketDisabled = await dataStore.getBool(isMarketDisabledKey);
        console.log("Market disabled:", isMarketDisabled);

        // Check max PnL factors (required for deposit execution)
        const maxPnlFactorLongKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32", "bool"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), false]
            )
        );
        const maxPnlFactorShortKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32", "bool"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR")), true]
            )
        );
        const maxPnlFactorLong = await dataStore.getUint(maxPnlFactorLongKey);
        const maxPnlFactorShort = await dataStore.getUint(maxPnlFactorShortKey);
        console.log("Max PnL Factor (long):", maxPnlFactorLong.toString());
        console.log("Max PnL Factor (short):", maxPnlFactorShort.toString());

        if (maxPnlFactorLong.eq(0) || maxPnlFactorShort.eq(0)) {
            console.log("\n⚠️  Max PnL factors are not set! This is likely causing the execution to fail.");
            console.log("You need to set MAX_PNL_FACTOR for both long and short positions.");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });