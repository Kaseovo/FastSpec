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
 * List the current user's lint rulesets (lightweight summaries).
 *
 * @returns {Promise<Array<{id: string, name: string, is_default: boolean, rule_count: number, has_raw_yaml: boolean, updated_at: string|null}>>}
 */
export const listLintRulesets = async () => {
  const response = await lintApi.get("/rulesets");
  return response.data;
};

/**
 * Fetch one lint ruleset in full (rules + raw_yaml).
 *
 * @param {string} rulesetId
 * @returns {Promise<{id: string, name: string, is_default: boolean, rules: Array|null, raw_yaml: string|null, updated_at: string|null}>}
 */
export const getLintRuleset = async (rulesetId) => {
  const response = await lintApi.get(`/rulesets/${rulesetId}`);
  return response.data;
};

/**
 * Create a new named lint ruleset. The first ruleset a user creates
 * automatically becomes their default.
 *
 * @param {{ name: string, rules?: Array, raw_yaml?: string }} payload
 */
export const createLintRuleset = async (payload) => {
  const response = await lintApi.post("/rulesets", payload);
  return response.data;
};

/**
 * Update a ruleset's name and/or rule content.
 *
 * @param {string} rulesetId
 * @param {{ name?: string, rules?: Array, raw_yaml?: string }} payload
 */
export const updateLintRuleset = async (rulesetId, payload) => {
  const response = await lintApi.put(`/rulesets/${rulesetId}`, payload);
  return response.data;
};

/**
 * Delete a ruleset. Fails with 409 if it's assigned to a spec, or if it's
 * the default ruleset and other rulesets exist.
 *
 * @param {string} rulesetId
 */
export const deleteLintRuleset = async (rulesetId) => {
  await lintApi.delete(`/rulesets/${rulesetId}`);
};

/**
 * Mark a ruleset as the user's default (unsets the previous default).
 *
 * @param {string} rulesetId
 */
export const setDefaultLintRuleset = async (rulesetId) => {
  const response = await lintApi.post(`/rulesets/${rulesetId}/set-default`);
  return response.data;
};

/**
 * Pin (or clear) which ruleset a spec should be linted against.
 *
 * @param {string} specId
 * @param {string|null} rulesetId - pass null to fall back to the user's default ruleset
 */
export const assignSpecRuleset = async (specId, rulesetId) => {
  await lintApi.put(`/spec/${specId}/ruleset`, { ruleset_id: rulesetId });
};

/**
 * Test a single unsaved draft rule against spec content, without saving it
 * or running the full ruleset. Used for immediate per-rule authoring feedback.
 *
 * @param {object} specJson
 * @param {object} rule - a StructuredRule shape (name, severity, given, then_function, ...)
 * @returns {Promise<{score: number, summary: object, results: Array}>}
 */
export const previewLintRule = async (specJson, rule) => {
  const response = await lintApi.post("/preview-rule", {
    spec_json: specJson,
    rule,
  });
  return response.data;
};
