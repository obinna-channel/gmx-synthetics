const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Fixing First Deposit Issue ===");

    const [signer] = await ethers.getSigners();

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Solution: Bootstrap the Market ===");
    console.log("For first deposit, we need to ensure pool value calculation doesn't go negative.");
    console.log("This can happen if impact pool amounts are set but pool is empty.");

    // Check and reset impact pool amounts
    const impactPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_IMPACT_POOL_AMOUNT")), MARKET]
        )
    );

    const currentImpactPool = await dataStore.getUint(impactPoolAmountKey);
    console.log("\nCurrent position impact pool amount:", currentImpactPool.toString());

    if (currentImpactPool.gt(0)) {
        console.log("Resetting position impact pool to 0 for first deposit...");
        const tx = await dataStore.setUint(impactPoolAmountKey, 0);
        await tx.wait();
        console.log("✅ Reset impact pool amount!");
    }

    // Check swap impact pool
    const swapImpactPoolKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SWAP_IMPACT_POOL_AMOUNT")), MARKET, USDT]
        )
    );

    const swapImpactPool = await dataStore.getUint(swapImpactPoolKey);
    console.log("Current swap impact pool amount:", swapImpactPool.toString());

    if (swapImpactPool.gt(0)) {
        console.log("Resetting swap impact pool to 0...");
        const tx = await dataStore.setUint(swapImpactPoolKey, 0);
        await tx.wait();
        console.log("✅ Reset swap impact pool!");
    }

    // Alternative approach: Add a small initial pool amount
    console.log("\n=== Alternative: Bootstrap with Initial Liquidity ===");

    // Check current USDT in vault
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Set a small pool amount to bootstrap
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );

    const currentPoolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Current pool amount:", currentPoolAmount.toString());

    if (currentPoolAmount.eq(0) && vaultBalance.gt(0)) {
        // Set pool amount to a small value (1 USDT)
        const bootstrapAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
        console.log("Setting bootstrap pool amount to 1 USDT...");
        const tx = await dataStore.setUint(poolAmountKey, bootstrapAmount);
        await tx.wait();
        console.log("✅ Pool bootstrapped with 1 USDT!");

        // Also mint a small amount of GM tokens to establish initial price
        console.log("\nMinting initial GM tokens...");
        const marketToken = await ethers.getContractAt("IERC20", MARKET);

        // Check if we can mint (market token might have restricted minting)
        try {
            // Try to call a mint function if it exists
            const mintTx = await marketToken.mint(signer.address, ethers.utils.parseEther("1"));
            await mintTx.wait();
            console.log("✅ Minted 1 GM token!");
        } catch (e) {
            console.log("Note: Could not mint GM tokens (expected if minting is restricted)");
        }
    }

    console.log("\n=== Setting Oracle Prices ===");

    const ORACLE = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    await oracle.clearAllPrices();

    // Set USDT price
    await oracle.setPrimaryPrice(USDT, {
        min: ethers.utils.parseUnits("1", 30),
        max: ethers.utils.parseUnits("1", 30)
    });
    console.log("✅ USDT price set to $1");

    // Set sNGN price
    await oracle.setPrimaryPrice(sNGN, {
        min: ethers.utils.parseUnits("1500", 30),
        max: ethers.utils.parseUnits("1500", 30)
    });
    console.log("✅ sNGN price set to 1500");

    console.log("\n=== Final Execution Attempt ===");

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

        console.log("Executing deposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 10000000 }
        );

        const receipt = await tx.wait();
        console.log("\n✅ SUCCESS! First deposit executed!");
        console.log("Transaction:", receipt.transactionHash);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check GM token balance
        const marketToken = await ethers.getContractAt("IERC20", MARKET);
        const balance = await marketToken.balanceOf(signer.address);
        console.log("GM tokens received:", ethers.utils.formatEther(balance));

    } catch (error) {
        console.log("❌ Execution failed");
        if (error.data) {
            const selector = error.data.slice(0, 10);
            console.log("Error selector:", selector);
            if (selector === "0xf9996e9f") {
                console.log("Still InvalidPoolValueForDeposit");
                console.log("\nThe market might need to be recreated or requires admin intervention.");
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