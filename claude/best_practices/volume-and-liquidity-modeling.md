# Volume and Liquidity Modeling

## Overview

This document outlines the volume capacity, trader segmentation, and LP yield modeling for markets with 4x reserve factor (400% OI caps relative to pool liquidity).

**Key Configuration:**
- Reserve Factor: 4.0 (400%)
- Pool Size: $1M
- Max OI per side: $4M
- Total OI capacity: $8M
- Max drawdown risk: 25% (user tolerance)

---

## Trader Segmentation

### SMB (Institutional-Lite) Traders

**Profile:**
- Average position: $50k-$150k
- Leverage: 5-10x
- Hold period: 2 weeks (blended average)
- Trading frequency: 2 turnovers/month
- Target count: 15-20 active traders per market

**Volume Metrics:**
- **Conservative**: $75k position × 2 turns = $150k/trader/month
- **Moderate**: $100k position × 2 turns = $200k/trader/month
- **Aggressive**: $150k position × 2 turns = $300k/trader/month

**OI Impact:**
- Each trader holds ~1 position at a time
- Average OI utilization: $100-150k per trader
- 15 traders = $1.5M-$2.25M OI used (37-56% of cap)

---

### Retail Traders

**Profile:**
- Average position: $2k-$8k
- Leverage: 10-25x
- Hold period: 2-7 days
- Trading frequency: 6-12 turnovers/month
- Target count: 200-250 active traders per market

**Volume Metrics:**
- **Conservative**: $4k position × 6 turns = $24k/trader/month
- **Moderate**: $5k position × 8 turns = $40k/trader/month
- **Aggressive**: $8k position × 12 turns = $96k/trader/month

**OI Impact:**
- Shorter hold periods = higher capital efficiency
- Average OI utilization: $4-8k per trader
- 200 traders = $800k-$1.6M OI used (20-40% of cap)

---

## Volume Scenarios (Own Markets Only)

Per $1M liquidity with $4M OI cap per side:

### Scenario 1: Conservative
**SMB:** 10 traders × $75k avg × 2 turns/month
- OI used: $750k
- Volume: $1.5M

**Retail:** 150 traders × $4k avg × 6 turns/month
- OI used: $600k
- Volume: $3.6M

**Total Monthly Volume: $5.1M**
- OI utilization: 34%
- Revenue @ 0.0152%: $776/month
- Annualized: $9.3k

---

### Scenario 2: Moderate (Realistic Target)
**SMB:** 15 traders × $100k avg × 2 turns/month
- OI used: $1.5M
- Volume: $3M

**Retail:** 200 traders × $5k avg × 8 turns/month
- OI used: $1M
- Volume: $8M

**Total Monthly Volume: $11M**
- OI utilization: 63%
- Revenue @ 0.0152%: $1,672/month
- Annualized: $20k

---

### Scenario 3: Aggressive
**SMB:** 20 traders × $150k avg × 2 turns/month
- OI used: $3M
- Volume: $6M

**Retail:** 250 traders × $6k avg × 10 turns/month
- OI used: $1.5M
- Volume: $15M

**Total Monthly Volume: $21M**
- OI utilization: 75%
- Revenue @ 0.0152%: $3,192/month
- Annualized: $38.3k

---

### Scenario 4: Peak Performance
**SMB:** 25 traders × $120k avg × 2 turns/month
- OI used: $3M
- Volume: $6M

**Retail:** 300 traders × $8k avg × 12 turns/month
- OI used: $2.4M (averaged)
- Volume: $28.8M

**Total Monthly Volume: $34.8M**
- OI utilization: 90%
- Revenue @ 0.0152%: $5,290/month
- Annualized: $63.5k

---

## Routed Markets Effect

Routed markets (BTC, ETH, stocks) have **zero liquidity constraints** and multiply total platform volume.

### Volume Multiplier

**Same trader base trades across multiple markets:**
- Own market (USDTNGN): $25M/month
- Routed (BTC): $10M/month
- Routed (ETH): $8M/month
- Routed (Stocks): $7M/month

**Total Platform Volume: $50M/month** (2x multiplier)

### Revenue Comparison

| Market Type | Volume/Month | Fee Rate | Revenue | Notes |
|------------|--------------|----------|---------|-------|
| Own (USDTNGN) | $25M | 0.0152% | $3,800 | Pool earns fees |
| Routed (BTC) | $10M | 0.02% | $2,000 | Pure markup |
| Routed (ETH) | $8M | 0.02% | $1,600 | Pure markup |
| Routed (Stocks) | $7M | 0.02% | $1,400 | Pure markup |
| **Total** | **$50M** | **Blended** | **$8,800** | Per $1M liquidity |

**Key Insight:** Routed markets earn higher margin (0.02% vs 0.0152%) with zero liquidity risk.

---

## LP Yield Analysis

LPs only earn from **own markets** (not routed trades).

### Fee Structure
- Total position fees: ~0.05% of trade volume
- LP share (positionFeeAmountForPool): ~70% after protocol split
- **Net LP fee rate: 0.035% of trade volume**

### Yield Scenarios

| Scenario | Own Volume | LP Revenue | Monthly Yield | APY |
|----------|-----------|------------|---------------|-----|
| Conservative | $20M | $7,000 | 0.70% | **8.4%** |
| Moderate | $25M | $8,750 | 0.875% | **10.5%** |
| Aggressive | $30M | $10,500 | 1.05% | **12.6%** |
| Peak | $35M | $12,250 | 1.225% | **14.7%** |

**Realistic Range: 10-13% APY** on $1M pool with $20-30M monthly volume

### Yield Components

**Revenue sources for LPs:**
1. Position fees (0.05% × 70% share = 0.035%)
2. Borrowing fees (minimal, ~0.0002% of volume)
3. Funding fees (net zero across balanced OI)

**Not included:**
- Routed market revenue (goes to protocol/markup)
- Swap fees (perps don't require swaps)

### Risk-Adjusted Returns

**Downside risk:**
- Max loss: 25% of pool (at max OI imbalance + 25% price move)
- Realistic expected loss: 5-15% over adverse conditions
- Balanced OI = near-zero directional risk

**Net expected APY after risk:**
- Best case (balanced OI): 10-15% APY, minimal drawdown
- Worst case (max imbalance + drawdown): 10-15% APY - 25% one-time loss
- Recovery timeline: 18-24 months to break even after max loss

---

## Market Comparisons

| Platform | APY Range | Risk Profile |
|----------|-----------|--------------|
| **Your Market** | **10-15%** | Medium (capped 25% drawdown) |
| GMX v2 (GLP) | 8-20% | Medium (multi-asset IL) |
| Vertex (vGLP) | 12-25% | Medium-High (imbalance risk) |
| Aave/Compound | 2-5% | Low (lending only) |
| General Perp LPs | 10-30% | Medium-High (varies) |

**Competitive positioning:**
- Above lending yields (2-5%)
- Competitive with other perp DEX LPs
- Lower ceiling but more predictable than high-variance platforms
- Capped downside (25%) is unique advantage

---

## Volume Sensitivity Analysis

### Impact of Volume Growth on LP APY

Every **$5M increase** in monthly volume = **+1.75% APY**

| Monthly Volume | Annual LP Revenue | APY | Growth Stage |
|---------------|-------------------|-----|--------------|
| $10M | $42k | 4.2% | Bootstrap |
| $15M | $63k | 6.3% | Early |
| $20M | $84k | 8.4% | Growing |
| $25M | $105k | 10.5% | **Target** |
| $30M | $126k | 12.6% | Mature |
| $35M | $147k | 14.7% | Peak |
| $40M | $168k | 16.8% | Exceptional |

**Volume is THE key metric for LP returns**

---

## Acquisition Targets

### SMB Trader Acquisition
- **Target:** 15-20 traders per market
- **Value:** $200-300k volume/trader/month
- **Acquisition strategy:**
  - High-touch onboarding
  - API access for automated trading
  - Fee discounts for volume (referral tier)
  - Direct relationship management

### Retail Trader Acquisition
- **Target:** 200-250 active traders per market
- **Value:** $25-40k volume/trader/month
- **Acquisition strategy:**
  - Marketing campaigns
  - User-friendly interface
  - Educational content
  - Community building
  - Trading competitions

### Prioritization
- **1 SMB trader ≈ 5-10 retail traders** in volume contribution
- SMB drives volume spikes and fills OI capacity
- Retail provides consistent base load and liquidity depth
- **Optimal mix:** 10-15 SMB + 150-250 retail per market

---

## Capital Efficiency Metrics

### Turnover Rates
**Definition:** Monthly volume / Average OI

| Trader Type | Hold Period | Turnovers/Month | Capital Efficiency |
|-------------|-------------|-----------------|-------------------|
| SMB (2 weeks) | 14 days | 2x | Moderate |
| Retail (4 days) | 4 days | 7.5x | High |
| Retail (2 days) | 2 days | 15x | Very High |

**Key insight:** Shorter holds = higher volume per dollar of OI

### Volume Capacity Formula

```
Monthly Volume = (Avg OI × Turnovers/month)

Where:
- Avg OI = Sum of all trader positions at any moment
- Turnovers = 30 days / Average hold period
```

**Example (Moderate scenario):**
- SMB: $1.5M OI × 2 turns = $3M
- Retail: $1M OI × 8 turns = $8M
- Total: $11M from $2.5M average OI

**Turnover ratio: 4.4x** (very healthy)

---

## Liquidity Growth Strategy

### Phase 1: Bootstrap ($1M pool)
- **Target:** $15-20M monthly volume
- **LP APY:** 6-8%
- **Trader count:** 5-10 SMB, 100-150 retail
- **Strategy:** Focus on SMB acquisition, subsidize LP yield with token incentives if needed

### Phase 2: Growth ($2-3M pool)
- **Target:** $40-50M monthly volume
- **LP APY:** 8-10%
- **Trader count:** 15-20 SMB, 200-250 retail
- **Strategy:** Scale retail acquisition, maintain SMB relationships

### Phase 3: Mature ($5M+ pool)
- **Target:** $100M+ monthly volume
- **LP APY:** 10-15%
- **Trader count:** 30+ SMB, 400+ retail
- **Strategy:** Market maker integration, institutional liquidity partnerships

---

## Risk Management for LPs

### Pool Protection Mechanisms

1. **Reserve Factor Cap (4.0)**
   - Max OI: $4M per side on $1M pool
   - Prevents over-leveraging pool capital
   - Validated in ConfigUtils.sol (max 10.0 allowed)

2. **Balanced OI Targeting**
   - Long OI ≈ Short OI = minimal directional risk
   - Use funding rates to incentivize balance
   - Monitor imbalance ratio (target <20% difference)

3. **Max Drawdown Tolerance**
   - Design accepts 25% pool loss in extreme scenario
   - Requires: max imbalance + 25% price move + all winners close at peak
   - Probability: Low (realistic expected loss 5-15%)

4. **Dynamic Risk Monitoring**
   - Track OI imbalance in real-time
   - Adjust funding rates to rebalance
   - Circuit breakers if imbalance >50%
   - Price impact on large closes

### LP Protection Best Practices

**Monitor these metrics:**
- OI utilization (target: 60-80%)
- Long/Short ratio (target: 0.8-1.2)
- 7-day average volume trend
- Fee accrual rate vs projections
- Largest position sizes (concentration risk)

**Warning signals:**
- OI imbalance >40% for >24 hours
- Volume drop >50% week-over-week
- Single trader >20% of one side's OI
- Funding rate ineffective at rebalancing

---

## Summary

### Key Takeaways

1. **$1M liquidity can support $20-35M monthly volume** (own markets only)
2. **Routed markets add 2-3x volume multiplier** with zero liquidity risk
3. **LP yields: 10-13% APY** realistic, 15%+ achievable at scale
4. **Trader mix matters:** 15 SMB + 200 retail = optimal balance
5. **Capital efficiency:** 2-week SMB holds + 3-5 day retail holds = 4-5x turnover
6. **Volume sensitivity:** Every $5M volume = +1.75% LP APY
7. **Routed revenue:** Higher margin (0.02%) than own markets (0.0152%)

### Target Metrics (Moderate Scenario)

- **Pool size:** $1M
- **Monthly volume (own):** $25M
- **Monthly volume (routed):** $15M
- **Total platform volume:** $40M
- **LP APY:** 10.5%
- **Protocol revenue:** $8,800/month
- **Trader count:** 15 SMB + 200 retail
- **OI utilization:** 60-70%

### Revenue Projections (Per Market)

| Scenario | Own Vol | Routed Vol | Total Vol | Protocol Rev | LP APY |
|----------|---------|------------|-----------|--------------|--------|
| Conservative | $20M | $10M | $30M | $5,040 | 8.4% |
| Moderate | $25M | $15M | $40M | $8,800 | 10.5% |
| Aggressive | $30M | $20M | $50M | $12,560 | 12.6% |

**Annual projections (Moderate):**
- Protocol revenue: $105k/market
- LP revenue: $105k/market
- Combined: $210k per $1M liquidity deployed

---

## Implementation Checklist

### Pre-Launch
- [ ] Set reserve factor to 4.0 (400%)
- [ ] Configure max OI caps ($4M per side)
- [ ] Set position fees split (30-40% protocol, rest to pool)
- [ ] Implement OI monitoring dashboard
- [ ] Set up funding rate auto-adjustment
- [ ] Create LP performance dashboard

### Launch Phase
- [ ] Target 5-10 SMB traders (pilot group)
- [ ] Acquire 50-100 retail traders
- [ ] Monitor OI balance daily
- [ ] Track volume vs projections
- [ ] Adjust funding rates as needed
- [ ] Communicate LP yields transparently

### Growth Phase
- [ ] Scale to 15-20 SMB traders
- [ ] Grow to 200+ retail traders
- [ ] Add routed markets (BTC, ETH)
- [ ] Optimize fee splits based on data
- [ ] Consider LP token incentives if needed
- [ ] Build market maker relationships

---

## Appendix: Calculations

### LP Fee Calculation
```
LP Monthly Revenue = Volume × 0.035%
LP Monthly Yield = (Volume × 0.035%) / Pool Size
LP APY = Monthly Yield × 12

Example (Moderate):
Revenue = $25M × 0.035% = $8,750
Yield = $8,750 / $1,000,000 = 0.875%
APY = 0.875% × 12 = 10.5%
```

### Volume Capacity Calculation
```
Monthly Volume = Σ(Position Size × Turnovers)

Example (Moderate):
SMB: 15 × $100k × 2 = $3M
Retail: 200 × $5k × 8 = $8M
Total = $11M
```

### OI Utilization
```
OI Utilization = (Sum of Open Positions) / Max OI Cap

Example:
SMB OI: $1.5M
Retail OI: $1M
Total: $2.5M
Utilization: $2.5M / $4M = 62.5%
```

### Turnover Rate
```
Turnover = 30 days / Average Hold Period

Examples:
2-week hold: 30/14 = 2.14 turns/month
4-day hold: 30/4 = 7.5 turns/month
```
