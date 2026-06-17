package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type BIMModel struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	Name       string         `gorm:"size:255;not null" json:"name"`
	FilePath   string         `gorm:"size:512;not null" json:"file_path"`
	Length     float64        `gorm:"type:decimal(10,3);not null" json:"length"`
	Width      float64        `gorm:"type:decimal(10,3);not null" json:"width"`
	Height     float64        `gorm:"type:decimal(10,3);not null" json:"height"`
	AxisPoints datatypes.JSON `gorm:"type:jsonb;not null" json:"axis_points"`
	CreatedAt  time.Time      `gorm:"autoCreateTime" json:"created_at"`

	PointClouds   []PointCloud    `gorm:"foreignKey:BIMModelID" json:"-"`
	CrossSections []CrossSection  `gorm:"foreignKey:BIMModelID" json:"-"`
}
