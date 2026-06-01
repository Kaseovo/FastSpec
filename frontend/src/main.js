import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import Aura from "@primevue/themes/aura";
import App from "./App.vue";
import OAuthCallback from "./components/OAuthCallback.vue";
// PrimeIcons
import "primeicons/primeicons.css";

// Check if this is an OAuth callback
import router from "./router";
import { useAuthStore } from "./stores/auth";
import { getCurrentUser } from "./api/auth";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
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
  try {
    // attempt to use provided alerts if available
    const alerts = app._context.provides?.alerts;
    if (alerts?.showAlert)
      alerts.showAlert("Unexpected error occurred", "error");
  } catch (e) {
    console.error("Failed to notify user via alerts", e);
  }
  // TODO: integrate with remote error reporting (Sentry/Datadog)
};

// Catch unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Rejection]", event.reason);
  try {
    const alerts = app._context.provides?.alerts;
    if (alerts?.showAlert)
      alerts.showAlert(event.reason?.message || "An error occurred", "error");
  } catch (e) {
    console.error("Failed to notify user of unhandledrejection", e);
  }
  // prevent the default logging (optional)
  // event.preventDefault();
});

// Handle token passed to root URL (backend redirects to /?token=...)
const handleRootToken = async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const errorParam = params.get("error");
  if (!token && !errorParam) return;

  const auth = useAuthStore();
  auth.setLoading(true);
  try {
    if (errorParam) {
      console.error("OAuth error:", errorParam);
      auth.setOauthError(errorParam);
    } else if (token) {
      const user = await getCurrentUser(token);
      auth.setAuth(token, user);
      // remove token from URL so it isn't visible
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
      await router.push({ name: "editor" }).catch(() => {});
    }
  } catch (err) {
    console.error("OAuth callback processing failed:", err);
  } finally {
    auth.setLoading(false);
  }
};

app.mount("#app");

// Run token handler after mount
handleRootToken();
