package pointcloud

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"unsafe"

	"pipe-monitor/internal/models"
)

type PLYHeader struct {
	Format       string
	Version      string
	PointCount   int
	Properties   []string
	DataStartPos int64
}

func LoadPLYFile(filePath string) ([]models.Point3D, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open PLY file: %w", err)
	}
	defer file.Close()

	header, err := parsePLYHeader(file)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PLY header: %w", err)
	}

	points := make([]models.Point3D, 0, header.PointCount)

	if header.Format == "ascii" {
		points, err = parseASCIIData(file, header)
	} else if header.Format == "binary_little_endian" {
		points, err = parseBinaryData(file, header, binary.LittleEndian)
	} else if header.Format == "binary_big_endian" {
		points, err = parseBinaryData(file, header, binary.BigEndian)
	} else {
		return nil, fmt.Errorf("unsupported PLY format: %s", header.Format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to parse PLY data: %w", err)
	}

	return points, nil
}

func parsePLYHeader(file *os.File) (*PLYHeader, error) {
	reader := bufio.NewReader(file)
	header := &PLYHeader{
		Properties: make([]string, 0),
	}

	line, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimSpace(line)
	if line != "ply" {
		return nil, fmt.Errorf("invalid PLY file: missing 'ply' magic number")
	}

	for {
		line, err = reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)

		if line == "end_header" {
			pos, _ := file.Seek(0, io.SeekCurrent)
			header.DataStartPos = pos
			break
		}

		parts := strings.Fields(line)
		if len(parts) == 0 {
			continue
		}

		switch parts[0] {
		case "format":
			if len(parts) >= 3 {
				header.Format = parts[1]
				header.Version = parts[2]
			}
		case "element":
			if len(parts) >= 3 && parts[1] == "vertex" {
				header.PointCount, _ = strconv.Atoi(parts[2])
			}
		case "property":
			if len(parts) >= 3 {
				header.Properties = append(header.Properties, parts[2])
			}
		}
	}

	return header, nil
}

func parseASCIIData(file *os.File, header *PLYHeader) ([]models.Point3D, error) {
	scanner := bufio.NewScanner(file)
	points := make([]models.Point3D, 0, header.PointCount)

	xIdx := findIndex(header.Properties, "x")
	yIdx := findIndex(header.Properties, "y")
	zIdx := findIndex(header.Properties, "z")

	if xIdx == -1 || yIdx == -1 || zIdx == -1 {
		return nil, fmt.Errorf("PLY file missing x, y, or z properties")
	}

	for scanner.Scan() && len(points) < header.PointCount {
		line := scanner.Text()
		parts := strings.Fields(line)

		if len(parts) < len(header.Properties) {
			continue
		}

		x, _ := strconv.ParseFloat(parts[xIdx], 64)
		y, _ := strconv.ParseFloat(parts[yIdx], 64)
		z, _ := strconv.ParseFloat(parts[zIdx], 64)

		points = append(points, models.Point3D{X: x, Y: y, Z: z})
	}

	return points, scanner.Err()
}

func parseBinaryData(file *os.File, header *PLYHeader, byteOrder binary.ByteOrder) ([]models.Point3D, error) {
	if _, err := file.Seek(header.DataStartPos, io.SeekStart); err != nil {
		return nil, err
	}

	points := make([]models.Point3D, header.PointCount)
	stride := 4 * len(header.Properties)
	buf := make([]byte, stride)

	for i := 0; i < header.PointCount; i++ {
		if _, err := io.ReadFull(file, buf); err != nil {
			return nil, err
		}

		x := byteOrder.Uint32(buf[0:4])
		y := byteOrder.Uint32(buf[4:8])
		z := byteOrder.Uint32(buf[8:12])

		points[i] = models.Point3D{
			X: float64(*(*float32)(unsafe.Pointer(&x))),
			Y: float64(*(*float32)(unsafe.Pointer(&y))),
			Z: float64(*(*float32)(unsafe.Pointer(&z))),
		}
	}

	return points, nil
}

func findIndex(slice []string, target string) int {
	for i, s := range slice {
		if s == target {
			return i
		}
	}
	return -1
}
