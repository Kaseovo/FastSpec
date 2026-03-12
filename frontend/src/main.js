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

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
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

app.mount("#app");
