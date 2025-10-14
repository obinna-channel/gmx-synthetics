# Revenue Model Analysis - Own Markets vs Routed Trades

## Overview
This document analyzes revenue potential from two sources:
1. **Own Markets** (GMX fork) - Full fee control, you provide liquidity
2. **Routed Trades** (GMX/Ostium) - Markup model, external liquidity

---

## 1. Own Markets Revenue Structure (GMX Fork)

### Fee Types You Collect

#### A. Position Fees (Open/Close) - PRIMARY REVENUE

```javascript
// Fee calculation flow
positionFeeAmount = sizeDeltaUsd * positionFeeFactor

// After referral discounts (if any):
protocolFeeAmount = positionFeeAmount - referralDiscounts

// Split between protocol and pool:
feeReceiverAmount = protocolFeeAmount * positionFeeReceiverFactor  // ← YOU KEEP THIS
positionFeeAmountForPool = protocolFeeAmount - feeReceiverAmount   // ← Goes to LP pool
```

**Standard Configuration**:
```javascript
{
  positionFeeFactor: 0.0005e30,           // 0.05% (5 bps)
  positionFeeReceiverFactor: 0.3e30,      // 30% of fees to protocol
  // Result: 0.015% to protocol, 0.035% to pool
}
```

**Your Revenue**: `Trade Size * 0.05% * 30% = Trade Size * 0.015%`

**Charged On**:
- Position opens (full size)
- Position increases (size delta)
- Position decreases (size delta)
- Position closes (full size)

#### B. Borrowing Fees - SECONDARY REVENUE

```javascript
borrowingFee = positionSize * borrowingRate * timeElapsed

// Split:
borrowingFeeForPool = borrowingFee * (1 - borrowingFeeReceiverFactor)
borrowingFeeForProtocol = borrowingFee * borrowingFeeReceiverFactor  // ← YOU KEEP THIS
```

**Standard Configuration**:
```javascript
{
  borrowingFactorPerSecond: Variable based on utilization
  borrowingFeeReceiverFactor: 0.1e30      // 10% to protocol
}
```

**Your Revenue**: `~0.01-0.1% annually on open positions`

**Note**: Borrowing fees accrue continuously while positions are open, calculated per second.

#### C. Funding Fees - NO DIRECT REVENUE

```javascript
// Paid by imbalanced side to balanced side
fundingFee = OI * fundingRate * timeElapsed

// Distribution:
// - Profitable side receives (traders)
// - Pool receives net balance
```

**You don't directly collect**, but it:
- Helps keep pool profitable
- Incentivizes balanced OI
- Increases pool value (if you're LP)

---

### Revenue Calculation: Own Markets

#### Example: USDTNGN Market

**Assumptions**:
- Daily trading volume: $500,000
- Average position size: $10,000
- Average position duration: 3 days
- Open interest: $200,000 average

**Position Fee Revenue** (Primary - ~95% of revenue):
```javascript
// Opens + Closes
dailyVolume = $500,000
positionFee = $500,000 * 0.05% = $250
protocolShare = $250 * 30% = $75/day

Monthly: $75 * 30 = $2,250
Annually: $2,250 * 12 = $27,000
```

**Borrowing Fee Revenue** (Secondary - ~5% of revenue):
```javascript
// Assuming 0.01% per day borrowing rate
avgOpenInterest = $200,000
borrowingFees = $200,000 * 0.01% = $20/day
protocolShare = $20 * 10% = $2/day

Monthly: $2 * 30 = $60
Annually: $60 * 12 = $720
```

**Total Annual Revenue (Own Market)**:
- Position fees: $27,000
- Borrowing fees: $720
- **Total: ~$27,720/year** (per $500k daily volume)

**As % of Volume**: $27,720 / ($500k * 365) = **0.0152% of annual volume**

---

## 2. Routed Trades Revenue Structure

### Markup Model (0.02% Spread)

You add a 0.02% markup before routing:

```javascript
// User Order Flow
userOrderSize = $10,000
yourMarkup = 0.0002              // 0.02%
markupFee = $10,000 * 0.0002 = $2

// Routing
totalUserPays = orderSize + markupFee + platformFee
youKeep = $2
platformGets = their normal fee
```

#### A. Routed to GMX (Crypto Perps)

**GMX Fee Structure** (they charge):
- Position fee: 0.05-0.07% (varies by market)
- Funding fees (variable)
- Borrowing fees (variable)

**Your Revenue**:
```javascript
positionSize = $10,000
yourMarkup = $10,000 * 0.02% = $2
gmxFee = $10,000 * 0.06% = $6      // User pays this to GMX

totalUserPays = $10,000 * 0.08% = $8
youKeep = $2
```

**User Comparison**:
- Trading directly on GMX: 0.06%
- Trading via your platform: 0.08%
- Premium for your UX: 0.02%

#### B. Routed to Ostium (Stock Perps)

**Ostium Fee Structure** (typical perp DEX):
- Position fee: ~0.05-0.10%
- Funding fees: Variable

**Your Revenue**:
```javascript
positionSize = $10,000
yourMarkup = $10,000 * 0.02% = $2
ostiumFee = $10,000 * 0.08% = $8   // User pays to Ostium

totalUserPays = $10,000 * 0.10% = $10
youKeep = $2
```

---

### Revenue Calculation: Routed Trades

#### Example: $2M Daily Routed Volume

**Assumptions**:
- $1M routed to GMX (crypto)
- $1M routed to Ostium (stocks)
- 0.02% markup on all trades

**Daily Revenue**:
```javascript
gmxRouted = $1,000,000
ostiumRouted = $1,000,000
markup = 0.0002

dailyRevenue = ($1M + $1M) * 0.0002 = $400/day

Monthly: $400 * 30 = $12,000
Annually: $12,000 * 12 = $144,000
```

**As % of Volume**: $144,000 / ($2M * 365) = **0.0197% of annual volume**

---

## 3. Revenue Comparison & Analysis

### Revenue Per $1M Daily Volume

| Revenue Source | Annual Revenue | % of Volume | Capital Required |
|----------------|---------------|-------------|------------------|
| **Own Market** | $55,440 | 0.0152% | $25k-$100k pool |
| **Routed (0.02% markup)** | $72,000 | 0.0197% | $0 |

### Key Insights

✅ **Routed trades are MORE profitable per dollar of volume**
- No capital requirements
- No liquidity risk
- Pure margin business
- Higher revenue rate (0.0197% vs 0.0152%)

✅ **Own markets have strategic value**
- Control user experience
- Capture unique markets (USDTNGN, USDTARS)
- Build moat against competition
- Pool can appreciate in value
- Lower total fees for users (0.05% vs 0.08%)

✅ **Markup sweet spot: 0.02%**
- Competitive vs direct platform usage
- Small enough to be acceptable
- Sustainable for most users

---

## 4. Blended Revenue Model

### Recommended Strategy

Assume your platform does:
- 30% volume on own markets (unique pairs like USDTNGN)
- 70% volume routed (commoditized pairs like BTC, ETH, stocks)

#### Example: $5M Daily Total Volume

**Own Markets** ($1.5M/day):
```javascript
dailyVolume = $1,500,000
annualRevenue = $1.5M * 365 * 0.000152 = $83,220
```

**Routed Trades** ($3.5M/day):
```javascript
dailyVolume = $3,500,000
annualRevenue = $3.5M * 365 * 0.000197 = $251,678
```

**Total Annual Revenue**: ~$334,898

**Blended Fee Rate**: 0.0184% of total volume

---

## 5. Optimizing Own Market Fees

### Current State

```javascript
positionFeeFactor = 0.05%
protocolShare = 30%
yourRevenue = 0.015%
```

### Option A: Increase Protocol Share (Recommended)

Keep user fees competitive, take more from pool:

```javascript
{
  positionFeeFactor: 0.0005e30,           // 0.05% (keep competitive)
  positionFeeReceiverFactor: 0.4e30,      // 40% (vs 30% standard)
  // Result: 0.02% protocol revenue

  // User still pays: 0.05% (lowest in market)
  // You earn: 0.02% (matches routed markup)
  // Pool gets: 0.03% (still profitable)
}
```

### Option B: Increase Position Fee

Raise fees slightly, keep share constant:

```javascript
{
  positionFeeFactor: 0.000667e30,         // 0.0667%
  positionFeeReceiverFactor: 0.3e30,      // 30%
  // Result: 0.02% protocol revenue

  // User pays: 0.0667% (still competitive vs 0.08% routed)
  // You earn: 0.02%
  // Pool gets: 0.0467%
}
```

### Recommended: Option A (Higher Protocol Share)

**Why**:
- Users see 0.05% fee (same as GMX, better than routed 0.08%)
- You earn 0.02% (matches routed revenue)
- Simpler to explain ("lowest fees in the market")
- Pool still profitable at 0.03%

---

## 6. Implementation Guide

### A. Own Market Fee Configuration

```javascript
// scripts/configure-market-fees.js
async function configureMarketFees(marketAddress) {
  const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

  // Position fees (0.05% competitive rate)
  await dataStore.setUint(
    Keys.positionFeeFactorKey(marketAddress, true),   // for positive price impact
    ethers.utils.parseUnits("0.0003", 30)             // 0.03%
  );

  await dataStore.setUint(
    Keys.positionFeeFactorKey(marketAddress, false),  // for negative price impact
    ethers.utils.parseUnits("0.0005", 30)             // 0.05%
  );

  // Protocol share (40% to match routed revenue)
  await dataStore.setUint(
    Keys.POSITION_FEE_RECEIVER_FACTOR,
    ethers.utils.parseUnits("0.4", 30)                // 40%
  );

  // Borrowing fee split (10% protocol share)
  await dataStore.setUint(
    Keys.BORROWING_FEE_RECEIVER_FACTOR,
    ethers.utils.parseUnits("0.1", 30)                // 10%
  );

  console.log("✅ Fee configuration complete");
  console.log("   Position fee: 0.05%");
  console.log("   Protocol share: 40%");
  console.log("   Protocol earns: 0.02% of volume");
}
```

### B. Routed Trade Markup (Frontend)

```javascript
// client/src/services/orderRouting.js

const MARKUP_BPS = 2;  // 0.02% = 2 basis points

async function routeOrder(order, platform) {
  // Calculate markup
  const markupAmount = order.size * (MARKUP_BPS / 10000);

  // Add to order
  const routedOrder = {
    ...order,
    size: order.size,
    totalCost: order.size + markupAmount,
    breakdown: {
      positionSize: order.size,
      platformMarkup: markupAmount,
      markupBps: MARKUP_BPS,
      destination: platform  // 'gmx' or 'ostium'
    }
  };

  // Route to platform
  if (platform === 'gmx') {
    return await routeToGMX(routedOrder);
  } else if (platform === 'ostium') {
    return await routeToOstium(routedOrder);
  }
}

// Revenue tracking
async function trackRevenue(order) {
  const markup = order.size * (MARKUP_BPS / 10000);

  await analytics.track('routing_revenue', {
    platform: order.destination,
    orderSize: order.size,
    markupCollected: markup,
    markupBps: MARKUP_BPS,
    timestamp: Date.now()
  });

  // Aggregate daily revenue
  await updateDailyRevenue({
    date: new Date().toISOString().split('T')[0],
    source: order.destination,
    amount: markup
  });
}
```

### C. User-Facing Fee Display

```javascript
// client/src/components/trading/FeeBreakdown.js

const FeeBreakdown = ({ order, isRouted }) => {
  if (isRouted) {
    const platformFee = order.size * 0.0002;
    const destinationFee = order.size * 0.0006; // Assuming 0.06% avg
    const totalFee = platformFee + destinationFee;

    return (
      <div className="fee-breakdown">
        <div className="fee-line">
          <span>Position Size</span>
          <span>${order.size.toLocaleString()}</span>
        </div>
        <div className="fee-line">
          <span>Platform Fee (0.02%)</span>
          <span>${platformFee.toFixed(2)}</span>
        </div>
        <div className="fee-line">
          <span>{order.platform} Fee (~0.06%)</span>
          <span>${destinationFee.toFixed(2)}</span>
        </div>
        <div className="fee-line total">
          <span>Total Fees (~0.08%)</span>
          <span>${totalFee.toFixed(2)}</span>
        </div>
      </div>
    );
  } else {
    const totalFee = order.size * 0.0005;

    return (
      <div className="fee-breakdown">
        <div className="fee-line">
          <span>Position Size</span>
          <span>${order.size.toLocaleString()}</span>
        </div>
        <div className="fee-line highlight">
          <span>Trading Fee (0.05%)</span>
          <span>${totalFee.toFixed(2)}</span>
        </div>
        <div className="badge">
          ⭐ Lowest fees - Native market
        </div>
        <div className="savings">
          Save ${(order.size * 0.0003).toFixed(2)} vs routed trades
        </div>
      </div>
    );
  }
};
```

---

## 7. Revenue Projections

### Conservative Scenario (Year 1)

**Assumptions**:
- Month 1-3: $500k daily volume (50% own, 50% routed)
- Month 4-6: $1M daily volume (40% own, 60% routed)
- Month 7-12: $2M daily volume (30% own, 70% routed)

**Revenue Breakdown**:

| Period | Own Markets | Routed | Total Monthly |
|--------|-------------|--------|---------------|
| **Q1** (Avg $500k/day, 50/50 split) | | | |
| - Own: $250k/day * 0.0152% | $2,090 | - | - |
| - Routed: $250k/day * 0.0197% | - | $2,700 | - |
| Q1 Subtotal | $6,270 | $8,100 | **$14,370** |
| | | | |
| **Q2** (Avg $1M/day, 40/60 split) | | | |
| - Own: $400k/day * 0.0152% | $3,344 | - | - |
| - Routed: $600k/day * 0.0197% | - | $6,480 | - |
| Q2 Subtotal | $10,032 | $19,440 | **$29,472** |
| | | | |
| **Q3** (Avg $2M/day, 30/70 split) | | | |
| - Own: $600k/day * 0.0152% | $5,016 | - | - |
| - Routed: $1.4M/day * 0.0197% | - | $15,120 | - |
| Q3 Subtotal | $15,048 | $45,360 | **$60,408** |
| | | | |
| **Q4** (Avg $2M/day, 30/70 split) | | | |
| Q4 Subtotal | $15,048 | $45,360 | **$60,408** |

**Year 1 Total**: ~$164,658

### Moderate Scenario

**Assumptions**:
- Average daily volume: $5M
- 30% own markets, 70% routed

**Annual Revenue**:
```javascript
ownMarkets = $5M * 0.3 * 365 * 0.000152 = $83,220
routed = $5M * 0.7 * 365 * 0.000197 = $251,678
total = $334,898
```

### Aggressive Scenario

**Assumptions**:
- Average daily volume: $20M
- 25% own markets, 75% routed

**Annual Revenue**:
```javascript
ownMarkets = $20M * 0.25 * 365 * 0.000152 = $277,400
routed = $20M * 0.75 * 365 * 0.000197 = $1,080,000
total = $1,357,400
```

---

## 8. Revenue Per User Analysis

### Typical User Behavior

**Casual Trader**:
- Trades: 2x per week
- Avg size: $1,000
- Monthly volume: $8,000

**Revenue**:
- Own markets: $8,000 * 0.0152% = $1.22/month
- Routed: $8,000 * 0.0197% = $1.58/month

**Active Trader**:
- Trades: 5x per week
- Avg size: $5,000
- Monthly volume: $100,000

**Revenue**:
- Own markets: $100,000 * 0.0152% = $15.20/month
- Routed: $100,000 * 0.0197% = $19.70/month

**Power Trader**:
- Trades: 3x per day
- Avg size: $20,000
- Monthly volume: $1,800,000

**Revenue**:
- Own markets: $1,800,000 * 0.0152% = $273.60/month
- Routed: $1,800,000 * 0.0197% = $354.60/month

### User Cohort Targets

To hit $334k annual revenue ($28k/month):

```javascript
// Option 1: 100 power traders (own markets)
100 users * $273.60 = $27,360/month ✅

// Option 2: 142 power traders (routed)
142 users * $197.00 = $27,974/month ✅

// Option 3: Blended (realistic)
50 power traders (own) = $13,680
100 active traders (routed) = $19,700
Total = $33,380/month ✅
```

---

## 9. Fee Comparison Matrix

### User-Facing Fees

| Market Type | Your Fee | Competitor | Advantage |
|-------------|----------|------------|-----------|
| **Own Markets (USDTNGN)** | 0.05% | N/A | Unique market |
| **Routed Crypto (BTC)** | 0.08% | 0.06% (GMX direct) | +0.02% for UX |
| **Routed Stocks (TSLA)** | 0.10% | 0.08% (Ostium direct) | +0.02% for UX |

### Your Revenue

| Market Type | Revenue | Capital Required | ROI |
|-------------|---------|------------------|-----|
| **Own Markets** | 0.0152% | $25k-100k pool | Moderate |
| **Routed** | 0.0197% | $0 | Infinite |

---

## 10. Key Takeaways

### Revenue Structure (Revised - No Swaps)

✅ **Own Markets**: 0.0152% of volume
- Position fees: 0.015% (at 30% share) or 0.02% (at 40% share)
- Borrowing fees: ~0.0002% annually
- ~~Swap fees: N/A~~ (removed)

✅ **Routed Trades**: 0.02% markup
- Pure margin, no capital requirements
- Higher per-dollar revenue than own markets
- Scales infinitely

### Strategic Recommendations

1. **Optimize own market protocol share**
   - Increase from 30% → 40%
   - Matches routed revenue (0.02%)
   - Users still get best rates (0.05%)

2. **Focus routing on commodity markets**
   - BTC, ETH, major altcoins
   - Popular stocks (TSLA, AAPL, etc)
   - 0.02% markup sustainable

3. **Position own markets as premium**
   - Unique pairs (USDTNGN, USDTARS)
   - Lowest fees (0.05% vs 0.08%)
   - "Trade local currencies cheaper"

4. **Revenue targets**
   - Year 1: $150k-$350k (conservative to moderate)
   - Target blended rate: 0.018-0.019%
   - Optimize for 30% own / 70% routed mix

### Implementation Priority

1. ✅ Configure own markets: 40% protocol share
2. ✅ Implement 0.02% routing markup
3. ✅ Build transparent fee UI
4. ✅ Track revenue by source
5. ✅ Optimize based on user behavior

---

## 11. References

### Contract Files
- `contracts/pricing/PositionPricingUtils.sol` - Fee calculations
- `contracts/data/Keys.sol` - Fee configuration keys

### Fee Configuration Keys
- `POSITION_FEE_RECEIVER_FACTOR` - Protocol share (recommend 0.4 = 40%)
- `positionFeeFactorKey(market, balanceImproved)` - Base fee (0.05%)
- `BORROWING_FEE_RECEIVER_FACTOR` - Protocol share of borrowing (10%)

### External References
- GMX V2 fees: 0.05-0.07% position fees
- Ostium fees: ~0.08-0.10% typical

---

**Last Updated**: October 2025
