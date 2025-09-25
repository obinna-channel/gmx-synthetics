const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMULATING DEPOSIT TO GET EXACT REVERT REASON ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [signer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);

    // Check current vault balance
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Current DepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Prepare deposit params (same as before)
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== METHOD 1: Using eth_call to Simulate ===");
    try {
        // Use eth_call to simulate without sending transaction
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams,
            {
                value: ethers.utils.parseEther("0.001"),
                from: signer.address
            }
        );
        console.log(" Simulation succeeded! Would return:", result);
    } catch (error) {
        console.log("L Simulation failed with error:");

        // Try to extract the actual error message
        if (error.reason) {
            console.log("Reason:", error.reason);
        }

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);

            // Try to decode known error signatures
            const errorSignatures = [
                "error Unauthorized(address,bytes32)",
                "error EmptyDeposit()",
                "error EmptyDepositAmounts()",
                "error InsufficientWntAmountForExecutionFee(uint256,uint256)",
                "error InvalidReceiverForFirstDeposit(address,address)",
                "error MinMarketTokens(uint256,uint256)",
                "error InvalidSwapPath(address[])",
                "error InvalidMarketTokenBalance(address,address,uint256,uint256)",
                "error DisabledFeature(bytes32)",
                "error InvalidRequestCancellation(uint256,uint256)",
                "error InvalidPoolAmount()",
                "error InvalidUint(bytes32,uint256)",
                "error InvalidAddress(bytes32,address)"
            ];

            for (const sig of errorSignatures) {
                try {
                    const iface = new ethers.utils.Interface([sig]);
                    const decoded = iface.parseError(error.error.data);
                    console.log("\n Decoded error:", decoded.name);
                    if (decoded.args.length > 0) {
                        console.log("Arguments:", decoded.args.map(arg => arg.toString()));
                    }
                    break;
                } catch (e) {
                    // Continue trying other signatures
                }
            }
        }

        // Get more details
        if (error.stack) {
            const stackLines = error.stack.split('\n');
            const relevantLine = stackLines.find(line => line.includes('revert') || line.includes('require'));
            if (relevantLine) {
                console.log("\nStack trace hint:", relevantLine.trim());
            }
        }
    }

    console.log("\n=== METHOD 2: Checking Pre-conditions ===");

    // Check if there's a minimum deposit amount
    const MIN_DEPOSIT = ethers.utils.id("MIN_DEPOSIT");
    const dataStore = await ethers.getContractAt("DataStore", "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da");

    // Check various potential blockers
    console.log("\nChecking potential blockers:");

    // 1. Check if deposits are paused
    const CREATE_DEPOSIT_FEATURE_DISABLED = ethers.utils.id("CREATE_DEPOSIT_FEATURE_DISABLED");
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const featureKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [CREATE_DEPOSIT_FEATURE_DISABLED, DEPOSIT_HANDLER]
        )
    );
    const isDisabled = await dataStore.getBool(featureKey);
    console.log("1. Create deposit feature disabled:", isDisabled);

    // 2. Check execution fee requirements
    const ESTIMATED_GAS_FEE_BASE_AMOUNT = ethers.utils.id("ESTIMATED_GAS_FEE_BASE_AMOUNT");
    const baseGas = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT);
    console.log("2. Base gas fee:", baseGas.toString(), baseGas.eq(0) ? "L NOT SET" : "");

    // 3. Check if market is valid
    const MARKET_TOKEN = ethers.utils.id("MARKET_TOKEN");
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [ADDRESSES.MARKET, MARKET_TOKEN])
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    console.log("3. Market token configured:", marketToken !== ethers.constants.AddressZero ? "" : "L");

    // 4. Check WNT
    const WNT = ethers.utils.id("WNT");
    const wnt = await dataStore.getAddress(WNT);
    console.log("4. WNT configured:", wnt !== ethers.constants.AddressZero ? "" : "L");

    console.log("\n=== METHOD 3: Try with Different Parameters ===");

    // Try with zero execution fee to see if that's the issue
    const testParams = { ...depositParams };
    testParams.executionFee = 0;

    console.log("Testing with zero execution fee...");
    try {
        await exchangeRouter.callStatic.createDeposit(testParams, { from: signer.address });
        console.log(" Works with zero execution fee");
    } catch (error) {
        if (error.reason) {
            console.log("L Still fails:", error.reason);
        }
    }
}

main().catch(console.error);