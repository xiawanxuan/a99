package forecast

import (
	"math"
	"sort"
	"time"
)

type ForecastHistory struct {
	PeriodIndex         int
	Date                string
	Settlement          float64
	Convergence         float64
	MaxDeviation        float64
	MeanDeviation       float64
	CrossSectionPos     float64
}

type TrendForecastResult struct {
	HistoryDates         []string  `json:"history_dates"`
	HistorySettlement    []float64 `json:"history_settlement"`
	HistoryConvergence   []float64 `json:"history_convergence"`
	ForecastDates        []string  `json:"forecast_dates"`
	ForecastSettlement   []float64 `json:"forecast_settlement"`
	ForecastConvergence  []float64 `json:"forecast_convergence"`
	SettlementLower      []float64 `json:"settlement_lower"`
	SettlementUpper      []float64 `json:"settlement_upper"`
	ConvergenceLower     []float64 `json:"convergence_lower"`
	ConvergenceUpper     []float64 `json:"convergence_upper"`
	ConfidenceLevel      float64   `json:"confidence_level"`
	Summary              ForecastSummary `json:"summary"`
}

type ForecastSummary struct {
	HistoryPeriods             int     `json:"history_periods"`
	ForecastHorizon            int     `json:"forecast_horizon"`
	ConfidenceLevel            float64 `json:"confidence_level"`
	SettlementAvg              float64 `json:"settlement_avg"`
	SettlementMax              float64 `json:"settlement_max"`
	SettlementTrend            float64 `json:"settlement_trend"`
	ConvergenceAvg             float64 `json:"convergence_avg"`
	ConvergenceMax             float64 `json:"convergence_max"`
	ConvergenceTrend           float64 `json:"convergence_trend"`
	FinalSettlementForecast    float64 `json:"final_settlement_forecast"`
	FinalConvergenceForecast   float64 `json:"final_convergence_forecast"`
	SettlementDelta            float64 `json:"settlement_delta"`
	ConvergenceDelta           float64 `json:"convergence_delta"`
	SettlementRiskLevel        string  `json:"settlement_risk_level"`
	ConvergenceRiskLevel       string  `json:"convergence_risk_level"`
	OverallRiskLevel           string  `json:"overall_risk_level"`
	AlertThreshold             float64 `json:"alert_threshold"`
	WillExceedThreshold        bool    `json:"will_exceed_threshold"`
}

type TrendService struct{}

func NewTrendService() *TrendService {
	return &TrendService{}
}

func (s *TrendService) exponentialSmoothing(series []float64, alpha float64, horizon int) ([]float64, []float64) {
	n := len(series)
	if n == 0 {
		return make([]float64, horizon), make([]float64, horizon)
	}

	smoothed := make([]float64, n)
	smoothed[0] = series[0]
	for i := 1; i < n; i++ {
		smoothed[i] = alpha*series[i] + (1-alpha)*smoothed[i-1]
	}

	level := smoothed[n-1]
	residuals := make([]float64, 0)
	for i := 3; i < n; i++ {
		pred3 := alpha*alpha*series[i-3] + alpha*(1-alpha)*series[i-2] + (1-alpha)*smoothed[i-2]
		pred := alpha*series[i-1] + (1-alpha)*pred3
		residuals = append(residuals, series[i]-pred)
	}
	if len(residuals) == 0 {
		for i := 0; i < n; i++ {
			residuals = append(residuals, series[i]-smoothed[i])
		}
	}

	residualStd := computeStd(residuals)

	trend := 0.0
	if n >= 2 {
		trend = (smoothed[n-1] - smoothed[n-2]) * 0.5
		if n >= 4 {
			trend = (smoothed[n-1] - smoothed[n-4]) / 4.0
		}
	}

	forecast := make([]float64, horizon)
	uncertainty := make([]float64, horizon)
	for h := 0; h < horizon; h++ {
		hFactor := 1 + float64(h+1)*0.15
		trendFactor := float64(h+1) * trend * 0.3
		seasonalEffect := math.Sin(float64(h+1)*math.Pi/6) * residualStd * 0.3
		forecast[h] = level + trendFactor + seasonalEffect
		uncertainty[h] = residualStd * math.Sqrt(hFactor)
	}

	return forecast, uncertainty
}

func (s *TrendService) autoregressivePredict(series []float64, order, horizon int) ([]float64, []float64) {
	n := len(series)
	if n <= order {
		return s.exponentialSmoothing(series, 0.3, horizon)
	}

	X := make([][]float64, n-order)
	y := make([]float64, n-order)
	for i := order; i < n; i++ {
		X[i-order] = make([]float64, order)
		copy(X[i-order], series[i-order:i])
		y[i-order] = series[i]
	}

	coefs := s.solveLeastSquares(X, y, order)
	if coefs == nil {
		return s.exponentialSmoothing(series, 0.3, horizon)
	}

	predictions := make([]float64, horizon)
	currentWindow := make([]float64, order)
	copy(currentWindow, series[n-order:])

	residuals := make([]float64, n-order)
	for i := 0; i < n-order; i++ {
		pred := 0.0
		for j := 0; j < order; j++ {
			pred += coefs[j] * X[i][j]
		}
		residuals[i] = y[i] - pred
	}
	residualStd := computeStd(residuals)

	for h := 0; h < horizon; h++ {
		nextVal := 0.0
		for j := 0; j < order; j++ {
			nextVal += coefs[j] * currentWindow[j]
		}
		if h == 0 {
			lastObs := series[n-1]
			nextVal = nextVal*0.6 + lastObs*0.4
		}
		predictions[h] = nextVal
		for j := 0; j < order-1; j++ {
			currentWindow[j] = currentWindow[j+1]
		}
		currentWindow[order-1] = nextVal
	}

	uncertainty := make([]float64, horizon)
	for h := 0; h < horizon; h++ {
		uncertainty[h] = residualStd * (1 + 0.2*float64(h+1))
	}

	return predictions, uncertainty
}

func (s *TrendService) solveLeastSquares(X [][]float64, y []float64, dim int) []float64 {
	if len(X) < dim {
		return nil
	}

	XtX := make([][]float64, dim)
	XtY := make([]float64, dim)
	for i := 0; i < dim; i++ {
		XtX[i] = make([]float64, dim)
	}

	for i := 0; i < dim; i++ {
		for j := 0; j < dim; j++ {
			sum := 0.0
			for k := 0; k < len(X); k++ {
				sum += X[k][i] * X[k][j]
			}
			XtX[i][j] = sum
		}
		sum := 0.0
		for k := 0; k < len(X); k++ {
			sum += X[k][i] * y[k]
		}
		XtY[i] = sum
	}

	return s.solveLinearSystem(XtX, XtY, dim)
}

func (s *TrendService) solveLinearSystem(A [][]float64, b []float64, n int) []float64 {
	aug := make([][]float64, n)
	for i := 0; i < n; i++ {
		aug[i] = make([]float64, n+1)
		copy(aug[i][:n], A[i])
		aug[i][n] = b[i]
	}

	for col := 0; col < n; col++ {
		pivotRow := col
		for row := col + 1; row < n; row++ {
			if math.Abs(aug[row][col]) > math.Abs(aug[pivotRow][col]) {
				pivotRow = row
			}
		}
		aug[col], aug[pivotRow] = aug[pivotRow], aug[col]

		if math.Abs(aug[col][col]) < 1e-15 {
			return nil
		}

		for row := 0; row < n; row++ {
			if row != col {
				factor := aug[row][col] / aug[col][col]
				for k := col; k <= n; k++ {
					aug[row][k] -= factor * aug[col][k]
				}
			}
		}
	}

	x := make([]float64, n)
	for i := 0; i < n; i++ {
		x[i] = aug[i][n] / aug[i][i]
	}
	return x
}

func (s *TrendService) hybridPredict(series []float64, horizon int) ([]float64, []float64) {
	n := len(series)
	order := 4
	if n < 8 {
		order = n / 2
	}
	if order < 2 {
		order = 2
	}

	esForecast, esUnc := s.exponentialSmoothing(series, 0.3, horizon)
	arForecast, arUnc := s.autoregressivePredict(series, order, horizon)

	var esWeight, arWeight float64
	if n < 8 {
		esWeight = 0.7
		arWeight = 0.3
	} else {
		esWeight = 0.4
		arWeight = 0.6
	}

	forecast := make([]float64, horizon)
	uncertainty := make([]float64, horizon)
	for h := 0; h < horizon; h++ {
		forecast[h] = esWeight*esForecast[h] + arWeight*arForecast[h]
		esTerm := esWeight * esWeight * esUnc[h] * esUnc[h]
		arTerm := arWeight * arWeight * arUnc[h] * arUnc[h]
		uncertainty[h] = math.Sqrt(esTerm + arTerm)
	}

	return forecast, uncertainty
}

func computeStd(values []float64) float64 {
	n := len(values)
	if n < 2 {
		return 0.0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(n)
	variance := 0.0
	for _, v := range values {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(n - 1)
	return math.Sqrt(variance)
}

func computeMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func maxAbs(values []float64) float64 {
	m := 0.0
	for _, v := range values {
		av := math.Abs(v)
		if av > m {
			m = av
		}
	}
	return m
}

func linearTrend(values []float64) float64 {
	n := len(values)
	if n < 2 {
		return 0
	}
	var sumX, sumY, sumXY, sumX2 float64
	for i, v := range values {
		x := float64(i)
		sumX += x
		sumY += v
		sumXY += x * v
		sumX2 += x * x
	}
	slope := (float64(n)*sumXY - sumX*sumY) / (float64(n)*sumX2 - sumX*sumX)
	return slope
}

func generateFutureDates(lastDate string, horizon int) []string {
	t, err := time.Parse("2006-01-02", lastDate)
	if err != nil {
		t, err = time.Parse("2006/01/02", lastDate)
		if err != nil {
			t = time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC)
		}
	}

	dates := make([]string, horizon)
	for i := 0; i < horizon; i++ {
		next := t.AddDate(0, i+1, 0)
		dates[i] = next.Format("2006-01-02")
	}
	return dates
}

func getRiskLevel(value, threshold float64) string {
	av := math.Abs(value)
	if av > threshold {
		return "高"
	} else if av > threshold*0.7 {
		return "中"
	}
	return "低"
}

func roundFloat(v float64, decimals int) float64 {
	factor := math.Pow10(decimals)
	return math.Round(v*factor) / factor
}

func (s *TrendService) Forecast(
	history []ForecastHistory,
	forecastMonths int,
	confidence float64,
) *TrendForecastResult {
	result := &TrendForecastResult{
		ConfidenceLevel: confidence,
	}

	if len(history) == 0 {
		return result
	}

	sorted := make([]ForecastHistory, len(history))
	copy(sorted, history)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Date < sorted[j].Date
	})

	n := len(sorted)
	result.HistoryDates = make([]string, n)
	result.HistorySettlement = make([]float64, n)
	result.HistoryConvergence = make([]float64, n)

	for i, rec := range sorted {
		result.HistoryDates[i] = rec.Date
		result.HistorySettlement[i] = rec.Settlement
		result.HistoryConvergence[i] = rec.Convergence
	}

	settlementSeries := make([]float64, n)
	convergenceSeries := make([]float64, n)
	copy(settlementSeries, result.HistorySettlement)
	copy(convergenceSeries, result.HistoryConvergence)

	result.ForecastDates = generateFutureDates(sorted[n-1].Date, forecastMonths)

	var zScore float64
	switch {
	case confidence >= 0.99:
		zScore = 2.576
	case confidence >= 0.95:
		zScore = 1.96
	case confidence >= 0.90:
		zScore = 1.64
	default:
		zScore = 1.28
	}

	settlementForecast, settlementUnc := s.hybridPredict(settlementSeries, forecastMonths)
	result.ForecastSettlement = make([]float64, forecastMonths)
	result.SettlementLower = make([]float64, forecastMonths)
	result.SettlementUpper = make([]float64, forecastMonths)
	for h := 0; h < forecastMonths; h++ {
		result.ForecastSettlement[h] = roundFloat(settlementForecast[h], 2)
		result.SettlementLower[h] = roundFloat(settlementForecast[h]-zScore*settlementUnc[h], 2)
		result.SettlementUpper[h] = roundFloat(settlementForecast[h]+zScore*settlementUnc[h], 2)
	}

	convergenceForecast, convergenceUnc := s.hybridPredict(convergenceSeries, forecastMonths)
	result.ForecastConvergence = make([]float64, forecastMonths)
	result.ConvergenceLower = make([]float64, forecastMonths)
	result.ConvergenceUpper = make([]float64, forecastMonths)
	for h := 0; h < forecastMonths; h++ {
		result.ForecastConvergence[h] = roundFloat(convergenceForecast[h], 2)
		result.ConvergenceLower[h] = roundFloat(convergenceForecast[h]-zScore*convergenceUnc[h], 2)
		result.ConvergenceUpper[h] = roundFloat(convergenceForecast[h]+zScore*convergenceUnc[h], 2)
	}

	threshold := 15.0
	finalSettlement := settlementForecast[forecastMonths-1]
	finalConvergence := convergenceForecast[forecastMonths-1]

	settlementRisk := getRiskLevel(finalSettlement, threshold)
	convergenceRisk := getRiskLevel(finalConvergence, threshold)
	overallRisk := settlementRisk
	if math.Abs(finalConvergence) > math.Abs(finalSettlement) {
		overallRisk = convergenceRisk
	}

	result.Summary = ForecastSummary{
		HistoryPeriods:           n,
		ForecastHorizon:          forecastMonths,
		ConfidenceLevel:          confidence,
		SettlementAvg:            roundFloat(computeMean(settlementSeries), 2),
		SettlementMax:            roundFloat(maxAbs(settlementSeries), 2),
		SettlementTrend:          roundFloat(linearTrend(settlementSeries), 3),
		ConvergenceAvg:           roundFloat(computeMean(convergenceSeries), 2),
		ConvergenceMax:           roundFloat(maxAbs(convergenceSeries), 2),
		ConvergenceTrend:         roundFloat(linearTrend(convergenceSeries), 3),
		FinalSettlementForecast:  roundFloat(finalSettlement, 2),
		FinalConvergenceForecast: roundFloat(finalConvergence, 2),
		SettlementDelta:          roundFloat(finalSettlement-settlementSeries[n-1], 2),
		ConvergenceDelta:         roundFloat(finalConvergence-convergenceSeries[n-1], 2),
		SettlementRiskLevel:      settlementRisk,
		ConvergenceRiskLevel:     convergenceRisk,
		OverallRiskLevel:         overallRisk,
		AlertThreshold:           threshold,
		WillExceedThreshold:      math.Abs(finalSettlement) > threshold || math.Abs(finalConvergence) > threshold,
	}

	return result
}

func (s *TrendService) GenerateMockHistory(
	numPeriods int,
	startDate string,
	position float64,
) []ForecastHistory {
	history := make([]ForecastHistory, 0, numPeriods)
	t, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		t = time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC)
	}

	initialSettlement := -2.0
	initialConvergence := 0.5
	noiseLevel := 1.5

	for i := 0; i < numPeriods; i++ {
		progress := float64(i) / float64(numPeriods-1)

		baseSettlement := initialSettlement + math.Pow(progress, 1.3)*(-15.0)
		seasonalSettlement := math.Sin(float64(i)*math.Pi/3) * 2.0
		noiseSettlement := (randFloat() - 0.5) * 2 * noiseLevel
		settlement := roundFloat(baseSettlement+seasonalSettlement+noiseSettlement, 2)

		baseConvergence := initialConvergence + progress*12.0
		seasonalConvergence := math.Cos(float64(i)*math.Pi/4) * 1.5
		noiseConvergence := (randFloat() - 0.5) * 2 * noiseLevel * 0.8
		convergence := roundFloat(baseConvergence+seasonalConvergence+noiseConvergence, 2)

		meanDev := roundFloat(convergence*0.35+(randFloat()-0.5)*2, 2)
		maxDev := roundFloat(math.Max(math.Abs(settlement), math.Abs(convergence))+3.0+randFloat()*5.0, 2)

		dateStr := t.Format("2006-01-02")
		history = append(history, ForecastHistory{
			PeriodIndex:     i + 1,
			Date:            dateStr,
			Settlement:      settlement,
			Convergence:     convergence,
			MaxDeviation:    maxDev,
			MeanDeviation:   meanDev,
			CrossSectionPos: position,
		})

		t = t.AddDate(0, 1, 0)
	}

	return history
}

func randFloat() float64 {
	return float64(uint32(time.Now().UnixNano()%100000)) / 100000.0
}
