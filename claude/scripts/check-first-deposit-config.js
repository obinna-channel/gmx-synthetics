const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking First Deposit Configuration ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check RECEIVER_FOR_FIRST_DEPOSIT
    console.log("🎯 Checking RECEIVER_FOR_FIRST_DEPOSIT configuration...\n");
    
    // Try different possible key formats
    const possibleKeys = [
        // Global setting
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER_FOR_FIRST_DEPOSIT"])),
        // Market-specific setting
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER_FOR_FIRST_DEPOSIT"])),
                MARKET
            ]
        )),
        // Alternative naming
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FIRST_DEPOSIT_RECEIVER"])),
    ];
    
    let foundReceiver = false;
    for (let i = 0; i < possibleKeys.length; i++) {
        try {
            const receiver = await dataStore.getAddress(possibleKeys[i]);
            if (receiver !== ethers.constants.AddressZero) {
                console.log(`  Found at key ${i}: ${receiver}`);
                foundReceiver = true;
                
                if (receiver === "0x0000000000000000000000000000000000000001") {
                    console.log("  ✅ Matches address(1) - our deposit should work!");
                } else {
                    console.log("  ❌ Does NOT match address(1)!");
                    console.log("  We need to use THIS address as receiver for first deposit!");
                }
            }
        } catch (e) {
            // Key doesn't exist
        }
    }
    
    if (!foundReceiver) {
        console.log("  ⚠️  RECEIVER_FOR_FIRST_DEPOSIT not found in DataStore");
        console.log("  It might be hardcoded or use a different key");
        
        // Check if it's a constant in the contract
        console.log("\n  Checking ExecuteDepositUtils for hardcoded value...");
        const EXECUTE_DEPOSIT_UTILS = "0xf587D2143F5235d0F7B18952D1f948044D95c873";
        
        try {
            // Try to read RECEIVER_FOR_FIRST_DEPOSIT constant
            const executeDepositUtils = new ethers.Contract(
                EXECUTE_DEPOSIT_UTILS,
                ["function RECEIVER_FOR_FIRST_DEPOSIT() view returns (address)"],
                ethers.provider
            );
            
            const hardcodedReceiver = await executeDepositUtils.RECEIVER_FOR_FIRST_DEPOSIT();
            console.log("  Found hardcoded value:", hardcodedReceiver);
            
            if (hardcodedReceiver === "0x0000000000000000000000000000000000000001") {
                console.log("  ✅ Hardcoded as address(1) - matches our deposit!");
            } else {
                console.log("  ❌ Different from address(1) - this is the issue!");
            }
        } catch (e) {
            console.log("  Could not read from contract:", e.message);
        }
    }
    
    // Check MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT
    console.log("\n💰 Checking MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT...");
    
    const MIN_MARKET_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT"])),
                MARKET
            ]
        )
    );
    
    const minMarketTokens = await dataStore.getUint(MIN_MARKET_TOKENS_KEY);
    console.log("  Value:", ethers.utils.formatEther(minMarketTokens));
    
    if (minMarketTokens.gt(0)) {
        console.log("  ⚠️  This could block small deposits!");
        console.log("  With $2 deposit, you'd get ~2 market tokens");
        if (minMarketTokens.gt(ethers.utils.parseEther("2"))) {
            console.log("  ❌ Your deposit is too small to meet this minimum!");
        }
    } else {
        console.log("  ✅ No minimum set (0)");
    }
    
    // Check if market already has liquidity
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    const totalSupply = await marketToken.totalSupply();
    
    console.log("\n🏊 Market Liquidity Status:");
    console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
    console.log("  Is First Deposit:", totalSupply.eq(0) ? "YES" : "NO");
    
    // Check deposit method used
    console.log("\n🔧 Deposit Method Analysis:");
    console.log("  Our script used: multicall with sendWnt + sendTokens + createDeposit");
    console.log("  ⚠️  Guide warns: DON'T use multicall with sendTokens + createDeposit!");
    console.log("  Reason: Reentrancy guards conflict when using delegatecall");
    console.log("\n  Recommended approach:");
    console.log("  1. Deploy a helper contract that calls these sequentially");
    console.log("  2. Or use a different pattern without multicall");
    console.log("  3. Or use ExchangeRouter's built-in methods properly");
}

main().catch(console.error);