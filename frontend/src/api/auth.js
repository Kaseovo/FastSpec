import axios from "axios";
import { useAuthStore } from "../stores/auth";

const API_BASE = "/auth"; // Backend API base URL TODO: Move to config

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/**
 * Ensure the Google Identity Services script is loaded.
 * Returns a Promise that resolves once `window.google` is available.
 */
const loadGISScript = () =>
  new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services script"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services script"));
    document.head.appendChild(script);
  });

/**
 * POST a Google ID token to the backend for verification.
 * Returns { access_token } on success.
 * @param {string} googleIdToken - The credential (id_token) from GIS
 * @returns {Promise<Object>} { access_token }
 */
export const verifyGoogleToken = async (googleIdToken) => {
  const response = await axios.post(`${API_BASE}/google/verify`, {
    id_token: googleIdToken,
  });
  return response.data;
};

/**
 * Trigger the Google Identity Services One-Tap / popup sign-in flow (PKCE).
 * Loads the GIS script, initialises google.accounts.id, and prompts the user.
 * On success, verifies the id_token with the backend and stores the JWT in
 * the auth store.
 *
 * @returns {Promise<void>} Resolves when auth has been stored, rejects on failure.
 */
export const loginWithGoogle = async () => {
  await loadGISScript();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const auth = useAuthStore();
          const { access_token } = await verifyGoogleToken(response.credential);
          const user = await getCurrentUser(access_token);
          auth.setAuth(access_token, user);
          resolve();
        } catch (err) {
          reject(err);
        }
      },
    });

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(
          new Error(
            notification.getNotDisplayedReason() ||
              notification.getSkippedReason() ||
              "Google sign-in was not displayed"
          )
        );
      }
    });
  });
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
    `${API_BASE}/refresh`,
    body,
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
 * Update actions (and optionally name) for an API key by id
 * PUT /auth/refresh/{id}/actions
 * @param {string} id
 * @param {Array<string>} actions
 * @param {string|null} name - optional new name (omitted means no change)
 * @returns {Promise<Object>}
 */
export const updateApiKeyActions = async (id, actions, name = undefined) => {
  const body = { actions };
  if (name !== undefined) body.name = name;
  const response = await axios.put(
    `${API_BASE}/refresh/${encodeURIComponent(id)}/actions`,
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
