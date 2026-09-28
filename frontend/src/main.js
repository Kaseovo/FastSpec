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

import { useAuthStore } from "./stores/auth";
import { bootstrapSession } from "./auth/session";
import { waitForDatabase } from "./api/databaseWake";
import WakingScreen from "./components/WakingScreen.vue";

const bootApp = async () => {
  // The hosted version's database sleeps when unused. Wake it before
  // anything needs it; the waking-up screen shows only if it was asleep.
  const wakingScreen = createApp(WakingScreen);
  wakingScreen.mount("#app");
  await waitForDatabase();
  wakingScreen.unmount();

  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // Restore the session from localStorage, finish a sign-in redirect if we
  // just came back from the identity provider, and learn how this instance
  // signs in — all before the router takes its first navigation.
  const auth = useAuthStore();
  auth.initAuth();
  await bootstrapSession();

  // Imported only now: vue-router reads the address bar when it's created,
  // and must not see (and restore) the sign-in callback URL carrying the
  // token, which bootstrapSession has just replaced.
  const { default: router } = await import("./router");
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
  };

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Unhandled Rejection]", event.reason);
  });

  app.mount("#app");
};

bootApp();
