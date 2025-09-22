const { ethers } = require("hardhat");

async function main() {
    console.log("=== DETAILED DEPOSIT TEST ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da"
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const router = await ethers.getContractAt("Router", ADDRESSES.ROUTER);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    const depositAmount = ethers.utils.parseUnits("100", 6);

    // Check balances
    const usdtBalance = await usdt.balanceOf(signer.address);
    console.log("USDT Balance:", ethers.utils.formatUnits(usdtBalance, 6), "USDT");

    // Approve
    console.log("\nApproving Router...");
    const approveTx = await usdt.approve(ADDRESSES.ROUTER, depositAmount);
    await approveTx.wait();
    console.log("✓ Approved");

    // Check allowance
    const allowance = await usdt.allowance(signer.address, ADDRESSES.ROUTER);
    console.log("Allowance:", ethers.utils.formatUnits(allowance, 6), "USDT");

    // Build deposit params
    const depositParams = {
        receiver: signer.address,
        callbackContract: ethers.constants.AddressZero,
        market: ADDRESSES.MARKET,
        minMarketTokens: 0,
        shouldConvertETH: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };

    // Send USDT to Router first
    console.log("\nSending USDT to DepositVault via Router...");
    const transferTx = await router.pluginTransfer(
        ADDRESSES.USDT,
        signer.address,
        ADDRESSES.DEPOSIT_VAULT,
        depositAmount
    );
    await transferTx.wait();
    console.log("✓ USDT sent to DepositVault");

    // Check DepositVault balance
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Now try to create deposit
    console.log("\nAttempting createDeposit...");
    try {
        // Try to estimate gas first to get more error details
        const estimatedGas = await exchangeRouter.estimateGas.createDeposit(
            depositParams,
            { value: ethers.utils.parseEther("0.001") }
        );
        console.log("Estimated gas:", estimatedGas.toString());

        // If estimation succeeds, create the deposit
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            { value: ethers.utils.parseEther("0.001"), gasLimit: estimatedGas.mul(2) }
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✓ Deposit created!");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Look for deposit key in events
        const depositCreatedEvent = receipt.events?.find(e => e.event === "DepositCreated");
        if (depositCreatedEvent) {
            console.log("Deposit key:", depositCreatedEvent.args?.key);
        }
    } catch (error) {
        console.log("\n❌ Error details:");
        console.log(error.message);

        // Try to decode the error
        if (error.error && error.error.data) {
            console.log("\nError data:", error.error.data);

            // Try to decode custom errors
            try {
                const iface = new ethers.utils.Interface([
                    "error Unauthorized(address account, bytes32 roleName)"
                ]);
                const decoded = iface.parseError(error.error.data);
                console.log("\nDecoded error:", decoded.name);
                console.log("Account:", decoded.args.account);
                console.log("Role:", decoded.args.roleName);
            } catch (e) {
                // Try other error signatures
            }
        }
    }
}

main().catch(console.error);