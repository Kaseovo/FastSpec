import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// PrimeVue imports
import PrimeVue from 'primevue/config'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

const app = createApp(App)

app.use(router)
app.use(PrimeVue)

app.mount('#app')
