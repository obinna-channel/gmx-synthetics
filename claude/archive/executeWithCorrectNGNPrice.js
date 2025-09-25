const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Executing Deposit with NGN at $0.000667 (1/1500) ===");

    const [signer] = await ethers.getSigners();

    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Setting Oracle Prices ===");
    console.log("USDT = $1.00 (stablecoin)");
    console.log("sNGN = $0.000667 (1 NGN = $0.000667, so 1 USDT = 1500 NGN)");

    await oracle.clearAllPrices();

    // USDT price: $1
    const usdtPrice = {
        min: ethers.utils.parseUnits("1", 30),
        max: ethers.utils.parseUnits("1", 30)
    };
    await oracle.setPrimaryPrice(USDT, usdtPrice);
    console.log("✅ USDT price set to $1");

    // sNGN price: $0.000667 (1/1500)
    const sNgnPrice = {
        min: ethers.utils.parseUnits("0.000667", 30),
        max: ethers.utils.parseUnits("0.000667", 30)
    };
    await oracle.setPrimaryPrice(sNGN, sNgnPrice);
    console.log("✅ sNGN price set to $0.000667");

    // Verify prices
    const usdtPriceCheck = await oracle.getPrimaryPrice(USDT);
    const sNgnPriceCheck = await oracle.getPrimaryPrice(sNGN);
    console.log("\nPrice verification:");
    console.log("USDT:", ethers.utils.formatUnits(usdtPriceCheck.min, 30), "USD");
    console.log("sNGN:", ethers.utils.formatUnits(sNgnPriceCheck.min, 30), "USD");

    console.log("\n=== Impact Pool Calculation ===");
    console.log("With sNGN as index token at $0.000667:");
    console.log("- impactPoolAmount * 0.000667 = much smaller USD value");
    console.log("- This shouldn't cause pool value to go negative");

    // Check current pool amount
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("\nCurrent USDT pool amount:", poolAmount.toString());

    console.log("\n=== Executing Deposit ===");

    try {
        const oracleParams = {
            signerInfo: 0,
            tokens: [USDT, sNGN],
            providers: [ORACLE, ORACLE],
            data: []
        };

        console.log("Calling executeDeposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 10000000 }
        );

        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ SUCCESS! Deposit executed!");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Block:", receipt.blockNumber);

        // Check for GM tokens
        const marketToken = await ethers.getContractAt("IERC20", MARKET);
        const balance = await marketToken.balanceOf(signer.address);
        console.log("\nGM tokens received:", ethers.utils.formatEther(balance));

        console.log("\n🎉 First deposit successful with correct NGN price!");

    } catch (error) {
        console.log("\n❌ Execution failed");
        console.log("Error:", error.message);

        if (error.data) {
            const selector = error.data.slice(0, 10);
            console.log("Error selector:", selector);

            if (selector === "0xf9996e9f") {
                console.log("Still InvalidPoolValueForDeposit");
                console.log("\nEven with sNGN at $0.000667, pool value is still negative.");
                console.log("This suggests the index token configuration is fundamentally wrong.");
                console.log("USDT should be the index token for a USDT/NGN market.");
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