import axios from "axios";
import { useAuth } from "../stores/auth";

const API_BASE = "/api/specs";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const { token } = useAuth();
    if (token.value) {
      config.headers.Authorization = `Bearer ${token.value}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const { clearAuth } = useAuth();
      clearAuth();
      // Redirect to login page
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export const fetchSpecs = async () => {
  const response = await api.get("/");
  return response.data;
};

export const fetchSpec = async (id) => {
  const response = await api.get(`/${id}`);
  return response.data;
};

export const createSpec = async (data) => {
  const response = await api.post("/", data);
  return response.data;
};

export const updateSpec = async (id, data) => {
  // Ensure we send a version field required by backend. If caller passed a
  // versionChoice (from SaveDialog), map it into the payload.version field.
  const payload = { ...data };
  if (!payload.version && payload.versionChoice) {
    payload.version = payload.versionChoice.version;
    delete payload.versionChoice;
  }

  const response = await api.put(`/${id}`, payload);
  return response.data;
};

export const deleteSpec = async (id) => {
  await api.delete(`/${id}`);
};

export const validateSpec = async (spec_json) => {
  const response = await api.post("/validate", spec_json);
  return response.data;
};

export const fetchDiff = async (id, format = "json") => {
  const response = await api.get(`/${id}/diff`, {
    params: { format },
  });
  return response.data;
};

// Spec versions endpoints
export const listSpecVersions = async (specId) => {
  const response = await api.get(`/${specId}/versions`);
  return response.data;
};

export const createSpecVersion = async (specId, payload) => {
  // payload: { version: string, content: object, metadata?: object }
  const response = await api.post(`/${specId}/versions`, payload);
  return response.data;
};

export const getSpecVersion = async (specId, versionOrId) => {
  const response = await api.get(`/${specId}/versions/${versionOrId}`);
  return response.data;
};

export const deleteSpecVersion = async (specId, versionOrId) => {
  await api.delete(`/${specId}/versions/${versionOrId}`);
};

export const compareSpecVersions = async (specId, base, compare) => {
  const response = await api.post(`/${specId}/compare`, { base, compare });
  return response.data; // { base, compare, diff }
};

export const publishSpecVersion = async (specId, versionOrId) => {
  const response = await api.post(`/${specId}/versions/${versionOrId}/publish`);
  return response.data;
};

// Fetch the public OpenAPI file served from the frontend (Vite public folder)
export const fetchOpenApi = async () => {
  const response = await axios.get("/openapi.json");
  return response.data;
};
