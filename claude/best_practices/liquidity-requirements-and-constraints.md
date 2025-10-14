# Liquidity Requirements and Constraints - Best Practices Guide

## Overview
This document explains GMX's liquidity protection mechanisms, how to configure reserve factors for different risk profiles, and how to safely run markets with high leverage relative to pool size.

---

## 1. Three Core Liquidity Constraints

GMX uses three independent mechanisms to protect liquidity providers and ensure market stability:

### A. Max Pool Amount (Hard Cap on Deposits)

```solidity
// MarketUtils.sol:1758-1769
function validatePoolAmount(
    DataStore dataStore,
    Market.Props memory market,
    address token
) internal view {
    uint256 poolAmount = getPoolAmount(dataStore, market, token);
    uint256 maxPoolAmount = getMaxPoolAmount(dataStore, market.marketToken, token);

    if (poolAmount > maxPoolAmount) {
        revert Errors.MaxPoolAmountExceeded(poolAmount, maxPoolAmount);
    }
}
```

**Purpose**: Prevents the pool from growing too large
**When checked**: During deposits
**Configuration**:
```javascript
{
  maxPoolAmountKey(market, USDT): 1_000_000e6,  // 1M USDT max
  maxPoolAmountKey(market, sNGN): 1_500_000_000e18  // 1.5B sNGN max
}
```

---

### B. Max Open Interest (Position Size Cap)

```solidity
// MarketUtils.sol:1745-1752
function validateMaxOpenInterest(
    DataStore dataStore,
    Market.Props memory market,
    bool isLong
) internal view {
    uint256 openInterest = getOpenInterest(dataStore, market, isLong);
    uint256 maxOpenInterest = getMaxOpenInterest(dataStore, market.marketToken, isLong);

    if (openInterest > maxOpenInterest) {
        revert Errors.MaxOpenInterestExceeded(openInterest, maxOpenInterest);
    }
}
```

**Purpose**: Limits total position exposure (separately for longs and shorts)
**When checked**: During position opens/increases
**Configuration**:
```javascript
{
  maxOpenInterestKey(market, isLong: true): 500_000e30,   // $500k long OI
  maxOpenInterestKey(market, isLong: false): 500_000e30   // $500k short OI
}
```

**Key Point**: Longs and shorts have independent caps. Market can have $500k longs AND $500k shorts simultaneously.

---

### C. Reserve Factor (Dynamic Liquidity Protection)

```solidity
// MarketUtils.sol:1792-1814
function validateReserve(
    DataStore dataStore,
    Market.Props memory market,
    MarketPrices memory prices,
    bool isLong
) internal view {
    // Calculate pool value in USD
    uint256 poolUsd = getPoolUsdWithoutPnl(dataStore, market, prices, isLong, false);

    // Get reserve factor (configured parameter)
    uint256 reserveFactor = getReserveFactor(dataStore, market.marketToken, isLong);

    // Calculate max allowed reserved amount
    uint256 maxReservedUsd = Precision.applyFactor(poolUsd, reserveFactor);

    // Calculate how much is currently reserved
    uint256 reservedUsd = getReservedUsd(dataStore, market, prices, isLong);

    // Validation
    if (reservedUsd > maxReservedUsd) {
        revert Errors.InsufficientReserve(reservedUsd, maxReservedUsd);
    }
}
```

**Purpose**: Ensures pool has enough liquidity to pay trader profits
**When checked**: During position opens/increases (only if `sizeDeltaUsd > 0`)
**Formula**: `reservedUsd / poolUsd ≤ reserveFactor`

---

## 2. How Reserved USD is Calculated

The "reserved" amount represents how much of the pool is locked to pay potential trader profits.

```solidity
function getReservedUsd(
    DataStore dataStore,
    Market.Props memory market,
    MarketPrices memory prices,
    bool isLong
) internal view returns (uint256) {
    uint256 reservedUsd;

    if (isLong) {
        // For LONGS: reserved scales with token price
        // Example: ETH/USD market with WETH as long collateral
        // If ETH price doubles, reserved amount doubles (traders profit more)
        uint256 openInterestInTokens = getOpenInterestInTokens(dataStore, market, isLong);
        reservedUsd = openInterestInTokens * prices.indexTokenPrice.max;
    } else {
        // For SHORTS: reserved is fixed USD amount
        // Example: ETH/USD market with USDC as short collateral
        // Price changes don't affect reserved amount (stablecoin collateral)
        reservedUsd = getOpenInterest(dataStore, market, isLong);
    }

    return reservedUsd;
}
```

### Example: USDTNGN Market

```javascript
Market setup:
- Pool: $50,000 USDT
- Reserve factor: 0.8 (80%)
- Max reserved: $50,000 * 0.8 = $40,000

Scenario 1: Shorts open $30k position
- Reserved USD = $30,000 (fixed, regardless of price)
- Check: $30,000 ≤ $40,000 ✅ PASSES

Scenario 2: Price moves, shorts now have $35k OI
- Reserved USD = $35,000
- Check: $35,000 ≤ $40,000 ✅ PASSES

Scenario 3: Trying to open $50k position
- Reserved USD = $50,000
- Check: $50,000 ≤ $40,000 ❌ FAILS (InsufficientReserve)
```

---

## 3. Standard vs High-Leverage Configurations

### Standard Configuration (Conservative)

Suitable for most markets with adequate liquidity:

```javascript
{
  // Pool: $100,000
  maxPoolAmountUSDT: 100_000e6,
  maxPoolAmountsNGN: 150_000_000e18,

  // OI Caps: 80% of pool value
  maxOpenInterestLong: 80_000e30,
  maxOpenInterestShort: 80_000e30,

  // Reserve: 80% (conservative)
  reserveFactor: 0.8e30,                    // 80%
  openInterestReserveFactor: 0.9e30,        // 90%

  // PnL Caps
  maxPnlFactorForTraders: 0.5e30,           // 50% - traders can profit up to 50% of pool
  maxPnlFactorForDeposits: 0.6e30,          // 60%
  maxPnlFactorForWithdrawals: 0.5e30        // 50%
}
```

**Math**:
- Pool: $100k
- Max reserved: $100k * 0.8 = $80k
- Max OI per side: $80k
- Pool risk at max imbalance: $80k * 25% move = $20k loss (20% of pool)

---

### High-Leverage Configuration (Aggressive)

For bootstrapping or when willing to accept higher risk:

```javascript
{
  // Pool: $25,000 (smaller pool)
  maxPoolAmountUSDT: 25_000e6,
  maxPoolAmountsNGN: 37_500_000e18,

  // OI Caps: 4x pool value (aggressive!)
  maxOpenInterestLong: 100_000e30,
  maxOpenInterestShort: 100_000e30,

  // Reserve: 400% (allows 4x leverage)
  reserveFactor: 4.0e30,                    // 400%
  openInterestReserveFactor: 4.0e30,        // 400%

  // PnL Caps (aggressive - can drain pool)
  maxPnlFactorForTraders: 1.0e30,           // 100% - traders can claim entire pool
  maxPnlFactorForDeposits: 0.5e30,          // 50%
  maxPnlFactorForWithdrawals: 0.8e30        // 80%
}
```

**Math**:
- Pool: $25k
- Max reserved: $25k * 4.0 = $100k (can reserve 4x pool size!)
- Max OI per side: $100k
- Pool risk at max imbalance: $100k * 25% move = $25k loss (100% pool wipeout!)

---

## 4. Reserve Factor Validation Limits

### Hard Limits in GMX Code

From `ConfigUtils.sol:448-456`:

```solidity
if (
    baseKey == Keys.RESERVE_FACTOR ||
    baseKey == Keys.OPEN_INTEREST_RESERVE_FACTOR
) {
    // Maximum allowed: 10.0 (1000%)
    if (value > 10 * Precision.FLOAT_PRECISION) {
        revert Errors.ConfigValueExceedsAllowedRange(baseKey, value);
    }
}
```

**Allowed range**: `0.0` to `10.0` (0% to 1000%)

### Recommended Ranges by Risk Profile

| Profile | Reserve Factor | Max OI vs Pool | Risk Level |
|---------|---------------|----------------|------------|
| **Ultra Conservative** | 0.5 - 0.6 | 0.5x - 0.6x | Very Low |
| **Conservative** | 0.7 - 0.8 | 0.7x - 0.8x | Low |
| **Standard** | 0.8 - 0.9 | 0.8x - 0.9x | Moderate |
| **Aggressive** | 1.0 - 2.0 | 1x - 2x | High |
| **Very Aggressive** | 2.0 - 4.0 | 2x - 4x | Very High |
| **Extreme** | 4.0 - 10.0 | 4x - 10x | Extreme |

---

## 5. Understanding Pool Risk with OI Imbalance

### Key Insight: Balanced OI = Zero Pool Risk

When long and short OI are equal, the pool is perfectly hedged:

```javascript
Market state:
- $100k long OI
- $100k short OI
- Price moves 25%

Scenario A: NGN weakens (1500 → 1875)
- Longs profit: +$25k (pool pays out)
- Shorts lose: -$25k (pool receives)
- Net pool change: $0 ✅

Scenario B: NGN strengthens (1500 → 1125)
- Longs lose: -$25k (pool receives)
- Shorts profit: +$25k (pool pays out)
- Net pool change: $0 ✅
```

**Perfect balance = perfect hedge!**

### Pool Risk Comes from Imbalance

```javascript
Market state:
- $100k short OI
- $0 long OI (IMBALANCED!)
- Pool: $25k

NGN strengthens 25% (1500 → 1125):
- Shorts profit: +$25k
- No longs to offset
- Pool loss: -$25k ❌ (complete wipeout)
```

### Partial Imbalance Example

```javascript
Market state:
- $80k short OI
- $40k long OI
- Imbalance: $40k
- Pool: $25k

NGN strengthens 25%:
- Shorts profit: +$20k
- Longs lose: -$10k
- Net pool loss: -$10k (40% of pool)
```

**Formula**: `Max Pool Loss ≈ OI Imbalance * Price Move %`

---

## 6. Risk Management Strategies

When running high-leverage configurations (reserve factor > 1.0), implement these safeguards:

### A. High Funding Rates (Incentivize Balance)

```javascript
{
  // Charge funding to the larger side, pay to smaller side
  fundingFactor: 0.0001e30,                    // 0.01% per hour at 100% skew
  fundingExponentFactor: 1.5e30,               // Exponential scaling
  thresholdForStableFunding: 0.05e30,          // 5% imbalance threshold
  thresholdForDecreaseFunding: 0.0e30,         // Always charge funding

  // Aggressive funding rates
  maxFundingFactorPerSecond: 0.000001e30,      // ~3% per hour max
  minFundingFactorPerSecond: 0.0e30            // No minimum
}
```

**How it works**:
- If longs > shorts by 50%, longs pay 0.5% per hour to shorts
- Makes it expensive to keep imbalanced positions open
- Incentivizes traders to balance the market

### B. Price Impact (Discourage Large Imbalanced Orders)

```javascript
{
  positionImpactFactor: 0.01e30,               // 1% impact at $100k skew
  positionImpactExponentFactor: 2.0e30,        // Quadratic (gets expensive fast)
  maxPositionImpactFactor: 0.05e30,            // 5% max slippage

  // Positive impact (rebate for balancing trades)
  maxPositivePositionImpactFactor: 0.01e30     // 1% max rebate
}
```

**How it works**:
- Opening a $20k long when longs > shorts costs 2% slippage
- Opening a $20k short (balancing) gives 1% rebate
- Encourages traders to take the minority side

### C. Off-Chain Monitoring & Alerts

Set up monitoring to track OI imbalance:

```javascript
// monitoring/oiImbalanceMonitor.js
async function checkOIImbalance(market) {
  const longOI = await getOpenInterest(market, true);
  const shortOI = await getOpenInterest(market, false);
  const imbalance = Math.abs(longOI - shortOI);
  const poolValue = await getPoolValue(market);

  const imbalanceRatio = imbalance / poolValue;

  // Alert levels
  if (imbalanceRatio > 3.0) {
    sendCriticalAlert(`EXTREME IMBALANCE: ${imbalance} (${imbalanceRatio}x pool)`);
    // Consider: Increase funding rates, reduce OI caps, add liquidity
  } else if (imbalanceRatio > 2.0) {
    sendWarningAlert(`HIGH IMBALANCE: ${imbalance} (${imbalanceRatio}x pool)`);
  } else if (imbalanceRatio > 1.0) {
    sendInfoAlert(`Moderate imbalance: ${imbalance} (${imbalanceRatio}x pool)`);
  }
}
```

**Alert thresholds** (for $25k pool):
- **Info**: Imbalance > $25k (1x pool)
- **Warning**: Imbalance > $50k (2x pool)
- **Critical**: Imbalance > $75k (3x pool)

### D. Dynamic OI Caps Based on Balance

Advanced: Adjust OI caps based on current imbalance:

```javascript
// Custom validation function
function validateDynamicOI(market, isLong, sizeDeltaUsd) {
  const longOI = getOpenInterest(market, true);
  const shortOI = getOpenInterest(market, false);
  const imbalance = isLong ? (longOI - shortOI) : (shortOI - longOI);

  // Base max: $100k per side
  const baseMax = 100_000e30;

  // If already imbalanced by >$50k, don't allow more
  if (imbalance > 50_000e30) {
    const currentOI = isLong ? longOI : shortOI;
    if (sizeDeltaUsd > 0) {
      revert MaxOIImbalanceExceeded(imbalance, 50_000e30);
    }
  }

  // Normal validation
  validateMaxOpenInterest(market, isLong);
}
```

---

## 7. Configuration Examples

### Example 1: Conservative Market ($100k Pool, 80% Reserve)

```javascript
const conservativeConfig = {
  market: USDTNGN_MARKET,

  // Pool caps
  maxPoolAmount: {
    USDT: ethers.utils.parseUnits("100000", 6),
    sNGN: ethers.utils.parseEther("150000000")
  },

  // OI caps (80% of pool)
  maxOpenInterest: {
    long: ethers.utils.parseUnits("80000", 30),
    short: ethers.utils.parseUnits("80000", 30)
  },

  // Reserve factors
  reserveFactor: {
    long: ethers.utils.parseUnits("0.8", 30),   // 80%
    short: ethers.utils.parseUnits("0.8", 30)
  },

  openInterestReserveFactor: {
    long: ethers.utils.parseUnits("0.9", 30),   // 90%
    short: ethers.utils.parseUnits("0.9", 30)
  },

  // PnL caps
  maxPnlFactorForTraders: ethers.utils.parseUnits("0.5", 30),      // 50%
  maxPnlFactorForDeposits: ethers.utils.parseUnits("0.6", 30),
  maxPnlFactorForWithdrawals: ethers.utils.parseUnits("0.5", 30),

  // Moderate funding rates
  fundingFactor: ethers.utils.parseUnits("0.00005", 30),           // 0.005%/hr
  fundingExponentFactor: ethers.utils.parseUnits("1.0", 30)
};

// Risk analysis:
// - Max imbalance: $80k
// - 25% price move: $20k loss (20% of pool)
// - With balanced OI: ~$0 risk
```

### Example 2: High-Leverage Bootstrapping ($25k Pool, 400% Reserve)

```javascript
const aggressiveConfig = {
  market: USDTNGN_MARKET,

  // Pool caps (smaller pool)
  maxPoolAmount: {
    USDT: ethers.utils.parseUnits("25000", 6),
    sNGN: ethers.utils.parseEther("37500000")
  },

  // OI caps (4x pool size!)
  maxOpenInterest: {
    long: ethers.utils.parseUnits("100000", 30),
    short: ethers.utils.parseUnits("100000", 30)
  },

  // Reserve factors (CRITICAL - allows 4x leverage)
  reserveFactor: {
    long: ethers.utils.parseUnits("4.0", 30),   // 400%
    short: ethers.utils.parseUnits("4.0", 30)
  },

  openInterestReserveFactor: {
    long: ethers.utils.parseUnits("4.0", 30),
    short: ethers.utils.parseUnits("4.0", 30)
  },

  // PnL caps (aggressive - can drain pool)
  maxPnlFactorForTraders: ethers.utils.parseUnits("1.0", 30),      // 100%
  maxPnlFactorForDeposits: ethers.utils.parseUnits("0.5", 30),
  maxPnlFactorForWithdrawals: ethers.utils.parseUnits("0.8", 30),

  // HIGH funding rates (critical for balance)
  fundingFactor: ethers.utils.parseUnits("0.0001", 30),            // 0.01%/hr
  fundingExponentFactor: ethers.utils.parseUnits("1.5", 30),
  maxFundingFactorPerSecond: ethers.utils.parseUnits("0.000001", 30), // ~3%/hr max

  // Price impact (discourage imbalance)
  positionImpactFactor: ethers.utils.parseUnits("0.01", 30),       // 1% impact
  positionImpactExponentFactor: ethers.utils.parseUnits("2.0", 30) // Quadratic
};

// Risk analysis:
// - Max imbalance: $100k
// - 25% price move: $25k loss (100% pool wipeout!)
// - With balanced OI: ~$0 risk
// - REQUIRES: Active monitoring, high funding rates, price impact
```

### Example 3: Gradual Scale-Up Strategy

Start conservative, then increase as liquidity grows:

```javascript
// Phase 1: Launch ($25k pool, conservative)
const phase1 = {
  maxPoolAmount: 25_000e6,
  maxOpenInterest: { long: 20_000e30, short: 20_000e30 },
  reserveFactor: 0.8e30  // 80% - standard
};

// Phase 2: Growing ($50k pool, moderate)
const phase2 = {
  maxPoolAmount: 50_000e6,
  maxOpenInterest: { long: 50_000e30, short: 50_000e30 },
  reserveFactor: 1.0e30  // 100% - moderate leverage
};

// Phase 3: Mature ($100k pool, aggressive)
const phase3 = {
  maxPoolAmount: 100_000e6,
  maxOpenInterest: { long: 150_000e30, short: 150_000e30 },
  reserveFactor: 1.5e30  // 150% - aggressive
};
```

---

## 8. Deployment Script Template

```javascript
// scripts/configure-market-liquidity.js
const { ethers } = require("hardhat");

async function configureMarketLiquidity(marketAddress, config) {
  const dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS);

  console.log(`\n📍 Configuring liquidity for market: ${marketAddress}\n`);

  // 1. Set pool caps
  console.log("Setting pool caps...");
  await dataStore.setUint(
    Keys.maxPoolAmountKey(marketAddress, config.usdtAddress),
    config.maxPoolAmount.USDT
  );
  await dataStore.setUint(
    Keys.maxPoolAmountKey(marketAddress, config.sngnAddress),
    config.maxPoolAmount.sNGN
  );

  // 2. Set OI caps
  console.log("Setting OI caps...");
  await dataStore.setUint(
    Keys.maxOpenInterestKey(marketAddress, true),  // longs
    config.maxOpenInterest.long
  );
  await dataStore.setUint(
    Keys.maxOpenInterestKey(marketAddress, false), // shorts
    config.maxOpenInterest.short
  );

  // 3. Set reserve factors (CRITICAL!)
  console.log("Setting reserve factors...");
  await dataStore.setUint(
    Keys.reserveFactorKey(marketAddress, true),
    config.reserveFactor.long
  );
  await dataStore.setUint(
    Keys.reserveFactorKey(marketAddress, false),
    config.reserveFactor.short
  );

  await dataStore.setUint(
    Keys.openInterestReserveFactorKey(marketAddress, true),
    config.openInterestReserveFactor.long
  );
  await dataStore.setUint(
    Keys.openInterestReserveFactorKey(marketAddress, false),
    config.openInterestReserveFactor.short
  );

  // 4. Set PnL caps
  console.log("Setting PnL caps...");
  await dataStore.setUint(
    Keys.maxPnlFactorKey(Keys.MAX_PNL_FACTOR_FOR_TRADERS, marketAddress, true),
    config.maxPnlFactorForTraders
  );

  // Verify configuration
  console.log("\n✅ Configuration complete!\n");
  await verifyConfiguration(dataStore, marketAddress);
}

async function verifyConfiguration(dataStore, marketAddress) {
  const longReserveFactor = await dataStore.getUint(
    Keys.reserveFactorKey(marketAddress, true)
  );
  const maxLongOI = await dataStore.getUint(
    Keys.maxOpenInterestKey(marketAddress, true)
  );

  console.log("Verification:");
  console.log(`  Reserve Factor (Long): ${ethers.utils.formatUnits(longReserveFactor, 30)}`);
  console.log(`  Max Long OI: $${ethers.utils.formatUnits(maxLongOI, 30)}`);

  // Calculate effective leverage
  const leverage = parseFloat(ethers.utils.formatUnits(longReserveFactor, 30));
  console.log(`  Effective Leverage: ${leverage}x`);

  if (leverage > 2.0) {
    console.log("  ⚠️  WARNING: High leverage configuration!");
    console.log("     - Ensure funding rates are configured");
    console.log("     - Monitor OI imbalance closely");
    console.log("     - Have emergency response plan ready");
  }
}

// Example usage
const HIGH_LEVERAGE_CONFIG = {
  usdtAddress: "0x...",
  sngnAddress: "0x...",
  maxPoolAmount: {
    USDT: ethers.utils.parseUnits("25000", 6),
    sNGN: ethers.utils.parseEther("37500000")
  },
  maxOpenInterest: {
    long: ethers.utils.parseUnits("100000", 30),
    short: ethers.utils.parseUnits("100000", 30)
  },
  reserveFactor: {
    long: ethers.utils.parseUnits("4.0", 30),
    short: ethers.utils.parseUnits("4.0", 30)
  },
  openInterestReserveFactor: {
    long: ethers.utils.parseUnits("4.0", 30),
    short: ethers.utils.parseUnits("4.0", 30)
  },
  maxPnlFactorForTraders: ethers.utils.parseUnits("1.0", 30)
};

configureMarketLiquidity(MARKET_ADDRESS, HIGH_LEVERAGE_CONFIG);
```

---

## 9. Key Takeaways

### Reserve Factor Basics

✅ **Reserve factor determines max OI relative to pool size**
- 0.8 (80%) = conservative, OI ≤ 80% of pool
- 1.0 (100%) = standard, OI ≤ pool size
- 4.0 (400%) = aggressive, OI ≤ 4x pool size
- Max allowed: 10.0 (1000%)

✅ **Validation formula**: `reservedUsd ≤ poolUsd * reserveFactor`

✅ **Checked only when**: Opening/increasing positions with `sizeDeltaUsd > 0`

### Risk Management

✅ **Balanced OI = Zero pool risk** (perfect hedge)

✅ **Pool risk comes from imbalance**: `Max Loss ≈ Imbalance * Price Move %`

✅ **High leverage requires**:
- Active monitoring
- High funding rates
- Price impact settings
- Emergency response plan

### Configuration Strategy

✅ **Start conservative** (0.8-1.0 reserve factor)

✅ **Scale up gradually** as liquidity and confidence grow

✅ **Use safeguards** when running reserve factor > 1.0:
- Funding rates
- Price impact
- OI imbalance monitoring
- Dynamic caps

### Common Mistakes to Avoid

❌ Setting reserve factor > pool can handle without monitoring
❌ Ignoring OI imbalance in high-leverage configs
❌ Not configuring funding rates to incentivize balance
❌ Assuming "it will stay balanced" without enforcement

---

## 10. References

### Contract Files
- `contracts/market/MarketUtils.sol` - Reserve validation logic
- `contracts/config/ConfigUtils.sol` - Reserve factor validation (max 10.0)
- `contracts/position/IncreasePositionUtils.sol` - When validations are called

### README Sections
- Lines 499-506: Reserve factor explanation
- Lines 522-544: Parameter definitions

### Related Docs
- `position-fees-and-pricing.md` - How fees interact with pool value
- `first-deposit-solution-complete-guide.md` - Initial pool setup

---

**Last Updated**: October 2025
