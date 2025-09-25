# Oracle Deployment Troubleshooting Summary

## Context: What We're Building

**Marks Exchange**: A USDTNGN perpetual futures exchange on Arbitrum Sepolia using modified GMX V2 contracts. The key modification is that USDT serves as the sole collateral for both long and short positions (unlike standard GMX which requires different tokens).

## Current Deployment Status

### Successfully Deployed Contracts
- ✅ **RoleStore**: `0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778` - Permission management
- ✅ **DataStore**: `0x678FE2874cB82e6B44B7fF62C0f8638B86C462da` - Configuration storage
- ✅ **EventEmitter**: Deployed (address in deployment files)
- ✅ **Router**: Deployed
- ✅ **OrderVault**: Deployed
- ✅ **USDT Token**: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6` (existing)
- ✅ **sNGN Token**: `0xe0dBA0326623dEcE1712581271ebcD846D67b29f` (existing stub token)

### Not Yet Deployed
- ❌ **OracleStore**: Not deployed
- ❌ **Oracle**: Not deployed (blocking issue)
- ❌ Remaining contracts (OrderHandler, ExchangeRouter, etc.)

## Where We Are in Oracle Deployment

### The Plan
1. Deploy OracleStore using: `npx hardhat deploy --tags OracleStore --network arbitrumSepolia`
2. Deploy Oracle using: `npx hardhat deploy --tags Oracle --network arbitrumSepolia`
3. Configure Oracle signers using modified `configureOracleSigners.ts`

### Current Status
- **Stuck at Oracle deployment** - The deployment command runs but fails during the Tokens dependency deployment
- OracleStore hasn't been deployed yet (Oracle deployment includes it as a dependency)

## The Specific Issue

When running Oracle deployment, it tries to deploy its dependencies in this order:
1. Tokens (via `deployTestTokens.ts`)
2. MockDataStreamVerifier
3. ChainlinkPriceFeedProvider
4. OracleStore
5. Oracle

The deployment **fails at step 1 (Tokens)** with this error:
```
Error: cannot estimate gas; transaction may fail or may require manual gas limit
reason="execution reverted"
data="0xa35b150b..." (Unauthorized error for CONTROLLER role)
```

The specific failing operation is in `deployTestTokens.ts`:
```javascript
await setUintIfDifferent(
  keys.tokenTransferGasLimit(token.address!),
  token.transferGasLimit,
  `${tokenSymbol} transfer gas limit`
);
```

## What We've Confirmed

### ✅ Permissions Are Correct
1. **RoleStore has the deployer with CONTROLLER role**:
   - Address: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
   - Has CONTROLLER role: `true`
   - Role hash matches: `0x70546d1c92f8c2132ae23a23f5177aa8526356051c7510df99f50e012d221529`

2. **DataStore points to the correct RoleStore**:
   - DataStore's RoleStore: `0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778`
   - Confirmed match with actual RoleStore

3. **Manual DataStore writes work**:
   - Successfully wrote to DataStore using console (but value didn't persist - showed as 0)
   - Transaction succeeded with status 1

### ✅ Configuration Is Consistent
- Hardhat deployer address matches the address with CONTROLLER role
- Network is correct (arbitrumSepolia)
- Error decoding confirms it's a CONTROLLER role issue for the correct address

## The Mystery

**The paradox**: 
- Deployer HAS CONTROLLER role in RoleStore ✅
- DataStore uses the correct RoleStore ✅
- Manual permission check passes ✅
- But hardhat-deploy's execution fails with Unauthorized ❌

## Possible Areas to Explore

### 1. Transaction Context Issue
- Hardhat-deploy might be using a different transaction context
- The `from` address might be getting modified somehow
- Gas estimation might be using a different caller

### 2. DataStore State Issue
The manual test transaction succeeded but the value read back as 0, suggesting:
- Transaction went to wrong address (but we see it went to RoleStore, not DataStore)
- State isn't persisting as expected
- There might be multiple DataStore instances

### 3. Deployment Cache Issue
- Hardhat-deploy might be caching old contract addresses
- The deployment system might have stale state
- Previous partial deployments might be interfering

### 4. Contract Verification
- Verify the deployed DataStore has the expected bytecode
- Check if DataStore at `0x678FE...` is actually the DataStore contract
- Confirm the contract hasn't been upgraded or replaced

## Recommended Next Steps

### Option 1: Skip Tokens Deployment
Since you already have USDT deployed, create a manual deployment file:
```bash
# Create deployments/marks/arbitrumSepolia/WETH.json
# with minimal content to satisfy the dependency
```

### Option 2: Debug the Exact Call
Use Tenderly or similar to trace the exact failing transaction and see what the contract is actually checking.

### Option 3: Fresh Deployment
Clear all deployment artifacts and start fresh:
```bash
rm -rf deployments/marks/arbitrumSepolia/*
# Redeploy from RoleStore onwards
```

### Option 4: Direct Oracle Deployment
Try deploying OracleStore and Oracle directly without going through dependencies, using manual contract deployment scripts.

## Critical Questions to Answer

1. Why does the manual DataStore write transaction go to RoleStore address instead of DataStore?
2. Why does the value not persist when we write to DataStore?
3. Is there a proxy or delegate pattern we're missing?
4. Are there multiple DataStore instances deployed?

## Summary

We're stuck at Oracle deployment because its Tokens dependency fails with a permission error that shouldn't exist given our confirmed permissions. The root cause appears to be either a transaction context issue in hardhat-deploy or a state management problem with the DataStore contract.