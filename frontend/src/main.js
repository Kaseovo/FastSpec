import { createApp } from "vue";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import App from "./App.vue";

// PrimeVue CSS
import "primevue/resources/themes/lara-light-blue/theme.css";
import "primevue/resources/primevue.min.css";
import "primeicons/primeicons.css";

const app = createApp(App);
app.use(PrimeVue);
app.use(ConfirmationService);
app.mount("#app");
