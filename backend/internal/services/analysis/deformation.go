package analysis

import (
	"math"

	"pipe-monitor/internal/models"
)

type DeviationResult struct {
	Deviations []float64
	Stats      *models.DeviationStats
	Colors     []float64
}

func ComputePointDeviations(points []Point2D, baseline *models.EllipseParams) *DeviationResult {
	result := &DeviationResult{
		Deviations: make([]float64, len(points)),
		Colors:     make([]float64, len(points)),
	}

	if baseline == nil {
		return result
	}

	var sum, sumSq float64
	minDev := math.Inf(1)
	maxDev := math.Inf(-1)

	for i, p := range points {
		dist := distanceToEllipse(p.X, p.Y, baseline)
		result.Deviations[i] = dist * 1000

		sum += result.Deviations[i]
		sumSq += result.Deviations[i] * result.Deviations[i]

		if result.Deviations[i] < minDev {
			minDev = result.Deviations[i]
		}
		if result.Deviations[i] > maxDev {
			maxDev = result.Deviations[i]
		}
	}

	n := float64(len(points))
	mean := sum / n
	variance := (sumSq / n) - mean*mean
	std := math.Sqrt(variance)

	histogram := computeHistogram(result.Deviations, -20, 20, 10)

	result.Stats = &models.DeviationStats{
		Min:       minDev,
		Max:       maxDev,
		Mean:      mean,
		Std:       std,
		Histogram: histogram,
	}

	for i, d := range result.Deviations {
		result.Colors[i] = normalizeDeviation(d, -20, 20)
	}

	return result
}

func distanceToEllipse(x, y float64, ellipse *models.EllipseParams) float64 {
	cx := ellipse.Cx
	cy := ellipse.Cy
	a := ellipse.A
	b := ellipse.B
	theta := ellipse.Rotation

	cosT := math.Cos(-theta)
	sinT := math.Sin(-theta)

	dx := x - cx
	dy := y - cy

	lx := dx*cosT - dy*sinT
	ly := dx*sinT + dy*cosT

	t := 0.0
	for i := 0; i < 10; i++ {
		cos := math.Cos(t)
		sin := math.Sin(t)

		ex := a * cos
		ey := b * sin

		distX := lx - ex
		distY := ly - ey

		dist := math.Sqrt(distX*distX + distY*distY)
		if dist < 1e-8 {
			return 0
		}

		fx := -a * sin
		fy := b * cos

		deriv := (distX*fx + distY*fy) / dist
		deriv2 := (distX*(-a*cos) + distY*(-b*sin))/dist - (deriv*deriv)/dist

		if math.Abs(deriv2) < 1e-10 {
			break
		}

		t -= deriv / deriv2
	}

	cosT = math.Cos(t)
	sinT = math.Sin(t)
	ex := a * cosT
	ey := b * sinT

	distX := lx - ex
	distY := ly - ey

	sign := 1.0
	if (lx*lx)/(a*a) + (ly*ly)/(b*b) < 1 {
		sign = -1.0
	}

	return sign * math.Sqrt(distX*distX + distY*distY)
}

func normalizeDeviation(d, min, max float64) float64 {
	t := (d - min) / (max - min)
	return math.Max(0, math.Min(1, t))
}

func computeHistogram(data []float64, min, max float64, bins int) []float64 {
	histogram := make([]float64, bins)
	binWidth := (max - min) / float64(bins)

	for _, d := range data {
		if d < min || d > max {
			continue
		}
		binIdx := int((d - min) / binWidth)
		if binIdx >= bins {
			binIdx = bins - 1
		}
		histogram[binIdx]++
	}

	total := float64(len(data))
	if total > 0 {
		for i := range histogram {
			histogram[i] /= total
		}
	}

	return histogram
}
