import type { TrendForecastData, ForecastSummary } from '../types';

const API_BASE = '/api/forecast';

export interface ForecastHistoryItem {
  date: string;
  settlement: number;
  convergence: number;
  max_deviation?: number;
  mean_deviation?: number;
  cross_section_pos?: number;
}

export interface ForecastRequest {
  history: ForecastHistoryItem[];
  forecast_months?: number;
  confidence?: number;
}

export interface ForecastApiResponse {
  success: boolean;
  data: TrendForecastData;
  message?: string;
}

export async function fetchTrendForecast(
  history: ForecastHistoryItem[],
  forecastMonths: number = 3,
  confidence: number = 0.95
): Promise<TrendForecastData> {
  try {
    const res = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history,
        forecast_months: forecastMonths,
        confidence,
      } as ForecastRequest),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as ForecastApiResponse;
    if (!json.success || !json.data) {
      throw new Error(json.message || '预测失败');
    }
    return json.data;
  } catch (err) {
    console.warn('[forecastService] API调用失败，使用本地预测算法:', err);
    return localForecast(history, forecastMonths, confidence);
  }
}

export async function fetchMockForecast(
  numPeriods: number = 12,
  startDate: string = '2025-01-15',
  position: number = 0.5,
  forecastMonths: number = 3,
  confidence: number = 0.95
): Promise<TrendForecastData> {
  try {
    const params = new URLSearchParams({
      num_periods: String(numPeriods),
      start_date: startDate,
      position: String(position),
      forecast_months: String(forecastMonths),
      confidence: String(confidence),
    });

    const res = await fetch(`${API_BASE}/mock?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as ForecastApiResponse;
    if (!json.success || !json.data) {
      throw new Error('Mock数据获取失败');
    }
    return json.data;
  } catch (err) {
    console.warn('[forecastService] Mock API调用失败，使用本地生成:', err);
    return localMockForecast(numPeriods, startDate, position, forecastMonths, confidence);
  }
}

function exponentialSmoothing(series: number[], alpha: number, horizon: number): { forecast: number[]; uncertainty: number[] } {
  const n = series.length;
  if (n === 0) {
    return { forecast: new Array(horizon).fill(0), uncertainty: new Array(horizon).fill(0) };
  }

  const smoothed = new Array(n).fill(0);
  smoothed[0] = series[0];
  for (let i = 1; i < n; i++) {
    smoothed[i] = alpha * series[i] + (1 - alpha) * smoothed[i - 1];
  }

  const level = smoothed[n - 1];
  const residuals: number[] = [];
  for (let i = 3; i < n; i++) {
    const pred3 = alpha * alpha * series[i - 3] + alpha * (1 - alpha) * series[i - 2] + (1 - alpha) * smoothed[i - 2];
    const pred = alpha * series[i - 1] + (1 - alpha) * pred3;
    residuals.push(series[i] - pred);
  }
  if (residuals.length === 0) {
    for (let i = 0; i < n; i++) residuals.push(series[i] - smoothed[i]);
  }

  const residualStd = residuals.length > 1
    ? Math.sqrt(residuals.reduce((s, x) => s + (x - residuals.reduce((a, b) => a + b, 0) / residuals.length) ** 2, 0) / (residuals.length - 1))
    : 0;

  let trend = 0;
  if (n >= 2) {
    trend = (smoothed[n - 1] - smoothed[n - 2]) * 0.5;
    if (n >= 4) trend = (smoothed[n - 1] - smoothed[n - 4]) / 4;
  }

  const forecast = new Array(horizon).fill(0);
  const uncertainty = new Array(horizon).fill(0);
  for (let h = 0; h < horizon; h++) {
    const hFactor = 1 + (h + 1) * 0.15;
    const trendFactor = (h + 1) * trend * 0.3;
    const seasonalEffect = Math.sin((h + 1) * Math.PI / 6) * residualStd * 0.3;
    forecast[h] = level + trendFactor + seasonalEffect;
    uncertainty[h] = residualStd * Math.sqrt(hFactor);
  }

  return { forecast, uncertainty };
}

function autoregressivePredict(series: number[], order: number, horizon: number): { forecast: number[]; uncertainty: number[] } {
  const n = series.length;
  if (n <= order) return exponentialSmoothing(series, 0.3, horizon);

  const X: number[][] = [];
  const y: number[] = [];
  for (let i = order; i < n; i++) {
    X.push(series.slice(i - order, i));
    y.push(series[i]);
  }

  const coefs = solveLeastSquares(X, y, order);
  if (!coefs) return exponentialSmoothing(series, 0.3, horizon);

  const predictions = new Array(horizon).fill(0);
  const window = series.slice(n - order);

  const residuals: number[] = [];
  for (let i = 0; i < X.length; i++) {
    let pred = 0;
    for (let j = 0; j < order; j++) pred += coefs[j] * X[i][j];
    residuals.push(y[i] - pred);
  }
  const residualStd = residuals.length > 1
    ? Math.sqrt(residuals.reduce((s, x) => s + x * x, 0) / (residuals.length - 1))
    : 0;

  for (let h = 0; h < horizon; h++) {
    let nextVal = 0;
    for (let j = 0; j < order; j++) nextVal += coefs[j] * window[j];
    if (h === 0) nextVal = nextVal * 0.6 + series[n - 1] * 0.4;

    predictions[h] = nextVal;
    window.shift();
    window.push(nextVal);
  }

  const uncertainty = new Array(horizon).fill(0);
  for (let h = 0; h < horizon; h++) {
    uncertainty[h] = residualStd * (1 + 0.2 * (h + 1));
  }
  return { forecast: predictions, uncertainty };
}

function solveLeastSquares(X: number[][], y: number[], dim: number): number[] | null {
  if (X.length < dim) return null;

  const XtX: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const XtY = new Array(dim).fill(0);

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < X.length; k++) sum += X[k][i] * X[k][j];
      XtX[i][j] = sum;
    }
    let sum = 0;
    for (let k = 0; k < X.length; k++) sum += X[k][i] * y[k];
    XtY[i] = sum;
  }
  return solveLinear(XtX, XtY, dim);
}

function solveLinear(A: number[][], b: number[], n: number): number[] | null {
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    }
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-15) return null;

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col] / aug[col][col];
        for (let k = col; k <= n; k++) aug[row][k] -= factor * aug[col][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) x[i] = aug[i][n] / aug[i][i];
  return x;
}

function hybridPredict(series: number[], horizon: number): { forecast: number[]; uncertainty: number[] } {
  const n = series.length;
  let order = Math.max(2, Math.min(4, Math.floor(n / 2)));
  if (order < 2) order = 2;

  const es = exponentialSmoothing(series, 0.3, horizon);
  const ar = autoregressivePredict(series, order, horizon);

  const [esW, arW] = n < 8 ? [0.7, 0.3] : [0.4, 0.6];

  const forecast = new Array(horizon).fill(0);
  const uncertainty = new Array(horizon).fill(0);
  for (let h = 0; h < horizon; h++) {
    forecast[h] = esW * es.forecast[h] + arW * ar.forecast[h];
    const esTerm = esW * esW * es.uncertainty[h] * es.uncertainty[h];
    const arTerm = arW * arW * ar.uncertainty[h] * ar.uncertainty[h];
    uncertainty[h] = Math.sqrt(esTerm + arTerm);
  }
  return { forecast, uncertainty };
}

function linearTrend(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function addMonths(dateStr: string, months: number): string {
  try {
    const [y, m, d] = dateStr.split(/[-/]/).map(Number);
    const dt = new Date(y || 2025, (m || 1) - 1, d || 15);
    dt.setMonth(dt.getMonth() + months);
    return dt.toISOString().slice(0, 10);
  } catch {
    return `T+${months}`;
  }
}

function maxAbs(values: number[]): number {
  let m = 0;
  for (const v of values) m = Math.max(m, Math.abs(v));
  return m;
}

function getZScore(confidence: number): number {
  if (confidence >= 0.99) return 2.576;
  if (confidence >= 0.95) return 1.96;
  if (confidence >= 0.9) return 1.64;
  return 1.28;
}

function getRiskLevel(value: number, threshold: number): '低' | '中' | '高' {
  const av = Math.abs(value);
  if (av > threshold) return '高';
  if (av > threshold * 0.7) return '中';
  return '低';
}

export function localForecast(
  history: ForecastHistoryItem[],
  forecastMonths: number = 3,
  confidence: number = 0.95
): TrendForecastData {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  const historyDates = sorted.map(r => r.date);
  const historySettlement = sorted.map(r => r.settlement);
  const historyConvergence = sorted.map(r => r.convergence);

  const forecastDates: string[] = [];
  const lastDate = sorted[n - 1]?.date || '2025-12-15';
  for (let i = 1; i <= forecastMonths; i++) forecastDates.push(addMonths(lastDate, i));

  const zScore = getZScore(confidence);
  const threshold = 15.0;

  const sPred = hybridPredict(historySettlement, forecastMonths);
  const forecastSettlement = sPred.forecast.map(v => Number(v.toFixed(2)));
  const settlementLower = sPred.forecast.map((v, h) => Number((v - zScore * sPred.uncertainty[h]).toFixed(2)));
  const settlementUpper = sPred.forecast.map((v, h) => Number((v + zScore * sPred.uncertainty[h]).toFixed(2)));

  const cPred = hybridPredict(historyConvergence, forecastMonths);
  const forecastConvergence = cPred.forecast.map(v => Number(v.toFixed(2)));
  const convergenceLower = cPred.forecast.map((v, h) => Number((v - zScore * cPred.uncertainty[h]).toFixed(2)));
  const convergenceUpper = cPred.forecast.map((v, h) => Number((v + zScore * cPred.uncertainty[h]).toFixed(2)));

  const finalSettlement = sPred.forecast[forecastMonths - 1];
  const finalConvergence = cPred.forecast[forecastMonths - 1];
  const settlementRisk = getRiskLevel(finalSettlement, threshold);
  const convergenceRisk = getRiskLevel(finalConvergence, threshold);
  const overallRisk = Math.abs(finalConvergence) > Math.abs(finalSettlement) ? convergenceRisk : settlementRisk;

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);

  const summary: ForecastSummary = {
    history_periods: n,
    forecast_horizon: forecastMonths,
    confidence_level: confidence,
    settlement_avg: Number(mean(historySettlement).toFixed(2)),
    settlement_max: Number(maxAbs(historySettlement).toFixed(2)),
    settlement_trend: Number(linearTrend(historySettlement).toFixed(3)),
    convergence_avg: Number(mean(historyConvergence).toFixed(2)),
    convergence_max: Number(maxAbs(historyConvergence).toFixed(2)),
    convergence_trend: Number(linearTrend(historyConvergence).toFixed(3)),
    final_settlement_forecast: Number(finalSettlement.toFixed(2)),
    final_convergence_forecast: Number(finalConvergence.toFixed(2)),
    settlement_delta: Number((finalSettlement - historySettlement[n - 1]).toFixed(2)),
    convergence_delta: Number((finalConvergence - historyConvergence[n - 1]).toFixed(2)),
    settlement_risk_level: settlementRisk,
    convergence_risk_level: convergenceRisk,
    overall_risk_level: overallRisk,
    alert_threshold: threshold,
    will_exceed_threshold: Math.abs(finalSettlement) > threshold || Math.abs(finalConvergence) > threshold,
  };

  return {
    history_dates: historyDates,
    history_settlement: historySettlement,
    history_convergence: historyConvergence,
    forecast_dates: forecastDates,
    forecast_settlement: forecastSettlement,
    forecast_convergence: forecastConvergence,
    settlement_lower: settlementLower,
    settlement_upper: settlementUpper,
    convergence_lower: convergenceLower,
    convergence_upper: convergenceUpper,
    confidence_level: confidence,
    summary,
  };
}

export function localMockForecast(
  numPeriods: number = 12,
  startDate: string = '2025-01-15',
  position: number = 0.5,
  forecastMonths: number = 3,
  confidence: number = 0.95
): TrendForecastData {
  const history: ForecastHistoryItem[] = [];
  const initialSettlement = -2.0;
  const initialConvergence = 0.5;
  const noiseLevel = 1.5;

  for (let i = 0; i < numPeriods; i++) {
    const t = i / (numPeriods - 1);
    const baseSett = initialSettlement + Math.pow(t, 1.3) * (-15.0);
    const seasonalSett = Math.sin(i * Math.PI / 3) * 2.0;
    const noiseSett = (Math.random() - 0.5) * 2 * noiseLevel;
    const settlement = Number((baseSett + seasonalSett + noiseSett).toFixed(2));

    const baseConv = initialConvergence + t * 12.0;
    const seasonalConv = Math.cos(i * Math.PI / 4) * 1.5;
    const noiseConv = (Math.random() - 0.5) * 2 * noiseLevel * 0.8;
    const convergence = Number((baseConv + seasonalConv + noiseConv).toFixed(2));

    const date = addMonths(startDate, i);
    history.push({
      date,
      settlement,
      convergence,
      max_deviation: Number((Math.max(Math.abs(settlement), Math.abs(convergence)) + 3 + Math.random() * 5).toFixed(2)),
      mean_deviation: Number((convergence * 0.35 + (Math.random() - 0.5) * 2).toFixed(2)),
      cross_section_pos: position,
    });
  }

  return localForecast(history, forecastMonths, confidence);
}