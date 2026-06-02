import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import Aura from "@primevue/themes/aura";
import App from "./App.vue";
// PrimeIcons
import "primeicons/primeicons.css";

import router from "./router";
import { useAuthStore } from "./stores/auth";
import { getCurrentUser } from "./api/auth";

// Handle token passed via ?token= before mounting so the router guard
// never fires while unauthenticated on the /specs route.
const bootApp = async () => {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(router);

  // Restore session from localStorage first
  const auth = useAuthStore();
  auth.initAuth();

  // If a ?token= is present (OAuth redirect), exchange it for a user session
  // before the router guard runs, so isAuthenticated is true on first check.
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const errorParam = params.get("error");

  if (errorParam) {
    console.error("OAuth error:", errorParam);
    auth.setOauthError(errorParam);
    // Clean the URL
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  } else if (token) {
    try {
      auth.setLoading(true);
      const user = await getCurrentUser(token);
      auth.setAuth(token, user);
      // Clean the token from the URL before the router resolves
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      console.error("OAuth callback processing failed:", err);
    } finally {
      auth.setLoading(false);
    }
  }

  app.use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: false,
      },
      cssLayer: false,
    },
    pt: {
      button: {
        root: {
          style: 'border-radius: 8px; font-weight: 500;',
        },
      },
    },
  });
  app.use(ConfirmationService);
  app.use(ToastService);
  app.directive("tooltip", Tooltip);

  // Global Vue error handler
  app.config.errorHandler = (err, instance, info) => {
    console.error("[Global Error]", { err, info });
  };

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Unhandled Rejection]", event.reason);
  });

  app.mount("#app");
};

bootApp();

