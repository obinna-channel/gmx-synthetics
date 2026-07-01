# Keeper Separation Implementation Plan

**Goal:** Separate order execution and liquidation monitoring into two independent keepers with different wallets, using an upgraded MockOracleProvider that supports multiple price updaters.

**Created:** 2024-11-16
**Status:** Planning Complete - Ready for Implementation

---

## Table of Contents

1. [Phase 1: Contract Modification](#phase-1-contract-modification)
2. [Phase 2: Deployment](#phase-2-deployment)
3. [Phase 3: DataStore Configuration](#phase-3-datastore-configuration)
4. [Phase 4: Identify Keeper Wallets](#phase-4-identify-keeper-wallets)
5. [Phase 5: Assign RoleStore Roles](#phase-5-assign-rolestore-roles)
6. [Phase 6: Authorize Price Updaters](#phase-6-authorize-price-updaters)
7. [Phase 7: Update Keeper Scripts](#phase-7-update-keeper-scripts)
8. [Phase 8: Testing](#phase-8-testing)
9. [Phase 9: Cleanup](#phase-9-cleanup-optional)
10. [Reference Information](#reference-information)

---

## Phase 1: Contract Modification

### Step 1.1: Modify MockOracleProvider.sol

Add role-based access control to allow multiple price updaters.

**Location:** `contracts/oracle/MockOracleProvider.sol`

**Changes to make:**

1. Add state variable:
```solidity
mapping(address => bool) public isPriceUpdater;
```

2. Add new modifier:
```solidity
modifier onlyOwnerOrPriceUpdater() {
    require(
        msg.sender == owner || isPriceUpdater[msg.sender],
        "MockOracleProvider: unauthorized"
    );
    _;
}
```

3. Add management functions:
```solidity
function grantPriceUpdater(address updater) external onlyOwner {
    isPriceUpdater[updater] = true;
}

function revokePriceUpdater(address updater) external onlyOwner {
    isPriceUpdater[updater] = false;
}
```

4. Update existing functions:
   - Change `setPriceWithPrecision()` modifier from `onlyOwner` to `onlyOwnerOrPriceUpdater`
   - Change `setPrice()` modifier from `onlyOwner` to `onlyOwnerOrPriceUpdater`

**Access Control Design:**

| Action | Owner | Price Updater |
|--------|-------|---------------|
| Update prices (`setPriceWithPrecision`, `setPrice`) | ✅ YES | ✅ YES |
| Grant/revoke updater role | ✅ YES | ❌ NO |
| Transfer ownership | ✅ YES | ❌ NO |

### Step 1.2: Review and Test Contract (Optional)

- Write unit tests for new access control
- Test that owner can still update prices
- Test that authorized updaters can update prices
- Test that unauthorized addresses cannot update prices
- Ensure backward compatibility

---

## Phase 2: Deployment

### Step 2.1: Create Deployment Script

Create file: `scripts/deploy-new-mock-oracle-provider.js`

```javascript
const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEPLOYING NEW MOCK ORACLE PROVIDER ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy MockOracleProvider
    const MockOracleProvider = await ethers.getContractFactory(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider"
    );

    console.log("\nDeploying MockOracleProvider...");
    const mockProvider = await MockOracleProvider.deploy();
    await mockProvider.deployed();

    console.log("\n✅ MockOracleProvider deployed to:", mockProvider.address);
    console.log("   Owner:", await mockProvider.owner());

    // Save address to file
    const fs = require('fs');
    const addressFile = './keeper/new_mock_provider_address.txt';
    fs.writeFileSync(addressFile, mockProvider.address);
    console.log("\n💾 Address saved to:", addressFile);

    console.log("\n📝 Next steps:");
    console.log("1. Verify on Arbiscan");
    console.log("2. Update DataStore configuration");
    console.log("3. Authorize keeper wallets");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Step 2.2: Deploy to Arbitrum Sepolia

```bash
npx hardhat run scripts/deploy-new-mock-oracle-provider.js --network arbitrumSepolia
```

**Requirements:**
- Deployer wallet needs ETH for gas
- Save the deployed address - needed for all subsequent phases

### Step 2.3: Verify Contract on Arbiscan

```bash
npx hardhat verify --network arbitrumSepolia <DEPLOYED_ADDRESS>
```

---

## Phase 3: DataStore Configuration

**Prerequisites:**
- ✅ New MockOracleProvider deployed (Phase 2)
- ✅ Wallet with `CONTROLLER` role
- ✅ DataStore address: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`

### Step 3.1: Enable New Provider in DataStore

Create file: `scripts/configure-new-oracle-provider.js`

```javascript
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("=== CONFIGURING NEW ORACLE PROVIDER ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Configuring with account:", signer.address);

    // Addresses
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";

    // Read new provider address
    const newProviderAddress = fs.readFileSync('./keeper/new_mock_provider_address.txt', 'utf8').trim();
    console.log("New MockOracleProvider:", newProviderAddress);

    // Check CONTROLLER role
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);

    if (!hasController) {
        throw new Error("❌ Signer needs CONTROLLER role to update DataStore");
    }
    console.log("✅ Signer has CONTROLLER role\n");

    // Get DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);

    // Step 1: Enable new provider
    console.log("Step 1: Enabling new provider...");
    const isProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), newProviderAddress]
        )
    );

    const tx1 = await dataStore.setBool(isProviderEnabledKey, true);
    await tx1.wait();
    console.log("   ✅ Provider enabled\n");

    // Step 2: Set provider for all tokens
    console.log("Step 2: Setting provider for all tokens...");

    const tokens = {
        mUSDTNGN: "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73",
        mTSLA: "0x77d4DdD2E847592fb7710e342C0492A4b85655f4",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
        mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",
        mAAPL: "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e",
        mNVDA: "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325",
        mMETA: "0xE2f8B015D23bB0EFdD57D8C08a328180437D031D",
        mUSDTARS: "0xed6890bE2409F0db06a00C809a298E2E06553BE1",
        mPKR: "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD",
        mCOP: "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8",
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6"
    };

    for (const [name, tokenAddress] of Object.entries(tokens)) {
        const providerKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN"),
                    ORACLE,
                    tokenAddress
                ]
            )
        );

        const tx = await dataStore.setAddress(providerKey, newProviderAddress);
        await tx.wait();
        console.log(`   ✅ Set provider for ${name}`);
    }

    console.log("\n🎉 DataStore configuration complete!");
    console.log("\n📝 Next steps:");
    console.log("1. Verify provider is enabled");
    console.log("2. Authorize keeper wallets as price updaters");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Step 3.2: Run Configuration Script

```bash
npx hardhat run scripts/configure-new-oracle-provider.js --network arbitrumSepolia
```

### Step 3.3: Verify Configuration

Create file: `scripts/verify-oracle-provider-config.js`

```javascript
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";

    const newProviderAddress = fs.readFileSync('./keeper/new_mock_provider_address.txt', 'utf8').trim();

    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);

    // Check if provider is enabled
    const isProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), newProviderAddress]
        )
    );
    const isEnabled = await dataStore.getBool(isProviderEnabledKey);
    console.log("Provider enabled:", isEnabled ? "✅ YES" : "❌ NO");

    // Check one token as example
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const providerKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN"), ORACLE, mUSD]
        )
    );
    const provider = await dataStore.getAddress(providerKey);
    console.log("Provider for mUSD:", provider);
    console.log("Matches new provider:", provider.toLowerCase() === newProviderAddress.toLowerCase() ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
```

---

## Phase 4: Identify Keeper Wallets

### Step 4.1: Determine Order Keeper Wallet

**Option 1: Check existing keeper**
```bash
cd keeper
grep UPDATER_PRIVATE_KEY .env
```

**Option 2: Choose from existing 9 keeper wallets**

All 9 addresses below currently have both ORDER_KEEPER and LIQUIDATION_KEEPER roles:

1. `0x3053c7edC20aa08d225CdeC9688136c4ab9F9963`
2. `0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3`
3. `0xC84f3398eDf6336E1Ef55b50Ca3F9f9f96B8b504`
4. `0xFb11f15f206bdA02c224EDC744b0E50E46137046`
5. `0xb38302e27bAe8932536A84ab362c3d1013420Cb4`
6. `0xc9e1CE91d3f782499cFe787b6F1d2AF0Ca76C049`
7. `0x9f7198eb1b9Ccc0Eb7A07eD228d8FbC12963ea33`
8. `0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0`
9. `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292` (also MockOracleProvider owner)

**Decision:** Order Keeper Address = `________________`

### Step 4.2: Determine Liquidation Keeper Wallet

**Requirements:**
- Must be different from Order Keeper wallet
- Can be one of the existing 9, OR a completely new wallet
- Needs some ETH for gas

**Decision:** Liquidation Keeper Address = `________________`

### Step 4.3: Identify Admin Wallet

Need wallet with both `ROLE_ADMIN` and `CONTROLLER` roles.

**Wallets with ROLE_ADMIN** (from our check):
- `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
- `0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0`
- `0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3`

**Decision:** Admin Wallet = `________________`

---

## Phase 5: Assign RoleStore Roles

**Prerequisites:**
- ✅ Order Keeper address identified
- ✅ Liquidation Keeper address identified
- ✅ Wallet with `ROLE_ADMIN` role
- ✅ RoleStore address: `0x4943c063691259B677f3D7BC808C9C3090321EbB`

### Step 5.1: Create Role Assignment Script

Create file: `scripts/assign-keeper-roles.js`

```javascript
const { ethers } = require("hardhat");

async function main() {
    console.log("=== ASSIGNING KEEPER ROLES ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Assigning with account:", signer.address);

    // Addresses - UPDATE THESE
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const ORDER_KEEPER_ADDRESS = "0x________________";  // TODO: Fill in
    const LIQUIDATION_KEEPER_ADDRESS = "0x________________";  // TODO: Fill in

    // Get RoleStore
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Calculate role hashes
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    const LIQUIDATION_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LIQUIDATION_KEEPER"])
    );
    const ROLE_ADMIN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
    );

    // Check signer has ROLE_ADMIN
    const hasRoleAdmin = await roleStore.hasRole(signer.address, ROLE_ADMIN);
    if (!hasRoleAdmin) {
        throw new Error("❌ Signer needs ROLE_ADMIN to grant roles");
    }
    console.log("✅ Signer has ROLE_ADMIN\n");

    // Check current roles
    console.log("Checking current roles...");
    const orderHasOrderRole = await roleStore.hasRole(ORDER_KEEPER_ADDRESS, ORDER_KEEPER);
    const orderHasLiqRole = await roleStore.hasRole(ORDER_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
    const liqHasLiqRole = await roleStore.hasRole(LIQUIDATION_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
    const liqHasOrderRole = await roleStore.hasRole(LIQUIDATION_KEEPER_ADDRESS, ORDER_KEEPER);

    console.log(`Order Keeper (${ORDER_KEEPER_ADDRESS}):`);
    console.log(`  Has ORDER_KEEPER: ${orderHasOrderRole ? "✅" : "❌"}`);
    console.log(`  Has LIQUIDATION_KEEPER: ${orderHasLiqRole ? "✅" : "❌"}`);
    console.log(`Liquidation Keeper (${LIQUIDATION_KEEPER_ADDRESS}):`);
    console.log(`  Has LIQUIDATION_KEEPER: ${liqHasLiqRole ? "✅" : "❌"}`);
    console.log(`  Has ORDER_KEEPER: ${liqHasOrderRole ? "✅" : "❌"}`);
    console.log();

    // Grant ORDER_KEEPER to order keeper
    if (!orderHasOrderRole) {
        console.log("Granting ORDER_KEEPER to order keeper...");
        const tx1 = await roleStore.grantRole(ORDER_KEEPER_ADDRESS, ORDER_KEEPER);
        await tx1.wait();
        console.log("   ✅ Granted\n");
    } else {
        console.log("   ℹ️  Order keeper already has ORDER_KEEPER role\n");
    }

    // Grant LIQUIDATION_KEEPER to liquidation keeper
    if (!liqHasLiqRole) {
        console.log("Granting LIQUIDATION_KEEPER to liquidation keeper...");
        const tx2 = await roleStore.grantRole(LIQUIDATION_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
        await tx2.wait();
        console.log("   ✅ Granted\n");
    } else {
        console.log("   ℹ️  Liquidation keeper already has LIQUIDATION_KEEPER role\n");
    }

    // Enforce separation (optional but recommended)
    console.log("Enforcing strict role separation...");

    if (orderHasLiqRole) {
        console.log("Revoking LIQUIDATION_KEEPER from order keeper...");
        const tx3 = await roleStore.revokeRole(ORDER_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
        await tx3.wait();
        console.log("   ✅ Revoked");
    }

    if (liqHasOrderRole) {
        console.log("Revoking ORDER_KEEPER from liquidation keeper...");
        const tx4 = await roleStore.revokeRole(LIQUIDATION_KEEPER_ADDRESS, ORDER_KEEPER);
        await tx4.wait();
        console.log("   ✅ Revoked");
    }

    console.log("\n🎉 Role assignment complete!");

    // Verify final state
    console.log("\nFinal verification:");
    const finalOrderHasOrder = await roleStore.hasRole(ORDER_KEEPER_ADDRESS, ORDER_KEEPER);
    const finalOrderHasLiq = await roleStore.hasRole(ORDER_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
    const finalLiqHasLiq = await roleStore.hasRole(LIQUIDATION_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
    const finalLiqHasOrder = await roleStore.hasRole(LIQUIDATION_KEEPER_ADDRESS, ORDER_KEEPER);

    console.log(`Order Keeper: ORDER_KEEPER=${finalOrderHasOrder ? "✅" : "❌"}, LIQUIDATION_KEEPER=${finalOrderHasLiq ? "❌" : "✅"}`);
    console.log(`Liquidation Keeper: LIQUIDATION_KEEPER=${finalLiqHasLiq ? "✅" : "❌"}, ORDER_KEEPER=${finalLiqHasOrder ? "❌" : "✅"}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Step 5.2: Run Role Assignment Script

```bash
npx hardhat run scripts/assign-keeper-roles.js --network arbitrumSepolia
```

---

## Phase 6: Authorize Price Updaters

**Prerequisites:**
- ✅ New MockOracleProvider deployed
- ✅ Wallet that owns the new MockOracleProvider (the deployer)
- ✅ Order Keeper and Liquidation Keeper addresses

### Step 6.1: Create Price Updater Authorization Script

Create file: `scripts/authorize-price-updaters.js`

```javascript
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("=== AUTHORIZING PRICE UPDATERS ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Authorizing with account:", signer.address);

    // Addresses - UPDATE THESE
    const ORDER_KEEPER_ADDRESS = "0x________________";  // TODO: Fill in
    const LIQUIDATION_KEEPER_ADDRESS = "0x________________";  // TODO: Fill in

    // Read new provider address
    const newProviderAddress = fs.readFileSync('./keeper/new_mock_provider_address.txt', 'utf8').trim();
    console.log("MockOracleProvider:", newProviderAddress);

    // Get contract
    const mockProvider = await ethers.getContractAt(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider",
        newProviderAddress
    );

    // Check owner
    const owner = await mockProvider.owner();
    console.log("Owner:", owner);

    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error("❌ Signer is not the owner of MockOracleProvider");
    }
    console.log("✅ Signer is owner\n");

    // Authorize order keeper
    console.log("Authorizing order keeper as price updater...");
    const tx1 = await mockProvider.grantPriceUpdater(ORDER_KEEPER_ADDRESS);
    await tx1.wait();
    console.log("   ✅ Order keeper authorized\n");

    // Authorize liquidation keeper
    console.log("Authorizing liquidation keeper as price updater...");
    const tx2 = await mockProvider.grantPriceUpdater(LIQUIDATION_KEEPER_ADDRESS);
    await tx2.wait();
    console.log("   ✅ Liquidation keeper authorized\n");

    // Verify
    console.log("Verifying authorizations...");
    const orderAuthorized = await mockProvider.isPriceUpdater(ORDER_KEEPER_ADDRESS);
    const liqAuthorized = await mockProvider.isPriceUpdater(LIQUIDATION_KEEPER_ADDRESS);

    console.log(`  Order Keeper: ${orderAuthorized ? "✅ Authorized" : "❌ Not authorized"}`);
    console.log(`  Liquidation Keeper: ${liqAuthorized ? "✅ Authorized" : "❌ Not authorized"}`);

    console.log("\n🎉 Price updater authorization complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Step 6.2: Run Authorization Script

```bash
npx hardhat run scripts/authorize-price-updaters.js --network arbitrumSepolia
```

---

## Phase 7: Update Keeper Scripts

### Step 7.1: Update order_keeper_v2.py

**File:** `keeper/order_keeper_v2.py`

**Changes:**

1. **Update MockOracleProvider address:**
```python
def load_mock_provider_address(self):
    """Load MockOracleProvider address from file"""
    try:
        with open('new_mock_provider_address.txt', 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        return None
```

2. **Remove liquidation code:**
   - Delete `LiquidationMonitor` class (lines ~474-1097)
   - Remove `self.liquidation_monitor` initialization
   - Remove liquidation task from `asyncio.gather()` in `run()`
   - Remove `LIQUIDATION_HANDLER` if only used for liquidations

3. **Update environment variable:**
```python
# Change from:
private_key = os.getenv("UPDATER_PRIVATE_KEY")

# To:
private_key = os.getenv("ORDER_KEEPER_PRIVATE_KEY")
```

4. **Simplify run() method:**
```python
async def run(self):
    """Main entry point - orders only"""

    # Connect to price feeds
    await asyncio.gather(
        connect_crypto_feed(),
        connect_stock_feed()
    )

    # Start order recovery
    recovery_task = asyncio.create_task(run_recovery())

    # Start conditional order monitor
    monitor_task = asyncio.create_task(self.monitor_conditional_orders())

    # Start websocket listener
    websocket_task = asyncio.create_task(run_websocket())

    # Wait for all tasks
    await asyncio.gather(
        recovery_task,
        monitor_task,
        websocket_task
    )
```

### Step 7.2: Create liquidation_keeper.py

**File:** `keeper/liquidation_keeper.py`

**Structure:**

```python
"""
Liquidation Keeper - Monitors and executes position liquidations
Extracted from order_keeper_v2.py to run as separate process
"""

import asyncio
import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

class LiquidationMonitor:
    """
    Monitors all open positions and executes liquidations when necessary
    (Copied from order_keeper_v2.py with modifications)
    """
    # ... existing LiquidationMonitor code ...

class LiquidationKeeper:
    def __init__(self):
        """Initialize the liquidation keeper"""

        # Setup Web3
        alchemy_key = os.getenv("ALCHEMY_KEY")
        private_key = os.getenv("LIQUIDATION_KEEPER_PRIVATE_KEY")  # NEW ENV VAR

        if not private_key:
            raise ValueError("Please set LIQUIDATION_KEEPER_PRIVATE_KEY in .env")

        self.HTTP_URL = f"https://arb-sepolia.g.alchemy.com/v2/{alchemy_key}"
        self.w3 = Web3(Web3.HTTPProvider(self.HTTP_URL))
        self.account = self.w3.eth.account.from_key(private_key)

        # Contract addresses
        self.DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
        self.READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8"
        self.REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547"
        self.LIQUIDATION_HANDLER = "0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B"

        # Load NEW MockOracleProvider address
        self.MOCK_PROVIDER = self.load_mock_provider_address()

        # Price feeds
        self.PRICE_FEED_URL = "https://marks-server-a58cc19eb539.herokuapp.com/"
        self.price_cache = {}
        self.price_update_queue = asyncio.Queue()

        # Initialize price feeds
        self.crypto_feed = PriceFeedManager(...)
        self.stock_feed = StockPriceFeedManager(...)

        # Initialize liquidation monitor
        self.liquidation_monitor = LiquidationMonitor(self, ...)

    def load_mock_provider_address(self):
        """Load new MockOracleProvider address"""
        try:
            with open('new_mock_provider_address.txt', 'r') as f:
                return f.read().strip()
        except FileNotFoundError:
            print("⚠️  new_mock_provider_address.txt not found")
            return None

    async def run(self):
        """Main entry point"""

        print("=" * 60)
        print("       LIQUIDATION KEEPER")
        print("=" * 60)

        # Connect to price feeds
        await asyncio.gather(
            self.crypto_feed.connect(),
            self.stock_feed.connect()
        )

        # Initialize liquidation monitor
        await self.liquidation_monitor.async_init()

        # Start liquidation monitor
        await self.liquidation_monitor.monitor_loop()

async def main():
    """Run the liquidation keeper"""
    keeper = LiquidationKeeper()
    await keeper.run()

if __name__ == "__main__":
    print("\n🚀 Starting Liquidation Keeper\n")
    asyncio.run(main())
```

### Step 7.3: Update Environment Configuration

**File:** `keeper/.env`

Add new environment variables:

```bash
# Keeper Wallets
ORDER_KEEPER_PRIVATE_KEY=0x...
LIQUIDATION_KEEPER_PRIVATE_KEY=0x...

# Keep existing vars
ALCHEMY_KEY=...
INFURA_KEY=...
```

### Step 7.4: Create New Mock Provider Address File

```bash
cd keeper
echo "0x________________" > new_mock_provider_address.txt
# Replace with actual deployed address from Phase 2
```

### Step 7.5: Update Documentation

Update `keeper/README_HEROKU.md` or create new `keeper/README.md` with:

- Architecture overview (two separate keepers)
- Which wallet does what
- How to run each keeper
- Environment variable requirements

---

## Phase 8: Testing

### Step 8.1: Test Price Updates

**Test Order Keeper:**

```bash
cd keeper

# Quick test
python3 << EOF
from order_keeper_v2 import OrderKeeper
import asyncio

async def test():
    keeper = OrderKeeper()
    success = await keeper.update_mock_provider_prices()
    print(f'Order keeper price update: {"✅ SUCCESS" if success else "❌ FAILED"}')

asyncio.run(test())
EOF
```

**Test Liquidation Keeper:**

```bash
cd keeper

# Quick test
python3 << EOF
from liquidation_keeper import LiquidationKeeper
import asyncio

async def test():
    keeper = LiquidationKeeper()
    success = await keeper.update_mock_provider_prices()
    print(f'Liquidation keeper price update: {"✅ SUCCESS" if success else "❌ FAILED"}')

asyncio.run(test())
EOF
```

### Step 8.2: Test Order Execution

1. **Create test order:**
   - Use frontend or create via script
   - Create a simple market increase order

2. **Start order keeper:**
```bash
cd keeper
python3 order_keeper_v2.py
```

3. **Monitor logs:**
   - Watch for OrderCreated event
   - Verify order is detected and executed
   - Check transaction on Arbiscan

4. **Verify success:**
   - Transaction should succeed
   - No errors in logs
   - Prices updated correctly

### Step 8.3: Test Liquidation Monitoring

**If you can create liquidatable position:**

1. Open position near liquidation threshold
2. Start liquidation keeper
3. Watch for liquidation detection
4. Verify liquidation executes

**If not possible (testnet limitations):**

```bash
cd keeper
python3 liquidation_keeper.py
```

Monitor logs for:
- ✅ Price feed connections
- ✅ Position cache refresh
- ✅ Periodic scans
- ✅ No errors

### Step 8.4: Integration Test - Run Both Keepers

**Terminal 1 - Order Keeper:**
```bash
cd keeper
python3 order_keeper_v2.py
```

**Terminal 2 - Liquidation Keeper:**
```bash
cd keeper
python3 liquidation_keeper.py
```

**Monitor for 1-2 hours:**

- [ ] Both connect to price feeds successfully
- [ ] Both update prices on MockOracleProvider independently
- [ ] No nonce conflicts between keepers
- [ ] Orders execute correctly (if any created)
- [ ] Liquidations scan correctly
- [ ] No crashes or errors
- [ ] Both can operate simultaneously

### Step 8.5: Verify On-Chain State

Create file: `scripts/verify-complete-setup.js`

```javascript
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("=== VERIFYING COMPLETE SETUP ===\n");

    // Addresses - UPDATE THESE
    const ORDER_KEEPER_ADDRESS = "0x________________";
    const LIQUIDATION_KEEPER_ADDRESS = "0x________________";
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";

    const newProviderAddress = fs.readFileSync('./keeper/new_mock_provider_address.txt', 'utf8').trim();

    // Get contracts
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);
    const mockProvider = await ethers.getContractAt(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider",
        newProviderAddress
    );

    // Calculate role hashes
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    const LIQUIDATION_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LIQUIDATION_KEEPER"])
    );

    console.log("1. RoleStore Roles:");
    const orderHasOrder = await roleStore.hasRole(ORDER_KEEPER_ADDRESS, ORDER_KEEPER);
    const orderHasLiq = await roleStore.hasRole(ORDER_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
    const liqHasLiq = await roleStore.hasRole(LIQUIDATION_KEEPER_ADDRESS, LIQUIDATION_KEEPER);
    const liqHasOrder = await roleStore.hasRole(LIQUIDATION_KEEPER_ADDRESS, ORDER_KEEPER);

    console.log(`   Order Keeper:`);
    console.log(`     ORDER_KEEPER: ${orderHasOrder ? "✅" : "❌"}`);
    console.log(`     LIQUIDATION_KEEPER: ${orderHasLiq ? "❌ (should not have)" : "✅"}`);
    console.log(`   Liquidation Keeper:`);
    console.log(`     LIQUIDATION_KEEPER: ${liqHasLiq ? "✅" : "❌"}`);
    console.log(`     ORDER_KEEPER: ${liqHasOrder ? "❌ (should not have)" : "✅"}`);

    console.log("\n2. MockOracleProvider Price Updaters:");
    const orderCanUpdate = await mockProvider.isPriceUpdater(ORDER_KEEPER_ADDRESS);
    const liqCanUpdate = await mockProvider.isPriceUpdater(LIQUIDATION_KEEPER_ADDRESS);

    console.log(`   Order Keeper: ${orderCanUpdate ? "✅" : "❌"}`);
    console.log(`   Liquidation Keeper: ${liqCanUpdate ? "✅" : "❌"}`);

    console.log("\n3. DataStore Oracle Provider:");

    // Check provider is enabled
    const isProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), newProviderAddress]
        )
    );
    const isEnabled = await dataStore.getBool(isProviderEnabledKey);
    console.log(`   Provider enabled: ${isEnabled ? "✅" : "❌"}`);

    // Check provider for sample token (mUSD)
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const providerKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN"), ORACLE, mUSD]
        )
    );
    const provider = await dataStore.getAddress(providerKey);
    console.log(`   Provider for mUSD: ${provider}`);
    console.log(`   Matches new provider: ${provider.toLowerCase() === newProviderAddress.toLowerCase() ? "✅" : "❌"}`);

    console.log("\n4. Summary:");
    const allGood = orderHasOrder && !orderHasLiq && liqHasLiq && !liqHasOrder &&
                    orderCanUpdate && liqCanUpdate && isEnabled &&
                    provider.toLowerCase() === newProviderAddress.toLowerCase();

    if (allGood) {
        console.log("   🎉 All checks passed! Setup is complete.");
    } else {
        console.log("   ⚠️  Some checks failed. Review above.");
    }
}

main().catch(console.error);
```

Run verification:
```bash
npx hardhat run scripts/verify-complete-setup.js --network arbitrumSepolia
```

---

## Phase 9: Cleanup (Optional)

**⚠️ Only perform after 24+ hours of successful operation**

### Step 9.1: Disable Old Provider

Create file: `scripts/disable-old-oracle-provider.js`

```javascript
const { ethers } = require("hardhat");

async function main() {
    console.log("=== DISABLING OLD ORACLE PROVIDER ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Disabling with account:", signer.address);

    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const OLD_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);

    const oldProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), OLD_PROVIDER]
        )
    );

    console.log("Disabling old provider...");
    const tx = await dataStore.setBool(oldProviderKey, false);
    await tx.wait();

    console.log("✅ Old provider disabled");
    console.log("   Address:", OLD_PROVIDER);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Step 9.2: Archive Old Code

```bash
# Create archive
mkdir -p keeper/archive

# Move old version
cp keeper/order_keeper_v2.py keeper/archive/order_keeper_v2_with_liquidations_$(date +%Y%m%d).py

# Tag git commit
git add .
git commit -m "Keeper separation: split order and liquidation keepers"
git tag -a keeper-separation-v1 -m "Separated order and liquidation keepers with new MockOracleProvider"
```

### Step 9.3: Update Documentation

Update or create:
- `keeper/README.md` - New architecture
- `claude/plans/keeper-separation-implementation-plan.md` - Mark as completed
- Update deployment docs with new MockOracleProvider address

---

## Reference Information

### Contract Addresses (Arbitrum Sepolia)

| Contract | Address | Notes |
|----------|---------|-------|
| RoleStore | `0x4943c063691259B677f3D7BC808C9C3090321EbB` | Manages keeper roles |
| DataStore | `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111` | Stores oracle provider config |
| Oracle | `0xE89d94669f49D278cCD094A084139eB6639C0a93` | Uses oracle providers |
| Old MockOracleProvider | `0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5` | Original, single-owner |
| New MockOracleProvider | `0x________________` | **From Phase 2** |
| OrderHandler | `0x83f2D66af7f794893C31c0B32BD2D4cE826871d7` | Executes orders |
| LiquidationHandler | `0x08eEB7f410d94FF4B0a637b81d2bcD62A2FCBC8B` | Executes liquidations |
| Reader | `0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8` | Reads position data |

### Token Addresses (for Oracle Provider Config)

| Token | Address |
|-------|---------|
| mUSDTNGN | `0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73` |
| mTSLA | `0x77d4DdD2E847592fb7710e342C0492A4b85655f4` |
| mUSD | `0x85bf04B07A6df0172372b959C1C73F3e90F73faf` |
| mNGN | `0x2e08218698339AFdba205312cc23dAe8c3690827` |
| mAAPL | `0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e` |
| mNVDA | `0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325` |
| mMETA | `0xE2f8B015D23bB0EFdD57D8C08a328180437D031D` |
| mUSDTARS | `0xed6890bE2409F0db06a00C809a298E2E06553BE1` |
| mPKR | `0xDC7e9F5a3D337161880d084131BC16214f2F8EBD` |
| mCOP | `0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8` |
| USDT | `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6` |

### Role Hashes

| Role | Hash |
|------|------|
| ORDER_KEEPER | `0x40a07f8f0fc57fcf18b093d96362a8e661eaac7b7e6edbf66f242111f83a6794` |
| LIQUIDATION_KEEPER | `0x556c788ffc0574ec93966d808c170833d96489c9c58f5bcb3dadf711ba28720e` |
| ROLE_ADMIN | `0x56908b85b56869d7c69cd020749874f238259af9646ca930287866cdd660b7d9` |
| CONTROLLER | `0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b` |

### Required Permissions Summary

| Phase | Required Role/Permission | Purpose |
|-------|------------------------|---------|
| 2 (Deploy) | ETH for gas | Deploy contract |
| 3 (DataStore) | CONTROLLER | Update DataStore |
| 5 (Roles) | ROLE_ADMIN | Grant keeper roles |
| 6 (Price Updaters) | MockOracle Owner | Authorize price updaters |
| 7 (Keepers) | ORDER_KEEPER + isPriceUpdater | Execute orders |
| 7 (Keepers) | LIQUIDATION_KEEPER + isPriceUpdater | Execute liquidations |

### Wallets with Admin Roles (Current)

**ROLE_ADMIN holders:**
- `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
- `0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0`
- `0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3`

**Current keeper wallets (have both ORDER_KEEPER and LIQUIDATION_KEEPER):**
1. `0x3053c7edC20aa08d225CdeC9688136c4ab9F9963`
2. `0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3`
3. `0xC84f3398eDf6336E1Ef55b50Ca3F9f9f96B8b504`
4. `0xFb11f15f206bdA02c224EDC744b0E50E46137046`
5. `0xb38302e27bAe8932536A84ab362c3d1013420Cb4`
6. `0xc9e1CE91d3f782499cFe787b6F1d2AF0Ca76C049`
7. `0x9f7198eb1b9Ccc0Eb7A07eD228d8FbC12963ea33`
8. `0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0`
9. `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

---

## Decision Checklist

Before starting implementation, complete this checklist:

- [ ] **Order Keeper Address:** `________________`
- [ ] **Liquidation Keeper Address:** `________________`
- [ ] **Admin Wallet for Roles:** `________________`
- [ ] **Admin Wallet for DataStore:** `________________`
- [ ] **Deployer Wallet:** `________________`
- [ ] Confirm admin wallets have ROLE_ADMIN + CONTROLLER roles
- [ ] Confirm deployer wallet has ETH for gas
- [ ] Backup current `.env` file
- [ ] Backup current `order_keeper_v2.py`

---

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| 1. Modify Contract | 1-2 hours | - |
| 2. Deploy | 30 min | Phase 1 |
| 3. DataStore Config | 1 hour | Phase 2, CONTROLLER role |
| 4. Identify Wallets | 30 min - 1 day | Access to wallets/keys |
| 5. Assign Roles | 30 min | Phase 4, ROLE_ADMIN |
| 6. Price Updaters | 30 min | Phase 2, 4 |
| 7. Update Scripts | 3-4 hours | Phase 2, 4 |
| 8. Testing | 4-8 hours | Phase 7 |
| 9. Cleanup | 1 hour | Phase 8 success |

**Total: 1-2 days** (assuming no blockers with wallet access)

---

## Success Criteria

✅ **Phase Complete When:**

1. New MockOracleProvider deployed and verified
2. DataStore configured for new provider (all 11 tokens)
3. Order keeper has ORDER_KEEPER role only
4. Liquidation keeper has LIQUIDATION_KEEPER role only
5. Both keepers authorized as price updaters
6. order_keeper_v2.py handles orders only
7. liquidation_keeper.py handles liquidations only
8. Both can run simultaneously without conflicts
9. Orders execute successfully
10. Liquidations scan correctly
11. All on-chain state verified

---

## Rollback Plan

If issues arise:

1. **Keep old provider enabled** - don't disable until fully tested
2. **Revert keeper scripts** - use archived versions
3. **Restore roles** - re-grant original role assignments
4. **DataStore can point to old provider** - just update addresses

Old MockOracleProvider: `0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5`

---

## Support & Troubleshooting

### Common Issues

**Issue: "Only owner" error when updating prices**
- Solution: Check wallet is authorized via `isPriceUpdater(address)`
- Run: `scripts/authorize-price-updaters.js`

**Issue: Order execution fails**
- Check ORDER_KEEPER role: `scripts/verify-complete-setup.js`
- Check oracle provider is set for tokens

**Issue: Nonce conflicts between keepers**
- Confirm using different private keys
- Check `.env` has separate keys

**Issue: "Invalid oracle provider" error**
- Check provider is enabled in DataStore
- Verify provider is set for the specific token

### Debug Scripts

All verification scripts in `scripts/`:
- `check-keeper-roles.js` - Check RoleStore assignments
- `verify-oracle-provider-config.js` - Check DataStore config
- `verify-complete-setup.js` - Complete system check

---

**Status:** Ready to implement - proceed to Phase 1
