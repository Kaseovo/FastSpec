import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface OpenAPISpec {
  id: number;
  name: string;
  title: string;
  version: string;
  spec_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const specApi = {
  // List all specs
  listSpecs: async (): Promise<OpenAPISpec[]> => {
    const response = await api.get('/api/specs');
    return response.data;
  },

  // Get a single spec
  getSpec: async (id: number): Promise<OpenAPISpec> => {
    const response = await api.get(`/api/specs/${id}`);
    return response.data;
  },

  // Create a new spec
  createSpec: async (name: string, spec_json: Record<string, unknown>): Promise<OpenAPISpec> => {
    const response = await api.post('/api/specs', { name, spec_json });
    return response.data;
  },

  // Update a spec
  updateSpec: async (id: number, updates: { name?: string; spec_json?: Record<string, unknown> }): Promise<OpenAPISpec> => {
    const response = await api.put(`/api/specs/${id}`, updates);
    return response.data;
  },

  // Delete a spec
  deleteSpec: async (id: number): Promise<void> => {
    await api.delete(`/api/specs/${id}`);
  },

  // Validate a spec
  validateSpec: async (spec_json: Record<string, unknown>): Promise<ValidationResponse> => {
    const response = await api.post('/api/validate', spec_json);
    return response.data;
  },

  // Get diff between current and previous version
  getDiff: async (id: number, format: 'json' | 'markdown' = 'json'): Promise<unknown> => {
    const response = await api.get(`/api/specs/${id}/diff`, { params: { format } });
    return response.data;
  },
};
