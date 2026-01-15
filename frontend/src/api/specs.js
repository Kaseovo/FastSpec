import axios from "axios";
import { useAuth } from "../stores/auth";

const API_BASE = "/api";

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
  }
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
  }
);

export const fetchSpecs = async () => {
  const response = await api.get("/specs");
  return response.data;
};

export const fetchSpec = async (id) => {
  const response = await api.get(`/specs/${id}`);
  return response.data;
};

export const createSpec = async (data) => {
  const response = await api.post("/specs", data);
  return response.data;
};

export const updateSpec = async (id, data) => {
  const response = await api.put(`/specs/${id}`, data);
  return response.data;
};

export const deleteSpec = async (id) => {
  await api.delete(`/specs/${id}`);
};

export const validateSpec = async (spec_json) => {
  const response = await api.post("/validate", spec_json);
  return response.data;
};

export const fetchDiff = async (id, format = "json") => {
  const response = await api.get(`/specs/${id}/diff`, {
    params: { format },
  });
  return response.data;
};

// Fetch the public OpenAPI file served from the frontend (Vite public folder)
export const fetchOpenApi = async () => {
  const response = await axios.get("/openapi.json");
  return response.data;
};
