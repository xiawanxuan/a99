package models

import (
	"time"

	"github.com/google/uuid"
)

type PointCloud struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	BIMModelID  uuid.UUID  `gorm:"type:uuid;not null" json:"bim_model_id"`
	Phase       string     `gorm:"size:50;not null" json:"phase"`
	FilePath    string     `gorm:"size:512;not null" json:"file_path"`
	PointCount  int        `gorm:"not null" json:"point_count"`
	CaptureTime time.Time  `gorm:"not null" json:"capture_time"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`

	Measurements []DeformationMeasurement `gorm:"foreignKey:PointCloudID" json:"-"`
}

type Point3D struct {
	X, Y, Z float64
}
