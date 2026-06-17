package models

import (
	"time"

	"github.com/google/uuid"
)

type Alert struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	MeasurementID uuid.UUID  `gorm:"type:uuid;not null" json:"measurement_id"`
	UserID        *uuid.UUID `gorm:"type:uuid" json:"user_id,omitempty"`
	Level         string     `gorm:"size:20;not null" json:"level"`
	Message       string     `gorm:"type:text;not null" json:"message"`
	Threshold     float64    `gorm:"type:decimal(10,3);not null" json:"threshold"`
	ActualValue   float64    `gorm:"type:decimal(10,3);not null" json:"actual_value"`
	Acknowledged  bool       `gorm:"default:false" json:"acknowledged"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

type User struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	Username      string    `gorm:"size:50;unique;not null" json:"username"`
	Role          string    `gorm:"size:20;not null" json:"role"`
	Email         string    `gorm:"size:255" json:"email,omitempty"`
	PasswordHash  string    `gorm:"size:255;not null" json:"-"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
}
