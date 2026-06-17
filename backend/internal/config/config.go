package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port              string
	DBHost            string
	DBPort            string
	DBUser            string
	DBPassword        string
	DBName            string
	PointCloudStorage string
	BIMModelStorage   string
	AlertThreshold    float64
}

func Load() *Config {
	threshold := 15.0
	if t := os.Getenv("ALERT_THRESHOLD"); t != "" {
		if v, err := strconv.ParseFloat(t, 64); err == nil {
			threshold = v
		}
	}

	return &Config{
		Port:              getEnv("PORT", "8080"),
		DBHost:            getEnv("DB_HOST", "localhost"),
		DBPort:            getEnv("DB_PORT", "5432"),
		DBUser:            getEnv("DB_USER", "postgres"),
		DBPassword:        getEnv("DB_PASSWORD", "postgres"),
		DBName:            getEnv("DB_NAME", "pipe_monitor"),
		PointCloudStorage: getEnv("POINT_CLOUD_STORAGE", "./storage/pointclouds"),
		BIMModelStorage:   getEnv("BIM_MODEL_STORAGE", "./storage/bim"),
		AlertThreshold:    threshold,
	}
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
