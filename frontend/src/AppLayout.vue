<template>
  <div id="app">
    <PagePrototypeHost v-if="isDev && route.query.pageVariant && auth.isAuthenticated" />

    <template v-else>
      <AppHeader />

      <div v-if="!auth.isAuthenticated" class="main-content">
        <div class="signed-out-card">
          <i class="pi pi-lock signed-out-icon"></i>
          <h2>Sign in to continue</h2>
          <p>Sign in with Google to create, edit, and save OpenAPI specifications.</p>
          <Button label="Sign in with Google" icon="pi pi-google" @click="loginWithGoogle" />
        </div>
      </div>

      <div v-else class="main-content">
        <Toolbar @load-template="loadTemplate" />


        <Message v-if="alert.show" :severity="alert.type" @close="closeAlert">
          {{ alert.message }}
        </Message>

        <div class="view-mode-toggle">
          <SelectButton
            :modelValue="selectedView"
            :options="viewModeOptions"
            optionLabel="label"
            optionValue="value"
            optionDisabled="disabled"
            dataKey="value"
            @update:modelValue="onViewChange"
          >
            <template #option="slotProps">
              <span class="flex align-items-center gap-2">
                <i :class="slotProps.option.icon" />
                {{ slotProps.option.label }}
              </span>
            </template>
          </SelectButton>
        </div>

        <div class="editor-container">
          <router-view />
        </div>
      </div>
    </template>

    <SaveDialog
      :visible="showSaveDialog"
      @update:visible="showSaveDialog = $event"
      :spec-name="currentSpec?.name || ''"
      :spec-id="currentSpec?.id || null"
      :current-version="currentSpec?.version || null"
      :draft-content="parsedSpec"
      @save="saveSpec"
    />

    <!-- Token Manager Dialog -->
    <Dialog
      :visible="showTokenDialog"
      @update:visible="showTokenDialog = $event"
      header="Manage Tokens"
      :modal="true"
      :style="{ width: '1200px' }"
    >
      <TokenManager />
    </Dialog>

    <ConfirmDialog />
    <Toast />
  </div>
</template>

<script>
import Message from "primevue/message";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";
import SelectButton from "primevue/selectbutton";
import Toolbar from "./components/Toolbar.vue";
import SaveDialog from "./components/SaveDialog.vue";
import TokenManager from "./components/TokenManager.vue";
import AppHeader from "./AppHeader.vue";
import PagePrototypeHost from "./components/page-prototype/PagePrototypeHost.vue";
import { computed, ref, provide, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApp } from "./composables/useApp";
import { useAuthStore } from "./stores/auth";
import { useToast } from "primevue/usetoast";
import { validateSpec } from "./api/specs";
import { loginWithGoogle } from "./api/auth";

export default {
  name: "AppLayout",
  components: {
    Message,
    Button,
    Dialog,
    ConfirmDialog,
    Toast,
    SelectButton,
    Toolbar,
    SaveDialog,
    TokenManager,
    AppHeader,
    PagePrototypeHost,
  },
  setup() {
    const app = useApp();
    const auth = useAuthStore();
    const route = useRoute();
    const router = useRouter();

    // UI state moved from useApp
    const showTokenDialog = ref(false);
    const viewModeOptions = ref([
      { label: "Form", value: "form", icon: "pi pi-list" },
      { label: "Code", value: "code", icon: "pi pi-code" },
      { label: "Preview", value: "preview", icon: "pi pi-eye" },
      { label: "Lint", value: "lint", icon: "pi pi-search" },
    ]);

    // Lifecycle moved from useApp
    const toast = useToast();
    onMounted(() => {
      if (auth.isAuthenticated) {
        app.fetchOpenApiFile().catch(() => {});
      }
      if (auth.oauthError) {
        toast.add({
          severity: "error",
          summary: "Sign-in failed",
          detail: auth.oauthError,
          life: 8000,
        });
        auth.clearOauthError();
      }
    });

    // Provides moved from useApp
    provide("showTokenDialog", () => (showTokenDialog.value = true));

    const specEditor = app.specEditor ?? null;
    provide("validateCurrentSpec", async () => {
      try {
        const spec_json = JSON.parse(app.specContent.value);
        const result = await validateSpec(spec_json);
        if (result.valid)
          toast.add({ severity: "success", summary: "Valid", detail: "✓ Specification is valid!", life: 4000 });
        else
          toast.add({ severity: "error", summary: "Invalid", detail: "Validation failed", life: 4000 });
      } catch (e) {
        toast.add({ severity: "error", summary: "Invalid JSON", detail: e.message, life: 6000 });
      }
    });

    // selected view mirrors router query 'view'
    const selectedView = computed(() => route.query.view || "form");
    const onViewChange = (value) => {
      const name = route.name || "editor";
      router
        .push({ name, params: route.params, query: { view: value } })
        .catch(() => {});
    };

    const sidebarCollapsed = ref(false);
    provide("sidebarCollapsed", sidebarCollapsed);

    return {
      ...app,
      auth,
      route,
      isDev: import.meta.env.DEV,
      loginWithGoogle,
      showTokenDialog,
      viewModeOptions,
      selectedView,
      onViewChange,
    };
  },
};
</script>

<style>
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('/fonts/SpaceGrotesk-VariableFont.ttf') format('truetype');
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --fs-primary: #2563ff;
  --fs-primary-hover: #2D66C4;
  --fs-primary-light: rgba(37, 99, 255, 0.1);
  --fs-dark: #0B1220;
  --fs-dark-surface: #1c1f25;
  --fs-text: rgb(28 31 37);
  --fs-text-muted: rgb(98 105 129);
  --fs-bg: rgb(245 247 250);
  --fs-surface: #ffffff;
  --fs-border: rgb(210 213 226);
  --fs-radius: 10px;
  --fs-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);

  /* Severity colors */
  --fs-danger: #ef4444;
  --fs-danger-hover: #dc2626;
  --fs-warn: #f59e0b;
  --fs-warn-hover: #d97706;
  --fs-success: #10b981;
  --fs-success-hover: #059669;
  --fs-info: #00adef;
  --fs-info-hover: #0090c9;
}

body {
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--fs-bg);
  color: var(--fs-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
  padding: 20px;
}

.main-content {
  max-width: 2000px;
  margin: 0 auto;
}

.signed-out-card {
  max-width: 420px;
  margin: 80px auto;
  padding: 48px 40px;
  text-align: center;
  background: var(--fs-surface);
  border-radius: var(--fs-radius);
  box-shadow: var(--fs-shadow);
  border: 1px solid var(--fs-border);
}

.signed-out-icon {
  font-size: 2.5rem;
  color: var(--fs-primary);
  margin-bottom: 16px;
  display: block;
}

.signed-out-card h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  color: var(--fs-text);
}

.signed-out-card p {
  margin: 0 0 24px;
  color: var(--fs-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.view-mode-toggle {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.auth-banner {
  margin-bottom: 20px;
}

.auth-banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  height: calc(100vh - 280px);
}

.editor-container > * {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-container:not(:has(.spec-list)) {
  grid-template-columns: 1fr;
}

.right-split-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 320px;
}

.preview-section {
  background: var(--fs-surface);
  border-radius: var(--fs-radius);
  padding: 12px;
  box-shadow: var(--fs-shadow);
  overflow: auto;
  max-height: calc(100vh - 420px);
}

.diff-inline-wrapper {
  background: var(--fs-surface);
  border-radius: var(--fs-radius);
  padding: 12px;
  box-shadow: var(--fs-shadow);
  overflow: auto;
  max-height: calc(100vh - 420px);
}

.preview-full,
.lint-full {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  background: var(--fs-surface);
}

/* PrimeVue theme overrides to match landing page */
:root {
  --p-primary-color: #2563ff;
  --p-primary-hover-color: #2D66C4;
  --p-primary-active-color: #224C93;
  --p-primary-50: #e2ecfe;
  --p-primary-100: #b6d1fb;
  --p-primary-200: #88b2f9;
  --p-primary-300: #6099f7;
  --p-primary-400: #387ff5;
  --p-primary-500: #2563ff;
  --p-primary-600: #2D66C4;
  --p-primary-700: #224C93;
  --p-primary-800: #1a3a6e;
  --p-primary-900: #0B1220;
}

/* Button styling overrides */
.p-button {
  border-radius: 8px !important;
  font-weight: 500 !important;
  font-family: 'Space Grotesk', sans-serif !important;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
  box-sizing: border-box !important;
  border-width: 1px !important;
  border-style: solid !important;
}

.p-button:hover,
.p-button:focus,
.p-button:active {
  outline: none !important;
  box-shadow: none !important;
  border-width: 1px !important;
}

.p-button:not(.p-button-outlined):not(.p-button-text):not(.p-button-secondary):not(.p-button-danger):not(.p-button-warn):not(.p-button-success):not(.p-button-info) {
  background: var(--fs-primary) !important;
  border-color: var(--fs-primary) !important;
}

.p-button:not(.p-button-outlined):not(.p-button-text):not(.p-button-secondary):not(.p-button-danger):not(.p-button-warn):not(.p-button-success):not(.p-button-info):hover {
  background: var(--fs-primary-hover) !important;
  border-color: var(--fs-primary-hover) !important;
}

/* Danger buttons */
.p-button.p-button-danger:not(.p-button-outlined):not(.p-button-text) {
  background: var(--fs-danger) !important;
  border-color: var(--fs-danger) !important;
}
.p-button.p-button-danger:not(.p-button-outlined):not(.p-button-text):hover {
  background: var(--fs-danger-hover) !important;
  border-color: var(--fs-danger-hover) !important;
}

/* Warn buttons */
.p-button.p-button-warn:not(.p-button-outlined):not(.p-button-text) {
  background: var(--fs-warn) !important;
  border-color: var(--fs-warn) !important;
  color: #fff !important;
}
.p-button.p-button-warn:not(.p-button-outlined):not(.p-button-text):hover {
  background: var(--fs-warn-hover) !important;
  border-color: var(--fs-warn-hover) !important;
}

/* Success buttons */
.p-button.p-button-success:not(.p-button-outlined):not(.p-button-text) {
  background: var(--fs-success) !important;
  border-color: var(--fs-success) !important;
}
.p-button.p-button-success:not(.p-button-outlined):not(.p-button-text):hover {
  background: var(--fs-success-hover) !important;
  border-color: var(--fs-success-hover) !important;
}

/* Info buttons */
.p-button.p-button-info:not(.p-button-outlined):not(.p-button-text) {
  background: var(--fs-info) !important;
  border-color: var(--fs-info) !important;
}
.p-button.p-button-info:not(.p-button-outlined):not(.p-button-text):hover {
  background: var(--fs-info-hover) !important;
  border-color: var(--fs-info-hover) !important;
}

/* Secondary buttons */
.p-button.p-button-secondary:not(.p-button-outlined):not(.p-button-text) {
  background: #f1f5f9 !important;
  border-color: var(--fs-border) !important;
  color: var(--fs-text) !important;
}
.p-button.p-button-secondary:not(.p-button-outlined):not(.p-button-text):hover {
  background: #e2e8f0 !important;
  border-color: var(--fs-border) !important;
}

/* Disable all button hover transforms globally */
.p-button:hover,
.p-button:active {
  transform: none !important;
}

/* Card / Dialog styling */
.p-dialog {
  border-radius: 14px !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid var(--fs-border) !important;
}

.p-dialog .p-dialog-header {
  border-radius: 14px 14px 0 0 !important;
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
}

/* SelectButton styling */
.p-selectbutton .p-button {
  font-size: 0.875rem !important;
}

.p-selectbutton .p-button.p-highlight {
  background: var(--fs-primary) !important;
  border-color: var(--fs-primary) !important;
}

@media (max-width: 1200px) {
  .editor-container {
    grid-template-columns: 1fr;
    height: auto;
  }

  .split-view {
    grid-template-columns: 1fr;
  }
}
</style>
