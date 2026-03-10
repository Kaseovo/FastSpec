<template>
  <div id="app">
    <div class="header">
      <h1>🧩 FastSpec</h1>
      <p>Create, edit, and validate OpenAPI specifications</p>
    </div>

    <div class="main-content">
      <Toolbar />

      <!-- Login prompt banner for unauthenticated users -->
      <Message
        v-if="!isAuthenticated"
        severity="info"
        :closable="false"
        class="auth-banner"
      >
        <div class="auth-banner-content">
          <span
            >You're browsing in guest mode. Sign in to save and manage your
            specifications.</span
          >
          <Button
            label="Sign In"
            icon="pi pi-sign-in"
            size="small"
            @click="showLoginDialog = true"
          />
        </div>
      </Message>

      <Message v-if="alert.show" :severity="alert.type" @close="closeAlert">
        {{ alert.message }}
      </Message>

      <div class="view-mode-toggle">
        <SelectButton
          v-model="viewMode"
          :options="viewModeOptions"
          optionLabel="label"
          optionValue="value"
          optionDisabled="disabled"
          dataKey="value"
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
        <SpecList
          v-if="isAuthenticated"
          @spec-selected="loadSpec"
          :selected-id="selectedSpecId"
        />

        <!-- Render the FormEditor for explicit 'form' view -->
        <template v-if="viewMode === 'form'">
          <FormEditor
            :model-value="parsedSpec"
            @update:modelValue="updateFromForm"
          />
        </template>

        <template v-else-if="viewMode === 'code'">
          <EditorPanel
            ref="editorPanelRef"
            v-model="specContent"
            :show-validate="true"
            :lint-results="lintResults"
            @update:modelValue="updatePreview"
          />
        </template>

        <template v-else-if="viewMode === 'preview'">
          <!-- Full-width Preview view: render PreviewPanel as drawer did -->
          <div class="preview-full">
            <PreviewPanel :spec="parsedSpec" />
          </div>
        </template>

        <template v-else-if="viewMode === 'lint'">
          <div class="lint-full">
            <LintPanel
              :results="lintResults"
              :loading="lintLoading"
              :error="lintError"
              @run-lint="runLint"
              @go-to-line="handleGoToLine"
            />
          </div>
        </template>
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
import { ref, computed, provide, onMounted, nextTick } from "vue";
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
import Tag from "primevue/tag";
import { useAuthStore } from "./stores/auth";
import { lintSpec, lintSpecById, validateSpec } from "./api/specs";

// composables
import { useSpecEditor } from "./composables/useSpecEditor";
import { useSpecSave } from "./composables/useSpecSave";
import { useSpecDiff } from "./composables/useSpecDiff";
import { useAlerts } from "./composables/useAlerts";

export default {
  name: "App",
  components: {
    Message,
    Button,
    Dialog,
    ConfirmDialog,
    Toast,
    Tag,
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
  },
  setup() {
    const auth = useAuthStore();
    const isAuthenticated = computed(() => auth.isAuthenticated);

    const alerts = useAlerts();
    const editor = useSpecEditor();
    const diff = useSpecDiff();
    const saver = useSpecSave({
      isAuthenticatedRef: isAuthenticated,
      specContentRef: editor.specContent,
      currentSpecRef: editor.currentSpec,
      initialSpecRef: editor.initialSpec,
      showAlert: alerts.showAlert,
    });

    const viewMode = ref("form");
    const viewModeOptions = ref([
      { label: "Form", value: "form", icon: "pi pi-list" },
      { label: "Code", value: "code", icon: "pi pi-code" },
      { label: "Preview", value: "preview", icon: "pi pi-eye" },
      { label: "Lint", value: "lint", icon: "pi pi-search" },
    ]);

    const editorPanelRef = ref(null);

    const lintResults = ref(null);
    const lintLoading = ref(false);
    const lintError = ref(null);

    const runLint = async () => {
      lintLoading.value = true;
      lintError.value = null;
      try {
        let specJson;
        try {
          specJson = JSON.parse(editor.specContent.value);
        } catch {
          lintError.value = "Cannot lint: the editor contains invalid JSON.";
          return;
        }

        if (editor.currentSpec.value?.id && editor.currentSpec.value?.version) {
          lintResults.value = await lintSpecById(
            editor.currentSpec.value.id,
            editor.currentSpec.value.version
          );
        } else {
          lintResults.value = await lintSpec(specJson);
        }
      } catch (err) {
        lintError.value =
          err.response?.data?.detail ?? err.message ?? "Lint failed";
      } finally {
        lintLoading.value = false;
      }
    };

    const handleGoToLine = (result) => {
      viewMode.value = "code";
      nextTick(() => {
        editorPanelRef.value?.goToLine(result);
      });
    };

    const specListKey = ref(0);
    const showLoginDialog = ref(false);
    const showTokenDialog = ref(false);

    const saveSpec = async (payload) => {
      try {
        await saver.saveSpec(payload);
        specListKey.value++;
        // Non-blocking lint run
        runLint().catch(() => {});
      } catch (e) {
        // saver shows alerts
      }
    };

    const loadTemplate = () => {
      const templateSpec = {
        openapi: "3.0.0",
        info: {
          title: "Sample API",
          version: "1.0.0",
          description: "A sample API with common endpoints",
          contact: { name: "API Support", email: "support@example.com" },
        },
        servers: [
          {
            url: "https://api.example.com/v1",
            description: "Production server",
          },
        ],
        paths: {
          "/users": {
            get: {
              summary: "List users",
              description: "Get a list of all users",
              tags: ["Users"],
              responses: {
                200: {
                  description: "Successful response",
                  content: {
                    "application/json": {
                      schema: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
            post: {
              summary: "Create user",
              description: "Create a new user",
              tags: ["Users"],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/User" },
                  },
                },
              },
              responses: { 201: { description: "User created" } },
            },
          },
          "/users/{id}": {
            get: {
              summary: "Get user",
              description: "Get a specific user by ID",
              tags: ["Users"],
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "integer" },
                },
              ],
              responses: {
                200: {
                  description: "Successful response",
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
                404: { description: "User not found" },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: "object",
              required: ["id", "email"],
              properties: {
                id: { type: "integer" },
                email: { type: "string", format: "email" },
                name: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      };

      editor.currentSpec.value = null;
      editor.specContent.value = JSON.stringify(templateSpec, null, 2);
      editor.initialSpec.value = JSON.parse(JSON.stringify(templateSpec));
      editor.unsavedSpec.value = {
        id: "__unsaved",
        name: templateSpec.info?.title || "Untitled Spec",
        spec_json: templateSpec,
        version: templateSpec.info?.version || "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      editor.updatePreview();
      alerts.showAlert("Template loaded with sample endpoints", "success");
    };

    const togglePreview = () => {
      viewMode.value = viewMode.value === "preview" ? "code" : "preview";
    };

    onMounted(() => {
      auth.initAuth();
      diff.fetchOpenApiFile().catch(() => {});
    });

    // provide grouped composables
    provide("specEditor", editor);
    provide("specSave", saver);
    provide("specDiff", diff);
    provide("alerts", alerts);

    // legacy provides
    provide("newSpec", editor.newSpec);
    provide("openSaveDialog", saver.openSaveDialog);
    provide("validateCurrentSpec", async () => {
      try {
        const spec_json = JSON.parse(editor.specContent.value);
        const result = await validateSpec(spec_json);
        if (result.valid)
          alerts.showAlert("✓ Specification is valid!", "success");
        else alerts.showAlert("Validation failed", "error");
      } catch (e) {
        alerts.showAlert("Invalid JSON", "error");
      }
    });
    provide("loadTemplate", loadTemplate);
    provide("togglePreview", togglePreview);
    provide("viewMode", viewMode);
    provide("refreshSpecList", specListKey);
    provide("showTokenDialog", () => (showTokenDialog.value = true));
    provide("unsavedSpec", editor.unsavedSpec);
    provide("hasUnsavedChanges", editor.hasUnsavedChanges);
    provide("discardUnsaved", () => {
      editor.unsavedSpec.value = null;
      editor.hasUnsavedChanges.value = false;
    });
    const selectedSpecId = computed(
      () =>
        editor.currentSpec.value?.id ??
        (editor.unsavedSpec.value ? "__unsaved" : null)
    );
    provide("selectedSpecId", selectedSpecId);
    provide("getCurrentEditorSpec", () => editor.parsedSpec.value);
    provide(
      "lintScore",
      computed(() => lintResults.value?.score ?? null)
    );
    provide("lintLoading", lintLoading);
    provide("runLint", runLint);

    return {
      isAuthenticated,
      currentSpec: editor.currentSpec,
      specContent: editor.specContent,
      parsedSpec: editor.parsedSpec,
      selectedSpecId,
      showSaveDialog: saver.showSaveDialog,
      showLoginDialog,
      showTokenDialog,
      alert: alerts.alert,
      viewMode,
      viewModeOptions,
      showAlert: alerts.showAlert,
      closeAlert: alerts.closeAlert,
      updatePreview: editor.updatePreview,
      updateFromForm: editor.updateFromForm,
      loadSpec: editor.loadSpec,
      saveSpec,
      editorPanelRef,
      lintResults,
      lintLoading,
      lintError,
      runLint,
      handleGoToLine,
      fetchOpenApiFile: diff.fetchOpenApiFile,
      openapiFileRaw: diff.openapiFileRaw,
      openapiBaseline: diff.openapiBaseline,
      openapiFileDiff: diff.openapiFileDiff,
      openapiFileHasChanges: diff.openapiFileHasChanges,
      formattedOpenapiFileDiff: diff.formattedOpenapiFileDiff,
      copyOpenapiFileDiff: diff.copyOpenapiFileDiff,
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
  grid-template-columns: 250px 1fr;
  gap: 20px;
  height: calc(100vh - 300px);
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
