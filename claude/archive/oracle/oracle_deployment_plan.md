# Oracle System Deployment Plan for Marks Exchange

## Executive Summary

This plan outlines the deployment and configuration of the Oracle system for Marks Exchange using GMX V2's standard Oracle contracts configured for single-keeper operation. The approach prioritizes compatibility and uniformity while achieving the simplified price update mechanism required for FX markets.

## Key Decision: Use Standard Oracle.sol

**Approach**: Deploy unmodified GMX Oracle.sol and configure it for simplified operation
**Rationale**: 
- Ensures 100% compatibility with all GMX contracts
- Maintains deployment uniformity
- Avoids potential bugs from custom modifications
- Proven, tested code from GMX

## Phase 1: Pre-Deployment Preparation

### 1.1 Environment Setup
- Ensure RoleStore, DataStore, EventEmitter, Router, OrderVault are already deployed
- Have keeper wallet address ready
- Prepare deployment environment variables

### 1.2 Keeper Address Decision
```
Keeper Address: [Your keeper wallet address]
This address will:
- Be granted ORACLE_KEEPER role
- Sign all price updates
- Execute price update transactions
```

## Phase 2: Deploy OracleStore

### 2.1 Deployment Command
```bash
SKIP_AUTO_HANDLER_REDEPLOYMENT=false npx hardhat deploy --tags OracleStore --network arbitrumSepolia
```

### 2.2 What Happens Automatically
- OracleStore deploys with RoleStore and EventEmitter as dependencies
- CONTROLLER role granted to OracleStore
- Contract address saved to `deployments/marks/arbitrumSepolia/OracleStore.json`

### 2.3 No Modifications Needed
✅ Deploy as-is without any code changes

## Phase 3: Deploy Oracle

### 3.1 Deployment Command
```bash
SKIP_AUTO_HANDLER_REDEPLOYMENT=false npx hardhat deploy --tags Oracle --network arbitrumSepolia
```

### 3.2 What Happens Automatically
The deployment script will:
1. Deploy Oracle contract with dependencies:
   - RoleStore address
   - DataStore address
   - EventEmitter address
   - Sequencer feed (will use 0x0 for testnet)

2. Configure initial parameters in DataStore:
   - `MIN_ORACLE_BLOCK_CONFIRMATIONS`: Set from config
   - `MAX_ORACLE_PRICE_AGE`: Set from config
   - `MAX_ORACLE_TIMESTAMP_RANGE`: Set from config
   - `MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR`: Set from config

3. Grant CONTROLLER role to Oracle

### 3.3 No Modifications Needed
✅ Deploy as-is without any code changes to `deployOracle.ts`

### 3.4 Note on Configuration
The deployment does NOT set:
- `MIN_ORACLE_SIGNERS` (handled in Phase 4)
- Your keeper as a valid signer (handled in Phase 4)

## Phase 4: Configure Oracle Signers

### 4.1 Modify `deploy/configureOracleSigners.ts`

**Required Code Changes:**

1. **Replace dynamic config reading with hardcoded keeper address:**
```javascript
// REPLACE this line:
const oracleSigners = oracleConfig.signers.map((s) => ethers.utils.getAddress(s));

// WITH:
const oracleSigners = ["YOUR_KEEPER_ADDRESS_HERE"];
```

2. **Hardcode MIN_ORACLE_SIGNERS to 1:**
```javascript
// REPLACE this line:
await setUintIfDifferent(keys.MIN_ORACLE_SIGNERS, oracleConfig.minOracleSigners, "min oracle signers");

// WITH:
await setUintIfDifferent(keys.MIN_ORACLE_SIGNERS, 1, "min oracle signers");
```

### 4.2 Deploy Oracle Signer Configuration
```bash
SKIP_AUTO_HANDLER_REDEPLOYMENT=false npx hardhat deploy --tags OracleSigners --network arbitrumSepolia
```

### 4.3 What This Accomplishes
- Sets `MIN_ORACLE_SIGNERS = 1` in DataStore
- Adds your keeper as the only valid signer in OracleStore
- Removes any default signers that don't match your keeper
- Grants necessary permissions

## Phase 5: Additional Configuration

### 5.1 Grant ORACLE_KEEPER Role to Keeper
After the OracleSigners deployment, grant the role to your keeper:
```bash
# This may need to be done via a script or direct contract call
RoleStore.grantRole(keeperAddress, keccak256("ORACLE_KEEPER"))
```

## Phase 6: Keeper Script Modifications

### 6.1 Required Changes Overview

The keeper script must be updated to format prices for GMX Oracle:

**From (Current MarksSimplifiedOracle)**:
- Simple arrays: `tokens[]`, `minPrices[]`, `maxPrices[]`
- Direct function call to `setSimplePrices()`

**To (GMX Oracle)**:
- Complex `SetPricesParams` structure
- Compacted data format
- Signature generation
- Call to `setPrices()`

### 6.2 Data Formatting Requirements

**Compaction Required For**:
1. **Block Numbers**: Multiple values packed into uint256
2. **Timestamps**: Multiple values packed into uint256  
3. **Decimals**: Price decimals packed together
4. **Prices**: Compressed based on decimal configuration

**Signature Requirements**:
1. Sign price data with keeper private key
2. Include signature in transaction
3. Set signer bitmap (value = 1 for single signer at index 0)

### 6.3 Function Changes

**Current Keeper Call**:
```python
contract.functions.setSimplePrices(tokens, minPrices, maxPrices)
```

**New Keeper Call Structure**:
```python
contract.functions.setPrices({
    signerInfo: 1,  # Bitmap indicating signer 0 signed
    tokens: [...],
    compactedOracleBlockNumbers: [...],
    compactedOracleTimestamps: [...],
    compactedDecimals: [...],
    compactedMinPrices: [...],
    compactedMaxPrices: [...],
    signatures: [...],
    priceFeedTokens: []
})
```

## Phase 7: Testing & Validation

### 7.1 Verify Configuration
1. Check MIN_ORACLE_SIGNERS = 1 in DataStore
2. Verify keeper has ORACLE_KEEPER role
3. Confirm Oracle has CONTROLLER role
4. Test keeper can update prices

### 7.2 Price Update Test
1. Run modified keeper script with one test price
2. Verify transaction succeeds
3. Call `getPrimaryPrice()` to confirm price stored
4. Check min and max values are correct

### 7.3 Integration Test
1. Ensure other contracts can read prices
2. Verify OrderHandler can access prices
3. Test with a sample order creation

## Summary of Key Changes from Original Plan

### What Changed:
1. **No modifications to Oracle.sol or deployOracle.ts** - Deploy standard contracts as-is
2. **Configuration happens in configureOracleSigners.ts** - Not post-deployment manual steps
3. **Three deployment commands** - OracleStore → Oracle → OracleSigners
4. **Only one file needs editing** - `deploy/configureOracleSigners.ts` with hardcoded values

### What Stays the Same:
1. Using standard GMX Oracle.sol for compatibility
2. Configuring for single keeper operation
3. Keeper script needs significant modifications for data formatting
4. Full compatibility with GMX V2 system

## Critical Success Factors

### ✅ Must Have
- MIN_ORACLE_SIGNERS set to 1
- Keeper address properly authorized
- Keeper script correctly formats data
- Proper data compaction implemented

### ⚠️ Common Pitfalls to Avoid
- Forgetting to set MIN_ORACLE_SIGNERS to 1 (causes revert)
- Not authorizing keeper address (unauthorized error)
- Incorrect data compaction (invalid price format)
- Wrong signature format (validation failure)

## Timeline Estimate

1. **OracleStore Deployment**: 5 minutes
2. **Oracle Deployment**: 5 minutes  
3. **Modify configureOracleSigners.ts**: 10 minutes
4. **OracleSigners Deployment**: 5 minutes
5. **Keeper Script Modification**: 2-4 hours (main complexity)
6. **Testing & Validation**: 1 hour

**Total**: ~3-6 hours (mostly keeper script work)

## Next Steps After Oracle Deployment

Once Oracle system is working:
1. Continue with remaining contract deployments
2. Deploy Order Executors
3. Deploy OrderHandler
4. Deploy ExchangeRouter
5. Create USDTNGN market
6. Begin trading tests

## Appendix: Key Differences from MarksSimplifiedOracle

| Aspect | MarksSimplifiedOracle | GMX Oracle |
|--------|----------------------|------------|
| Price Format | Simple uint256 arrays | Compacted data |
| Signatures | Role-based (no signatures) | Signature required |
| Function | `setSimplePrices()` | `setPrices()` |
| Storage | Simple arrays | EnumerableSet |
| Validation | Basic | Comprehensive |
| Configuration | Hardcoded | DataStore-based |

## Conclusion

This plan provides a clear path to deploy and configure GMX's standard Oracle for Marks Exchange's single-keeper FX market setup. The main complexity lies in updating the keeper script to format data correctly, but this ensures full compatibility with the GMX V2 system while maintaining the simplified operation model needed for FX markets.