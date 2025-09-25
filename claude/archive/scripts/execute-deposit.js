const { ethers } = require("hardhat");

async function main() {
    console.log("=== EXECUTING DEPOSIT ===\n");

    const ADDRESSES = {
        ROLE_STORE: "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778",  // From deployments folder
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C",  // From deployments folder
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    // Check if we have ORDER_KEEPER role
    const roleStore = await ethers.getContractAt("RoleStore", ADDRESSES.ROLE_STORE);
    const ORDER_KEEPER = ethers.utils.id("ORDER_KEEPER");
    const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);

    console.log("Has ORDER_KEEPER role:", hasKeeperRole);

    if (!hasKeeperRole) {
        console.log("\n❌ You don't have ORDER_KEEPER role!");
        console.log("Granting role...");
        const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
        await tx.wait();
        console.log("✓ ORDER_KEEPER role granted");
    }

    // Get the deposit key from the last successful deposit
    // From the transaction, we need to find the deposit key
    console.log("\n1. Finding deposit key...");

    // Look at the last successful transaction logs
    const lastTxHash = "0xa94cfa908e0f0c38b90fe900aeffcb9773453fa111abed972e1825c831f75bef";
    const receipt = await ethers.provider.getTransactionReceipt(lastTxHash);

    // Find DepositCreated event
    const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
    const depositEvent = receipt.logs?.find(log =>
        log.topics[0] === depositCreatedTopic
    );

    if (!depositEvent) {
        console.log("❌ Could not find deposit event");
        return;
    }

    const depositKey = depositEvent.topics[1];
    console.log("Deposit key:", depositKey);

    // Set oracle prices
    console.log("\n2. Setting oracle prices...");
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);

    // Clear old prices
    await oracle.clearAllPrices();
    console.log("✓ Cleared old prices");

    // Set fresh prices for USDT and sNGN
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);

    // Set USDT price ($1)
    await oracle.setPrimaryPrice(ADDRESSES.USDT, {
        min: ethers.utils.parseUnits("1", 30),
        max: ethers.utils.parseUnits("1", 30)
    });
    console.log("✓ Set USDT price: $1");

    // Set sNGN price (1650 NGN = 1 USD, so 1 NGN = 0.000606 USD)
    const ngnPriceInUsd = ethers.utils.parseUnits("0.000606", 30);
    await oracle.setPrimaryPrice(ADDRESSES.sNGN, {
        min: ngnPriceInUsd,
        max: ngnPriceInUsd
    });
    console.log("✓ Set sNGN price: 1650 NGN per USD");

    // Execute the deposit
    console.log("\n3. Executing deposit...");
    const depositHandler = await ethers.getContractAt("DepositHandler", ADDRESSES.DEPOSIT_HANDLER);

    // Build oracle params
    const oracleParams = {
        signerInfo: 0,  // No signers needed for our setup
        tokens: [ADDRESSES.USDT, ADDRESSES.sNGN],
        providers: [oracle.address, oracle.address],
        data: []
    };

    try {
        console.log("Calling executeDeposit...");
        const tx = await depositHandler.executeDeposit(
            depositKey,
            oracleParams,
            { gasLimit: 5000000 }
        );

        console.log("\n✅ Transaction sent!");
        console.log("Transaction hash:", tx.hash);

        const executionReceipt = await tx.wait();
        console.log("✓ Transaction confirmed");
        console.log("Gas used:", executionReceipt.gasUsed.toString());

        if (executionReceipt.status === 1) {
            console.log("\n🎉 DEPOSIT EXECUTED SUCCESSFULLY!");
            console.log("You should now have GM tokens!");

            // Check for minted tokens
            const marketToken = await ethers.getContractAt("MarketToken", "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970");
            const gmBalance = await marketToken.balanceOf(signer.address);
            console.log("\nYour GM token balance:", ethers.utils.formatUnits(gmBalance, 18), "GM");
        } else {
            console.log("\n❌ Execution reverted");
        }

    } catch (error) {
        console.log("\n❌ Error executing deposit");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);