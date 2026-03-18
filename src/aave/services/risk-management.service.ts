import { Injectable } from '@nestjs/common';
import { AggregatedOHLCOptions } from '../../historical-price-data/interfaces';
import { HistoricalPriceDataService } from '../../historical-price-data/historical-price-data.service';
import { AaveMarketStatusService } from './aave-market-status.service';
import { AaveUserSuppliesInterface } from '../interfaces/aave-user.interface';
import { Reserve, supplyLiquidationInterface } from '../interfaces/aave-market';

export interface PortfolioRiskResult {
  liquidationPrices: Record<string, supplyLiquidationInterface>;
  totalCollateralValue: string;
  var95: string;
  var99: string;
}

@Injectable()
export class RiskManagementService {
  constructor(
    private readonly priceDataService: HistoricalPriceDataService,
    private readonly aaveMarketStatusService: AaveMarketStatusService,
  ) {}

  /**
   * Calculate volatility based on aggregated OHLC data
   * Volatility is calculated as the percentage change between consecutive closing prices
   * @param options - Aggregated OHLC options
   * @returns An array of objects containing timestamp and volatility
   */
  public async getVolatility(
    options: AggregatedOHLCOptions,
  ): Promise<{ timestamp: string; volatility: number }[]> {
    const volatilityResults: { timestamp: string; volatility: number }[] = [];
    const aggregatedOHLC =
      await this.priceDataService.getAggregatedOHLC(options);
    for (let i = 0; i < aggregatedOHLC.dataset.length - 1; i++) {
      const price = aggregatedOHLC.dataset[i];
      const nextPrice = aggregatedOHLC.dataset[i + 1];
      const volatility = (price.close - nextPrice.close) / nextPrice.close;
      volatilityResults.push({ timestamp: price.timestamp, volatility });
    }
    return volatilityResults;
  }

  // 1a. Calculate the standard deviation of an asset (its individual volatility)
  private calculateStdDev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance =
      arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  // 1b. EWMA volatility (RiskMetrics, λ=0.94) — weights recent days more heavily
  private calculateEWMAVolatility(
    returns: number[],
    lambda: number = 0.94,
  ): number {
    if (returns.length === 0) return 0;
    // Seed with full-sample variance
    let variance = Math.pow(this.calculateStdDev(returns), 2);
    for (const r of returns) {
      variance = lambda * variance + (1 - lambda) * r * r;
    }
    return Math.sqrt(variance);
  }

  // 1c. Calculate the Pearson correlation between two series
  private calculateCorrelation(arr1: number[], arr2: number[]): number {
    const n = Math.min(arr1.length, arr2.length);
    if (n === 0) return 0;
    const mean1 = arr1.slice(0, n).reduce((a, b) => a + b) / n;
    const mean2 = arr2.slice(0, n).reduce((a, b) => a + b) / n;

    let num = 0,
      den1 = 0,
      den2 = 0;
    for (let i = 0; i < n; i++) {
      const d1 = arr1[i] - mean1;
      const d2 = arr2[i] - mean2;
      num += d1 * d2;
      den1 += d1 * d1;
      den2 += d2 * d2;
    }
    const denom = Math.sqrt(den1 * den2);
    return denom === 0 ? 0 : num / denom;
  }

  // 1d. Stressed correlation — computed on the worst 10% days of the target asset
  // Correlations spike during crashes; this gives a conservative crisis estimate
  private calculateStressedCorrelation(
    targetReturns: number[],
    otherReturns: number[],
  ): number {
    const stressCount = Math.max(Math.floor(targetReturns.length * 0.1), 5);
    const stressedIndices = targetReturns
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v) // ascending: worst (most negative) first
      .slice(0, stressCount)
      .map((x) => x.i);

    const stressedTarget = stressedIndices.map((i) => targetReturns[i]);
    const stressedOther = stressedIndices.map((i) => otherReturns[i]);
    return this.calculateCorrelation(stressedTarget, stressedOther);
  }

  // 2. Identify the heaviest-weight asset (Dominant)
  public getDominantAsset(
    assets: AaveUserSuppliesInterface[],
  ): AaveUserSuppliesInterface {
    return assets.reduce((prev, current) =>
      prev.balance.usd > current.balance.usd ? prev : current,
    );
  }

  public async getPortfolioRisk(
    accountAddress: string,
    marketChain: number,
    marketAddress: string,
  ): Promise<PortfolioRiskResult> {
    const userSupplies = await this.aaveMarketStatusService.getUserSupplies(
      marketChain,
      marketAddress,
      accountAddress,
    );

    const market = await this.aaveMarketStatusService.getMarket(
      marketChain,
      marketAddress,
      accountAddress,
    );
    return await this.calculateSystemicLiquidationPrices(
      marketChain,
      userSupplies,
      market.userState.totalDebtBase,
      market.reserves,
    );
  }

  public async calculateSystemicLiquidationPrices(
    chainId: number,
    userSupplies: AaveUserSuppliesInterface[],
    debt: number,
    marketReserves: Reserve[],
    healthFactor: number = 1,
  ): Promise<PortfolioRiskResult> {
    const liquidationPrices: Record<string, supplyLiquidationInterface> = {};
    const dailyReturns: Record<string, number[]> = {};

    for (const asset of userSupplies) {
      const volatilityData = await this.getVolatility({
        address: asset.currency.address,
        chainId: chainId,
        interval: '1d',
        fromTimestamp: new Date(
          Date.now() - 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      dailyReturns[asset.currency.address] = volatilityData.map(
        (v) => v.volatility,
      );
    }

    // Pre-compute EWMA volatility for each asset
    const ewmaVols: Record<string, number> = {};
    userSupplies.forEach((a) => {
      ewmaVols[a.currency.address] = this.calculateEWMAVolatility(
        dailyReturns[a.currency.address],
      );
    });

    // Step A: Calculate the total current collateral capacity
    let totalCurrentCollateral = 0;
    userSupplies.forEach((a) => {
      const lt =
        this.findReservesByAddress(marketReserves, a.currency.address)
          ?.supplyInfo.liquidationThreshold ?? 0;
      totalCurrentCollateral +=
        a.balance.amount.value * a.balance.usdPerToken * lt;
    });

    const targetCollateral = debt * healthFactor;

    // Already below the threshold at current prices
    if (totalCurrentCollateral < targetCollateral) {
      userSupplies.forEach(
        (a) =>
          (liquidationPrices[a.currency.address] = {
            price: -1,
            error: 'ALREADY LIQUIDATED',
          }),
      );
      return {
        liquidationPrices,
        totalCollateralValue: totalCurrentCollateral.toFixed(2),
        var95: 'N/A',
        var99: 'N/A',
      };
    }

    // Step B: Calculate the break price for EACH asset using Beta + EWMA + stressed correlations
    userSupplies.forEach((target) => {
      const targetReturns = dailyReturns[target.currency.address];
      const targetEWMAVol = ewmaVols[target.currency.address];
      let betaWeightedCollateral = 0;

      userSupplies.forEach((other) => {
        const otherLt =
          this.findReservesByAddress(marketReserves, other.currency.address)
            ?.supplyInfo.liquidationThreshold ?? 0;
        const otherCollateral =
          other.balance.amount.value * other.balance.usdPerToken * otherLt;

        if (other.currency.address === target.currency.address) {
          // Beta of an asset against itself is always 1
          betaWeightedCollateral += otherCollateral;
        } else {
          const otherReturns = dailyReturns[other.currency.address];
          const otherEWMAVol = ewmaVols[other.currency.address];
          // Use stressed correlation: worst 10% days of the target asset
          const correl = this.calculateStressedCorrelation(
            targetReturns,
            otherReturns,
          );
          // Beta: "If the target asset moves -1%, how much does the other move?"
          const beta =
            targetEWMAVol > 0 ? correl * (otherEWMAVol / targetEWMAVol) : 0;
          betaWeightedCollateral += otherCollateral * beta;
        }
      });

      // Step C: Calculate the % drop required to reach the debt threshold
      if (betaWeightedCollateral <= 0) {
        liquidationPrices[target.currency.address] = {
          price: -1,
          error: 'Incalculable (Inverse coverage detected)',
        };
      } else {
        const dropRequired =
          (totalCurrentCollateral - targetCollateral) / betaWeightedCollateral;
        const systemicPrice = target.balance.usdPerToken * (1 - dropRequired);
        liquidationPrices[target.currency.address] = {
          price: systemicPrice > 0 ? systemicPrice : -1,
          error:
            systemicPrice > 0 ? '' : 'Near-zero risk (Required drop > 100%)',
        };
      }
    });

    // Portfolio VaR (parametric, 1-day horizon)
    // Uses EWMA volatilities + stressed correlations on the full collateral value
    const totalCollateralValue = userSupplies.reduce(
      (sum, a) => sum + (parseFloat(String(a.balance.usd)) || 0),
      0,
    );
    if (totalCollateralValue === 0) {
      return {
        liquidationPrices,
        totalCollateralValue: '0.00',
        var95: 'N/A',
        var99: 'N/A',
      };
    }
    let portfolioVariance = 0;
    userSupplies.forEach((assetI) => {
      userSupplies.forEach((assetJ) => {
        const wi = assetI.balance.usd / totalCollateralValue;
        const wj = assetJ.balance.usd / totalCollateralValue;
        const sigmaI = ewmaVols[assetI.currency.address];
        const sigmaJ = ewmaVols[assetJ.currency.address];
        const correl =
          assetI.currency.address === assetJ.currency.address
            ? 1
            : this.calculateStressedCorrelation(
                dailyReturns[assetI.currency.address],
                dailyReturns[assetJ.currency.address],
              );
        portfolioVariance += wi * wj * sigmaI * sigmaJ * correl;
      });
    });
    const portfolioStdDev = Math.sqrt(portfolioVariance);
    const var95 = totalCollateralValue * 1.645 * portfolioStdDev;
    const var99 = totalCollateralValue * 2.326 * portfolioStdDev;

    return {
      liquidationPrices,
      totalCollateralValue: totalCollateralValue.toFixed(2),
      var95: var95.toFixed(2),
      var99: var99.toFixed(2),
    };
  }

  findReservesByAddress(
    reserves: Reserve[],
    address: string,
  ): Reserve | undefined {
    return reserves.find(
      (reserve) =>
        reserve.underlyingToken.address.toLowerCase() === address.toLowerCase(),
    );
  }
}
