package pointcloud

import (
	"pipe-monitor/internal/models"
)

type PointCloudProcessor struct {
	points []models.Point3D
	bbox   *BoundingBox
}

type BoundingBox struct {
	MinX, MaxX float64
	MinY, MaxY float64
	MinZ, MaxZ float64
}

func NewProcessor(points []models.Point3D) *PointCloudProcessor {
	return &PointCloudProcessor{
		points: points,
		bbox:   computeBoundingBox(points),
	}
}

func (p *PointCloudProcessor) GetPoints() []models.Point3D {
	return p.points
}

func (p *PointCloudProcessor) GetBoundingBox() *BoundingBox {
	return p.bbox
}

func (p *PointCloudProcessor) GetBounds() (float64, float64, float64, float64, float64, float64) {
	return p.bbox.MinX, p.bbox.MaxX, p.bbox.MinY, p.bbox.MaxY, p.bbox.MinZ, p.bbox.MaxZ
}

func (p *PointCloudProcessor) Centroid() (float64, float64, float64) {
	return (p.bbox.MinX + p.bbox.MaxX) / 2,
		(p.bbox.MinY + p.bbox.MaxY) / 2,
		(p.bbox.MinZ + p.bbox.MaxZ) / 2
}

func computeBoundingBox(points []models.Point3D) *BoundingBox {
	if len(points) == 0 {
		return &BoundingBox{}
	}

	bbox := &BoundingBox{
		MinX: points[0].X, MaxX: points[0].X,
		MinY: points[0].Y, MaxY: points[0].Y,
		MinZ: points[0].Z, MaxZ: points[0].Z,
	}

	for _, p := range points[1:] {
		if p.X < bbox.MinX {
			bbox.MinX = p.X
		}
		if p.X > bbox.MaxX {
			bbox.MaxX = p.X
		}
		if p.Y < bbox.MinY {
			bbox.MinY = p.Y
		}
		if p.Y > bbox.MaxY {
			bbox.MaxY = p.Y
		}
		if p.Z < bbox.MinZ {
			bbox.MinZ = p.Z
		}
		if p.Z > bbox.MaxZ {
			bbox.MaxZ = p.Z
		}
	}

	return bbox
}
