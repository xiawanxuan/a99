package analysis

import (
	"math"

	"pipe-monitor/internal/models"
)

func FitEllipse(points []Point2D) *models.EllipseParams {
	n := len(points)
	if n < 5 {
		return nil
	}

	var sumX, sumY, sumXY, sumX2, sumY2, sumX3, sumY3, sumX2Y, sumXY2, sumX4, sumY4, sumX3Y, sumXY3, sumX2Y2 float64

	for _, p := range points {
		x := p.X
		y := p.Y

		x2 := x * x
		y2 := y * y
		xy := x * y

		sumX += x
		sumY += y
		sumXY += xy
		sumX2 += x2
		sumY2 += y2
		sumX3 += x2 * x
		sumY3 += y2 * y
		sumX2Y += x2 * y
		sumXY2 += x * y2
		sumX4 += x2 * x2
		sumY4 += y2 * y2
		sumX3Y += x2 * xy
		sumXY3 += xy * y2
		sumX2Y2 += x2 * y2
	}

	D := [][]float64{
		{sumX4, sumX3Y, sumX2Y2, sumX3, sumX2Y, sumX2},
		{sumX3Y, sumX2Y2, sumXY3, sumX2Y, sumXY2, sumXY},
		{sumX2Y2, sumXY3, sumY4, sumX2Y, sumY3, sumY2},
		{sumX3, sumX2Y, sumX2Y, sumX2, sumXY, sumX},
		{sumX2Y, sumXY2, sumY3, sumXY, sumY2, sumY},
		{sumX2, sumXY, sumY2, sumX, sumY, float64(n)},
	}

	C := make([][]float64, 6)
	for i := range C {
		C[i] = make([]float64, 6)
	}
	C[0][2] = 2
	C[1][1] = -1
	C[2][0] = 2

	eigenvalues, eigenvectors := generalizedEigenvalue(D, C, 6)

	var bestIdx int
	minEig := math.Inf(1)
	for i, eig := range eigenvalues {
		if eig > 0 && eig < minEig {
			minEig = eig
			bestIdx = i
		}
	}

	A := eigenvectors[0][bestIdx]
	B := eigenvectors[1][bestIdx]
	Ccoef := eigenvectors[2][bestIdx]
	Dcoef := eigenvectors[3][bestIdx]
	Ecoef := eigenvectors[4][bestIdx]
	F := eigenvectors[5][bestIdx]

	denom := B*B - 4*A*Ccoef
	if denom >= 0 {
		return nil
	}

	cx := (2*Ccoef*Dcoef - B*Ecoef) / denom
	cy := (2*A*Ecoef - B*Dcoef) / denom

	numer := 2 * (A*Ecoef*Ecoef + Ccoef*Dcoef*Dcoef - B*Dcoef*Ecoef + denom*F)
	denomA := (B*B - 4*A*Ccoef) * (math.Sqrt((A-Ccoef)*(A-Ccoef) + B*B) - (A + Ccoef))
	denomB := (B*B - 4*A*Ccoef) * (-math.Sqrt((A-Ccoef)*(A-Ccoef) + B*B) - (A + Ccoef))

	a := math.Sqrt(math.Abs(numer / denomA))
	b := math.Sqrt(math.Abs(numer / denomB))

	var theta float64
	if B == 0 {
		if A < Ccoef {
			theta = 0
		} else {
			theta = math.Pi / 2
		}
	} else {
		theta = 0.5 * math.Atan2(B, A-Ccoef)
		if a < b {
			temp := a
			a = b
			b = temp
			theta += math.Pi / 2
		}
	}

	return &models.EllipseParams{
		Cx:       cx,
		Cy:       cy,
		A:        a,
		B:        b,
		Rotation: theta,
	}
}

func generalizedEigenvalue(D, C [][]float64, n int) ([]float64, [][]float64) {
	eigenvalues := make([]float64, n)
	eigenvectors := make([][]float64, n)
	for i := range eigenvectors {
		eigenvectors[i] = make([]float64, n)
	}

	for iter := 0; iter < 100; iter++ {
		maxOff := 0.0
		p, q := 0, 1
		for i := 0; i < n; i++ {
			for j := i + 1; j < n; j++ {
				if math.Abs(D[i][j]) > maxOff {
					maxOff = math.Abs(D[i][j])
					p, q = i, j
				}
			}
		}

		if maxOff < 1e-10 {
			break
		}

		Dpp := D[p][p]
		Dqq := D[q][q]
		Dpq := D[p][q]

		var theta float64
		if math.Abs(Dqq-Dpp) < 1e-10 {
			theta = math.Pi / 4
		} else {
			theta = 0.5 * math.Atan2(2*Dpq, Dqq-Dpp)
		}

		c := math.Cos(theta)
		s := math.Sin(theta)

		for i := 0; i < n; i++ {
			if i != p && i != q {
				Dip := D[i][p]
				Diq := D[i][q]
				D[i][p] = c*Dip - s*Diq
				D[p][i] = D[i][p]
				D[i][q] = s*Dip + c*Diq
				D[q][i] = D[i][q]
			}
		}

		D[p][p] = c*c*Dpp - 2*s*c*Dpq + s*s*Dqq
		D[q][q] = s*s*Dpp + 2*s*c*Dpq + c*c*Dqq
		D[p][q] = 0
		D[q][p] = 0

		for i := 0; i < n; i++ {
			eip := eigenvectors[i][p]
			eiq := eigenvectors[i][q]
			eigenvectors[i][p] = c*eip - s*eiq
			eigenvectors[i][q] = s*eip + c*eiq
		}
	}

	for i := 0; i < n; i++ {
		eigenvalues[i] = D[i][i]
	}

	return eigenvalues, eigenvectors
}
