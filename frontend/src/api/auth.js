import { createApiClient } from "./http";

// Sign-in itself (OIDC redirect, single-user session) lives in
// ../auth/session.js; this module covers the authenticated /auth endpoints.
const authApi = createApiClient("/auth");

/**
 * Revoke the current session server-side.
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  const response = await authApi.post("/logout");
  return response.data;
};

/**
 * --- API Key management ---
 * Long-lived keys for MCP clients, via /auth/api-keys, identified by `id`.
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

  // The raw api key is shown once by the backend; return the full response.
  const response = await authApi.post("/api-keys", body);
  return response.data;
};

/**
 * List API keys for the current user
 * GET /auth/api-keys
 * @returns {Promise<Array>} List of API key objects
 */
export const listApiKeys = async () => {
  const response = await authApi.get("/api-keys");
  return response.data;
};

/**
 * Revoke an API key by id
 * DELETE /auth/api-keys/{id}
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const revokeApiKey = async (id) => {
  const response = await authApi.delete(`/api-keys/${encodeURIComponent(id)}`);
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
  const response = await authApi.put(`/api-keys/${encodeURIComponent(id)}/actions`, body);
  return response.data;
};

/**
 * Fetch the list of available actions that can be assigned to API keys
 * @returns {Promise<Array<{value: string, description: string}>>}
 */
export const fetchAvailableActions = async () => {
  const response = await authApi.get("/actions");
  return response.data;
};
