CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE bim_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    length DECIMAL(10,3) NOT NULL,
    width DECIMAL(10,3) NOT NULL,
    height DECIMAL(10,3) NOT NULL,
    axis_points JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE point_clouds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bim_model_id UUID REFERENCES bim_models(id) ON DELETE CASCADE,
    phase VARCHAR(50) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    point_count INTEGER NOT NULL,
    capture_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bim_model_id, phase)
);

CREATE TABLE cross_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bim_model_id UUID REFERENCES bim_models(id) ON DELETE CASCADE,
    position DECIMAL(10,3) NOT NULL,
    baseline_width DECIMAL(10,3) NOT NULL,
    baseline_height DECIMAL(10,3) NOT NULL,
    baseline_ellipse JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bim_model_id, position)
);

CREATE TABLE deformation_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cross_section_id UUID REFERENCES cross_sections(id) ON DELETE CASCADE,
    point_cloud_id UUID REFERENCES point_clouds(id) ON DELETE CASCADE,
    convergence DECIMAL(10,3) NOT NULL,
    settlement DECIMAL(10,3) NOT NULL,
    max_deviation DECIMAL(10,3) NOT NULL,
    avg_deviation DECIMAL(10,3) NOT NULL,
    ellipse_params JSONB NOT NULL,
    deviation_stats JSONB NOT NULL,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cross_section_id, point_cloud_id)
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    measurement_id UUID REFERENCES deformation_measurements(id) ON DELETE CASCADE,
    user_id UUID,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    threshold DECIMAL(10,3) NOT NULL,
    actual_value DECIMAL(10,3) NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_point_clouds_bim_model ON point_clouds(bim_model_id);
CREATE INDEX idx_cross_sections_bim_model ON cross_sections(bim_model_id);
CREATE INDEX idx_measurements_cross_section ON deformation_measurements(cross_section_id);
CREATE INDEX idx_measurements_point_cloud ON deformation_measurements(point_cloud_id);
CREATE INDEX idx_alerts_measurement ON alerts(measurement_id);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

INSERT INTO users (username, role, email, password_hash) VALUES
('admin', 'admin', 'admin@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
('engineer', 'engineer', 'engineer@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
