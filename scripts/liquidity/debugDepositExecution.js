const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Debugging Deposit Execution ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    // Contract addresses
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";

    // Deposit key
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    // Get contracts
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    console.log("\n=== Checking Deposit Vault Balance ===");
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    console.log("\n=== Checking Market Pool Amounts ===");

    // Check pool amount for USDT (long token)
    const poolAmountLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmountLong = await dataStore.getUint(poolAmountLongKey);
    console.log("Pool amount (USDT):", poolAmountLong.toString());

    // Check if this is the first deposit (pool value = 0)
    const poolValueInfoKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_VALUE_INFO"))]
        )
    );

    console.log("\n=== Checking Required Fees Configuration ===");

    // Check swap fees
    const swapFeeFactorKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SWAP_FEE_FACTOR"))]
        )
    );
    const swapFeeFactor = await dataStore.getUint(swapFeeFactorKey);
    console.log("Swap fee factor:", swapFeeFactor.toString());

    // Check position fees
    const positionFeeFactorKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_FEE_FACTOR")), false]
        )
    );
    const positionFeeFactor = await dataStore.getUint(positionFeeFactorKey);
    console.log("Position fee factor (long):", positionFeeFactor.toString());

    // Check funding factors
    const fundingFactorKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FUNDING_FACTOR"))]
        )
    );
    const fundingFactor = await dataStore.getUint(fundingFactorKey);
    console.log("Funding factor:", fundingFactor.toString());

    // Check borrowing factors
    const borrowingFactorLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32", "bool"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BORROWING_FACTOR")), false]
        )
    );
    const borrowingFactorLong = await dataStore.getUint(borrowingFactorLongKey);
    console.log("Borrowing factor (long):", borrowingFactorLong.toString());

    console.log("\n=== Setting Missing Configuration ===");

    // Set swap fee factor if not set (0.05% = 0.0005 * 10^30)
    if (swapFeeFactor.eq(0)) {
        console.log("Setting swap fee factor to 0.05%...");
        const swapFee = ethers.utils.parseUnits("0.0005", 30);
        const tx1 = await dataStore.setUint(swapFeeFactorKey, swapFee);
        await tx1.wait();
        console.log("✅ Swap fee factor set!");
    }

    // Set position fee factor if not set (0.05% = 0.0005 * 10^30)
    if (positionFeeFactor.eq(0)) {
        console.log("Setting position fee factor to 0.05%...");
        const posFee = ethers.utils.parseUnits("0.0005", 30);
        const positionFeeFactorKeyShort = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32", "bool"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_FEE_FACTOR")), true]
            )
        );
        const tx2 = await dataStore.setUint(positionFeeFactorKey, posFee);
        await tx2.wait();
        const tx3 = await dataStore.setUint(positionFeeFactorKeyShort, posFee);
        await tx3.wait();
        console.log("✅ Position fee factors set!");
    }

    // Set funding factor if not set
    if (fundingFactor.eq(0)) {
        console.log("Setting funding factor...");
        const funding = ethers.utils.parseUnits("0.0000001", 30); // Very small funding rate
        const tx4 = await dataStore.setUint(fundingFactorKey, funding);
        await tx4.wait();
        console.log("✅ Funding factor set!");
    }

    // Set borrowing factor if not set
    if (borrowingFactorLong.eq(0)) {
        console.log("Setting borrowing factors...");
        const borrowing = ethers.utils.parseUnits("0.0000001", 30); // Very small borrowing rate
        const borrowingFactorShortKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32", "bool"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BORROWING_FACTOR")), true]
            )
        );
        const tx5 = await dataStore.setUint(borrowingFactorLongKey, borrowing);
        await tx5.wait();
        const tx6 = await dataStore.setUint(borrowingFactorShortKey, borrowing);
        await tx6.wait();
        console.log("✅ Borrowing factors set!");
    }

    console.log("\n=== Attempting Static Call First ===");

    // Try a static call to get the exact error
    try {
        const oracleParams = {
            signerInfo: 0,
            tokens: [USDT, sNGN],
            providers: [ORACLE, ORACLE],
            data: []
        };

        console.log("Attempting static call to executeDeposit...");
        await depositHandler.callStatic.executeDeposit(depositKey, oracleParams);
        console.log("Static call succeeded! Should be able to execute.");
    } catch (error) {
        console.log("Static call failed with error:");
        console.log(error.reason || error.message);

        if (error.errorName) {
            console.log("Error name:", error.errorName);
        }
        if (error.errorArgs) {
            console.log("Error args:", error.errorArgs);
        }
    }

    console.log("\n=== Checking if Market Token exists ===");

    // The market token should have been created when the market was created
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_TOKEN"))]
        )
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    console.log("Market token address:", marketToken);

    if (marketToken === ethers.constants.AddressZero) {
        console.log("❌ Market token not set! This is likely the issue.");
        console.log("The market token should have been created when the market was deployed.");
    } else {
        const marketTokenContract = await ethers.getContractAt("IERC20", marketToken);
        const totalSupply = await marketTokenContract.totalSupply();
        console.log("Market token total supply:", totalSupply.toString());
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });