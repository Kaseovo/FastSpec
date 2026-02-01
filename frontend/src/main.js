import { createApp } from "vue";
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
const urlParams = new URLSearchParams(window.location.search);
const isCallback = urlParams.has("token") || urlParams.has("error");

// Use callback component if this is a callback, otherwise use main app
const rootComponent = isCallback ? OAuthCallback : App;

const app = createApp(rootComponent);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.use(ConfirmationService);
app.use(ToastService);
app.directive("tooltip", Tooltip);
app.mount("#app");
