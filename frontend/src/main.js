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

const bootApp = async () => {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(router);

  // Restore session from localStorage
  const auth = useAuthStore();
  auth.initAuth();

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
