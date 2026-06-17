import type {
  BIMModel,
  PointCloud,
  CrossSection,
  DeformationMeasurement,
  Alert,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '../types/api';

const API_BASE_URL = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const isFormData = options.body instanceof FormData;
  if (isFormData) {
    delete defaultHeaders['Content-Type'];
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const data = (await response.json()) as ApiResponse<T>;
    if (!data.success) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    return data.data as T;
  }

  return (await response.blob()) as T;
}

function buildQueryParams(params: Record<string, unknown> | object): string {
  const searchParams = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const bimApi = {
  getAll: (): Promise<BIMModel[]> =>
    request<BIMModel[]>('/bim-models'),

  getById: (id: string): Promise<BIMModel> =>
    request<BIMModel>(`/bim-models/${id}`),

  create: (data: Omit<BIMModel, 'id' | 'created_at'>): Promise<BIMModel> =>
    request<BIMModel>('/bim-models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: Partial<Omit<BIMModel, 'id' | 'created_at'>>
  ): Promise<BIMModel> =>
    request<BIMModel>(`/bim-models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<{ success: boolean }> =>
    request<{ success: boolean }>(`/bim-models/${id}`, {
      method: 'DELETE',
    }),
};

export const pointCloudApi = {
  getAll: (params?: { bim_model_id?: string }): Promise<PointCloud[]> =>
    request<PointCloud[]>(`/point-clouds${buildQueryParams(params || {})}`),

  getById: (id: string): Promise<PointCloud> =>
    request<PointCloud>(`/point-clouds/${id}`),

  download: (id: string): Promise<Blob> =>
    request<Blob>(`/point-clouds/${id}/download`),

  upload: (
    file: File,
    data: Omit<PointCloud, 'id' | 'file_path' | 'created_at' | 'point_count'>
  ): Promise<PointCloud> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bim_model_id', data.bim_model_id);
    formData.append('phase', data.phase);
    formData.append('capture_time', data.capture_time);

    return request<PointCloud>('/point-clouds/upload', {
      method: 'POST',
      body: formData,
    });
  },

  delete: (id: string): Promise<{ success: boolean }> =>
    request<{ success: boolean }>(`/point-clouds/${id}`, {
      method: 'DELETE',
    }),
};

export const crossSectionApi = {
  getAll: (params?: { bim_model_id?: string }): Promise<CrossSection[]> =>
    request<CrossSection[]>(`/cross-sections${buildQueryParams(params || {})}`),

  create: (
    data: Omit<CrossSection, 'id' | 'created_at'>
  ): Promise<CrossSection> =>
    request<CrossSection>('/cross-sections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<{ success: boolean }> =>
    request<{ success: boolean }>(`/cross-sections/${id}`, {
      method: 'DELETE',
    }),
};

export const analysisApi = {
  analyzeCrossSection: (data: {
    cross_section_id: string;
    point_cloud_id: string;
    position: number;
  }): Promise<DeformationMeasurement> =>
    request<DeformationMeasurement>('/analysis/cross-section', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMeasurements: (params?: {
    cross_section_id?: string;
    point_cloud_id?: string;
  }): Promise<DeformationMeasurement[]> =>
    request<DeformationMeasurement[]>(
      `/analysis/measurements${buildQueryParams(params || {})}`
    ),

  getMeasurementsPaginated: (
    params: {
      cross_section_id?: string;
      point_cloud_id?: string;
    } & PaginationParams
  ): Promise<PaginatedResponse<DeformationMeasurement>> =>
    request<PaginatedResponse<DeformationMeasurement>>(
      `/analysis/measurements${buildQueryParams(params)}`
    ),
};

export const alertApi = {
  getAll: (params?: { acknowledged?: boolean }): Promise<Alert[]> =>
    request<Alert[]>(`/alerts${buildQueryParams(params || {})}`),

  getPaginated: (
    params: { acknowledged?: boolean } & PaginationParams
  ): Promise<PaginatedResponse<Alert>> =>
    request<PaginatedResponse<Alert>>(`/alerts${buildQueryParams(params)}`),

  acknowledge: (id: string): Promise<Alert> =>
    request<Alert>(`/alerts/${id}/acknowledge`, {
      method: 'PUT',
    }),
};

export const api = {
  bim: bimApi,
  pointCloud: pointCloudApi,
  crossSection: crossSectionApi,
  analysis: analysisApi,
  alert: alertApi,
};

export default api;
