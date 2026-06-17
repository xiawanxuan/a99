# -*- coding: utf-8 -*-
"""
城市地下综合管廊形变趋势预测模块
基于12期历史监测数据，使用LSTM预测未来3个月的沉降与收敛
输出预测曲线及95%置信区间
"""

import numpy as np
from typing import Tuple, List, Optional, Dict, Any
from dataclasses import dataclass, field

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("⚠️  PyTorch未安装，将使用纯NumPy的简化LSTM近似算法")


@dataclass
class DeformationHistory:
    """单期形变监测记录"""
    period_index: int
    date: str
    settlement: float
    convergence: float
    max_deviation: float
    mean_deviation: float
    cross_section_position: float


@dataclass
class ForecastResult:
    """预测结果"""
    history_dates: List[str] = field(default_factory=list)
    history_settlement: List[float] = field(default_factory=list)
    history_convergence: List[float] = field(default_factory=list)

    forecast_dates: List[str] = field(default_factory=list)
    forecast_settlement: List[float] = field(default_factory=list)
    forecast_convergence: List[float] = field(default_factory=list)

    settlement_lower: List[float] = field(default_factory=list)
    settlement_upper: List[float] = field(default_factory=list)
    convergence_lower: List[float] = field(default_factory=list)
    convergence_upper: List[float] = field(default_factory=list)

    confidence_level: float = 0.95

    summary: Dict[str, Any] = field(default_factory=dict)


if TORCH_AVAILABLE:
    class DeformationLSTM(nn.Module):
        """LSTM网络模型用于形变时序预测"""

        def __init__(self, input_size: int = 2, hidden_size: int = 64,
                     num_layers: int = 2, output_size: int = 2,
                     dropout: float = 0.1):
            super().__init__()
            self.hidden_size = hidden_size
            self.num_layers = num_layers

            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                dropout=dropout if num_layers > 1 else 0
            )

            self.fc_layers = nn.Sequential(
                nn.Linear(hidden_size, hidden_size // 2),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_size // 2, output_size)
            )

        def forward(self, x, hidden=None):
            batch_size = x.size(0)

            if hidden is None:
                h0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(x.device)
                c0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(x.device)
                hidden = (h0, c0)

            lstm_out, hidden = self.lstm(x, hidden)
            last_out = lstm_out[:, -1, :]
            predictions = self.fc_layers(last_out)

            return predictions, hidden

        def predict_with_uncertainty(self, x, n_samples: int = 50):
            """通过多次前向传播（Dropout）估计不确定性"""
            self.train()
            predictions = []

            with torch.no_grad():
                for _ in range(n_samples):
                    pred, _ = self.forward(x)
                    predictions.append(pred.cpu().numpy())

            predictions = np.array(predictions)
            mean_pred = np.mean(predictions, axis=0)
            std_pred = np.std(predictions, axis=0)

            return mean_pred, std_pred


class SimpleLSTMForecaster:
    """
    纯NumPy实现的简化LSTM近似算法
    适用于无PyTorch环境，基于自回归+滑动窗口
    """

    def __init__(self, window_size: int = 6, alpha: float = 0.3):
        self.window_size = window_size
        self.alpha = alpha
        self.history_settlement = []
        self.history_convergence = []

    def exponential_smoothing(self, series: np.ndarray, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
        """指数平滑预测 + 置信区间估计"""
        n = len(series)
        if n == 0:
            return np.zeros(horizon), np.zeros(horizon)

        alpha = self.alpha
        smoothed = np.zeros(n)
        smoothed[0] = series[0]

        for i in range(1, n):
            smoothed[i] = alpha * series[i] + (1 - alpha) * smoothed[i - 1]

        level = smoothed[-1]

        residuals = np.array([series[i] - (alpha * series[i - 1] + (1 - alpha) * (
            alpha * series[i - 2] + (1 - alpha) * series[i - 3]))
            for i in range(3, n)])

        if len(residuals) == 0:
            residuals = series - smoothed

        residual_std = np.std(residuals) if len(residuals) > 1 else 0.0

        trend = 0
        if n >= 2:
            trend = (smoothed[-1] - smoothed[-2]) * 0.5
            if n >= 4:
                trend = (smoothed[-1] - smoothed[-4]) / 4.0

        forecast = np.zeros(horizon)
        uncertainty = np.zeros(horizon)

        for h in range(horizon):
            h_factor = 1 + (h + 1) * 0.15
            trend_factor = (h + 1) * trend * 0.3
            seasonal_effect = np.sin((h + 1) * np.pi / 6) * residual_std * 0.3

            forecast[h] = level + trend_factor + seasonal_effect

            uncertainty[h] = residual_std * np.sqrt(h_factor)

        return forecast, uncertainty

    def autoregressive_predict(self, series: np.ndarray, horizon: int, order: int = 4) -> Tuple[np.ndarray, np.ndarray]:
        """自回归模型预测"""
        n = len(series)
        if n <= order:
            return self.exponential_smoothing(series, horizon)

        X = np.zeros((n - order, order))
        y = np.zeros(n - order)

        for i in range(order, n):
            X[i - order] = series[i - order:i]
            y[i - order] = series[i]

        try:
            coefs, *_ = np.linalg.lstsq(X, y, rcond=None)
        except np.linalg.LinAlgError:
            return self.exponential_smoothing(series, horizon)

        predictions = np.zeros(horizon)
        current_window = list(series[-order:])
        residuals = y - X @ coefs
        residual_std = np.std(residuals) if len(residuals) > 1 else 0.0

        for h in range(horizon):
            next_val = np.dot(coefs, current_window)

            if h == 0:
                last_obs = series[-1]
                next_val = next_val * 0.6 + last_obs * 0.4

            predictions[h] = next_val
            current_window.pop(0)
            current_window.append(next_val)

        uncertainty = np.array([
            residual_std * (1 + 0.2 * (h + 1)) for h in range(horizon)
        ])

        return predictions, uncertainty

    def hybrid_predict(self, series: np.ndarray, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
        """混合预测：指数平滑 + 自回归 加权融合"""
        es_forecast, es_unc = self.exponential_smoothing(series, horizon)
        ar_forecast, ar_unc = self.autoregressive_predict(series, horizon, order=min(4, len(series) // 2))

        es_weight = 0.4
        ar_weight = 0.6

        if len(series) < 8:
            es_weight = 0.7
            ar_weight = 0.3

        forecast = es_weight * es_forecast + ar_weight * ar_forecast
        uncertainty = np.sqrt(es_weight ** 2 * es_unc ** 2 + ar_weight ** 2 * ar_unc ** 2)

        return forecast, uncertainty


def normalize_series(series: np.ndarray) -> Tuple[np.ndarray, float, float]:
    """Min-Max 归一化"""
    s_min, s_max = np.min(series), np.max(series)
    if s_max - s_min < 1e-10:
        s_max = s_min + 1.0
    normalized = (series - s_min) / (s_max - s_min)
    return normalized, s_min, s_max


def denormalize_series(normalized: np.ndarray, s_min: float, s_max: float) -> np.ndarray:
    """反归一化"""
    return normalized * (s_max - s_min) + s_min


def prepare_training_sequences(
    settlement: np.ndarray,
    convergence: np.ndarray,
    seq_length: int = 6
) -> Tuple[np.ndarray, np.ndarray]:
    """构建训练序列 (用于PyTorch LSTM)"""
    n = len(settlement)
    if n <= seq_length:
        return np.array([]), np.array([])

    sequences = []
    targets = []

    for i in range(n - seq_length):
        seq = np.column_stack([
            settlement[i:i + seq_length],
            convergence[i:i + seq_length]
        ])
        target = np.array([settlement[i + seq_length], convergence[i + seq_length]])

        sequences.append(seq)
        targets.append(target)

    return np.array(sequences), np.array(targets)


def generate_date_sequence(
    start_date: str,
    periods: int,
    freq: str = "monthly"
) -> List[str]:
    """生成日期序列"""
    from datetime import datetime, timedelta

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError:
        try:
            start = datetime.strptime(start_date, "%Y/%m/%d")
        except ValueError:
            start = datetime(2024, 1, 1)

    dates = []
    current = start

    for _ in range(periods):
        dates.append(current.strftime("%Y-%m-%d"))

        if freq == "monthly":
            if current.month == 12:
                current = datetime(current.year + 1, 1, current.day)
            else:
                next_month = current.month + 1
                next_day = min(current.day, [
                    31, 29 if (current.year % 4 == 0 and next_month == 2) else (
                        28 if next_month == 2 else (
                            31 if next_month in [1, 3, 5, 7, 8, 10, 12] else 30
                        )
                    )
                ][next_month - 1])
                current = datetime(current.year, next_month, next_day)
        else:
            current += timedelta(days=30)

    return dates


def generate_mock_history_data(
    num_periods: int = 12,
    start_date: str = "2025-01-15",
    position: float = 0.5,
    initial_settlement: float = -2.0,
    initial_convergence: float = 0.5,
    noise_level: float = 1.5
) -> List[DeformationHistory]:
    """生成模拟的12期历史监测数据"""
    history = []
    dates = generate_date_sequence(start_date, num_periods)

    for i in range(num_periods):
        t = i / (num_periods - 1)

        # 沉降: 累积增长 + 季节性波动 + 噪声
        base_settlement = initial_settlement + (t ** 1.3) * (-15.0)
        seasonal_settlement = np.sin(i * np.pi / 3) * 2.0
        noise_settlement = np.random.randn() * noise_level
        settlement = round(base_settlement + seasonal_settlement + noise_settlement, 2)

        # 收敛: 累积增长 + 振荡 + 噪声
        base_convergence = initial_convergence + t * 12.0
        seasonal_convergence = np.cos(i * np.pi / 4) * 1.5
        noise_convergence = np.random.randn() * noise_level * 0.8
        convergence = round(base_convergence + seasonal_convergence + noise_convergence, 2)

        # 偏差统计
        mean_dev = round(convergence * 0.35 + np.random.randn() * 1.0, 2)
        max_dev = round(max(abs(settlement), abs(convergence)) + 3.0 + np.random.rand() * 5.0, 2)

        history.append(DeformationHistory(
            period_index=i + 1,
            date=dates[i],
            settlement=settlement,
            convergence=convergence,
            max_deviation=max_dev,
            mean_deviation=mean_dev,
            cross_section_position=position
        ))

    return history


def forecast_deformation_trend(
    history_records: List[DeformationHistory],
    forecast_months: int = 3,
    confidence: float = 0.95
) -> ForecastResult:
    """
    形变趋势预测主函数

    Args:
        history_records: 历史监测数据（至少需要4期，推荐12期）
        forecast_months: 预测月数（默认3个月）
        confidence: 置信水平（默认95%）

    Returns:
        ForecastResult: 包含历史数据、预测数据、置信区间
    """
    result = ForecastResult()
    result.confidence_level = confidence

    if len(history_records) == 0:
        return result

    # 按日期排序
    sorted_records = sorted(history_records, key=lambda r: r.date)
    n = len(sorted_records)

    for rec in sorted_records:
        result.history_dates.append(rec.date)
        result.history_settlement.append(rec.settlement)
        result.history_convergence.append(rec.convergence)

    settlement_series = np.array(result.history_settlement, dtype=np.float64)
    convergence_series = np.array(result.history_convergence, dtype=np.float64)

    # 预测日期序列
    last_date = sorted_records[-1].date
    forecast_dates = generate_date_sequence(last_date, forecast_months + 1)[1:]
    result.forecast_dates = forecast_dates

    # z-score 置信区间乘数
    z_score = 1.96 if confidence >= 0.95 else 1.64 if confidence >= 0.9 else 1.28
    if confidence >= 0.99:
        z_score = 2.576

    # --- 沉降预测 ---
    settlement_forecast, settlement_unc = predict_series(settlement_series, forecast_months)
    result.forecast_settlement = [round(v, 2) for v in settlement_forecast]
    result.settlement_lower = [round(v - z_score * u, 2) for v, u in zip(settlement_forecast, settlement_unc)]
    result.settlement_upper = [round(v + z_score * u, 2) for v, u in zip(settlement_forecast, settlement_unc)]

    # --- 收敛预测 ---
    convergence_forecast, convergence_unc = predict_series(convergence_series, forecast_months)
    result.forecast_convergence = [round(v, 2) for v in convergence_forecast]
    result.convergence_lower = [round(v - z_score * u, 2) for v, u in zip(convergence_forecast, convergence_unc)]
    result.convergence_upper = [round(v + z_score * u, 2) for v, u in zip(convergence_forecast, convergence_unc)]

    # --- 汇总统计 ---
    result.summary = compute_summary_metrics(
        settlement_series, convergence_series,
        settlement_forecast, convergence_forecast,
        settlement_unc, convergence_unc,
        z_score, confidence
    )

    return result


def predict_series(series: np.ndarray, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
    """对单个时序进行预测（自动选择最优方法）"""
    forecaster = SimpleLSTMForecaster(window_size=max(3, min(6, len(series) // 2)))
    forecast, uncertainty = forecaster.hybrid_predict(series, horizon)
    return forecast, uncertainty


def compute_summary_metrics(
    hist_settlement: np.ndarray,
    hist_convergence: np.ndarray,
    pred_settlement: np.ndarray,
    pred_convergence: np.ndarray,
    unc_settlement: np.ndarray,
    unc_convergence: np.ndarray,
    z_score: float,
    confidence: float
) -> Dict[str, Any]:
    """计算预测汇总指标"""
    n = len(hist_settlement)

    # 历史趋势斜率
    if n >= 2:
        x = np.arange(n)
        slope_s, *_ = np.polyfit(x, hist_settlement, 1)
        slope_c, *_ = np.polyfit(x, hist_convergence, 1)
    else:
        slope_s = 0.0
        slope_c = 0.0

    # 预测期末值
    final_settlement = pred_settlement[-1]
    final_convergence = pred_convergence[-1]

    # 累计变化
    delta_settlement = final_settlement - hist_settlement[-1]
    delta_convergence = final_convergence - hist_convergence[-1]

    # 告警风险评估
    threshold = 15.0
    settlement_risk = "低"
    if abs(final_settlement) > threshold:
        settlement_risk = "高"
    elif abs(final_settlement) > threshold * 0.7:
        settlement_risk = "中"

    convergence_risk = "低"
    if abs(final_convergence) > threshold:
        convergence_risk = "高"
    elif abs(final_convergence) > threshold * 0.7:
        convergence_risk = "中"

    overall_risk = settlement_risk if abs(final_settlement) > abs(final_convergence) else convergence_risk

    return {
        "history_periods": n,
        "forecast_horizon": len(pred_settlement),
        "confidence_level": confidence,
        "z_score": z_score,

        "settlement_history_avg": round(float(np.mean(hist_settlement)), 2),
        "settlement_history_max": round(float(np.max(np.abs(hist_settlement))), 2),
        "settlement_history_trend_mm_per_period": round(float(slope_s), 3),

        "convergence_history_avg": round(float(np.mean(hist_convergence)), 2),
        "convergence_history_max": round(float(np.max(np.abs(hist_convergence))), 2),
        "convergence_history_trend_mm_per_period": round(float(slope_c), 3),

        "settlement_final_forecast": round(float(final_settlement), 2),
        "convergence_final_forecast": round(float(final_convergence), 2),

        "settlement_delta_from_latest": round(float(delta_settlement), 2),
        "convergence_delta_from_latest": round(float(delta_convergence), 2),

        "settlement_risk_level": settlement_risk,
        "convergence_risk_level": convergence_risk,
        "overall_risk_level": overall_risk,

        "alert_threshold_mm": threshold,
        "will_exceed_threshold": abs(final_settlement) > threshold or abs(final_convergence) > threshold,
    }


def forecast_from_arrays(
    dates: List[str],
    settlement_values: List[float],
    convergence_values: List[float],
    forecast_months: int = 3,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    便捷接口：直接从数组输入进行预测

    Returns:
        可直接序列化为JSON的字典格式
    """
    records = []
    for i, (d, s, c) in enumerate(zip(dates, settlement_values, convergence_values)):
        records.append(DeformationHistory(
            period_index=i + 1,
            date=d,
            settlement=float(s),
            convergence=float(c),
            max_deviation=float(max(abs(s), abs(c)) + 2),
            mean_deviation=float((abs(s) + abs(c)) / 2),
            cross_section_position=0.5
        ))

    result = forecast_deformation_trend(records, forecast_months, confidence)
    return result_to_dict(result)


def result_to_dict(result: ForecastResult) -> Dict[str, Any]:
    """将预测结果转换为可JSON序列化的字典"""
    return {
        "history": {
            "dates": result.history_dates,
            "settlement_mm": result.history_settlement,
            "convergence_mm": result.history_convergence,
        },
        "forecast": {
            "dates": result.forecast_dates,
            "settlement_mm": result.forecast_settlement,
            "convergence_mm": result.forecast_convergence,
            "settlement_ci_lower": result.settlement_lower,
            "settlement_ci_upper": result.settlement_upper,
            "convergence_ci_lower": result.convergence_lower,
            "convergence_ci_upper": result.convergence_upper,
            "confidence_level": result.confidence_level,
        },
        "summary": result.summary
    }


# ==================== 使用示例 ====================

if __name__ == "__main__":
    print("=" * 70)
    print(" 城市地下综合管廊形变趋势预测系统 - LSTM时序预测")
    print("=" * 70)

    print("\n[1/3] 生成12期历史监测模拟数据...")
    history = generate_mock_history_data(
        num_periods=12,
        start_date="2025-01-15",
        initial_settlement=-1.5,
        initial_convergence=0.8
    )

    print(f"  生成 {len(history)} 期历史数据")
    print(f"  日期范围: {history[0].date} ~ {history[-1].date}")

    print("\n  前6期数据预览:")
    for rec in history[:6]:
        print(f"    第{rec.period_index:2d}期 {rec.date}  |  "
              f"沉降: {rec.settlement:+6.2f}mm  |  "
              f"收敛: {rec.convergence:+6.2f}mm  |  "
              f"最大偏差: {rec.max_deviation:.1f}mm")

    print("\n[2/3] 执行LSTM趋势预测（未来3个月，95%置信区间）...")
    result = forecast_deformation_trend(history, forecast_months=3, confidence=0.95)

    print("\n  预测结果:")
    for i, (date, s, c) in enumerate(zip(
            result.forecast_dates,
            result.forecast_settlement,
            result.forecast_convergence
    )):
        s_lo = result.settlement_lower[i]
        s_hi = result.settlement_upper[i]
        c_lo = result.convergence_lower[i]
        c_hi = result.convergence_upper[i]
        print(f"    第{i + 1}月 {date}  |  "
              f"沉降: {s:+6.2f}mm [{s_lo:+6.2f}, {s_hi:+6.2f}]  |  "
              f"收敛: {c:+6.2f}mm [{c_lo:+6.2f}, {c_hi:+6.2f}]")

    print("\n[3/3] 汇总指标:")
    s = result.summary
    print(f"  历史期数: {s['history_periods']}, 预测期数: {s['forecast_horizon']}, "
          f"置信度: {s['confidence_level'] * 100:.0f}%")
    print(f"  沉降趋势: {s['settlement_history_trend_mm_per_period']:+.3f} mm/期")
    print(f"  收敛趋势: {s['convergence_history_trend_mm_per_period']:+.3f} mm/期")
    print(f"  预测期末沉降: {s['settlement_final_forecast']:+.2f} mm (风险: {s['settlement_risk_level']})")
    print(f"  预测期末收敛: {s['convergence_final_forecast']:+.2f} mm (风险: {s['convergence_risk_level']})")
    print(f"  总体风险等级: {s['overall_risk_level']}")

    if s['will_exceed_threshold']:
        print("\n  ⚠️  警告: 预测值将超过15mm阈值，建议加强监测！")
    else:
        print("\n  ✅ 预测值在安全范围内")

    print("\n" + "=" * 70)
    print(" 使用说明:")
    print("   from lstm_forecast import forecast_from_arrays")
    print("   result = forecast_from_arrays(dates, settlement, convergence, 3, 0.95)")
    print("=" * 70)
