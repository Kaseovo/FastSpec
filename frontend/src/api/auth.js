import axios from "axios";
import { useAuthStore } from "../stores/auth";

const API_BASE = "/auth"; // Backend API base URL TODO: Move to config

/**
 * Redirect to Google OAuth login
 */
export const loginWithGoogle = () => {
  window.location.href = `${API_BASE}/google`;
};

/**
 * Redirect to GitHub OAuth login
 */
export const loginWithGitHub = () => {
  window.location.href = `${API_BASE}/github`;
};

/**
 * Get current user information
 * @param {string} token - JWT access token
 * @returns {Promise<Object>} User data
 */
export const getCurrentUser = async (token) => {
  const response = await axios.get(`${API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

/**
 * Logout (client-side token removal)
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  const response = await axios.post(`${API_BASE}/logout`);
  return response.data;
};

// Helper to build auth headers using the auth store
const getAuthHeaders = () => {
  try {
    const auth = useAuthStore();
    const t = auth.token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch (e) {
    return {};
  }
};

/**
 * Token APIs removed: only API key APIs and OAuth login functions remain.
 */

/**
 * --- API Key management ---
 * The following functions mirror the custom token endpoints but operate on
 * API keys via /auth/refresh and use `id` as the identifier.
 */

/**
 * Create an API key (server returns the raw API key once)
 * POST /auth/refresh
 * @param {Array<string>} actions - e.g. ['A','B']
 * @returns {Promise<Object>} Created API key data { api_key, id, expires_at }
 */
export const createApiKey = async (actions) => {
  const normalized = (actions || [])
    .map((a) => (typeof a === "string" ? a : (a && a.value) || a || ""))
    .filter(Boolean);

  const allowed = ["A", "B"];
  const filtered = normalized.filter((a) => allowed.includes(a));
  if (filtered.length !== normalized.length) {
    throw new Error("Invalid actions");
  }

  const response = await axios.post(
    `${API_BASE}/refresh`,
    { actions: filtered },
    { headers: getAuthHeaders() },
  );

  // backend returns { refresh_token: raw, id, expires_at }
  // the raw refresh token is shown once by the backend; return the full response
  return response.data;
};

/**
 * List API keys for the current user
 * GET /auth/refresh
 * @returns {Promise<Array>} List of API key objects
 */
export const listApiKeys = async () => {
  const response = await axios.get(`${API_BASE}/refresh`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Revoke an API key by id
 * DELETE /auth/refresh/{id}
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const revokeApiKey = async (id) => {
  const response = await axios.delete(
    `${API_BASE}/refresh/${encodeURIComponent(id)}`,
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * Update actions for an API key by id
 * PUT /auth/refresh/{id}/actions
 * @param {string} id
 * @param {Array<string>} actions
 * @returns {Promise<Object>}
 */
export const updateApiKeyActions = async (id, actions) => {
  const response = await axios.put(
    `${API_BASE}/refresh/${encodeURIComponent(id)}/actions`,
    { actions },
    { headers: getAuthHeaders() },
  );
  return response.data;
};
