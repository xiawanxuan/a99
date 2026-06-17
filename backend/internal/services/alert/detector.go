package alert

import (
	"time"

	"github.com/google/uuid"
	"pipe-monitor/internal/config"
	"pipe-monitor/internal/models"
)

type AlertDetector struct {
	cfg        *config.Config
	hub        *AlertHub
}

func NewAlertDetector(cfg *config.Config, hub *AlertHub) *AlertDetector {
	return &AlertDetector{
		cfg: cfg,
		hub: hub,
	}
}

func (d *AlertDetector) DetectAndAlert(measurement *models.DeformationMeasurement, crossSectionPosition float64, pointCloudPhase string) (*models.Alert, error) {
	if measurement.MaxDeviation <= d.cfg.AlertThreshold {
		return nil, nil
	}

	level := "warning"
	if measurement.MaxDeviation > d.cfg.AlertThreshold*1.5 {
		level = "danger"
	}

	alert := &models.Alert{
		MeasurementID: measurement.ID,
		Level:         level,
		Message:       d.buildAlertMessage(measurement, crossSectionPosition, pointCloudPhase),
		Threshold:     d.cfg.AlertThreshold,
		ActualValue:   measurement.MaxDeviation,
		Acknowledged:  false,
		CreatedAt:     time.Now(),
	}

	if err := models.DB.Create(alert).Error; err != nil {
		return nil, err
	}

	d.hub.BroadcastAlert(alert, crossSectionPosition, pointCloudPhase)

	return alert, nil
}

func (d *AlertDetector) buildAlertMessage(measurement *models.DeformationMeasurement, position float64, phase string) string {
	return "截面位置 " + formatFloat(position) + "m, " +
		"点云期次 " + phase + ", " +
		"最大偏差 " + formatFloat(measurement.MaxDeviation) + "mm, " +
		"收敛值 " + formatFloat(measurement.Convergence) + "mm, " +
		"沉降值 " + formatFloat(measurement.Settlement) + "mm"
}

func formatFloat(f float64) string {
	return string(appendFloat(make([]byte, 0, 20), f, 2))
}

func appendFloat(b []byte, f float64, prec int) []byte {
	neg := f < 0
	if neg {
		f = -f
		b = append(b, '-')
	}

	scale := 1.0
	for i := 0; i < prec; i++ {
		scale *= 10
	}

	val := int64(f*scale + 0.5)
	integer := val / int64(scale)
	frac := val % int64(scale)

	b = appendInt(b, integer)
	b = append(b, '.')

	fracStr := appendInt(make([]byte, 0, prec), frac)
	for len(fracStr) < prec {
		fracStr = append([]byte{'0'}, fracStr...)
	}
	b = append(b, fracStr...)

	return b
}

func appendInt(b []byte, i int64) []byte {
	if i == 0 {
		return append(b, '0')
	}

	var buf [20]byte
	pos := len(buf)
	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}

	return append(b, buf[pos:]...)
}
