const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market State After Execution ===\n");
    
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    
    // Check total supply
    const totalSupply = await marketToken.totalSupply();
    console.log("🎯 Market Token Total Supply:", ethers.utils.formatEther(totalSupply));
    
    if (totalSupply.eq(0)) {
        console.log("  ❌ No market tokens have been minted yet!");
        console.log("  This confirms the deposit was cancelled.");
    } else {
        console.log("  ✅ Market tokens exist!");
    }
    
    // Check address(1) balance (where first deposit should go)
    const address1 = "0x0000000000000000000000000000000000000001";
    const address1Balance = await marketToken.balanceOf(address1);
    console.log("\nAddress(1) balance:", ethers.utils.formatEther(address1Balance));
    
    // Check pool amounts
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    // Pool amount keys
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    const usdtPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );
    
    const ngnPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, sNGN]
        )
    );
    
    const usdtPoolAmount = await dataStore.getUint(usdtPoolKey);
    const ngnPoolAmount = await dataStore.getUint(ngnPoolKey);
    
    console.log("\n📊 Pool Amounts:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtPoolAmount, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(ngnPoolAmount, 18));
    
    if (usdtPoolAmount.eq(0) && ngnPoolAmount.eq(0)) {
        console.log("\n  ❌ Pool amounts are still zero!");
        console.log("  The deposit was definitely cancelled.");
    }
    
    // Check minimum prices to understand if that's the issue
    const MIN_PRICE_KEYS = [
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_PRICE"])), USDT]
        )),
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_PRICE"])), sNGN]
        ))
    ];
    
    console.log("\n💰 Oracle Prices:");
    for (let i = 0; i < MIN_PRICE_KEYS.length; i++) {
        const minPrice = await dataStore.getUint(MIN_PRICE_KEYS[i]);
        const token = i === 0 ? "USDT" : "sNGN";
        if (minPrice.gt(0)) {
            // Price is stored with 30 decimals
            console.log(`  ${token} min price: ${ethers.utils.formatUnits(minPrice, 30)}`);
        } else {
            console.log(`  ${token} min price: 0 (not set)`);
        }
    }
    
    // Check market configuration
    const IS_MARKET_DISABLED_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["IS_MARKET_DISABLED"])),
                MARKET
            ]
        )
    );
    
    const isDisabled = await dataStore.getBool(IS_MARKET_DISABLED_KEY);
    console.log("\n🎪 Market Status:");
    console.log("  Is Disabled:", isDisabled ? "YES ❌" : "NO ✅");
    
    // Check min market tokens
    const MIN_MARKET_TOKENS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT"])),
                MARKET
            ]
        )
    );
    
    const minMarketTokens = await dataStore.getUint(MIN_MARKET_TOKENS);
    console.log("\n🏯 Min Market Tokens for First Deposit:", ethers.utils.formatEther(minMarketTokens));
    
    if (minMarketTokens.gt(0)) {
        console.log("  ⚠️  This could be blocking the deposit if calculated tokens < minimum");
    }
    
    console.log("\n🔍 Diagnosis:");
    if (totalSupply.eq(0)) {
        console.log("The most likely issue is MinMarketTokens validation.");
        console.log("The calculated market tokens from your deposit were likely below the minimum.");
        console.log("\nPossible solutions:");
        console.log("1. Increase deposit amounts");
        console.log("2. Set MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT to 0");
        console.log("3. Check price configuration (prices might be too high/low)");
    }
}

main().catch(console.error);