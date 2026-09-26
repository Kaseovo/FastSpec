<template>
  <div id="app">
    <div v-if="!auth.isAuthenticated" class="main-content">
      <div v-if="auth.serverUnreachable" class="signed-out-card">
        <i class="pi pi-exclamation-triangle signed-out-icon"></i>
        <h2>Can't reach the FastSpec server</h2>
        <p>Check that the backend is running, then try again.</p>
        <Button label="Retry" icon="pi pi-refresh" @click="reload" />
      </div>
      <div v-else-if="auth.authMode === 'oidc'" class="signed-out-card">
        <i class="pi pi-lock signed-out-icon"></i>
        <h2>Sign in to continue</h2>
        <p>Sign in to create, edit, and save OpenAPI specifications.</p>
        <Button :label="signInLabel" :icon="signInIcon" @click="signIn" />
      </div>
    </div>

    <div v-else class="main-content">
      <Message v-if="alert.show" :severity="alert.type" @close="closeAlert">
        {{ alert.message }}
      </Message>

      <router-view />
    </div>

    <SaveDialog
      :visible="showSaveDialog"
      :spec-name="currentSpec?.name || ''"
      :spec-id="currentSpec?.id || null"
      :current-version="currentSpec?.version || null"
      :draft-content="parsedSpec"
      @update:visible="showSaveDialog = $event"
      @save="saveSpec"
    />

    <!-- New Spec Dialog -->
    <Dialog
      :visible="showNewDialog"
      header="Create New Specification"
      :modal="true"
      :style="{ width: '500px' }"
      @update:visible="(val) => (showNewDialog = val)"
    >
      <div class="new-spec-options">
        <div class="option-card" @click="createBlank">
          <i class="pi pi-file"></i>
          <h4>Blank Specification</h4>
          <p>Start with a minimal OpenAPI 3.0 structure</p>
        </div>
        <div class="option-card" @click="createFromTemplate">
          <i class="pi pi-clone"></i>
          <h4>From Template</h4>
          <p>Start with a pre-configured API template</p>
        </div>
      </div>
    </Dialog>

    <!-- Token Manager Dialog -->
    <Dialog
      :visible="showTokenDialog"
      header="API keys"
      :modal="true"
      :style="{ width: '1200px' }"
      @update:visible="showTokenDialog = $event"
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
import SaveDialog from "./components/SaveDialog.vue";
import TokenManager from "./components/TokenManager.vue";
import { ref, provide, onMounted, computed } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useApp } from "./composables/useApp";
import { useAuthStore } from "./stores/auth";
import { useToast } from "primevue/usetoast";
import { validateSpec } from "./api/specs";
import { signIn } from "./auth/session";

export default {
  name: "AppLayout",
  components: {
    Message,
    Button,
    Dialog,
    ConfirmDialog,
    Toast,
    SaveDialog,
    TokenManager,
  },
  setup() {
    const app = useApp();
    const auth = useAuthStore();

    // UI state moved from useApp
    const showTokenDialog = ref(false);
    const showNewDialog = ref(false);

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

    // New Spec dialog + unsaved-changes guard, moved from Toolbar.vue —
    // the only remaining consumer of that component was AppLayout itself.
    const confirm = useConfirm();
    const confirmOpen = ref(false);

    const createBlank = () => {
      if (app.hasUnsavedChanges.value) {
        if (!confirmOpen.value) {
          confirmOpen.value = true;
          confirm.require({
            message: "You have unsaved changes. Discard them and create a new blank spec?",
            header: "Discard unsaved changes?",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            accept: () => {
              app.discardUnsaved();
              app.newSpec();
              showNewDialog.value = false;
              confirmOpen.value = false;
            },
            reject: () => {
              confirmOpen.value = false;
            },
            onHide: () => {
              confirmOpen.value = false;
            },
          });
        }
        return;
      }
      app.newSpec();
      showNewDialog.value = false;
    };

    const createFromTemplate = () => {
      if (app.hasUnsavedChanges.value) {
        if (!confirmOpen.value) {
          confirmOpen.value = true;
          confirm.require({
            message: "You have unsaved changes. Discard them and create a new spec from template?",
            header: "Discard unsaved changes?",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            accept: () => {
              app.discardUnsaved();
              app.loadTemplate();
              showNewDialog.value = false;
              confirmOpen.value = false;
            },
            reject: () => {
              confirmOpen.value = false;
            },
            onHide: () => {
              confirmOpen.value = false;
            },
          });
        }
        return;
      }
      app.loadTemplate();
      showNewDialog.value = false;
    };

    provide("openNewSpecDialog", () => (showNewDialog.value = true));

    const signInLabel = computed(() => `Sign in with ${auth.providerName || "SSO"}`);
    const signInIcon = computed(() =>
      auth.providerName === "Google" ? "pi pi-google" : "pi pi-sign-in",
    );
    const reload = () => window.location.reload();

    return {
      ...app,
      auth,
      signIn,
      signInLabel,
      signInIcon,
      reload,
      showTokenDialog,
      showNewDialog,
      createBlank,
      createFromTemplate,
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
  display: flex;
  flex-direction: column;
}

.main-content {
  max-width: 2000px;
  width: 100%;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.new-spec-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 0;
}

.option-card {
  padding: 28px 24px;
  border: 1.5px solid var(--fs-border, #e5e7eb);
  border-radius: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--fs-surface, #fff);
}

.option-card:hover {
  border-color: var(--fs-primary, #2563ff);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(37, 99, 255, 0.15);
  background: linear-gradient(135deg, #e2ecfe 0%, #f0f5ff 100%);
}

.option-card i {
  font-size: 2.5rem;
  color: var(--fs-primary, #2563ff);
  margin-bottom: 12px;
  display: block;
}

.option-card h4 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
}

.option-card p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.4;
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
</style>
