const { ethers } = require("hardhat");

async function main() {
    console.log("=== New Debugging Angles ===\n");
    
    const [signer] = await ethers.getSigners();
    
    // 1. Check if the market token is a standard ERC20 or has special logic
    console.log("1. ANALYZING MARKET TOKEN CONTRACT\n");
    
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    
    try {
        // Try to call standard ERC20 functions
        const name = await marketToken.name();
        const symbol = await marketToken.symbol();
        const decimals = await marketToken.decimals();
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);
    } catch (e) {
        console.log("   Could not read token metadata:", e.message);
    }
    
    // 2. Check if there's a minter role requirement
    console.log("\n2. CHECKING MINTER PERMISSIONS\n");
    
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // Check if DepositHandler has necessary roles
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    const hasController = await roleStore.hasRole(DEPOSIT_HANDLER, CONTROLLER);
    console.log(`   DepositHandler has CONTROLLER role: ${hasController ? "✅" : "❌"}`);
    
    // 3. Check pool value calculations
    console.log("\n3. POOL VALUE CALCULATIONS\n");
    
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    
    const reader = await ethers.getContractAt("Reader", READER);
    
    try {
        // Try to get market info
        const marketInfo = await reader.getMarket(DATA_STORE, MARKET);
        console.log("   Market exists in reader:", marketInfo.marketToken !== ethers.constants.AddressZero ? "✅" : "❌");
        
        // Try to get market prices
        const marketPrices = await reader.getMarketPrices(DATA_STORE, {
            indexTokenPrice: {
                min: ethers.utils.parseUnits("1500", 30),
                max: ethers.utils.parseUnits("1500", 30)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 30),
                max: ethers.utils.parseUnits("1", 30)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits("1", 30),
                max: ethers.utils.parseUnits("1", 30)
            }
        });
        
        console.log("   Got market prices:", marketPrices ? "✅" : "❌");
    } catch (e) {
        console.log("   Error getting market info:", e.reason || e.message.substring(0, 100));
    }
    
    // 4. Check if it's a division by zero or underflow
    console.log("\n4. CHECKING FOR MATH ERRORS\n");
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check swap impact pool amounts
    const SWAP_IMPACT_POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SWAP_IMPACT_POOL_AMOUNT"])
    );
    
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const swapImpactKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [SWAP_IMPACT_POOL_AMOUNT, MARKET, USDT]
        )
    );
    
    const swapImpactAmount = await dataStore.getUint(swapImpactKey);
    console.log("   Swap impact pool amount:", swapImpactAmount.toString());
    
    // Check position impact pool
    const POSITION_IMPACT_POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_IMPACT_POOL_AMOUNT"])
    );
    
    const positionImpactKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [POSITION_IMPACT_POOL_AMOUNT, MARKET]
        )
    );
    
    const positionImpactAmount = await dataStore.getUint(positionImpactKey);
    console.log("   Position impact pool amount:", positionImpactAmount.toString());
    
    // 5. Try to trace the exact error
    console.log("\n5. ERROR ORIGIN ANALYSIS\n");
    
    console.log("   Error 0x95b66fe9 characteristics:");
    console.log("   - Occurs after 1.4M gas (deep in execution)");
    console.log("   - Not in GMX source code");
    console.log("   - Causes deposit cancellation");
    console.log("   - Consistent across multiple attempts");
    
    console.log("\n   Possible origins:");
    console.log("   a) MarketToken mint() has a revert condition");
    console.log("   b) Division by zero in pool value calculation");
    console.log("   c) Overflow/underflow in market token amount calculation");
    console.log("   d) External call to token contract failing");
    
    // 6. Check if we need to initialize something first
    console.log("\n6. INITIALIZATION CHECKS\n");
    
    // Check if market needs initialization
    const MARKET_SALT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_SALT"])
    );
    
    const marketSaltKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, MARKET_SALT])
    );
    
    const marketSalt = await dataStore.getBytes32(marketSaltKey);
    console.log("   Market salt:", marketSalt === ethers.constants.HashZero ? "NOT SET" : "SET");
    
    console.log("\n💡 NEW HYPOTHESIS:");
    console.log("The error might be from:");
    console.log("1. MarketToken.mint() requiring special initialization");
    console.log("2. A zero-value calculation causing revert");
    console.log("3. Missing configuration that only affects first deposit");
}

main().catch(console.error);