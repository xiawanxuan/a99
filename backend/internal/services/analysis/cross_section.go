package analysis

import (
	"math"

	"pipe-monitor/internal/models"
)

type Plane struct {
	NormalX, NormalY, NormalZ float64
	D                         float64
}

type CrossSectionResult struct {
	Points        []Point2D
	EllipseParams *models.EllipseParams
	Convergence   float64
	Settlement    float64
	PointCount    int
}

type Point2D struct {
	X, Y float64
}

func NewPlaneFromPointNormal(px, py, pz, nx, ny, nz float64) *Plane {
	mag := math.Sqrt(nx*nx + ny*ny + nz*nz)
	if mag == 0 {
		nx = 1
	} else {
		nx /= mag
		ny /= mag
		nz /= mag
	}
	return &Plane{
		NormalX: nx,
		NormalY: ny,
		NormalZ: nz,
		D:       -(nx*px + ny*py + nz*pz),
	}
}

func (p *Plane) DistanceToPoint(x, y, z float64) float64 {
	return math.Abs(p.NormalX*x + p.NormalY*y + p.NormalZ*z + p.D)
}

func (p *Plane) ProjectPoint(x, y, z float64) (float64, float64) {
	t := -(p.NormalX*x + p.NormalY*y + p.NormalZ*z + p.D) /
		(p.NormalX*p.NormalX + p.NormalY*p.NormalY + p.NormalZ*p.NormalZ)

	projX := x + t*p.NormalX
	projY := y + t*p.NormalY
	projZ := z + t*p.NormalZ

	uX, uY, uZ := p.getPerpendicular1()
	vX, vY, vZ := p.getPerpendicular2()

	u := projX*uX + projY*uY + projZ*uZ
	v := projX*vX + projY*vY + projZ*vZ

	return u, v
}

func (p *Plane) getPerpendicular1() (float64, float64, float64) {
	if math.Abs(p.NormalZ) < 0.9 {
		len := math.Sqrt(p.NormalX*p.NormalX + p.NormalY*p.NormalY)
		return -p.NormalY / len, p.NormalX / len, 0
	}
	len := math.Sqrt(p.NormalX*p.NormalX + p.NormalZ*p.NormalZ)
	return p.NormalZ / len, 0, -p.NormalX / len
}

func (p *Plane) getPerpendicular2() (float64, float64, float64) {
	uX, uY, uZ := p.getPerpendicular1()
	return p.NormalY*uZ - p.NormalZ*uY,
		p.NormalZ*uX - p.NormalX*uZ,
		p.NormalX*uY - p.NormalY*uX
}

func CutCrossSection(points []models.Point3D, plane *Plane, thickness float64) *CrossSectionResult {
	result := &CrossSectionResult{
		Points: make([]Point2D, 0),
	}

	for _, p := range points {
		dist := plane.DistanceToPoint(p.X, p.Y, p.Z)
		if dist <= thickness {
			u, v := plane.ProjectPoint(p.X, p.Y, p.Z)
			result.Points = append(result.Points, Point2D{X: u, Y: v})
		}
	}

	result.PointCount = len(result.Points)

	if len(result.Points) >= 5 {
		params := FitEllipse(result.Points)
		result.EllipseParams = params
	}

	return result
}

func ComputeDeformation(current, baseline *models.EllipseParams) (convergence, settlement float64) {
	if current == nil || baseline == nil {
		return 0, 0
	}

	convergence = (current.A - baseline.A) * 2000
	settlement = (current.Cy - baseline.Cy) * 1000

	return convergence, settlement
}
