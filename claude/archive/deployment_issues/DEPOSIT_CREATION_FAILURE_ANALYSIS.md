# GMX V2 Deposit Creation Failure - Complete Analysis

## Date: 2025-09-21

## Executive Summary
The GMX V2 fork deployed on Arbitrum Sepolia cannot create deposits. The ExchangeRouter contract's `createDeposit` function accepts calls and consumes gas but fails to actually create deposits in the DataStore. This issue has existed since deployment and affects all deposit attempts.

## The Problem
- **Symptom**: Deposit creation transactions succeed but no deposits are stored in DataStore
- **Impact**: Cannot add liquidity to any market
- **Root Cause**: ExchangeRouter's `createDeposit` function doesn't call `depositHandler.createDeposit()`

## Investigation Timeline

### 1. Initial Discovery
- User reported successful deposit creation but execution failing with `InvalidPoolValueForDeposit` error
- Transaction hash: `0xbd62a9a987b00e82a9f13a7230fbc5f24c9ef681b70bc48012c5bb4575d1d316`
- Initial assumption: Execution issue with oracle prices or pool configuration

### 2. Market Configuration Issues Found
- Missing INDEX_TOKEN, LONG_TOKEN, SHORT_TOKEN in DataStore
- Incorrect oracle price format (0.000606 vs 1500 for NGN)
- These were fixed but didn't resolve the issue

### 3. Critical Discovery
**The "successful" deposit was never actually created:**
- Deposit key `0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd` doesn't exist in DataStore
- DataStore shows 0 deposits ever created (nonce = 0)
- No `DepositCreated` events ever emitted

### 4. Pattern Identified
Every deposit attempt shows the same pattern:
- Transaction succeeds (doesn't revert)
- Gas consumed (~676k)
- Only EventEmitter logs appear
- Same mysterious key appears: `0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd`
- No DepositHandler logs
- No deposit stored in DataStore

## Technical Analysis

### Contract Addresses
```
ExchangeRouter: 0x59b94d5B4686D59a4665d1679A8E27F71c544F40
DepositHandler: 0x3Bc412Ad515432cb3ddbD74bf1792971b156c827
DepositVault: 0x9986771384aeA06185960C5CACA7AFcb47bCC47d
Router: 0x200882043647295a21F9202f9C1535BfB2A2f127
DataStore: 0x678FE2874cB82e6B44B7fF62C0f8638B86C462da
RoleStore: 0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778
Market (USDTNGN): 0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970
USDT: 0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6
```

### Expected Flow (from contracts)
1. User calls `ExchangeRouter.createDeposit(params)`
2. ExchangeRouter calls `depositHandler.createDeposit(account, 0, params)`
3. DepositHandler validates and calls `DepositUtils.createDeposit()`
4. DepositUtils calls `depositVault.recordTransferIn()` to track tokens
5. Deposit is stored in DataStore with unique key
6. Events are emitted

### Actual Flow (observed)
1. User calls `ExchangeRouter.createDeposit(params)` ✅
2. Function accepts call and consumes gas ✅
3. **No call to depositHandler** ❌
4. Only EventEmitter logs (with hardcoded/placeholder key) ⚠️
5. No deposit in DataStore ❌

### Verification Performed

#### 1. Contract Wiring
- ✅ ExchangeRouter has correct DepositHandler address
- ✅ All contracts have code deployed
- ✅ Roles properly configured (CONTROLLER, ROUTER_PLUGIN)
- ✅ Feature flags enabled (CREATE_DEPOSIT_FEATURE_DISABLED = false)

#### 2. Token Flow
- ✅ USDT transfers work
- ✅ DepositVault can receive tokens
- ✅ recordTransferIn() function works when called directly
- ✅ Router.pluginTransfer() works with proper roles

#### 3. Bytecode Analysis
- ✅ Function selector `0xc82aa41b` exists in bytecode
- ✅ DepositHandler.createDeposit selector `0x7219bf24` found in bytecode
- ✅ DepositHandler address found in immutable section
- ❌ But the function body doesn't execute the expected logic

### Requirements Tested

#### First Deposit Requirement (from README)
- README states: "The first deposit in any market must go to the RECEIVER_FOR_FIRST_DEPOSIT"
- RECEIVER_FOR_FIRST_DEPOSIT = address(1)
- **Tested with receiver = address(1)**: Still fails
- This requirement is checked during execution, not creation

#### Token Transfer Methods Tried
1. **Separate transactions**: Transfer USDT then create deposit ❌
2. **Multicall**: sendTokens + createDeposit in same tx ❌
3. **Direct to DepositVault**: Transfer directly then create ❌
4. **With Router approval**: Approve Router, use multicall ❌

All methods fail at the same point - ExchangeRouter doesn't create the deposit.

## Root Cause

The deployed ExchangeRouter has a broken `createDeposit` implementation. While the function exists and can be called, it doesn't execute the expected logic of calling `depositHandler.createDeposit()`.

### Evidence
1. No DepositHandler logs ever emitted
2. Bytecode contains selectors but logic doesn't execute
3. Same placeholder key in every attempt
4. Zero deposits in DataStore after multiple attempts
5. Deployment happened Sept 20, 2024 using TypeScript deployment scripts

### Possible Reasons
1. **Library Linking Issue**: ExchangeRouter depends on 9 libraries that may not have been properly linked
2. **Compilation Problem**: Optimizer or compiler settings may have broken the function
3. **Deployment Script Issue**: The deployment might have used wrong bytecode

## Attempted Workarounds

### 1. Direct DepositHandler Call
- Created contract to call DepositHandler directly
- Failed with revert (even with CONTROLLER role)

### 2. Custom DepositCreator Contract
- Deployed wrapper contract to forward calls
- Also failed, confirming issue is deeper

### 3. Sync Token Balances
- Manually synced DepositVault token balances
- Didn't help as ExchangeRouter never reaches token recording step

## Impact

- **Cannot add liquidity** to any market
- **1476 USDT locked** in DepositVault from failed attempts
- Market cannot function without liquidity
- No deposits have ever been successfully created

## Solution Required

The ExchangeRouter needs to be redeployed with correct implementation. Steps:

1. **Clean and recompile**:
   ```bash
   npx hardhat clean
   npx hardhat compile
   ```

2. **Verify library deployments** are correct

3. **Redeploy ExchangeRouter** using the deployment script:
   ```bash
   npx hardhat deploy --tags ExchangeRouter --network arbitrumSepolia
   ```

4. **Grant required roles**:
   - CONTROLLER role
   - ROUTER_PLUGIN role

5. **Test with simple deposit** using address(1) as receiver for first deposit

## Lessons Learned

1. **Transaction success ≠ Functional success**: Transactions can succeed without performing expected actions
2. **Always verify state changes**: Check DataStore/storage, not just transaction receipts
3. **Event logs can be misleading**: EventEmitter logs don't confirm actual deposit creation
4. **Library linking is critical**: Complex contracts with many libraries need careful deployment
5. **First deposit has special requirements**: Must use address(1) as receiver (though this wasn't the issue here)

## Current State

- No deposits exist in the system
- 1476 USDT locked in DepositVault
- ExchangeRouter accepts calls but doesn't create deposits
- System is non-functional for liquidity provision

## Next Steps

1. Recompile contracts
2. Verify all library deployments
3. Redeploy ExchangeRouter only (not entire system)
4. Test deposit creation with address(1) as receiver
5. If successful, execute deposit with oracle prices
6. Document the working deployment process