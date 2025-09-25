# Deposit Execution Failing - Oracle Block Number Issue

## Issue Summary
Deposit execution is failing with `OracleBlockNumbersAreSmallerThanRequired` error despite successfully setting oracle prices and having all configurations correct. The Oracle appears to have stale internal block numbers that are not being updated by `setPrimaryPrice()` or `setTimestamps()` functions.

## Environment
- **Network**: Arbitrum Sepolia
- **Date**: September 23, 2025
- **Deposit Key**: `0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696`

## Contract Addresses
```javascript
// Core Contracts
DEPOSIT_HANDLER: 0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00
ORACLE: 0xE89d94669f49D278cCD094A084139eB6639C0a93
DATA_STORE: 0xD70154A2e4BEF0485Bb6d90265a4F878A4556111
DEPOSIT_VAULT: 0x77Dc2ceeaA0155DAEA6a6f0A131CDF587b96514D
EXCHANGE_ROUTER: 0x832dB4016bF4AFe98BB90BBb9F9375B0A1409D4b

// Market & Tokens  
MARKET: 0x53b49A28054D108d7050B0E5C317001bE984EB2D
USDT: 0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6
sNGN: 0xd66e60AA5b6982649a116e6944Daec22b15468Ad
```

## Current Status

### ✅ What's Working
1. **Deposit Creation**: Successfully created deposit with execution fee
2. **Role Permissions**: User has both CONTROLLER and ORDER_KEEPER roles
3. **Oracle Configuration**: MIN_ORACLE_SIGNERS set to 0 for testing
4. **Price Setting**: Can successfully set primary prices via `oracle.setPrimaryPrice()`
5. **Simulation Pass**: When using proper oracle params, we get `EndOfOracleSimulation` (success indicator)

### ❌ The Problem
1. **Oracle Block Numbers**: Oracle has stale internal block numbers that don't update
2. **Error Code**: `0xd84b8ee8` - `OracleBlockNumbersAreSmallerThanRequired`
3. **Failed Transaction**: TX `0x2d8c9dd4114c7231c71bb43ab95a8d8f77f686870e0c754ba150c5f09ba69b02` reverted on-chain

## Error Details

### The Exact Error
```
Error data: 0xd84b8ee8
0000000000000000000000000000000000000000000000000000000068d32bdd  // Current oracle block
0000000000000000000000000000000000000000000000000000000068d319a7  // Required minimum block
000000000000000000000000000000000000000000000000000000000000012c  // Difference (300)
```

Decoded:
- Current Oracle Block: 1758668765 (0x68d32bdd)
- Required Min Block: 1758665127 (0x68d319a7)
- Oracle's block numbers are 300 blocks behind

## Code We're Using

### 1. Price Setting Script (`set-fresh-prices.js`)
```javascript
const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Price calculations
    const usdtPrice = ethers.BigNumber.from(10).pow(24);  // $1.00
    const sngnPrice = ethers.BigNumber.from(10).pow(9).mul(2).div(3);  // $1/1500

    // Step 1: Clear existing prices
    await oracle.clearAllPrices();

    // Step 2: Set primary prices
    await oracle.setPrimaryPrice(USDT, {
        min: usdtPrice,
        max: usdtPrice
    });
    
    await oracle.setPrimaryPrice(sNGN, {
        min: sngnPrice,
        max: sngnPrice
    });

    // Step 3: Set timestamps (tried both approaches)
    // Approach 1: Using block.timestamp
    // const block = await ethers.provider.getBlock("latest");
    // await oracle.setTimestamps(block.timestamp, block.timestamp + 300);
    
    // Approach 2: Using JavaScript time (like previous deployment)
    const currentTime = Math.floor(Date.now() / 1000);
    await oracle.setTimestamps(currentTime - 30, currentTime + 30);
}
```

### 2. Deposit Execution Script (`execute-deposit-simple.js`)
```javascript
const { ethers } = require("hardhat");
const { execSync } = require("child_process");

async function main() {
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    // Step 1: Set fresh prices
    execSync("npx hardhat run claude/scripts/set-fresh-prices.js --network arbitrumSepolia", {
        stdio: 'inherit'
    });

    // Step 2: Build oracle params (tried multiple approaches)
    
    // Approach 1: Empty params (like previous deployment)
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    // Approach 2: With tokens and encoded data
    /*
    const currentBlock = await ethers.provider.getBlock("latest");
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    const usdtData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256", "uint256"],
        [usdtPrice, usdtPrice, currentBlock.number, currentBlock.timestamp]
    );
    
    const oracleParams = {
        tokens: [USDT, sNGN],
        providers: [],
        data: [usdtData, sngnData]
    };
    */

    // Step 3: Execute deposit
    try {
        // Simulation
        const estimatedGas = await depositHandler.estimateGas.executeDeposit(
            depositKey,
            oracleParams
        );
        
        // Actual execution
        const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
            gasLimit: estimatedGas
        });
        
        const receipt = await tx.wait();
        console.log("Success!", receipt.status);
        
    } catch (error) {
        // Always fails with OracleBlockNumbersAreSmallerThanRequired
        console.log("Error:", error.message);
    }
}
```

## What We've Tried

### 1. Different Oracle Parameter Approaches
- ✅ **Empty params** (like previous deployment) - Gets block number error
- ✅ **With tokens and encoded data** - Gets `EndOfOracleSimulation` in sim, fails on-chain
- ✅ **With just tokens, no data** - Gets block number error

### 2. Different Timestamp Approaches  
- ✅ **Using block.timestamp** - Block number error
- ✅ **Using JavaScript Date.now()** - Block number error
- ✅ **30 second window vs 300 second window** - Block number error
- ✅ **Setting min timestamp in the past** - Block number error

### 3. Configuration Changes
- ✅ **MIN_ORACLE_SIGNERS = 0** - Set successfully
- ✅ **Granted ORDER_KEEPER role** - User has role
- ✅ **Fresh price setting before each attempt** - Prices set but block numbers stale

## Key Observations

1. **Oracle Internal State**: The Oracle maintains internal block numbers that are NOT updated by:
   - `setPrimaryPrice()`
   - `setTimestamps()`
   - `clearAllPrices()`

2. **Simulation vs Execution Difference**:
   - With proper encoded data: Simulation returns `EndOfOracleSimulation` (success)
   - Same params in actual execution: Transaction reverts on-chain
   - This suggests Oracle behaves differently in simulation vs real execution

3. **Block Number Staleness**: 
   - Oracle's internal block number: 1758668765
   - Current block when executing: ~197440000+
   - These numbers don't align - Oracle seems to track something else

4. **Previous Deployment Success**:
   - Previous deployment (in `create_execute_deposit_flow.md`) used same approach
   - Empty oracle params + setPrimaryPrice worked there
   - Something different about current Oracle state or deployment

## The Core Issue

The Oracle contract has internal block number tracking that:
1. Is not updated by the standard price-setting functions
2. Is checked during deposit execution
3. Is currently stale (300+ blocks behind)
4. Needs to be updated through an unknown mechanism

## Questions for Team

1. **Oracle Deployment**: Was the Oracle deployed differently this time? Any custom modifications?
2. **Oracle State**: Is there a way to check/reset Oracle's internal block number state?
3. **SetPrices Format**: What's the exact encoding format for `oracle.setPrices()` data field?
4. **Previous Success**: What was different about the previous deployment that made it work?

## Failed Transaction for Analysis

**Transaction Hash**: `0x2d8c9dd4114c7231c71bb43ab95a8d8f77f686870e0c754ba150c5f09ba69b02`

**View on Arbiscan**: https://sepolia.arbiscan.io/tx/0x2d8c9dd4114c7231c71bb43ab95a8d8f77f686870e0c754ba150c5f09ba69b02

## Next Steps

1. **Check Oracle Contract**: Review Oracle implementation for block number update mechanism
2. **Compare Deployments**: Diff current Oracle vs previous successful deployment
3. **Find Update Method**: Locate the function that updates Oracle's internal block numbers
4. **Alternative Approach**: Consider using signed price updates if that updates block numbers

## Files for Reference

All scripts are in `/claude/scripts/`:
- `set-fresh-prices.js` - Sets oracle prices
- `execute-deposit-simple.js` - Attempts deposit execution
- `check-deposit-status.js` - Verifies deposit still exists
- `grant-order-keeper-role.js` - Grants keeper role
- `set-min-oracle-signers.js` - Sets MIN_ORACLE_SIGNERS to 0

Previous working deployment reference:
- `/claude/best_practices/create_execute_deposit_flow.md`