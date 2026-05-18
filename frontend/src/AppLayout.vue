<template>
  <div id="app">
    <AppHeader />

    <div class="main-content">
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

    <SaveDialog
      :visible="showSaveDialog"
      @update:visible="showSaveDialog = $event"
      :spec-name="currentSpec?.name || ''"
      :spec-id="currentSpec?.id || null"
      :current-version="currentSpec?.version || null"
      :draft-content="parsedSpec"
      @save="saveSpec"
    />

    <!-- Login Dialog -->
    <Dialog
      :visible="showLoginDialog"
      @update:visible="(val) => (showLoginDialog = val)"
      header="Sign In to FastSpec"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <LoginPage :inline="true" @close="showLoginDialog = false" />
    </Dialog>

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
import SpecList from "./components/SpecList.vue";
import EditorPanel from "./components/EditorPanel.vue";
import FormEditor from "./components/FormEditor.vue";
import PreviewPanel from "./components/PreviewPanel.vue";
import SaveDialog from "./components/SaveDialog.vue";
import LoginPage from "./components/LoginPage.vue";
import TokenManager from "./components/TokenManager.vue";
import LintPanel from "./components/LintPanel.vue";
import AppHeader from "./AppHeader.vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApp } from "./composables/useApp";

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
    SpecList,
    EditorPanel,
    FormEditor,
    PreviewPanel,
    SaveDialog,
    LoginPage,
    TokenManager,
    LintPanel,
    AppHeader,
  },
  setup() {
    const app = useApp();
    const route = useRoute();
    const router = useRouter();
    // selected view mirrors router query 'view'
    const selectedView = computed(() => route.query.view || "form");
    const onViewChange = (value) => {
      const name = route.name || "editor";
      router
        .push({ name, params: route.params, query: { view: value } })
        .catch(() => {});
    };
    return {
      ...app,
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
  --fs-primary: #8b5cf6;
  --fs-primary-hover: #7c3aed;
  --fs-primary-light: rgba(139, 92, 246, 0.1);
  --fs-dark: #0f0f1a;
  --fs-dark-surface: #1a1a2e;
  --fs-text: #1f2937;
  --fs-text-muted: #6b7280;
  --fs-bg: #f8f9fc;
  --fs-surface: #ffffff;
  --fs-border: #e5e7eb;
  --fs-radius: 10px;
  --fs-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
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
  max-width: 1800px;
  margin: 0 auto;
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
  --p-primary-color: #8b5cf6;
  --p-primary-hover-color: #7c3aed;
  --p-primary-active-color: #6d28d9;
  --p-primary-50: #f5f3ff;
  --p-primary-100: #ede9fe;
  --p-primary-200: #ddd6fe;
  --p-primary-300: #c4b5fd;
  --p-primary-400: #a78bfa;
  --p-primary-500: #8b5cf6;
  --p-primary-600: #7c3aed;
  --p-primary-700: #6d28d9;
  --p-primary-800: #5b21b6;
  --p-primary-900: #4c1d95;
}

/* Button styling overrides */
.p-button {
  border-radius: 8px !important;
  font-weight: 500 !important;
  font-family: 'Space Grotesk', sans-serif !important;
  transition: all 0.2s ease !important;
}

.p-button:not(.p-button-outlined):not(.p-button-text):not(.p-button-secondary) {
  background: var(--fs-primary) !important;
  border-color: var(--fs-primary) !important;
}

.p-button:not(.p-button-outlined):not(.p-button-text):not(.p-button-secondary):hover {
  background: var(--fs-primary-hover) !important;
  border-color: var(--fs-primary-hover) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
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
