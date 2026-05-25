import axios from "axios";
import { useAuthStore } from "../stores/auth";

const LINT_BASE = "/api/lint";

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

/**
 * Fetch the current user's custom lint ruleset.
 * Resolves to the ruleset object, or null if none is configured (404).
 *
 * @returns {Promise<{rules: Array|null, raw_yaml: string|null, updated_at: string|null}|null>}
 */
export const getLintRuleset = async () => {
  try {
    const response = await lintApi.get("/ruleset");
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Create or replace the current user's custom lint ruleset.
 *
 * @param {{ rules?: Array, raw_yaml?: string }} payload
 * @returns {Promise<{rules: Array|null, raw_yaml: string|null, updated_at: string|null}>}
 */
export const putLintRuleset = async (payload) => {
  const response = await lintApi.put("/ruleset", payload);
  return response.data;
};

/**
 * Delete the current user's custom lint ruleset.
 * Subsequent lint runs will fall back to the default spectral:oas ruleset.
 *
 * @returns {Promise<void>}
 */
export const deleteLintRuleset = async () => {
  await lintApi.delete("/ruleset");
};
