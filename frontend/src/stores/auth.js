import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    token: null,
    apiKey: null,
    isLoading: false,
    oauthError: null,
    // From GET /auth/config: "none" (single user, no sign-in) or "oidc".
    authMode: null,
    providerName: null,
    loginUrl: null,
    serverUnreachable: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
  },
  actions: {
    setAuth(newToken, newUser, newApiKey = null) {
      this.token = newToken;
      this.user = newUser;
      this.apiKey = newApiKey;
      try {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
        if (newApiKey !== null) {
          localStorage.setItem("api_key", newApiKey);
        }
      } catch (e) {
        // ignore storage errors
        console.error("Failed to persist auth to localStorage:", e);
      }
    },
    clearAuth() {
      this.token = null;
      this.user = null;
      this.apiKey = null;
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("api_key");
      } catch (e) {
        console.error("Failed to clear localStorage:", e);
      }
    },
    initAuth() {
      try {
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");
        const storedApiKey = localStorage.getItem("api_key");
        if (storedToken && storedUser) {
          try {
            this.token = storedToken;
            this.user = JSON.parse(storedUser);
            this.apiKey = storedApiKey;
          } catch (e) {
            console.error("Failed to parse stored user data:", e);
            this.clearAuth();
          }
        }
      } catch (e) {
        // localStorage not available
        console.error("initAuth error:", e);
      }
    },
    setLoading(loading) {
      this.isLoading = loading;
    },
    setOauthError(message) {
      this.oauthError = message;
    },
    clearOauthError() {
      this.oauthError = null;
    },
    setAuthConfig(config) {
      this.authMode = config.mode;
      this.providerName = config.provider_name;
      this.loginUrl = config.login_url;
      this.serverUnreachable = false;
    },
    setServerUnreachable(value) {
      this.serverUnreachable = value;
    },
  },
});
