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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  background: #f9fafb;
  color: #1f2937;
}

#app {
  min-height: 100vh;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.header p {
  color: #6b7280;
  font-size: 1.1rem;
}

.main-content {
  max-width: 1800px;
  margin: 0 auto;
}

.view-mode-toggle {
  display: flex;
  justify-content: center;
  margin: 20px 0;
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
  /* Allow route views to control their own internal layout; keep a single column here */
  grid-template-columns: 1fr;
  gap: 20px;
  height: calc(100vh - 300px);
}

/* Ensure router-view children fill the container */
.editor-container > * {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Hide spec list when not authenticated */
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
  background: white;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  overflow: auto;
  max-height: calc(100vh - 420px);
}

.diff-inline-wrapper {
  background: white;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  overflow: auto;
  max-height: calc(100vh - 420px);
}

.preview-full,
.lint-full {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background: white;
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
