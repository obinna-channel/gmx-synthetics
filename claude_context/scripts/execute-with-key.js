const { ethers } = require("hardhat");

async function main() {
    console.log("=== EXECUTING DEPOSIT WITH FOUND KEY ===\n");

    // All from deployments folder
    const ADDRESSES = {
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C",
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970"
    };

    const DEPOSIT_KEY = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    const [signer] = await ethers.getSigners();
    console.log("Executor:", signer.address);
    console.log("Deposit key:", DEPOSIT_KEY);

    const depositHandler = await ethers.getContractAt("DepositHandler", ADDRESSES.DEPOSIT_HANDLER);
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);

    // Set oracle prices
    console.log("\n=== SETTING ORACLE PRICES ===");
    await oracle.clearAllPrices();
    console.log("✓ Cleared old prices");

    // USDT = $1
    const usdtPrice = ethers.utils.parseUnits("1", 30);
    await oracle.setPrimaryPrice(ADDRESSES.USDT, {
        min: usdtPrice,
        max: usdtPrice
    });
    console.log("✓ USDT price: $1");

    // sNGN = 1650 NGN per USD
    const ngnPrice = ethers.utils.parseUnits("0.000606", 30);
    await oracle.setPrimaryPrice(ADDRESSES.sNGN, {
        min: ngnPrice,
        max: ngnPrice
    });
    console.log("✓ sNGN price: 1650 NGN/USD");

    // Build oracle params
    const oracleParams = {
        signerInfo: 0,
        tokens: [ADDRESSES.USDT, ADDRESSES.sNGN],
        providers: [ADDRESSES.ORACLE, ADDRESSES.ORACLE],
        data: []
    };

    console.log("\n=== EXECUTING DEPOSIT ===");

    try {
        const tx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            { gasLimit: 5000000 }
        );

        console.log("✅ Transaction sent!");
        console.log("Hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed!");
        console.log("Gas used:", receipt.gasUsed.toString());

        if (receipt.status === 1) {
            console.log("\n🎉 DEPOSIT EXECUTED SUCCESSFULLY!");

            // Check GM balance
            const marketToken = await ethers.getContractAt("MarketToken", ADDRESSES.MARKET);
            const gmBalance = await marketToken.balanceOf(signer.address);
            console.log("\nYour GM token balance:", ethers.utils.formatUnits(gmBalance, 18), "GM");

            if (gmBalance.gt(0)) {
                console.log("\n✅ SUCCESS! You now have liquidity in the USDTNGN market!");
                console.log("You can now:");
                console.log("- Earn fees from traders");
                console.log("- Withdraw your liquidity when needed");
                console.log("- Trade on this market");
            }
        }

    } catch (error) {
        console.log("\n❌ Execution failed");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);

            // Try to decode
            const errorSigs = {
                "0x3db8dd06": "EmptyDeposit - deposit doesn't exist or already executed",
                "0x637df23e": "Unauthorized - need ORDER_KEEPER role",
                "0xf6ff2fb7": "RequestNotYetCancellable",
                "0x8d666e20": "InvalidOraclePrice"
            };

            const selector = error.error.data.slice(0, 10);
            if (errorSigs[selector]) {
                console.log("\nError type:", errorSigs[selector]);
            }
        }
    }
}

main().catch(console.error);