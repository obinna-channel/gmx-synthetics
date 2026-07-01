# GLV (Global Liquidity Vault) Architecture and Usage Guide

## Overview

The GLV (Global Liquidity Vault) is a liquidity aggregation layer that sits on top of multiple GM markets. Instead of depositing liquidity into each market individually, users can deposit into a GLV and receive unified exposure across multiple markets with the same long/short token pair.

## Key Discoveries

### 1. **GLV is NOT an Automatic Liquidity Router**

**Common Misconception:** GLV automatically distributes user deposits across multiple markets.

**Reality:** Users specify which market their deposit goes into. The GLV acts as a unified wrapper that:
- Accepts deposits into any constituent market
- Issues GLV tokens representing proportional ownership of the entire pool
- Allows protocol operators to rebalance liquidity via "shift" operations

### 2. **User Deposits: Market Selection vs. Final Exposure**

When a user deposits into a GLV:

```
User Flow:
1. User calls GlvRouter.createGlvDeposit()
2. User MUST specify which market to deposit into
3. GLV deposits funds into that specific market
4. GLV mints GLV tokens to the user
5. User now owns a proportional share of ALL markets in the GLV
```

**Critical Understanding:** The market you choose for deposit is just the **entry point**. After shifts/rebalancing, your funds may be distributed across all markets in the GLV.

### 3. **GLV Token Value Calculation**

GLV tokens represent proportional ownership of GM tokens across ALL supported markets:

```solidity
// From GlvUtils.sol:43-59
function getGlvValue(...) {
    // Iterates through ALL markets
    for (uint256 i = 0; i < marketAddresses.length; i++) {
        glvValue += _getGlvMarketValue(...);
    }
    return glvValue;
}
```

**Example:**
```
GLV holds:
- Market A: $100k in GM tokens
- Market B: $50k in GM tokens
- Market C: $50k in GM tokens
Total: $200k

User deposits $10k into Market A:
- New GLV total: $210k
- User receives: 4.76% of GLV tokens (10k/210k)

After keeper shifts $30k from A → B:
- Market A: $80k
- Market B: $80k
- Market C: $50k
- User's 4.76% represents: ~$3.8k in A, ~$3.8k in B, ~$2.38k in C
```

### 4. **Rebalancing Architecture: Keepers + Smart Contracts**

The README states: "Liquidity is automatically rebalanced between underlying markets based on markets utilisation."

**How This Actually Works:**

#### On-Chain (Smart Contracts):
- `GlvShiftHandler.sol` provides `createGlvShift()` and `executeGlvShift()` functions
- Enforces constraints:
  - Maximum price impact limits
  - Minimum time intervals between shifts
  - Market capacity limits (glvMaxMarketTokenBalanceUsd)
  - Price impact caps

#### Off-Chain (Keeper Bots):
- Monitor market utilization across all markets in each GLV
- Calculate optimal rebalancing based on utilization imbalance
- Automatically call `createGlvShift()` when rebalancing is needed
- Provide oracle prices for the shift execution

**Evidence from Known Issues (README.md:641):**
> "The GLV shift feature can be exploited by temporarily increasing the utilization in a market that typically has low utilization. **Once the keeper executes the shift**, the attacker can lower the utilization back to its normal levels."

This confirms keepers monitor utilization and execute shifts accordingly.

### 5. **Required Role for Rebalancing: ORDER_KEEPER**

To execute GLV shifts, an account must have the `ORDER_KEEPER` role.

```solidity
// From GlvShiftHandler.sol:43, 54
function createGlvShift(...) external onlyOrderKeeper { ... }
function executeGlvShift(...) external onlyOrderKeeper { ... }

// Role definition from Role.sol:77-80
bytes32 public constant ORDER_KEEPER = keccak256(abi.encode("ORDER_KEEPER"));
// Hash: 0x40a07f8f0fc57fcf18b093d96362a8e661eaac7b7e6edbf66f242111f83a6794
```

The `ORDER_KEEPER` role is also responsible for:
- Executing deposits/withdrawals
- Executing trading orders
- Executing liquidations
- **Executing GLV shifts**

## Key Components

### Smart Contracts

1. **GlvVault** (`0xa736666971e7aa6Fdf61d532d3027a162597EBf5` on arbitrumSepolia)
   - StrictBank that holds tokens for GLV operations

2. **GlvToken**
   - ERC20 token representing user's share in the GLV
   - Also acts as a Bank holding the GM market tokens

3. **GlvRouter**
   - Main entry point for users
   - Functions: `createGlvDeposit()`, `createGlvWithdrawal()`

4. **GlvShiftHandler**
   - Handles rebalancing operations
   - Functions: `createGlvShift()`, `executeGlvShift()`

5. **GlvDepositHandler** / **GlvWithdrawalHandler**
   - Execute deposit and withdrawal requests

### Configuration Parameters

Each market in a GLV has configurable limits:

```typescript
// From config/glvs.ts
markets: {
    indexToken: string;
    isMarketDisabled?: boolean;
    glvMaxMarketTokenBalanceAmount: BigNumberish;  // Token amount cap
    glvMaxMarketTokenBalanceUsd: BigNumberish;     // USD value cap
}

// Shift constraints
shiftMaxPriceImpactFactor: percentageToFloat("0.025%");  // Max 0.025% price impact
shiftMinInterval: 30 * 60;  // Can only shift every 30 minutes
```

## How GLV Works: Step-by-Step

### Depositing into GLV

1. User deposits long/short tokens (e.g., mUSD + mNGN) into a specific market via GLV
2. GLV creates an internal GM market deposit
3. GLV receives GM market tokens from that market
4. GLV mints GLV tokens to the user proportional to value added
5. GM market tokens are held by the GLV token contract itself

**Key Code Flow** (ExecuteGlvDepositUtils.sol:59-70):
- Creates deposit to specified GM market
- GM tokens transferred to GLV
- GLV syncs GM token balance
- Mints GLV tokens based on share of total GLV value

### Withdrawing from GLV

1. User burns GLV tokens
2. GLV calculates equivalent GM market tokens to withdraw
3. Withdraws from the specified GM market
4. Returns long/short tokens to the user

### Shifting (Rebalancing)

1. Keeper monitors market utilization
2. When imbalance detected, keeper calls `createGlvShift()`
   - Specifies: fromMarket, toMarket, amount
   - Must have ORDER_KEEPER role
3. System validates:
   - Price impact within limits
   - Sufficient time passed since last shift
   - Destination market has capacity
4. GLV withdraws GM tokens from source market
5. GLV deposits into destination market
6. Net effect: Liquidity rebalanced across markets

## Benefits of Using GLV

1. **Unified Token Representation**
   - Hold one GLV token instead of multiple GM tokens
   - Simplifies portfolio management

2. **Diversified Exposure**
   - Automatic exposure to multiple markets
   - Risk spread across different market configurations

3. **Simplified Withdrawals**
   - Can withdraw from any market in the GLV
   - Don't need to manage individual GM positions

4. **Protocol-Managed Rebalancing**
   - Keepers handle rebalancing based on utilization
   - Users don't need to manually shift between markets

## Integration Guide

### For Users (Frontend Integration)

**Instead of:**
```javascript
// Depositing into each market separately
ExchangeRouter.createDeposit(market1, ...);  // Get GM_A tokens
ExchangeRouter.createDeposit(market2, ...);  // Get GM_B tokens
ExchangeRouter.createDeposit(market3, ...);  // Get GM_C tokens
```

**Use GLV:**
```javascript
// Deposit once, get unified exposure
GlvRouter.createGlvDeposit({
    glv: glvAddress,
    market: market1,  // Entry point (can be any market in the GLV)
    longTokenAmount: amount1,
    shortTokenAmount: amount2,
    // ...
});
// Receive GLV tokens representing exposure to all markets
```

### For Protocol Operators (Keeper Setup)

To implement automatic rebalancing:

1. **Monitor Market Utilization**
   ```javascript
   // Pseudocode for keeper logic
   for each GLV:
       markets = getGlvMarkets(glv)
       for each market in markets:
           utilization = getMarketUtilization(market)

       if (utilizationImbalance > threshold):
           fromMarket = highUtilizationMarket
           toMarket = lowUtilizationMarket
           amount = calculateOptimalShiftAmount()

           createGlvShift({
               glv: glvAddress,
               fromMarket: fromMarket,
               toMarket: toMarket,
               marketTokenAmount: amount
           })
   ```

2. **Grant ORDER_KEEPER Role**
   ```javascript
   // Grant role to keeper address
   roleStore.grantRole(
       keeperAddress,
       Role.ORDER_KEEPER
   );
   ```

3. **Execute Shifts**
   ```javascript
   // When shift is needed
   const shiftKey = await glvShiftHandler.createGlvShift(params);

   // Execute with oracle prices
   await glvShiftHandler.executeGlvShift(
       shiftKey,
       oracleParams
   );
   ```

## Important Considerations

### From README Known Issues (GLV Section):

1. **Shift Exploitation Risk**
   > "The GLV shift feature can be exploited by temporarily increasing the utilization in a market that typically has low utilization. Once the keeper executes the shift, the attacker can lower the utilization back to its normal levels."

   **Mitigation:** Configure position fees and price impact to make attacks expensive.

2. **PnL Factor Management**
   > "If this GM market's maxPnlFactorForDeposits is higher than maxPnlFactorForTraders then the GM market is valued lower during deposits than it will be once traders have realized their capped profits."

   **Best Practice:** Ensure `maxPnlFactorForDeposits ≤ maxPnlFactorForTraders`

3. **Illiquid GM Token Risk**
   > "GM tokens could become illiquid due to high pnl factor or high reserved usd. Users can deposit illiquid GM tokens into GVL and withdraw liquidity from a different market, leaving the GLV with illiquid tokens."

   **Best Practice:** Configure `glvMaxMarketTokenBalanceUsd` and `glvMaxMarketTokenBalanceAmount` based on market risk profiles.

4. **Market Value Can Become Negative**
   > "It's technically possible for market value to become negative. In this case the GLV would be unusable until the market value becomes positive."

   **Monitoring:** Track market values and have contingency plans.

## Your Current Deployment Status

Based on `claude/deployments/marks-arbitrumSepolia-deployments.md`:

**Deployed GLV Infrastructure:**
- GlvVault: `0xa736666971e7aa6Fdf61d532d3027a162597EBf5`
- GlvDepositHandler: `0x819b6B5B9C6d56629adf82B52B25aA6AEeaA16cc`
- GlvWithdrawalHandler: `0xFD790Fd45eCC932E71717413bA4f096FbfA9eC4B`

**Missing:**
- Actual GLV token deployment (created via GlvFactory)
- Configuration of which markets the GLV should support
- ORDER_KEEPER role assignment for your keeper

## Next Steps to Use GLV

1. **Deploy GLV Token** using GlvFactory
2. **Configure Supported Markets** - specify which markets share the same long/short tokens
3. **Set Market Caps** - configure `glvMaxMarketTokenBalanceUsd` for each market
4. **Grant ORDER_KEEPER Role** to your keeper address
5. **Implement Keeper Logic** to monitor utilization and trigger shifts
6. **Update Frontend** to use `GlvRouter.createGlvDeposit()` instead of direct market deposits

## References

- Main README: GLV section (line 91-93)
- Known Issues: GLV section (line 639-647)
- Contracts: `contracts/glv/` directory
- Configuration: `config/glvs.ts`
- Deployment docs: `claude/deployments/marks-arbitrumSepolia-deployments.md`

---

*Document created: 2025-11-22*
*Based on code analysis and system architecture discovery*
