# GMX V2 Comprehensive Deployment Plan #

## Overview
This plan outlines the complete deployment process for GMX V2 contracts on Arbitrum Sepolia, keeping existing USDT and sNGN tokens while redeploying all system contracts to fix the broken ExchangeRouter.

**Important Context**:
- All deployment artifacts (contract addresses and ABIs) will be saved in the `deployments/marks/arbitrumSepolia/` folder
- Token addresses (USDT, sNGN) are defined in `config/tokens.ts` and will NOT be redeployed
- The deployment scripts automatically read token addresses from the config, not from deployment artifacts

## Pre-Deployment Checklist

1. **Clean Deployment Folder**
   ```bash
   # Backup existing addresses if needed
   cp -r deployments/marks/arbitrumSepolia deployments/marks/arbitrumSepolia.backup

   # Remove ALL deployment artifacts (tokens are in config/tokens.ts)
   rm -rf deployments/marks/arbitrumSepolia/*
   ```

2. **Clean Build Environment**
   ```bash
   npx hardhat clean
   npx hardhat compile
   ```

3. **Verify Token Addresses in config/tokens.ts**
   - USDT: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6` (existing token)
   - sNGN: Check address in `config/tokens.ts`
   - These tokens are NOT redeployed, they're referenced from `config/tokens.ts`
   - The deployment scripts will read token addresses from this config file

4. **Configure Network**
   - Ensure `hardhat.config.ts` has correct Arbitrum Sepolia RPC and deployer account
   - Verify deployer has sufficient ETH for gas
   - Confirm network name is `arbitrumSepolia` (matches deployment folder)

## Phase 1: Core Infrastructure (Order Critical)

1. **RoleStore** - Permission management system
   ```bash
   npx hardhat deploy --tags RoleStore --network arbitrumSepolia
   ```

2. **DataStore** - Central data storage
   - Dependencies: RoleStore
   ```bash
   npx hardhat deploy --tags DataStore --network arbitrumSepolia
   ```

3. **EventEmitter** - Event logging system
   - Dependencies: RoleStore
   ```bash
   npx hardhat deploy --tags EventEmitter --network arbitrumSepolia
   ```

4. **Configure Roles** - Grant initial permissions
   ```bash
   npx hardhat deploy --tags Roles --network arbitrumSepolia
   ```

## Phase 2: Oracle System

1. **OracleStore** - Oracle data storage
   ```bash
   npx hardhat deploy --tags OracleStore --network arbitrumSepolia
   ```

2. **Oracle** - Price oracle contract
   - Dependencies: RoleStore, OracleStore
   ```bash
   npx hardhat deploy --tags Oracle --network arbitrumSepolia
   ```

3. **Configure Oracle Signers**
   - Set signer: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
   - Set MIN_ORACLE_SIGNERS = 1
   ```bash
   npx hardhat deploy --tags OracleSigners --network arbitrumSepolia
   ```

## Phase 3: Utility Libraries

Deploy all utility libraries (order independent within phase):
```bash
npx hardhat deploy --tags MarketStoreUtils,MarketEventUtils,DepositStoreUtils,WithdrawalStoreUtils --network arbitrumSepolia
npx hardhat deploy --tags OrderStoreUtils,PositionStoreUtils,OrderEventUtils,PositionEventUtils --network arbitrumSepolia
npx hardhat deploy --tags ReferralUtils,FeeUtils,CallbackUtils,GasUtils --network arbitrumSepolia
npx hardhat deploy --tags SwapUtils,MarketUtils,PositionUtils,OrderUtils --network arbitrumSepolia
npx hardhat deploy --tags IncreasePositionUtils,DecreasePositionUtils,DecreasePositionCollateralUtils --network arbitrumSepolia
npx hardhat deploy --tags DepositUtils,ExecuteDepositUtils,WithdrawalUtils,ExecuteWithdrawalUtils --network arbitrumSepolia
npx hardhat deploy --tags ShiftStoreUtils,ShiftUtils --network arbitrumSepolia
```

## Phase 4: Vaults and Storage

1. **DepositVault** - Holds deposit tokens
   ```bash
   npx hardhat deploy --tags DepositVault --network arbitrumSepolia
   ```

2. **WithdrawalVault** - Holds withdrawal tokens
   ```bash
   npx hardhat deploy --tags WithdrawalVault --network arbitrumSepolia
   ```

3. **OrderVault** - Holds order collateral
   ```bash
   npx hardhat deploy --tags OrderVault --network arbitrumSepolia
   ```

4. **ShiftVault** - Holds shift tokens
   ```bash
   npx hardhat deploy --tags ShiftVault --network arbitrumSepolia
   ```

## Phase 5: Core Routers

1. **Router** - Token transfer router
   - Dependencies: RoleStore
   ```bash
   npx hardhat deploy --tags Router --network arbitrumSepolia
   ```

2. **MarketFactory** - Market creation factory
   - Dependencies: DataStore, RoleStore, EventEmitter, MarketStoreUtils
   ```bash
   npx hardhat deploy --tags MarketFactory --network arbitrumSepolia
   ```

## Phase 6: Handlers

1. **DepositHandler** - Handles deposits
   - Dependencies: All vaults, DataStore, RoleStore, EventEmitter, Oracle
   ```bash
   npx hardhat deploy --tags DepositHandler --network arbitrumSepolia
   ```

2. **WithdrawalHandler** - Handles withdrawals
   ```bash
   npx hardhat deploy --tags WithdrawalHandler --network arbitrumSepolia
   ```

3. **OrderHandler** - Handles orders
   ```bash
   npx hardhat deploy --tags OrderHandler --network arbitrumSepolia
   ```

4. **ShiftHandler** - Handles shifts
   ```bash
   npx hardhat deploy --tags ShiftHandler --network arbitrumSepolia
   ```

5. **ExternalHandler** - External integrations
   ```bash
   npx hardhat deploy --tags ExternalHandler --network arbitrumSepolia
   ```

## Phase 7: Order Executors

1. **IncreaseOrderExecutor** - Increase position executor
   ```bash
   npx hardhat deploy --tags IncreaseOrderExecutor --network arbitrumSepolia
   ```

2. **DecreaseOrderExecutor** - Decrease position executor
   ```bash
   npx hardhat deploy --tags DecreaseOrderExecutor --network arbitrumSepolia
   ```

3. **SwapOrderExecutor** - Swap order executor
   ```bash
   npx hardhat deploy --tags SwapOrderExecutor --network arbitrumSepolia
   ```

## Phase 8: Exchange Router (Critical Fix)

**This is the critical contract that needs proper deployment:**

1. **ExchangeRouter** - Main user-facing router
   - Dependencies: Router, RoleStore, DataStore, EventEmitter, DepositHandler, WithdrawalHandler, ShiftHandler, OrderHandler, ExternalHandler
   - Libraries: CallbackUtils, DepositStoreUtils, FeeUtils, MarketEventUtils, MarketStoreUtils, OrderStoreUtils, ReferralUtils, ShiftStoreUtils, WithdrawalStoreUtils
   ```bash
   npx hardhat deploy --tags ExchangeRouter --network arbitrumSepolia
   ```

2. **Verify ExchangeRouter roles**:
   - Must have CONTROLLER role
   - Must have ROUTER_PLUGIN role

## Phase 9: Supporting Contracts

1. **Reader** - Read-only contract for fetching data
   ```bash
   npx hardhat deploy --tags Reader --network arbitrumSepolia
   ```

2. **ReferralStorage** - Referral system
   ```bash
   npx hardhat deploy --tags ReferralStorage --network arbitrumSepolia
   ```

3. **Multicall3** - Batch transaction support
   ```bash
   npx hardhat deploy --tags Multicall3 --network arbitrumSepolia
   ```

## Phase 10: Configuration

1. **Configure General Settings**
   ```bash
   npx hardhat deploy --tags GeneralSettings --network arbitrumSepolia
   ```

2. **Configure Oracle Tokens**
   - Set USDT price feed
   - Set sNGN price (1500 for 1 USDT = 1500 NGN)
   ```bash
   npx hardhat deploy --tags OracleTokens --network arbitrumSepolia
   ```

3. **Deploy and Configure Markets**
   - Create USDTNGN perpetual market
   - Index token: sNGN
   - Long token: USDT
   - Short token: USDT
   ```bash
   npx hardhat deploy --tags Markets --network arbitrumSepolia
   ```

## Phase 11: Post-Deployment Verification

1. **Verify Deployment Artifacts**:
   ```bash
   # Check that all contracts have deployment files
   ls deployments/marks/arbitrumSepolia/*.json | wc -l
   # Should show 80+ contract JSON files
   ```

2. **Verify Critical Contracts**:
   ```javascript
   // Load addresses from deployment files
   const exchangeRouterDeployment = require("./deployments/marks/arbitrumSepolia/ExchangeRouter.json");
   const EXCHANGE_ROUTER_ADDRESS = exchangeRouterDeployment.address;

   // Check ExchangeRouter has correct handlers
   const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER_ADDRESS);
   const depositHandler = await exchangeRouter.depositHandler();
   console.log("DepositHandler:", depositHandler); // Should not be 0x0
   ```

2. **Verify Roles**:
   ```javascript
   // Check CONTROLLER and ROUTER_PLUGIN roles
   const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE_ADDRESS);
   const hasController = await roleStore.hasRole(EXCHANGE_ROUTER_ADDRESS, "CONTROLLER");
   const hasRouterPlugin = await roleStore.hasRole(EXCHANGE_ROUTER_ADDRESS, "ROUTER_PLUGIN");
   ```

3. **Test Deposit Creation**:
   - Create deposit with receiver = address(1) for first deposit
   - Verify deposit exists in DataStore
   - Check for DepositCreated event

## Important Notes

1. **Token Configuration**: Tokens (USDT, sNGN) are defined in `config/tokens.ts` - do NOT redeploy them
2. **Deployment Artifacts**: All contract addresses/ABIs saved to `deployments/marks/arbitrumSepolia/`
3. **Library Linking**: Ensure all libraries are properly linked during ExchangeRouter deployment
4. **First Deposit Rule**: First deposit receiver MUST be `address(1)` (0x0000000000000000000000000000000000000001)
5. **Gas Limits**: Set appropriate gas limits for deployment transactions
6. **Deployment Order**: Maintain strict order for dependencies
7. **Role Configuration**: Roles must be granted immediately after contract deployment

## Verification Scripts (Optional)

Note: If creating verification scripts, ensure they use the correct hash calculation:

**Correct hash calculation for roles**:
```javascript
// CORRECT - matches how contracts calculate role hashes
const ROLE_ADMIN = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
);

// WRONG - will produce different hash
// const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
```

This is important because the contracts use `keccak256(abi.encode("ROLE_NAME"))` while a common mistake is to use `keccak256(toUtf8Bytes("ROLE_NAME"))`, which produces a completely different hash.

## Recovery Plan

If deployment fails at any stage:
1. Note which contracts were successfully deployed
2. Resume from the failed contract (no need to redeploy successful ones)
3. Update addresses in deployment artifacts if manually intervening

## Validation Script

After deployment, run validation:
```javascript
// scripts/validate-deployment.js
async function validateDeployment() {
  // 1. Check all contracts deployed
  // 2. Verify ExchangeRouter can create deposits
  // 3. Test token transfers to vaults
  // 4. Verify oracle configuration
  // 5. Check market configuration
}
```

## Commands Summary

For quick reference, here's the complete deployment sequence:

```bash
# Pre-deployment
npx hardhat clean
npx hardhat compile

# Phase 1: Core Infrastructure
npx hardhat deploy --tags RoleStore --network arbitrumSepolia
npx hardhat deploy --tags DataStore --network arbitrumSepolia
npx hardhat deploy --tags EventEmitter --network arbitrumSepolia
npx hardhat deploy --tags Roles --network arbitrumSepolia

# Phase 2: Oracle System
npx hardhat deploy --tags OracleStore --network arbitrumSepolia
npx hardhat deploy --tags Oracle --network arbitrumSepolia
npx hardhat deploy --tags OracleSigners --network arbitrumSepolia

# Phase 3: Utility Libraries (can be combined)
npx hardhat deploy --tags MarketStoreUtils,MarketEventUtils,DepositStoreUtils,WithdrawalStoreUtils --network arbitrumSepolia
npx hardhat deploy --tags OrderStoreUtils,PositionStoreUtils,OrderEventUtils,PositionEventUtils --network arbitrumSepolia
npx hardhat deploy --tags ReferralUtils,FeeUtils,CallbackUtils,GasUtils --network arbitrumSepolia
npx hardhat deploy --tags SwapUtils,MarketUtils,PositionUtils,OrderUtils --network arbitrumSepolia
npx hardhat deploy --tags IncreasePositionUtils,DecreasePositionUtils,DecreasePositionCollateralUtils --network arbitrumSepolia
npx hardhat deploy --tags DepositUtils,ExecuteDepositUtils,WithdrawalUtils,ExecuteWithdrawalUtils --network arbitrumSepolia
npx hardhat deploy --tags ShiftStoreUtils,ShiftUtils --network arbitrumSepolia

# Phase 4: Vaults
npx hardhat deploy --tags DepositVault --network arbitrumSepolia
npx hardhat deploy --tags WithdrawalVault --network arbitrumSepolia
npx hardhat deploy --tags OrderVault --network arbitrumSepolia
npx hardhat deploy --tags ShiftVault --network arbitrumSepolia

# Phase 5: Core Routers
npx hardhat deploy --tags Router --network arbitrumSepolia
npx hardhat deploy --tags MarketFactory --network arbitrumSepolia

# Phase 6: Handlers
npx hardhat deploy --tags DepositHandler --network arbitrumSepolia
npx hardhat deploy --tags WithdrawalHandler --network arbitrumSepolia
npx hardhat deploy --tags OrderHandler --network arbitrumSepolia
npx hardhat deploy --tags ShiftHandler --network arbitrumSepolia
npx hardhat deploy --tags ExternalHandler --network arbitrumSepolia

# Phase 7: Order Executors
npx hardhat deploy --tags IncreaseOrderExecutor --network arbitrumSepolia
npx hardhat deploy --tags DecreaseOrderExecutor --network arbitrumSepolia
npx hardhat deploy --tags SwapOrderExecutor --network arbitrumSepolia

# Phase 8: Exchange Router (CRITICAL)
npx hardhat deploy --tags ExchangeRouter --network arbitrumSepolia

# Phase 9: Supporting Contracts
npx hardhat deploy --tags Reader --network arbitrumSepolia
npx hardhat deploy --tags ReferralStorage --network arbitrumSepolia
npx hardhat deploy --tags Multicall3 --network arbitrumSepolia

# Phase 10: Configuration
npx hardhat deploy --tags GeneralSettings --network arbitrumSepolia
npx hardhat deploy --tags OracleTokens --network arbitrumSepolia
npx hardhat deploy --tags Markets --network arbitrumSepolia
```

## Success Criteria

Deployment is successful when:
1. All contracts are deployed without errors
2. ExchangeRouter.createDeposit() successfully creates deposits in DataStore
3. Deposit creation with receiver=address(1) works for first deposit
4. Oracle prices can be set and read correctly
5. Market is properly configured with USDT as collateral and sNGN as index token