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
app.mount("#app");
