package models

import (
	"pipe-monitor/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) error {
	var err error
	DB, err = gorm.Open(postgres.Open(cfg.GetDSN()), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&BIMModel{},
		&PointCloud{},
		&CrossSection{},
		&DeformationMeasurement{},
		&Alert{},
		&User{},
	)
	if err != nil {
		return err
	}

	return nil
}
