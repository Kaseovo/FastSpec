/**
 * Authentication store using Vue 3 Composition API
 * Manages user authentication state and JWT tokens and API Key storage
 */

import { ref, computed } from "vue";

// Reactive state
const user = ref(null);
const token = ref(null);
const apiKey = ref(null);
const isLoading = ref(false);

/**
 * Authentication composable
 * @returns {Object} Auth state and methods
 */
export function useAuth() {
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  /**
   * Set authentication data
   * @param {string} newToken - JWT access token
   * @param {Object} newUser - User data
   * @param {string} newApiKey - API key (optional)
   */
  const setAuth = (newToken, newUser, newApiKey = null) => {
    token.value = newToken;
    user.value = newUser;
    apiKey.value = newApiKey;
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    if (newApiKey !== null) {
      localStorage.setItem("api_key", newApiKey);
    }
  };

  /**
   * Clear authentication data
   */
  const clearAuth = () => {
    token.value = null;
    user.value = null;
    apiKey.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("api_key");
  };

  /**
   * Initialize auth from localStorage
   */
  const initAuth = () => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const storedApiKey = localStorage.getItem("api_key");

    if (storedToken && storedUser) {
      try {
        token.value = storedToken;
        user.value = JSON.parse(storedUser);
        apiKey.value = storedApiKey;
      } catch (e) {
        console.error("Failed to parse stored user data:", e);
        clearAuth();
      }
    }
  };

  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   */
  const setLoading = (loading) => {
    isLoading.value = loading;
  };

  return {
    // State
    user,
    token,
    apiKey,
    isLoading,
    isAuthenticated,

    // Methods
    setAuth,
    clearAuth,
    initAuth,
    setLoading,
  };
}
