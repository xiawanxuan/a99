package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type EllipseParams struct {
	Cx       float64 `json:"cx"`
	Cy       float64 `json:"cy"`
	A        float64 `json:"a"`
	B        float64 `json:"b"`
	Rotation float64 `json:"rotation"`
}

type DeviationStats struct {
	Min       float64   `json:"min"`
	Max       float64   `json:"max"`
	Mean      float64   `json:"mean"`
	Std       float64   `json:"std"`
	Histogram []float64 `json:"histogram"`
}

type CrossSection struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	BIMModelID      uuid.UUID      `gorm:"type:uuid;not null" json:"bim_model_id"`
	Position        float64        `gorm:"type:decimal(10,3);not null" json:"position"`
	BaselineWidth   float64        `gorm:"type:decimal(10,3);not null" json:"baseline_width"`
	BaselineHeight  float64        `gorm:"type:decimal(10,3);not null" json:"baseline_height"`
	BaselineEllipse datatypes.JSON `gorm:"type:jsonb;not null" json:"baseline_ellipse"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`

	Measurements []DeformationMeasurement `gorm:"foreignKey:CrossSectionID" json:"-"`
}

type DeformationMeasurement struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CrossSectionID uuid.UUID      `gorm:"type:uuid;not null" json:"cross_section_id"`
	PointCloudID   uuid.UUID      `gorm:"type:uuid;not null" json:"point_cloud_id"`
	Convergence    float64        `gorm:"type:decimal(10,3);not null" json:"convergence"`
	Settlement     float64        `gorm:"type:decimal(10,3);not null" json:"settlement"`
	MaxDeviation   float64        `gorm:"type:decimal(10,3);not null" json:"max_deviation"`
	AvgDeviation   float64        `gorm:"type:decimal(10,3);not null" json:"avg_deviation"`
	EllipseParams  datatypes.JSON `gorm:"type:jsonb;not null" json:"ellipse_params"`
	DeviationStats datatypes.JSON `gorm:"type:jsonb;not null" json:"deviation_stats"`
	MeasuredAt     time.Time      `gorm:"autoCreateTime" json:"measured_at"`

	Alerts []Alert `gorm:"foreignKey:MeasurementID" json:"-"`
}
