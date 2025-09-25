const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Option A: Direct Transfer + Immediate CreateDeposit ===\n");
    console.log("Signer address:", signer.address);

    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Check current vault status
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("Current vault status:");
    console.log("  USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    // Check if we need to transfer tokens
    const needsUsdtTransfer = vaultUsdtBalance.eq(0);
    const needsSngnTransfer = vaultSngnBalance.eq(0);

    if (needsUsdtTransfer || needsSngnTransfer) {
        console.log("\n📍 Transferring tokens directly to vault (no Router)...");

        if (needsUsdtTransfer) {
            const usdtAmount = ethers.utils.parseUnits("1", 6);
            console.log("  Transferring 1 USDT...");
            const tx1 = await usdt.transfer(DEPOSIT_VAULT, usdtAmount);
            await tx1.wait();
            console.log("  ✅ USDT transferred");
        }

        if (needsSngnTransfer) {
            const sngnAmount = ethers.utils.parseUnits("1500", 18);
            console.log("  Transferring 1500 sNGN...");
            const tx2 = await sngn.transfer(DEPOSIT_VAULT, sngnAmount);
            await tx2.wait();
            console.log("  ✅ sNGN transferred");
        }
    } else {
        console.log("\n✅ Vault already has tokens");
    }

    // IMMEDIATELY create deposit (hoping recordTransferIn picks up the tokens)
    console.log("\n📍 Immediately calling createDeposit...");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("  Market:", MARKET);
    console.log("  Receiver: address(1)");
    console.log("  Long token:", USDT);
    console.log("  Short token:", sNGN);

    try {
        const tx = await exchangeRouter.createDeposit(depositParams, { gasLimit: 2500000 });
        console.log("\n  Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("  ✅ SUCCESS! Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Status:", receipt.status ? "SUCCESS" : "FAILED");

        // Check for events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\n  Events emitted:");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log(`    - ${event.event}`);
                    if (event.event === "DepositCreated" && event.args) {
                        const depositKey = event.args.key || event.args[0];
                        console.log("      🔑 Deposit Key:", depositKey);
                    }
                }
            }
        }

        // Check if deposit was actually created
        const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

        const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
        );
        const accountKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ACCOUNT_DEPOSIT_LIST, signer.address]
            )
        );

        const depositCount = await dataStore.getBytes32Count(accountKey);
        console.log("\n  Total deposits for account:", depositCount.toString());

        if (depositCount.gt(0)) {
            console.log("\n🎉 DEPOSIT SUCCESSFULLY CREATED!");
        }

    } catch (error) {
        console.log("\n❌ Transaction failed:", error.message);

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            if (errorData === "0x01af8c24") {
                console.log("  Error: EmptyDepositAmounts");
                console.log("  The recordTransferIn didn't pick up the tokens");
                console.log("  Tokens might have been already recorded");
            }
        }

        // Check vault status after failure
        const finalUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
        const finalSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
        const finalUsdtRecorded = await depositVault.tokenBalances(USDT);
        const finalSngnRecorded = await depositVault.tokenBalances(sNGN);

        console.log("\nVault status after failure:");
        console.log("  USDT balance:", ethers.utils.formatUnits(finalUsdtBalance, 6));
        console.log("  USDT recorded:", ethers.utils.formatUnits(finalUsdtRecorded, 6));
        console.log("  sNGN balance:", ethers.utils.formatUnits(finalSngnBalance, 18));
        console.log("  sNGN recorded:", ethers.utils.formatUnits(finalSngnRecorded, 18));
    }
}

main().catch(console.error);