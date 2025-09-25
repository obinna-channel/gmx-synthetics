# Oracle Deployment Investigation - Marks Exchange

## Executive Summary

During the deployment of the Oracle system for Marks Exchange (a USDTNGN perpetual futures exchange on Arbitrum Sepolia), we encountered persistent "Unauthorized" errors when attempting to configure Oracle components, despite all permissions appearing to be correctly set. This document details the investigation process, findings, and the current state of the issue.

## Project Context

- **Project**: Marks Exchange - USDTNGN perpetual futures using modified GMX V2 contracts
- **Key Modification**: USDT serves as sole collateral for both long and short positions
- **Network**: Arbitrum Sepolia testnet
- **Deployer Address**: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

## Current Deployment Status

### Successfully Deployed Contracts
1. **RoleStore**: `0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778`
2. **DataStore**: `0x678FE2874cB82e6B44B7fF62C0f8638B86C462da`
3. **EventEmitter**: Deployed (address in deployment files)
4. **Router**: Deployed
5. **OrderVault**: Deployed
6. **USDT Token**: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`
7. **sNGN Token**: `0xe0dBA0326623dEcE1712581271ebcD846D67b29f`
8. **OracleStore**: `0xB4ccC17d5a99F8D2a6572717fCdC6a53c9ee66E8`
9. **Oracle**: `0xc14D5334E5724dEdAc38F52E9D8C40092aDc1cdd`

### Deployment Failures
1. **Oracle afterDeploy configuration** - Failed setting MIN_ORACLE_BLOCK_CONFIRMATIONS
2. **OracleSigners configuration** - Failed adding signers to OracleStore
3. **Tokens deployment** (as Oracle dependency) - Failed setting tokenTransferGasLimit

## The Issue

### Primary Problem
When running Oracle-related deployments, the system consistently fails with an "Unauthorized" error for the CONTROLLER role, specifically:

```
Error: cannot estimate gas; transaction may fail or may require manual gas limit
reason="execution reverted"
data="0xa35b150b..." (Unauthorized error for CONTROLLER role)
```

### Specific Failing Operations

1. **In `deployTestTokens.ts`**:
```javascript
await setUintIfDifferent(
  keys.tokenTransferGasLimit(token.address!),
  token.transferGasLimit,
  `${tokenSymbol} transfer gas limit`
);
```
Error: Trying to set WETH transfer gas limit in DataStore

2. **In `deployOracle.ts` afterDeploy**:
```javascript
await setUintIfDifferent(
  keys.MIN_ORACLE_BLOCK_CONFIRMATIONS,
  oracleConfig.minOracleBlockConfirmations,
  "min oracle block confirmations"
);
```
Error: Setting value 255 in DataStore

3. **In `configureOracleSigners.ts`**:
```javascript
await execute("OracleStore", { from: deployer, log: true }, "addSigner", oracleSigner);
```
Error: Adding signer `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292` to OracleStore

## Investigation Findings

### 1. Permission Structure - All Appears Correct

**Verified via Console:**
- Deployer HAS CONTROLLER role in RoleStore: ✅
- Oracle HAS CONTROLLER role in RoleStore: ✅ (granted manually after deployment)
- OracleStore HAS CONTROLLER role in RoleStore: ✅ (granted manually)
- DataStore uses correct RoleStore: ✅
- OracleStore uses correct RoleStore: ✅
- Role hash is correct: `0x70546d1c92f8c2132ae23a23f5177aa8526356051c7510df99f50e012d221529`

### 2. Manual Operations vs Hardhat Deploy

**Manual Console Test Results:**
```javascript
// Direct attempt to call DataStore.setUint() - FAILS
const tx = await dataStore.setUint(key, value);
// Error: Same "Unauthorized" error as hardhat-deploy
```

This proves the issue is NOT specific to hardhat-deploy but affects all attempts to write to these contracts.

### 3. Contract State Verification

- DataStore contract exists and has code (20,824 bytes)
- Can read from DataStore successfully
- DataStore.roleStore() returns correct RoleStore address
- All role checks pass when queried directly

### 4. The Paradox

The investigation revealed a fundamental paradox:
1. Deployer has CONTROLLER role (verified multiple ways)
2. Contracts point to correct RoleStore (verified)
3. Role hash matches expected value (verified)
4. BUT: All write operations requiring CONTROLLER role fail with Unauthorized

## Deployment Approach Context

### Phase Evolution
- **Phases 1-2**: Manual JavaScript deployment scripts
- **Phase 3 onwards**: Switched to GMX's TypeScript deployment system using hardhat-deploy
- **Modification made**: Removed Tokens dependency from Oracle deployment since WETH not needed

### Key Code Modifications

**In `deployOracle.ts`:**
```typescript
// Original line that caused issues:
// func.dependencies = func.dependencies.concat(["Tokens", "MockDataStreamVerifier", "ChainlinkPriceFeedProvider"]);

// Modified to remove unnecessary dependencies:
func.dependencies = func.dependencies.concat(["OracleStore"]);
```

## Investigation Dead Ends

### Theories Investigated and Ruled Out

1. **Wrong RoleStore**: Verified all contracts use the same RoleStore
2. **Old deployment artifacts**: Confirmed using fresh deployment
3. **Gas estimation issue**: Manual transactions with gas limit also fail
4. **Wrong network/chain**: Confirmed correct Arbitrum Sepolia connection
5. **Account mismatch**: Confirmed same deployer address throughout
6. **Proxy pattern**: No evidence of proxy contracts
7. **Cache issues**: Issue persists across fresh deployments

## Current State

### What Works
- All contracts are deployed
- Can read from all contracts
- Manual role verification passes
- Contract interfaces are correct

### What Doesn't Work
- Any write operation to DataStore requiring CONTROLLER role
- Any write operation to OracleStore requiring CONTROLLER role
- Both manual and automated attempts fail identically

## Unexplained Behaviors

1. **Why do permission checks pass but transactions fail?**
   - `roleStore.hasRole(deployer, CONTROLLER)` returns `true`
   - But `dataStore.setUint()` from same deployer fails with Unauthorized

2. **How did earlier deployments succeed?**
   - Earlier contracts were deployed successfully
   - They likely used similar permission patterns
   - Something changed between early deployments and Oracle deployment

3. **Why does the error occur during gas estimation?**
   - The error happens before the transaction is sent
   - Suggests the validation fails during simulation
   - But the same validation should pass based on on-chain state

## Next Steps to Investigate

1. **Check for additional validation logic** in DataStore beyond simple role check
2. **Verify contract bytecode** matches expected implementation
3. **Test with a completely fresh account** that's granted CONTROLLER role
4. **Check if there's a timelock or delay** mechanism affecting permissions
5. **Review the exact RoleModule implementation** for any additional checks
6. **Compare successful early deployments** with failing Oracle deployments

## Potential Workarounds

### Option 1: Manual Configuration
Since contracts are deployed, manually configure Oracle parameters through direct contract calls or scripts.

### Option 2: Deploy Fresh Set
Start with a completely new set of contracts, ensuring deployer has CONTROLLER from the beginning.

### Option 3: Use Different Account
Try deploying with a different account that's granted permissions fresh.

## Key Questions Remaining

1. Is there hidden validation logic in the contracts beyond the visible role check?
2. Did something change in the contract state between successful early deployments and Oracle deployment?
3. Is there a subtle difference in how the role check is performed that we're missing?
4. Could this be related to the order of operations in the deployment scripts?

## Conclusion

Despite extensive investigation, the root cause remains unclear. The system exhibits contradictory behavior where all permission checks pass but actual transactions fail with permission errors. This suggests either:
- Hidden complexity in the permission system not visible through standard checks
- A state inconsistency that's not apparent through normal queries
- An issue with how the contracts were deployed or initialized

The GMX V2 contracts are proven to work in production, so this is likely a deployment configuration issue rather than a contract bug. Further investigation focusing on the deployment sequence and initialization might reveal the cause.