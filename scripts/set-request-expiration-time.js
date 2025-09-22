const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting REQUEST_EXPIRATION_TIME ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Compute the key for REQUEST_EXPIRATION_TIME
    const REQUEST_EXPIRATION_TIME_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
    );

    console.log("REQUEST_EXPIRATION_TIME key:", REQUEST_EXPIRATION_TIME_KEY);

    // Check current value
    const currentValue = await dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY);
    console.log("\nCurrent REQUEST_EXPIRATION_TIME:", currentValue.toString(), "seconds");

    if (currentValue.eq(0)) {
        console.log("  ⚠️  Not set (0) - deposits expire immediately!");
    } else {
        console.log("  =", currentValue.div(60).toString(), "minutes");
        console.log("  =", currentValue.div(3600).toString(), "hours");
    }

    // Set new value - 1 hour (3600 seconds) is reasonable
    const newValue = 3600; // 1 hour
    console.log("\nSetting REQUEST_EXPIRATION_TIME to:", newValue, "seconds (1 hour)");

    try {
        const tx = await dataStore.setUint(REQUEST_EXPIRATION_TIME_KEY, newValue);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Transaction confirmed");

        // Verify the new value
        const updatedValue = await dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY);
        console.log("\nNew REQUEST_EXPIRATION_TIME:", updatedValue.toString(), "seconds");
        console.log("  =", updatedValue.div(60).toString(), "minutes");

        // Calculate if our deposit is still valid
        console.log("\n📊 Deposit Validity Check:");
        const depositCreationTime = 1758501155; // From our error
        const currentTime = Math.floor(Date.now() / 1000);
        const depositAge = currentTime - depositCreationTime;

        console.log("  Deposit created at:", depositCreationTime);
        console.log("  Current time:", currentTime);
        console.log("  Deposit age:", depositAge, "seconds");
        console.log("  Expiration window:", updatedValue.toString(), "seconds");

        if (depositAge > updatedValue.toNumber()) {
            console.log("  ❌ Deposit has already expired!");
            console.log("  You'll need to create a new deposit");
        } else {
            const timeRemaining = updatedValue.toNumber() - depositAge;
            console.log("  ✅ Deposit is still valid!");
            console.log("  Time remaining:", timeRemaining, "seconds");
        }

    } catch (error) {
        console.log("❌ Error setting REQUEST_EXPIRATION_TIME:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });