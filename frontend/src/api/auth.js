/**
 * Authentication API client
 * Handles OAuth flows and user authentication
 */

import axios from "axios";
import { useAuth } from "../stores/auth";

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
    const { token } = useAuth();
    const t = token.value;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch (e) {
    return {};
  }
};

/**
 * Create a short-lived custom token with allowed actions
 * @param {Array<string>} actions - e.g. ['A','B']
 * @returns {Promise<Object>} Created token data { token, jti, expires_at, ... }
 */
export const createToken = async (actions) => {
  // Normalize incoming actions to strings (support object items) before validation.
  // Fallback to empty-string which is filtered out.
  const normalized = (actions || [])
    .map((a) => (typeof a === "string" ? a : (a && a.value) || a || ""))
    .filter(Boolean);

  // if (normalized.length === 0) {
  //   throw new Error("At least one action must be selected");
  // }
  const allowed = ["A", "B"];
  const filtered = normalized.filter((a) => allowed.includes(a));
  if (filtered.length !== normalized.length) {
    throw new Error("Invalid actions");
  }

  const response = await axios.post(
    `${API_BASE}/tokens`,
    { actions: filtered },
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * List existing custom tokens
 * @returns {Promise<Array>} List of token objects
 */
export const listTokens = async () => {
  const response = await axios.get(`${API_BASE}/tokens`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Revoke a token by JTI
 * @param {string} jti
 * @returns {Promise<Object>}
 */
export const revokeToken = async (jti) => {
  const response = await axios.delete(
    `${API_BASE}/tokens/${encodeURIComponent(jti)}`,
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * Update authorized actions for an existing token
 * PUT /auth/tokens/{jti}/actions
 * @param {string} jti
 * @param {Array<string>} actions - e.g. ['A','B']
 * @returns {Promise<Object>}
 */
export const updateTokenActions = async (jti, actions) => {
  const response = await axios.put(
    `${API_BASE}/tokens/${encodeURIComponent(jti)}/actions`,
    { actions },
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * Introspect a token string
 * @param {string} token
 * @returns {Promise<Object>} Introspection result
 */
export const introspectToken = async (token) => {
  const response = await axios.post(
    `${API_BASE}/tokens/introspect`,
    { token },
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * --- Refresh token management ---
 * The following functions mirror the custom token endpoints but operate on
 * refresh tokens via /auth/refresh and use `id` as the identifier.
 */

/**
 * Create a refresh token (server returns the raw refresh token once)
 * POST /auth/refresh
 * @param {Array<string>} actions - e.g. ['A','B']
 * @returns {Promise<Object>} Created refresh token data { refresh_token, id, expires_at }
 */
export const createRefreshToken = async (actions) => {
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
 * List refresh tokens for the current user
 * GET /auth/refresh
 * @returns {Promise<Array>} List of refresh token objects
 */
export const listRefreshTokens = async () => {
  const response = await axios.get(`${API_BASE}/refresh`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Revoke a refresh token by id
 * DELETE /auth/refresh/{id}
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const revokeRefreshToken = async (id) => {
  const response = await axios.delete(
    `${API_BASE}/refresh/${encodeURIComponent(id)}`,
    { headers: getAuthHeaders() },
  );
  return response.data;
};

/**
 * Update actions for a refresh token by id
 * PUT /auth/refresh/{id}/actions
 * @param {string} id
 * @param {Array<string>} actions
 * @returns {Promise<Object>}
 */
export const updateRefreshTokenActions = async (id, actions) => {
  const response = await axios.put(
    `${API_BASE}/refresh/${encodeURIComponent(id)}/actions`,
    { actions },
    { headers: getAuthHeaders() },
  );
  return response.data;
};
