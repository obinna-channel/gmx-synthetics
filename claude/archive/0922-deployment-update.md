# GMX V2 Deployment Update - September 22, 2025

## Executive Summary
Successfully completed full system redeployment of GMX V2 on Arbitrum Sepolia, resolving critical permission issues through correct role hash calculation and establishing two functioning sNGN/USDT perpetual markets with different collateral configurations.

## Critical Discovery: Permission Paradox Resolution
The deployment revealed a critical hash mismatch between JavaScript and Solidity role calculations:
- **JavaScript (INCORRECT)**: `ethers.utils.id("ROLE_NAME")`
- **Solidity (CORRECT)**: `keccak256(abi.encode("ROLE_NAME"))`

This mismatch caused the "permission paradox" where role checks would pass but transactions would fail with "Unauthorized" errors.

## Deployment Phases Completed

### Phase 1: Core Infrastructure ✅
- **RoleStore**: `0x4943c063691259B677f3D7BC808C9C3090321EbB`
- **DataStore**: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`
- **EventEmitter**: `0xDB69f0E1c1BeA86B6AB079d2a49b690AE8Be63f5`

### Critical Step: EOA CONTROLLER Role ✅
After Phase 1, granted deployer EOA the CONTROLLER role using correct hash:
```javascript
const CONTROLLER = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
);
// Hash: 0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b
```

### Phase 2: Oracle System ✅
- **OracleStore**: `0xf96fDbA6C88ba1de67e7c017a093bD38C3e0C0Ab`
- **Oracle**: `0x1a8dc96e7DE3c0DA0aD05bDb3f42aE4C3e25cEDE`
- Oracle signer configured: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
- MIN_ORACLE_SIGNERS: 1

### Phase 3: Utility Libraries ✅
All 60+ utility libraries deployed including:
- MarketUtils, PositionUtils, OrderUtils
- DepositUtils, WithdrawalUtils, ExecuteDepositUtils
- SwapUtils, FeeUtils, CallbackUtils
- DecreasePositionUtils, IncreasePositionUtils
- ShiftUtils, ShiftStoreUtils
- And 50+ other utility contracts

### Phase 4: Vaults ✅
- **DepositVault**: `0xA5B5F36dd50B97e83B88ceC0BbFaE3Ec9b690E58`
- **WithdrawalVault**: `0xBBE03ADA9b3E0d7B33E8DDE956c7CCEC3A5CEEB6`
- **OrderVault**: `0xe1f3ACF0c8E3CdE2Cc85C670C70ee7c9CD0D4F09`
- **ShiftVault**: `0xf967BDB973879Bccd7deb7Dc9f5A32F7Cb7d09e8`

### Phase 5: Core Routers ✅
- **Router**: `0xF899C84Ab53CF5Ca82Fdc0F73bF6d383287E093B`
- **MarketFactory**: `0xf6BdE8b6A887B0E36eaF955B5E972D638F5FAA1f`

### Phase 6: Handlers ✅
- **DepositHandler**: `0xB802B9EBb67A5E8Afac3cf95F13cf72a35C2D639`
- **WithdrawalHandler**: `0x0C00F887bfd8C5AD3041C9a0cf95B6E1F74EF53b`
- **OrderHandler**: `0xC8E8cA996e0eeBcaCA1FcA690797a2aD7bF11fFB`
- **ShiftHandler**: `0xB8E17d37FA582F965F60db70f61Ff659cE28D85B`
- **ExternalHandler**: `0x5Af9DFdDeE6BB40cEc9ebA13e4A991fF899FaEc4`
- **SwapHandler**: `0x039C8D3aE7D3ED8C7a956B1cE67dB5aF8cb63E40`

### Phase 7: Order Executors ✅
- **IncreaseOrderExecutor**: `0xFf17c93Ecd8A1b96D8eECF491ec84DF24f9e60A2`
- **DecreaseOrderExecutor**: `0xed43C017D067Ffe4c0F56CF604FC488F3Cb00719`
- **SwapOrderExecutor**: `0xB77a1FbdFE3D89aE3d956E456e03Af09C56C7F37`

### Phase 8: ExchangeRouter ✅
- **ExchangeRouter**: `0x3B33708e9b8242999459EB9b4756C24c846e5936`
  - ✅ Properly linked with all required libraries
  - ✅ Granted CONTROLLER role
  - ✅ Granted ROUTER_PLUGIN role
  - ✅ All handlers correctly set

### Phase 9: Supporting Contracts ✅
- **Reader**: `0xdC951ceCaA42d6a1c6b8e3EEA674f45aBe59C7ae`
- **ReferralStorage**: `0x14a0D87B1D0E30E0b45b6BEc529FB983cF5FE2F8`
- **Config**: `0x47cF009b4F088bEDD37f64Bb5D6a5aDb63f2FFb8`
- **Multicall3**: `0x7F90076f23d5631f3E08cD829e96C685aD95A4a4`
- **MultichainTransferRouter**: `0xA81D672BDC37D0cb968B079c3b13eb37c1302Dd9`
- **MultichainUtils**: `0x88DACCCDCD969Ba73a59EdFd06FBC8DeCE056e24`
- **MultichainVault**: `0xCE29FFbC20F82E6E2aFD456FCa92dF9Be7Aef71F`

### Phase 10: Market Configuration ✅

#### Market 1: sNGN [USDT-sNGN]
**Address**: `0x53b49A28054D108d7050B0E5C317001bE984EB2D`
- **Purpose**: For shorting sNGN against USDT
- **Index Token**: sNGN (`0xd66e60AA5b6982649a116e6944Daec22b15468Ad`)
- **Long Token**: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)
- **Short Token**: sNGN (`0xd66e60AA5b6982649a116e6944Daec22b15468Ad`)

#### Market 2: sNGN [USDT-USDT]
**Address**: `0x88c6b23b32223305F2e286F806CB49662126B50b`
- **Purpose**: For longing sNGN with USDT collateral
- **Index Token**: sNGN (`0xd66e60AA5b6982649a116e6944Daec22b15468Ad`)
- **Long Token**: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)
- **Short Token**: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)

### Market Parameters (Both Markets)
- **Max Leverage**: ~50x (based on min collateral factor)
- **Position Fees**: 0.05% - 0.07%
- **Liquidation Fee**: 0.15%
- **Swap Fees**: Variable based on market conditions
- **Max Pool Amounts**: Configured for both tokens
- **Max Open Interest**: Set for long and short positions
- **Funding & Borrowing Factors**: Configured
- **Price Impact Factors**: Set for positions and swaps

## Key Configuration Updates

### Oracle Settings
- MIN_ORACLE_BLOCK_CONFIRMATIONS: 255
- MAX_ORACLE_PRICE_AGE: 86400 (24 hours)
- MAX_ORACLE_TIMESTAMP_RANGE: 3600 (1 hour)
- MIN_ORACLE_SIGNERS: 1

### General Settings
- All fee receivers configured
- Holding periods set
- Execution gas parameters configured
- Callback gas limits established

## Critical Issues Resolved

### 1. Hash Calculation Mismatch (Permission Paradox)
- **Discovery**: Oracle deployment failed with "Unauthorized" despite EOA having CONTROLLER role
- **Root Cause**: JavaScript's `ethers.utils.id()` produces different hash than Solidity's `keccak256(abi.encode())`
- **Resolution**: Created scripts using correct hash calculation method
- **Impact**: All role-based operations now function correctly

### 2. Market Configuration Loss
- **Discovery**: Markets lost all configuration when removed and re-added
- **Root Cause**: DataStore values tied to market addresses are deleted on market removal
- **Resolution**: Complete system redeployment with fresh configurations

### 3. Deployment Script Role Dependencies
- **Discovery**: Oracle deployment requires CONTROLLER role before Phase 2
- **Resolution**: Added critical step to grant EOA CONTROLLER role after Phase 1

## Scripts Created for Deployment

1. **grant-correct-controller-role.js** - Grants CONTROLLER role with correct hash
2. **grant-controller-new-deployment.js** - Updated for new deployment addresses
3. **grant-market-keeper-role.js** - Grants MARKET_KEEPER role for market creation
4. **check-market-params.js** - Verifies market configuration parameters
5. **verify-exchange-router.js** - Validates ExchangeRouter setup

## Tokens (Not Redeployed)
Existing tokens retained:
- **USDT**: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`
- **sNGN**: `0xd66e60AA5b6982649a116e6944Daec22b15468Ad`

## Pending Actions
1. **IMPORTANT**: Remove CONTROLLER and MARKET_KEEPER roles from EOA for security
2. Test deposit creation with both markets
3. Set token prices via Oracle
4. Execute first deposit with receiver = address(1)
5. Proceed with liquidity provision and trading operations

## Network Information
- **Network**: Arbitrum Sepolia
- **Deployment Date**: September 22, 2025
- **Deployer**: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

## Important Security Notes
- EOA currently has CONTROLLER and MARKET_KEEPER roles (temporary for deployment)
- These roles MUST be removed after deployment verification
- First deposit must use receiver = address(1) (`0x0000000000000000000000000000000000000001`)
- All contracts deployed with appropriate roles and permissions

## Lessons Learned
1. Always verify hash calculation methods match between JavaScript and Solidity
2. Market removal deletes all associated DataStore configurations
3. EOA needs CONTROLLER role during deployment for configuration operations
4. Deployment order is critical - dependencies must be strictly followed
5. Complete redeployment is sometimes cleaner than attempting to fix broken deployments

## Success Criteria Met
✅ All contracts deployed without errors
✅ ExchangeRouter properly configured with handlers
✅ Two markets created with different collateral configurations
✅ Oracle system configured with single signer
✅ All roles and permissions correctly granted
✅ System ready for deposit creation and trading operations