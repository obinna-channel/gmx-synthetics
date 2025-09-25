const { ethers } = require("hardhat");

async function main() {
    console.log("=== Executing Existing Deposit ===\n");
    
    const [signer] = await ethers.getSigners();
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    
    // The deposit key we know exists
    const DEPOSIT_KEY = "0xaaa38ef7cd53ff09fbdf662c0f6c39e9641d98d0635fa16aaf6948a389739b6e";
    
    console.log("Deposit key:", DEPOSIT_KEY);
    console.log("Signer:", signer.address);
    
    // Check oracle prices are still set
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("\n✅ Oracle prices are set:");
        console.log("  USDT:", ethers.utils.formatUnits(usdtPrice.min, 30));
        console.log("  sNGN:", ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch (e) {
        console.log("❌ Oracle prices not set!");
        return;
    }
    
    // Simple execution with minimal parameters
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    console.log("\nExecuting deposit...\n");
    
    try {
        const tx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            { gasLimit: 5000000 }
        );
        
        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("\n✅ TRANSACTION COMPLETED");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
        
        // Check for events
        if (receipt.logs && receipt.logs.length > 0) {
            console.log("\nEvents emitted:", receipt.logs.length);
            
            // Look for key events
            const eventEmitter = await ethers.getContractAt("EventEmitter", "0x9f7A35862dF4513e59d63CCEac1eB15E0F887aD2");
            
            for (const log of receipt.logs) {
                try {
                    const parsed = eventEmitter.interface.parseLog(log);
                    if (parsed.name === "DepositExecuted" || 
                        parsed.name === "DepositCancelled" ||
                        parsed.name === "MarketPoolValueInfo") {
                        console.log(`  ${parsed.name}`);
                    }
                } catch {}
            }
        } else {
            console.log("\n⚠️ No events emitted");
        }
        
    } catch (error) {
        console.log("\n❌ EXECUTION FAILED");
        console.log("Error:", error.message);
        
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
    
    // Check if deposit still exists
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
    console.log("\nDeposits remaining:", depositCount.toString());
    
    if (depositCount.eq(0)) {
        console.log("✅ Deposit was processed (no longer in queue)");
    } else {
        console.log("❌ Deposit still exists (was not executed)");
    }
}

main().catch(console.error);