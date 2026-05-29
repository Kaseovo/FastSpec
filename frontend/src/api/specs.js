import axios from "axios";
import { useAuthStore } from "../stores/auth";

const API_BASE = "/api/specs";
const LINT_BASE = "/api/lint";

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE,
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const auth = useAuthStore();
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
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
      const auth = useAuthStore();
      auth.clearAuth();
      // Redirect to login page
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

// Separate axios instance for lint endpoints
const lintApi = axios.create({ baseURL: LINT_BASE });
lintApi.interceptors.request.use(
  (config) => {
    const auth = useAuthStore();
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);
lintApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore();
      auth.clearAuth();
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
  // Accept version from modal (versionChoice) if not directly provided
  let version = data.version;
  if (!version) throw new Error("Version is required to create a spec");
  const payload = { ...data, version };
  if (payload.versionChoice) delete payload.versionChoice;
  const response = await api.post("/", payload, {
    params: { version },
  });
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

  // Only allow name and version update
  const updatePayload = { name: payload.name, version: payload.version };
  const response = await api.put(`/${id}`, updatePayload);
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

export const getSpecVersion = async (specId, versionId) => {
  const response = await api.get(`/${specId}/versions/${versionId}`);
  return response.data;
};

export const updateSpecVersion = async (specId, versionId, payload) => {
  const response = await api.put(`/${specId}/versions/${versionId}`, payload);
  return response.data;
};

export const deleteSpecVersion = async (specId, versionId) => {
  await api.delete(`/${specId}/versions/${versionId}`);
};

export const compareSpecVersions = async (specId, base, compare) => {
  const response = await api.post(`/${specId}/compare`, { base, compare });
  return response.data; // { base, compare, diff }
};

/**
 * Compare an unsaved draft (provided inline) against a stored base version.
 * POST /api/specs/{specId}/compare with { base, compare_content, options }
 * Returns: { base, compare, diff } or { base, compare, markdown }
 */
export const compareDraftWithVersion = async (
  specId,
  baseVersionId,
  draftContent,
  options = {},
) => {
  const payload = {
    base: baseVersionId,
    compare_content: draftContent,
    options,
  };
  const response = await api.post(`/${specId}/compare`, payload);
  return response.data;
};

// --
export const publishSpecVersion = async (specId, versionId) => {
  const response = await api.post(`/${specId}/versions/${versionId}/publish`);
  return response.data;
};

// Fetch the public OpenAPI file served from the frontend (Vite public folder)
export const fetchOpenApi = async () => {
  const response = await axios.get("/api/openapi.json");
  return response.data;
};

// ── Lint endpoints ────────────────────────────────────────────────────────────

/**
 * Lint a stored spec by its database ID.
 * POST /api/lint/{specId}?ruleset=spectral:oas
 * Returns: { score, summary, results }
 */
export const lintSpecById = async (
  specId,
  version,
  ruleset = "spectral:oas",
) => {
  if (!version) throw new Error("Version is required for linting");
  const response = await lintApi.post(`/${specId}`, null, {
    params: { version, ruleset },
  });
  return response.data;
};

/**
 * Lint an ad-hoc spec JSON without saving it.
 * POST /api/lint
 * Returns: { score, summary, results }
 */
export const lintSpec = async (specJson, ruleset = "spectral:oas") => {
  const response = await lintApi.post("", { spec_json: specJson, ruleset });
  return response.data;
};
