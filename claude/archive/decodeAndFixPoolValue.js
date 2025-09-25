const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Decoding Error and Fixing Pool Value Issue ===");

    const [signer] = await ethers.getSigners();

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Decoding Error Data ===");

    // Decode the InvalidPoolValueForDeposit error
    const errorData1 = "0xf9996e9f00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000";
    const iface1 = new ethers.utils.Interface([
        "error InvalidPoolValueForDeposit(int256 poolValue)"
    ]);

    try {
        const decoded1 = iface1.parseError(errorData1);
        console.log("Error: InvalidPoolValueForDeposit");
        console.log("Pool Value:", decoded1.args[0].toString());
        console.log("This means the pool value is being calculated as 0 or negative!");
    } catch (e) {
        console.log("Could not decode first error");
    }

    // Decode the second error
    const errorData2 = "0xded099de000000000000000000000000e0dba0326623dece1712581271ebcd846d67b29f00000000000000000000000000000000000049f4a966d45cd522088f0000000000000000000000000000000000000000000049f4a966d45cd522088f00000000";
    const iface2 = new ethers.utils.Interface([
        "error OracleError(address token, uint256 min, uint256 max)"
    ]);

    try {
        const decoded2 = iface2.parseError(errorData2);
        console.log("\nPossible Oracle Error:");
        console.log("Token:", decoded2.args[0]);
        console.log("Values:", decoded2.args[1].toString(), decoded2.args[2].toString());
    } catch (e) {
        // Try different error signature
        console.log("Second error signature: 0xded099de (unknown)");
    }

    console.log("\n=== Understanding Pool Value Issue ===");
    console.log("The InvalidPoolValueForDeposit error occurs when:");
    console.log("1. The pool has no liquidity (first deposit)");
    console.log("2. The market token supply is 0");
    console.log("3. Price calculations fail");

    console.log("\n=== Checking Market State ===");

    // Check market token total supply
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const totalSupply = await marketToken.totalSupply();
    console.log("Market token (GM) total supply:", totalSupply.toString());

    // Check pool amounts
    const poolAmountLongKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountLongKey);
    console.log("Pool amount (USDT):", poolAmount.toString());

    // Check impacted pool amounts
    const impactedPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IMPACT_POOL_AMOUNT"))]
        )
    );
    const impactedPoolAmount = await dataStore.getUint(impactedPoolAmountKey);
    console.log("Impacted pool amount:", impactedPoolAmount.toString());

    console.log("\n=== The Issue ===");
    if (totalSupply.eq(0) && poolAmount.eq(0)) {
        console.log("This is the FIRST deposit into this market!");
        console.log("GMX might have special handling for initial deposits.");
        console.log("\nFor first deposits, we might need to:");
        console.log("1. Set a minimum initial pool value");
        console.log("2. Use a different execution path");
        console.log("3. Set initial market token price");
    }

    console.log("\n=== Potential Fix: Setting Initial Pool Value ===");

    // For first deposit, we might need to set an initial market token price
    const marketTokenPriceKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_TOKEN_PRICE"))]
        )
    );

    const marketTokenPrice = await dataStore.getUint(marketTokenPriceKey);
    console.log("Current market token price:", marketTokenPrice.toString());

    if (marketTokenPrice.eq(0)) {
        // Set initial market token price to $1 (with 30 decimals)
        const initialPrice = ethers.utils.parseUnits("1", 30);
        console.log("Setting initial market token price to $1...");
        const tx = await dataStore.setUint(marketTokenPriceKey, initialPrice);
        await tx.wait();
        console.log("✅ Initial market token price set!");
    }

    // Check if we need to set USDT price in oracle
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    console.log("\n=== Setting Both Token Prices ===");
    await oracle.clearAllPrices();

    // Set USDT price
    console.log("Setting USDT price to $1...");
    await oracle.setPrimaryPrice(USDT, {
        min: ethers.utils.parseUnits("1", 30),
        max: ethers.utils.parseUnits("1", 30)
    });

    // Set sNGN price
    console.log("Setting sNGN price to 1500...");
    await oracle.setPrimaryPrice(sNGN, {
        min: ethers.utils.parseUnits("1500", 30),
        max: ethers.utils.parseUnits("1500", 30)
    });

    console.log("\n=== Trying Execution Again ===");

    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    try {
        const oracleParams = {
            signerInfo: 0,
            tokens: [USDT, sNGN],
            providers: [ORACLE, ORACLE],
            data: []
        };

        console.log("Attempting execution...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 10000000 }
        );

        const receipt = await tx.wait();
        console.log("\n✅ SUCCESS!");
        console.log("Transaction:", receipt.transactionHash);
        console.log("Gas used:", receipt.gasUsed.toString());

    } catch (error) {
        console.log("❌ Still failing");
        if (error.reason) console.log("Reason:", error.reason);
        if (error.data) {
            const selector = error.data.slice(0, 10);
            console.log("Error selector:", selector);
            if (selector === "0xf9996e9f") {
                console.log("Still getting InvalidPoolValueForDeposit");
                console.log("\nThis suggests the issue is deeper in the pool value calculation.");
                console.log("The market might need more configuration for the first deposit.");
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });