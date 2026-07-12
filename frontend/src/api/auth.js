import axios from "axios";
import { useAuthStore } from "../stores/auth";

const API_BASE = "/auth"; // Backend API base URL TODO: Move to config

/**
 * Start the Google sign-in flow (server-side Authorization Code flow).
 *
 * Performs a full-page redirect to the backend, which forwards to Google's
 * consent screen and, on success, redirects back to the log-in page with the
 * FastSpec JWT in the URL fragment. No popups — works in Brave and with
 * popup blockers enabled.
 */
export const loginWithGoogle = () => {
  window.location.href = `${API_BASE}/google/login`;
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
 * API keys via /auth/api-keys and use `id` as the identifier.
 */

/**
 * Create an API key (server returns the raw API key once)
 * POST /auth/api-keys
 * @param {Array<string>} actions - e.g. ['A','B']
 * @param {string|null} name - optional user-defined label
 * @returns {Promise<Object>} Created API key data { api_key, id, expires_at }
 */
export const createApiKey = async (actions, name = null) => {
  const normalized = (actions || [])
    .map((a) => (typeof a === "string" ? a : (a && a.value) || a || ""))
    .filter(Boolean);

  const body = { actions: normalized };
  if (name) body.name = name;

  const response = await axios.post(
    `${API_BASE}/api-keys`,
    body,
    { headers: getAuthHeaders() },
  );

  // backend returns { api_key: raw, id, expires_at }
  // the raw api key is shown once by the backend; return the full response
  return response.data;
};

/**
 * List API keys for the current user
 * GET /auth/api-keys
 * @returns {Promise<Array>} List of API key objects
 */
export const listApiKeys = async () => {
  const response = await axios.get(`${API_BASE}/api-keys`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Revoke an API key by id
 * DELETE /auth/api-keys/{id}
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const revokeApiKey = async (id) => {
  const response = await axios.delete(
    `${API_BASE}/api-keys/${encodeURIComponent(id)}`,
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * Update actions (and optionally name) for an API key by id
 * PUT /auth/api-keys/{id}/actions
 * @param {string} id
 * @param {Array<string>} actions
 * @param {string|null} name - optional new name (omitted means no change)
 * @returns {Promise<Object>}
 */
export const updateApiKeyActions = async (id, actions, name = undefined) => {
  const body = { actions };
  if (name !== undefined) body.name = name;
  const response = await axios.put(
    `${API_BASE}/api-keys/${encodeURIComponent(id)}/actions`,
    body,
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * Fetch the list of available actions that can be assigned to API keys
 * @returns {Promise<Array<{value: string, description: string}>>}
 */
export const fetchAvailableActions = async () => {
  const response = await axios.get(`${API_BASE}/actions`);
  return response.data;
};
