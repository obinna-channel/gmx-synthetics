const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking RECEIVER_FOR_FIRST_DEPOSIT Configuration ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("Checking possible DataStore keys for RECEIVER_FOR_FIRST_DEPOSIT...\n");
    
    // Try different possible key patterns
    const keysToCheck = [
        // Global receiver
        {
            name: "RECEIVER_FOR_FIRST_DEPOSIT (global)",
            key: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER_FOR_FIRST_DEPOSIT"]))
        },
        // Market-specific receiver
        {
            name: "RECEIVER_FOR_FIRST_DEPOSIT (market-specific)",
            key: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER_FOR_FIRST_DEPOSIT"])),
                    MARKET
                ]
            ))
        },
        // Alternative naming patterns
        {
            name: "FIRST_DEPOSIT_RECEIVER",
            key: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FIRST_DEPOSIT_RECEIVER"]))
        },
        {
            name: "INITIAL_DEPOSIT_RECEIVER",
            key: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_DEPOSIT_RECEIVER"]))
        },
        {
            name: "BOOTSTRAP_RECEIVER",
            key: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["BOOTSTRAP_RECEIVER"]))
        }
    ];
    
    let foundAny = false;
    
    for (const item of keysToCheck) {
        try {
            // Try as address
            const address = await dataStore.getAddress(item.key);
            if (address !== ethers.constants.AddressZero) {
                console.log(`✅ Found ${item.name}:`);
                console.log(`   Address: ${address}`);
                console.log(`   Key: ${item.key}`);
                foundAny = true;
            }
        } catch (e) {
            // Key might not exist or not be an address
        }
    }
    
    if (!foundAny) {
        console.log("❌ No RECEIVER_FOR_FIRST_DEPOSIT found in DataStore\n");
        console.log("This means it's likely hardcoded in the contract.\n");
        console.log("From ExecuteDepositUtils.sol line 76:");
        console.log("  address public constant RECEIVER_FOR_FIRST_DEPOSIT = address(1);");
        console.log("\nSo we should use address(1) for the first deposit.");
    }
    
    // Also check if we can read it from the ExecuteDepositUtils contract
    console.log("\n📍 Trying to read from ExecuteDepositUtils contract...");
    
    // Find ExecuteDepositUtils address from deployments
    const EXECUTE_DEPOSIT_UTILS = "0xA503F72CdDa766890d83994c64360b35B975edb5";
    
    try {
        // Try to call RECEIVER_FOR_FIRST_DEPOSIT as a public constant
        // Note: This might not work if it's not exposed in the ABI
        const contract = new ethers.Contract(
            EXECUTE_DEPOSIT_UTILS,
            ["function RECEIVER_FOR_FIRST_DEPOSIT() view returns (address)"],
            ethers.provider
        );
        
        const receiver = await contract.RECEIVER_FOR_FIRST_DEPOSIT();
        console.log("✅ Successfully read from contract:");
        console.log("   RECEIVER_FOR_FIRST_DEPOSIT =", receiver);
        
        if (receiver === "0x0000000000000000000000000000000000000001") {
            console.log("   This is address(1)!");
        }
        
        console.log("\n📝 Recommendation:");
        console.log("For safety, always use the value from the contract:");
        console.log("  receiver: '0x0000000000000000000000000000000000000001'");
        
    } catch (e) {
        console.log("❌ Could not read from contract:", e.message);
        console.log("\n📝 Since we can't fetch it dynamically, use:");
        console.log("  receiver: '0x0000000000000000000000000000000000000001' // address(1)");
    }
}

main().catch(console.error);