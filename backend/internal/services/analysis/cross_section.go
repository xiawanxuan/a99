package analysis

import (
	"math"
	"sort"

	"pipe-monitor/internal/models"
)

type Plane struct {
	NormalX, NormalY, NormalZ float64
	D                         float64
}

type LocalCoordinateSystem struct {
	OriginX, OriginY, OriginZ float64
	Ux, Uy, Uz                float64
	Vx, Vy, Vz                float64
	Nx, Ny, Nz                float64
}

type CrossSectionResult struct {
	Points        []Point2D
	Points3D      []models.Point3D
	PointIndices  []int
	EllipseParams *models.EllipseParams
	Convergence   float64
	Settlement    float64
	PointCount    int
	PlaneNormal   [3]float64
	LocalSystem   *LocalCoordinateSystem
}

type Point2D struct {
	X, Y float64
}

type Point3DWithIndex struct {
	X, Y, Z     float64
	AxialCoord  float64
	Index       int
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

func (p *Plane) SignedDistanceToPoint(x, y, z float64) float64 {
	return p.NormalX*x + p.NormalY*y + p.NormalZ*z + p.D
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
		if len < 1e-15 {
			return 0, 1, 0
		}
		return -p.NormalY / len, p.NormalX / len, 0
	}
	len := math.Sqrt(p.NormalX*p.NormalX + p.NormalZ*p.NormalZ)
	if len < 1e-15 {
		return 1, 0, 0
	}
	return p.NormalZ / len, 0, -p.NormalX / len
}

func (p *Plane) getPerpendicular2() (float64, float64, float64) {
	uX, uY, uZ := p.getPerpendicular1()
	return p.NormalY*uZ - p.NormalZ*uY,
		p.NormalZ*uX - p.NormalX*uZ,
		p.NormalX*uY - p.NormalY*uX
}

func ComputeCentroid(points []models.Point3D) (cx, cy, cz float64) {
	n := len(points)
	if n == 0 {
		return 0, 0, 0
	}
	for _, p := range points {
		cx += p.X
		cy += p.Y
		cz += p.Z
	}
	return cx / float64(n), cy / float64(n), cz / float64(n)
}

func ComputeCovarianceMatrix(points []models.Point3D, cx, cy, cz float64) [3][3]float64 {
	var cov [3][3]float64
	n := float64(len(points))
	if n < 2 {
		cov[0][0] = 1
		cov[1][1] = 1
		cov[2][2] = 1
		return cov
	}

	for _, p := range points {
		dx := p.X - cx
		dy := p.Y - cy
		dz := p.Z - cz

		cov[0][0] += dx * dx
		cov[0][1] += dx * dy
		cov[0][2] += dx * dz
		cov[1][1] += dy * dy
		cov[1][2] += dy * dz
		cov[2][2] += dz * dz
	}

	invN := 1.0 / (n - 1)
	for i := 0; i < 3; i++ {
		for j := i; j < 3; j++ {
			cov[i][j] *= invN
			cov[j][i] = cov[i][j]
		}
	}
	return cov
}

func JacobiEigenDecomposition(a [3][3]float64, maxIter int, tol float64) (eigenvalues [3]float64, eigenvectors [3][3]float64) {
	for i := 0; i < 3; i++ {
		eigenvectors[i][i] = 1
		for j := 0; j < 3; j++ {
			if i != j {
				eigenvectors[i][j] = 0
			}
		}
	}
	eigenvalues[0] = a[0][0]
	eigenvalues[1] = a[1][1]
	eigenvalues[2] = a[2][2]

	s := a[0][1]*a[0][1] + a[0][2]*a[0][2] + a[1][2]*a[1][2]
	if s == 0 {
		return
	}

	tresh := 0
	for iter := 0; iter < maxIter; iter++ {
		s = 0
		for i := 0; i < 2; i++ {
			for j := i + 1; j < 3; j++ {
				s += a[i][j] * a[i][j]
			}
		}
		if s < tol {
			break
		}

		if iter < 3 {
			tresh = 0.2 * s / 9
		} else {
			tresh = 0
		}

		for i := 0; i < 2; i++ {
			for j := i + 1; j < 3; j++ {
				offdiag := 100 * math.Abs(a[i][j])
				if iter > 3 && math.Abs(eigenvalues[i])+offdiag == math.Abs(eigenvalues[i]) &&
					math.Abs(eigenvalues[j])+offdiag == math.Abs(eigenvalues[j]) {
					a[i][j] = 0
				} else if math.Abs(a[i][j]) > tresh {
					h := eigenvalues[j] - eigenvalues[i]
					var t float64
					if math.Abs(h)+offdiag == math.Abs(h) {
						t = a[i][j] / h
					} else {
						theta := 0.5 * h / a[i][j]
						t = 1 / (math.Abs(theta) + math.Sqrt(1+theta*theta))
						if theta < 0 {
							t = -t
						}
					}

					c := 1 / math.Sqrt(1+t*t)
					s2 := t * c
					tau := s2 / (1 + c)

					h = t * a[i][j]
					eigenvalues[i] -= h
					eigenvalues[j] += h

					a[i][j] = 0

					for k := 0; k < i; k++ {
						g := a[k][i]
						h2 := a[k][j]
						a[k][i] = g - s2*(h2+g*tau)
						a[k][j] = h2 + s2*(g-h2*tau)
					}
					for k := i + 1; k < j; k++ {
						g := a[i][k]
						h2 := a[k][j]
						a[i][k] = g - s2*(h2+g*tau)
						a[k][j] = h2 + s2*(g-h2*tau)
					}
					for k := j + 1; k < 3; k++ {
						g := a[i][k]
						h2 := a[j][k]
						a[i][k] = g - s2*(h2+g*tau)
						a[j][k] = h2 + s2*(g-h2*tau)
					}

					for k := 0; k < 3; k++ {
						g := eigenvectors[k][i]
						h2 := eigenvectors[k][j]
						eigenvectors[k][i] = g - s2*(h2+g*tau)
						eigenvectors[k][j] = h2 + s2*(g-h2*tau)
					}
				}
			}
		}
	}

	return
}

func ComputePCA(points []models.Point3D) (eigenvalues [3]float64, eigenvectors [3][3]float64, centroid [3]float64) {
	cx, cy, cz := ComputeCentroid(points)
	centroid[0] = cx
	centroid[1] = cy
	centroid[2] = cz

	cov := ComputeCovarianceMatrix(points, cx, cy, cz)

	var covCopy [3][3]float64
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			covCopy[i][j] = cov[i][j]
		}
	}

	evals, evecs := JacobiEigenDecomposition(covCopy, 100, 1e-15)

	indices := []int{0, 1, 2}
	sort.Slice(indices, func(i, j int) bool {
		return evals[indices[i]] > evals[indices[j]]
	})

	for i, idx := range indices {
		eigenvalues[i] = evals[idx]
		eigenvectors[0][i] = evecs[0][idx]
		eigenvectors[1][i] = evecs[1][idx]
		eigenvectors[2][i] = evecs[2][idx]
	}

	return
}

func normalizeVec3(x, y, z float64) (nx, ny, nz float64, norm float64) {
	norm = math.Sqrt(x*x + y*y + z*z)
	if norm < 1e-15 {
		return 1, 0, 0, 0
	}
	return x / norm, y / norm, z / norm, norm
}

func crossVec3(ax, ay, az, bx, by, bz float64) (cx, cy, cz float64) {
	return ay*bz - az*by, az*bx - ax*bz, ax*by - ay*bx
}

func dotVec3(ax, ay, az, bx, by, bz float64) float64 {
	return ax*bx + ay*by + az*bz
}

func EstimatePipeAxisDirection(points []models.Point3D, windowSize int, position float64) (axisDir [3]float64, refPoint [3]float64) {
	if len(points) < 10 {
		axisDir[0] = 1
		return
	}

	_, evecs, globalCentroid := ComputePCA(points)
	roughAxis := [3]float64{evecs[0][0], evecs[1][0], evecs[2][0]}

	axialCoords := make([]Point3DWithIndex, len(points))
	for i, p := range points {
		axialCoords[i] = Point3DWithIndex{
			X:          p.X,
			Y:          p.Y,
			Z:          p.Z,
			AxialCoord: dotVec3(p.X-globalCentroid[0], p.Y-globalCentroid[1], p.Z-globalCentroid[2],
				roughAxis[0], roughAxis[1], roughAxis[2]),
			Index: i,
		}
	}

	sort.Slice(axialCoords, func(i, j int) bool {
		return axialCoords[i].AxialCoord < axialCoords[j].AxialCoord
	})

	targetIdx := int(position * float64(len(axialCoords)-1))
	if targetIdx < 0 {
		targetIdx = 0
	}
	if targetIdx >= len(axialCoords) {
		targetIdx = len(axialCoords) - 1
	}

	if windowSize <= 0 {
		autoSize := len(axialCoords) / 5
		if autoSize < 50 {
			autoSize = 50
		}
		if autoSize > 500 {
			autoSize = 500
		}
		windowSize = autoSize
	}

	halfWindow := windowSize / 2
	startIdx := targetIdx - halfWindow
	endIdx := targetIdx + halfWindow
	if startIdx < 0 {
		startIdx = 0
	}
	if endIdx > len(axialCoords) {
		endIdx = len(axialCoords)
	}

	localPoints := make([]models.Point3D, 0, endIdx-startIdx)
	for i := startIdx; i < endIdx; i++ {
		localPoints = append(localPoints, models.Point3D{
			X: axialCoords[i].X,
			Y: axialCoords[i].Y,
			Z: axialCoords[i].Z,
		})
	}

	_, localEvecs, localCentroid := ComputePCA(localPoints)
	localAxis := [3]float64{localEvecs[0][0], localEvecs[1][0], localEvecs[2][0]}

	dot := dotVec3(localAxis[0], localAxis[1], localAxis[2],
		roughAxis[0], roughAxis[1], roughAxis[2])
	if dot < 0 {
		localAxis[0] = -localAxis[0]
		localAxis[1] = -localAxis[1]
		localAxis[2] = -localAxis[2]
	}

	refPoint = localCentroid
	axisDir = localAxis

	return
}

func BuildCuttingPlane(positionPoint, axisDirection, upHint [3]float64) (*Plane, *LocalCoordinateSystem) {
	if upHint[0] == 0 && upHint[1] == 0 && upHint[2] == 0 {
		upHint = [3]float64{0, 0, 1}
	}

	nx, ny, nz, _ := normalizeVec3(axisDirection[0], axisDirection[1], axisDirection[2])

	uX, uY, uZ := crossVec3(upHint[0], upHint[1], upHint[2], nx, ny, nz)
	uX, uY, uZ, uNorm := normalizeVec3(uX, uY, uZ)

	if uNorm < 1e-10 {
		uX, uY, uZ = crossVec3(1, 0, 0, nx, ny, nz)
		uX, uY, uZ, uNorm = normalizeVec3(uX, uY, uZ)
		if uNorm < 1e-10 {
			uX, uY, uZ = 1, 0, 0
		}
	}

	vX, vY, vZ := crossVec3(nx, ny, nz, uX, uY, uZ)
	vX, vY, vZ, _ = normalizeVec3(vX, vY, vZ)

	vDot := dotVec3(vX, vY, vZ, upHint[0], upHint[1], upHint[2])
	if vDot < 0 {
		vX = -vX
		vY = -vY
		vZ = -vZ
		uX = -uX
		uY = -uY
		uZ = -uZ
	}

	plane := NewPlaneFromPointNormal(
		positionPoint[0], positionPoint[1], positionPoint[2],
		nx, ny, nz,
	)

	localSys := &LocalCoordinateSystem{
		OriginX: positionPoint[0],
		OriginY: positionPoint[1],
		OriginZ: positionPoint[2],
		Ux:      uX,
		Uy:      uY,
		Uz:      uZ,
		Vx:      vX,
		Vy:      vY,
		Vz:      vZ,
		Nx:      nx,
		Ny:      ny,
		Nz:      nz,
	}

	return plane, localSys
}

func (ls *LocalCoordinateSystem) ToLocal(x, y, z float64) (u, v, n float64) {
	dx := x - ls.OriginX
	dy := y - ls.OriginY
	dz := z - ls.OriginZ
	u = dotVec3(dx, dy, dz, ls.Ux, ls.Uy, ls.Uz)
	v = dotVec3(dx, dy, dz, ls.Vx, ls.Vy, ls.Vz)
	n = dotVec3(dx, dy, dz, ls.Nx, ls.Ny, ls.Nz)
	return
}

func (ls *LocalCoordinateSystem) ProjectToSection(x, y, z float64) (u, v float64) {
	u, v, _ = ls.ToLocal(x, y, z)
	return
}

func ExtractCrossSectionPoints(points []models.Point3D, plane *Plane, thickness float64) (sectionPoints []models.Point3D, indices []int) {
	sectionPoints = make([]models.Point3D, 0)
	indices = make([]int, 0)

	for i, p := range points {
		dist := plane.DistanceToPoint(p.X, p.Y, p.Z)
		if dist <= thickness {
			sectionPoints = append(sectionPoints, p)
			indices = append(indices, i)
		}
	}
	return
}

func CutCrossSection(points []models.Point3D, plane *Plane, thickness float64) *CrossSectionResult {
	result := &CrossSectionResult{
		Points:       make([]Point2D, 0),
		Points3D:     make([]models.Point3D, 0),
		PointIndices: make([]int, 0),
	}

	for i, p := range points {
		dist := plane.DistanceToPoint(p.X, p.Y, p.Z)
		if dist <= thickness {
			u, v := plane.ProjectPoint(p.X, p.Y, p.Z)
			result.Points = append(result.Points, Point2D{X: u, Y: v})
			result.Points3D = append(result.Points3D, p)
			result.PointIndices = append(result.PointIndices, i)
		}
	}

	result.PointCount = len(result.Points)
	result.PlaneNormal = [3]float64{plane.NormalX, plane.NormalY, plane.NormalZ}

	if len(result.Points) >= 5 {
		params := FitEllipse(result.Points)
		result.EllipseParams = params
	}

	return result
}

func AnalyzeCrossSectionAdaptive(
	points []models.Point3D,
	cutPosition *models.Point3D,
	cutFraction float64,
	thickness float64,
) *CrossSectionResult {
	result := &CrossSectionResult{
		Points:       make([]Point2D, 0),
		Points3D:     make([]models.Point3D, 0),
		PointIndices: make([]int, 0),
	}

	if len(points) < 10 {
		return result
	}

	axisDir, roughCentroid := EstimatePipeAxisDirection(points, 0, cutFraction)

	var positionPoint [3]float64
	if cutPosition != nil {
		positionPoint = [3]float64{cutPosition.X, cutPosition.Y, cutPosition.Z}
	} else {
		axialCoords := make([]float64, len(points))
		minAxial := math.Inf(1)
		maxAxial := math.Inf(-1)
		closestIdx := 0
		minDist := math.Inf(1)

		for i, p := range points {
			ac := dotVec3(p.X-roughCentroid[0], p.Y-roughCentroid[1], p.Z-roughCentroid[2],
				axisDir[0], axisDir[1], axisDir[2])
			axialCoords[i] = ac
			if ac < minAxial {
				minAxial = ac
			}
			if ac > maxAxial {
				maxAxial = ac
			}
		}

		targetAxial := minAxial + cutFraction*(maxAxial-minAxial)

		for i, ac := range axialCoords {
			d := math.Abs(ac - targetAxial)
			if d < minDist {
				minDist = d
				closestIdx = i
			}
		}
		positionPoint = [3]float64{points[closestIdx].X, points[closestIdx].Y, points[closestIdx].Z}
	}

	plane, localSys := BuildCuttingPlane(positionPoint, axisDir, [3]float64{0, 0, 1})
	result.LocalSystem = localSys
	result.PlaneNormal = [3]float64{plane.NormalX, plane.NormalY, plane.NormalZ}

	actualThickness := thickness
	sectionPoints, indices := ExtractCrossSectionPoints(points, plane, actualThickness)

	if len(sectionPoints) < 5 {
		sectionPoints, indices = ExtractCrossSectionPoints(points, plane, actualThickness*3)
	}

	result.Points3D = sectionPoints
	result.PointIndices = indices
	result.PointCount = len(sectionPoints)

	result.Points = make([]Point2D, len(sectionPoints))
	for i, p := range sectionPoints {
		u, v := localSys.ProjectToSection(p.X, p.Y, p.Z)
		result.Points[i] = Point2D{X: u, Y: v}
	}

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

func BenchmarkCuttingMethods(points []models.Point3D, cutFraction, thickness float64) (
	oldCount, newCount int,
	oldPoints, newPoints []models.Point3D,
	normalAlignment float64,
	planeNormal [3]float64,
) {
	xCoords := make([]float64, len(points))
	minX := math.Inf(1)
	maxX := math.Inf(-1)
	for i, p := range points {
		xCoords[i] = p.X
		if p.X < minX {
			minX = p.X
		}
		if p.X > maxX {
			maxX = p.X
		}
	}
	targetX := minX + cutFraction*(maxX-minX)

	oldPoints = make([]models.Point3D, 0)
	for _, p := range points {
		if math.Abs(p.X-targetX) <= thickness {
			oldPoints = append(oldPoints, p)
		}
	}
	oldCount = len(oldPoints)

	result := AnalyzeCrossSectionAdaptive(points, nil, cutFraction, thickness)
	newCount = result.PointCount
	newPoints = result.Points3D
	planeNormal = result.PlaneNormal
	normalAlignment = math.Abs(planeNormal[0])

	return
}
