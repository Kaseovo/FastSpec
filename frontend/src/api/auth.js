/**
 * Authentication API client
 * Handles OAuth flows and user authentication
 */

import axios from "axios";

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
