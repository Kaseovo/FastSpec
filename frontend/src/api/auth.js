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
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("At least one action must be selected");
  }
  const allowed = ["A", "B"];
  const filtered = actions.filter((a) => allowed.includes(a));
  if (filtered.length !== actions.length) {
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
 * Refresh a token by JTI (issue a new token for same jti/actions)
 * @param {string} jti
 * @returns {Promise<Object>} { token, expires_at, ... }
 */
export const refreshToken = async (jti) => {
  const response = await axios.post(
    `${API_BASE}/tokens/${encodeURIComponent(jti)}/refresh`,
    null,
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
