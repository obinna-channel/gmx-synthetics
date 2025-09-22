const { ethers } = require("hardhat");

async function main() {
    console.log("=== FIXING STUCK TOKENS AND DEPOSITING ===\n");

    const [deployer] = await ethers.getSigners();

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869",
        ROUTER: ethers.utils.getAddress("0x8209149be8c79b93c19efb0f92281b7c4b90fb75"),
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        ORACLE: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const oracle = await ethers.getContractAt("Oracle", ADDRESSES.ORACLE);
    const market = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.MARKET);

    console.log("Deployer:", deployer.address);

    // Check stuck tokens
    const stuckTokens = await usdt.balanceOf(ADDRESSES.EXCHANGE_ROUTER);
    console.log(`Stuck USDT in ExchangeRouter: ${ethers.utils.formatUnits(stuckTokens, 6)} USDT`);

    if (stuckTokens.gt(0)) {
        console.log("\n⚠️ Found stuck tokens in ExchangeRouter");
        console.log("Note: These tokens may be difficult to recover without admin functions");
        console.log("We'll proceed with a fresh deposit using tokens from your wallet\n");
    }

    // Use fresh tokens for deposit
    const DEPOSIT_AMOUNT = ethers.utils.parseUnits("100", 6);

    console.log("=== STEP 1: CHECK BALANCES ===");
    const initialUSDT = await usdt.balanceOf(deployer.address);
    const initialGM = await market.balanceOf(deployer.address);
    console.log("Your USDT:", ethers.utils.formatUnits(initialUSDT, 6));
    console.log("Your GM tokens:", ethers.utils.formatUnits(initialGM, 18));

    console.log("\n=== STEP 2: SET ORACLE PRICES ===");
    try {
        await oracle.clearAllPrices();
        const ngnPrice = ethers.utils.parseUnits("1650", 30);
        await oracle.setPrimaryPrice(ADDRESSES.sNGN, {min: ngnPrice, max: ngnPrice});
        console.log("✓ Price set: 1650 NGN per USDT");
    } catch (e) {
        console.log("Price update failed:", e.message);
    }

    console.log("\n=== STEP 3: APPROVE ROUTER ===");
    const currentAllowance = await usdt.allowance(deployer.address, ADDRESSES.ROUTER);
    if (currentAllowance.lt(DEPOSIT_AMOUNT)) {
        const approveTx = await usdt.approve(ADDRESSES.ROUTER, DEPOSIT_AMOUNT);
        await approveTx.wait();
        console.log("✓ Router approved for 100 USDT");
    } else {
        console.log("✓ Router already approved");
    }

    console.log("\n=== STEP 4: CREATE DEPOSIT (CORRECT WAY) ===");

    // Prepare deposit parameters
    const depositParams = {
        addresses: {
            receiver: deployer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ethers.constants.AddressZero,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };

    try {
        // IMPORTANT: sendTokens transfers from USER to VAULT using Router
        console.log("Sending USDT to DepositVault via Router...");
        const sendTx = await exchangeRouter.sendTokens(
            ADDRESSES.USDT,
            ADDRESSES.DEPOSIT_VAULT,
            DEPOSIT_AMOUNT
        );
        await sendTx.wait();
        console.log("✓ USDT transferred to DepositVault");

        // Now create the deposit
        console.log("\nCreating deposit...");
        const depositTx = await exchangeRouter.createDeposit(
            depositParams,
            { value: ethers.utils.parseEther("0.001") }
        );
        const receipt = await depositTx.wait();
        console.log("✓ Deposit created! Tx:", receipt.transactionHash);

        // Find deposit key from events
        const depositCreatedEvent = receipt.events?.find(e =>
            e.topics[0] === ethers.utils.id("DepositCreated(bytes32,address,address,address,address,address,address)")
        );

        if (depositCreatedEvent) {
            const depositKey = depositCreatedEvent.topics[1];
            console.log("Deposit Key:", depositKey);
            console.log("\n✅ SUCCESS! Deposit created and waiting for keeper execution.");
            console.log("Next: Run order keeper or grant ORDER_KEEPER role to execute");
        }

    } catch (error) {
        console.log("\n❌ Error:", error.reason || error.message);

        // Check where tokens ended up
        console.log("\n=== CHECKING TOKEN LOCATIONS ===");
        const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
        const routerBalance = await usdt.balanceOf(ADDRESSES.ROUTER);
        console.log(`DepositVault: ${ethers.utils.formatUnits(vaultBalance, 6)} USDT`);
        console.log(`Router: ${ethers.utils.formatUnits(routerBalance, 6)} USDT`);
    }

    console.log("\n=== FINAL BALANCES ===");
    const finalUSDT = await usdt.balanceOf(deployer.address);
    const finalGM = await market.balanceOf(deployer.address);
    console.log("Your USDT:", ethers.utils.formatUnits(finalUSDT, 6));
    console.log("Your GM tokens:", ethers.utils.formatUnits(finalGM, 18));
}

main().catch(console.error);