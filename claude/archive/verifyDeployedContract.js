const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFYING DEPLOYED EXCHANGEROUTER CONTRACT ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";

    // Get the deployed contract bytecode
    const provider = ethers.provider;
    const deployedBytecode = await provider.getCode(EXCHANGE_ROUTER);

    console.log("Deployed bytecode length:", deployedBytecode.length);
    console.log("First 100 chars:", deployedBytecode.slice(0, 100));

    // Check if it has the depositHandler storage slot
    // depositHandler is an immutable variable, stored in bytecode

    // Try to call depositHandler() function
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    console.log("\n=== CHECKING CONTRACT FUNCTIONS ===");

    try {
        const depositHandler = await exchangeRouter.depositHandler();
        console.log("✅ depositHandler() returns:", depositHandler);
    } catch (e) {
        console.log("❌ Could not call depositHandler():", e.message);
    }

    // Try to estimate gas for createDeposit with minimal params
    console.log("\n=== TESTING CREATEDDEPOSIT FUNCTION ===");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
            initialLongToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
            initialShortToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    // Check if the function exists
    try {
        // Get function selector
        const iface = new ethers.utils.Interface([
            "function createDeposit((((address,address,address,address,address,address,address[],address[]),uint256,bool,uint256,uint256,bytes32[]))) returns (bytes32)"
        ]);
        const selector = iface.getSighash("createDeposit");
        console.log("createDeposit selector:", selector);

        // Check if selector exists in bytecode
        if (deployedBytecode.includes(selector.slice(2))) {
            console.log("✅ createDeposit selector found in bytecode");
        } else {
            console.log("❌ createDeposit selector NOT found in bytecode!");
        }
    } catch (e) {
        console.log("Error checking function:", e.message);
    }

    console.log("\n=== CHECKING IF CONTRACT IS A PROXY ===");

    // Check for proxy patterns
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implAddress = await provider.getStorageAt(EXCHANGE_ROUTER, IMPLEMENTATION_SLOT);

    if (implAddress !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log("⚠️ This might be a proxy contract!");
        console.log("Implementation address:", implAddress);
    } else {
        console.log("✅ Not a proxy contract (no implementation at standard slot)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });