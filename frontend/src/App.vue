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
          :selected-id="currentSpec?.id"
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

    <Toast />
  </div>
</template>

<script>
import { ref, computed, provide, onMounted } from "vue";
import Message from "primevue/message";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
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
import {
  validateSpec,
  createSpec,
  updateSpec,
  lintSpec,
  lintSpecById,
} from "./api/specs";
import { compareSpecs } from "./utils/diffUtils";
import { generateMarkdownReport } from "./utils/markdownGenerator";
import { useAuth } from "./stores/auth";
import { fetchOpenApi } from "./api/specs";
import Tag from "primevue/tag";

export default {
  name: "App",
  components: {
    Message,
    Button,
    Dialog,
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
    // Initialize authentication
    const { isAuthenticated, initAuth } = useAuth();

    // Initialize auth from localStorage on mount
    onMounted(() => {
      initAuth();
    });

    const currentSpec = ref(null);
    const specContent = ref(JSON.stringify(getDefaultSpec(), null, 2));
    const parsedSpec = ref(getDefaultSpec());
    const initialSpec = ref(getDefaultSpec()); // Track initial state for diff
    const showSaveDialog = ref(false);
    const showLoginDialog = ref(false);
    const alert = ref({ show: false, message: "", type: "info" });
    const specListKey = ref(0);
    const viewMode = ref("form"); // 'form', 'code', or 'preview'
    const hasUnsavedChanges = ref(false);
    const autoSaveTimer = ref(null);
    const viewModeOptions = computed(() => [
      { label: "Form", value: "form", icon: "pi pi-list" },
      { label: "Code", value: "code", icon: "pi pi-code" },
      { label: "Preview", value: "preview", icon: "pi pi-eye" },
      { label: "Lint", value: "lint", icon: "pi pi-search" },
    ]);

    // ── Template refs ────────────────────────────────────────────────────────
    const editorPanelRef = ref(null);

    // ── Lint state ───────────────────────────────────────────────────────────
    const lintResults = ref(null); // full LintResponse object
    const lintLoading = ref(false);
    const lintError = ref(null);
    const lintScore = computed(() => lintResults.value?.score ?? null);

    const runLint = async () => {
      lintLoading.value = true;
      lintError.value = null;
      try {
        let specJson;
        try {
          specJson = JSON.parse(specContent.value);
        } catch {
          lintError.value = "Cannot lint: the editor contains invalid JSON.";
          return;
        }

        if (currentSpec.value?.id && currentSpec.value?.version) {
          // Prefer stored-spec lint so Spectral can resolve $ref paths from file
          lintResults.value = await lintSpecById(
            currentSpec.value.id,
            currentSpec.value.version
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
      // Switch to code view so markers are visible, then scroll
      viewMode.value = "code";
      // Use nextTick to wait for EditorPanel to mount if switching views
      import("vue").then(({ nextTick }) => {
        nextTick(() => {
          editorPanelRef.value?.goToLine(result);
        });
      });
    };

    const showTokenDialog = ref(false);

    // OpenAPI file helpers
    const copyingFile = ref(false);
    const openapiFileRaw = ref("");
    const openapiBaseline = ref(null);
    const openapiFileDiff = ref({});

    const fetchOpenApiFile = async () => {
      try {
        const data = await fetchOpenApi();
        openapiFileRaw.value = JSON.stringify(data, null, 2);
        if (!openapiBaseline.value) {
          openapiBaseline.value = JSON.parse(JSON.stringify(data));
        }
        openapiFileDiff.value = compareSpecs(openapiBaseline.value || {}, data);
      } catch (err) {
        console.error("Failed fetching openapi.json", err);
        showAlert("Failed to fetch openapi.json", "error");
      }
    };

    const openapiFileHasChanges = computed(() => {
      const d = openapiFileDiff.value || {};
      return (
        (d.infoAdded?.length || 0) +
          (d.infoModified?.length || 0) +
          (d.infoRemoved?.length || 0) +
          (d.added?.length || 0) +
          (d.modified?.length || 0) +
          (d.removed?.length || 0) +
          (d.schemaAdded?.length || 0) +
          (d.schemaModified?.length || 0) +
          (d.schemaRemoved?.length || 0) >
        0
      );
    });

    const formattedOpenapiFileDiff = computed(() => {
      try {
        return generateMarkdownReport(openapiFileDiff.value || {});
      } catch (e) {
        return JSON.stringify(openapiFileDiff.value || {}, null, 2);
      }
    });

    const copyOpenapiFileDiff = async () => {
      copyingFile.value = true;
      try {
        const md = formattedOpenapiFileDiff.value;
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(md);
        } else {
          const t = document.createElement("textarea");
          t.value = md;
          t.style.position = "fixed";
          t.style.left = "-999999px";
          t.style.top = "-999999px";
          document.body.appendChild(t);
          t.focus();
          t.select();
          try {
            document.execCommand("copy");
          } finally {
            t.remove();
          }
        }
        showAlert("OpenAPI file diff copied", "success");
      } catch (err) {
        console.error(err);
        showAlert("Failed to copy file diff", "error");
      } finally {
        copyingFile.value = false;
      }
    };

    onMounted(() => {
      fetchOpenApiFile();
    });

    const showAlert = (message, type = "info") => {
      alert.value = { show: true, message, type };
      setTimeout(() => {
        alert.value.show = false;
      }, 5000);
    };

    const closeAlert = () => {
      alert.value.show = false;
    };

    const updatePreview = () => {
      try {
        parsedSpec.value = JSON.parse(specContent.value);
        // Compute diff against initial state (used only for determining unsaved changes)
        const diff = compareSpecs(initialSpec.value, parsedSpec.value);
        checkForChanges(diff);
        scheduleAutoSave();
      } catch (e) {
        // Invalid JSON - preview will handle error display
      }
    };

    const updateFromForm = (formSpec) => {
      // Prevent unnecessary updates to avoid recursive loop
      const newContent = JSON.stringify(formSpec, null, 2);
      if (specContent.value === newContent) return;
      parsedSpec.value = formSpec;
      specContent.value = newContent;
      const diff = compareSpecs(initialSpec.value, parsedSpec.value);
      checkForChanges(diff);
      scheduleAutoSave();
    };

    const checkForChanges = (diff = null) => {
      const d = diff || compareSpecs(initialSpec.value, parsedSpec.value);
      hasUnsavedChanges.value = !!(
        d.infoAdded?.length ||
        d.infoModified?.length ||
        d.infoRemoved?.length ||
        d.added?.length ||
        d.modified?.length ||
        d.removed?.length ||
        d.schemaAdded?.length ||
        d.schemaModified?.length ||
        d.schemaRemoved?.length
      );
    };

    const scheduleAutoSave = () => {
      // Clear existing timer
      if (autoSaveTimer.value) {
        clearTimeout(autoSaveTimer.value);
      }

      // Auto-save disabled: Only save when user clicks Save
      // No PUT request will be sent automatically on form/code changes
      // Save logic is handled in saveSpec()
    };

    const loadSpec = (spec) => {
      // Clear auto-save timer when loading a new spec
      if (autoSaveTimer.value) {
        clearTimeout(autoSaveTimer.value);
      }
      // Prefer fetched version if present
      if (spec.content) {
        // If this is a version fetch, 'content' is present (from getSpecVersion)
        currentSpec.value = spec;
        specContent.value = JSON.stringify(spec.content, null, 2);
        initialSpec.value = JSON.parse(JSON.stringify(spec.content));
      } else if (spec.spec_json) {
        // If this is a normal fetch, spec_json is present
        currentSpec.value = spec;
        specContent.value = JSON.stringify(spec.spec_json, null, 2);
        initialSpec.value = JSON.parse(JSON.stringify(spec.spec_json)); // Deep clone
      } else {
        // Fallback
        currentSpec.value = spec;
        specContent.value = JSON.stringify(getDefaultSpec(), null, 2);
        initialSpec.value = JSON.parse(JSON.stringify(getDefaultSpec()));
      }
      hasUnsavedChanges.value = false;
      viewMode.value = "form";
      updatePreview();
    };

    const newSpec = () => {
      // Clear auto-save timer when creating a new spec
      if (autoSaveTimer.value) {
        clearTimeout(autoSaveTimer.value);
      }
      currentSpec.value = null;
      const defaultSpec = getDefaultSpec();
      specContent.value = JSON.stringify(defaultSpec, null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(defaultSpec)); // Deep clone
      hasUnsavedChanges.value = false;
      updatePreview();
    };

    const openSaveDialog = () => {
      // Check authentication before saving
      if (!isAuthenticated.value) {
        showAlert("Please sign in to save your specifications", "warn");
        showLoginDialog.value = true;
        return;
      }
      showSaveDialog.value = true;
    };

    const saveSpec = async (payloadOrName) => {
      if (!isAuthenticated.value) {
        showAlert("Authentication required to save specifications", "error");
        return;
      }

      const isString = typeof payloadOrName === "string";
      const name = isString ? payloadOrName : payloadOrName.name;
      const versionChoice = !isString ? payloadOrName.versionChoice : null;

      try {
        const spec_json = JSON.parse(specContent.value);

        // New spec (no currentSpec)
        if (!currentSpec.value) {
          // Do not modify spec_json.info.version
          const version = payloadOrName?.version_choice?.version || spec_json.info.version || "1.0.0";
          const created = await createSpec({ name, version, spec_json });
          currentSpec.value = created;
          initialSpec.value = JSON.parse(JSON.stringify(spec_json));
          hasUnsavedChanges.value = false;
          showAlert("Spec created successfully!", "success");
        } else {
          // Existing spec: versioning logic
          const specId = currentSpec.value.id;
          // If user chose to create a new version
          if (versionChoice && versionChoice.action === "create") {
            // Do not modify spec_json.info.version
            const { createSpecVersion } = await import("./api/specs");
            const created = await createSpecVersion(specId, {
              version: versionChoice.version,
              content: spec_json,
            });
            currentSpec.value = created;
            initialSpec.value = JSON.parse(JSON.stringify(spec_json));
            hasUnsavedChanges.value = false;
            showAlert("Spec version created successfully!", "success");
          } else if (versionChoice && versionChoice.action === "use") {
            // PUT /api/specs/{id}/versions/{version_id}
            // Do not modify spec_json.info.version
            const { updateSpecVersion, listSpecVersions } = await import(
              "./api/specs"
            );
            // Find versionId for the selected version
            const versions = await listSpecVersions(specId);
            const targetVersion = versions.find(
              (v) => v.version === versionChoice.version
            );
            if (!targetVersion) throw new Error("Version not found");
            const updated = await updateSpecVersion(specId, targetVersion.id, {
              version: versionChoice.version,
              content: spec_json,
            });
            currentSpec.value = updated;
            initialSpec.value = JSON.parse(JSON.stringify(spec_json));
            hasUnsavedChanges.value = false;
            showAlert("Spec version updated successfully!", "success");
          } else {
            // Default: update current version (PUT /api/specs/{id}/versions/{version_id})
            const { updateSpecVersion, listSpecVersions } = await import(
              "./api/specs"
            );
            const currentVersion = currentSpec.value.version;
            // Do not modify spec_json.info.version
            const versions = await listSpecVersions(specId);
            const targetVersion = versions.find(
              (v) => v.version === currentVersion
            );
            if (!targetVersion) throw new Error("Current version not found");
            const updated = await updateSpecVersion(specId, targetVersion.id, {
              version: currentVersion,
              content: spec_json,
            });
            currentSpec.value = updated;
            initialSpec.value = JSON.parse(JSON.stringify(spec_json));
            hasUnsavedChanges.value = false;
            showAlert("Spec version updated successfully!", "success");
          }
        }

        showSaveDialog.value = false;
        specListKey.value++;

        // Auto-run lint after a successful save (non-blocking)
        runLint().catch(() => {});
      } catch (error) {
        if (error.response?.status === 409) {
          const detail = error.response.data?.detail;
          const msg = detail?.message
            ? `${detail.message}: expected ${detail.expected}, provided ${detail.provided}`
            : "Version conflict";
          showAlert(msg, "error");
        } else {
          showAlert(error.response?.data?.detail || error.message, "error");
        }
      }
    };

    const validateCurrentSpec = async () => {
      try {
        const spec_json = JSON.parse(specContent.value);
        const result = await validateSpec(spec_json);

        if (result.valid) {
          // Format the JSON and update the editor
          specContent.value = JSON.stringify(spec_json, null, 2);
          showAlert("✓ Specification is valid!", "success");
        } else {
          let message = "✗ Validation errors:\n";
          result.errors.forEach((err) => {
            message += `\n• ${err.field}: ${err.message}`;
          });
          showAlert(message, "error");
        }
      } catch (error) {
        showAlert("Invalid JSON", "error");
      }
    };

    const loadTemplate = () => {
      currentSpec.value = null;
      const templateSpec = {
        openapi: "3.0.0",
        info: {
          title: "Sample API",
          version: "1.0.0",
          description: "A sample API with common endpoints",
          contact: {
            name: "API Support",
            email: "support@example.com",
          },
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
                        items: {
                          $ref: "#/components/schemas/User",
                        },
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
                    schema: {
                      $ref: "#/components/schemas/User",
                    },
                  },
                },
              },
              responses: {
                201: {
                  description: "User created",
                },
              },
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
                  schema: {
                    type: "integer",
                  },
                },
              ],
              responses: {
                200: {
                  description: "Successful response",
                  content: {
                    "application/json": {
                      schema: {
                        $ref: "#/components/schemas/User",
                      },
                    },
                  },
                },
                404: {
                  description: "User not found",
                },
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
                id: {
                  type: "integer",
                  description: "User ID",
                },
                email: {
                  type: "string",
                  format: "email",
                  description: "User email address",
                },
                name: {
                  type: "string",
                  description: "User full name",
                },
                createdAt: {
                  type: "string",
                  format: "date-time",
                  description: "Account creation timestamp",
                },
              },
            },
          },
        },
      };
      specContent.value = JSON.stringify(templateSpec, null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(templateSpec));
      updatePreview();
      showAlert("Template loaded with sample endpoints", "success");
    };

    const togglePreview = () => {
      viewMode.value = viewMode.value === "preview" ? "code" : "preview";
    };

    function getDefaultSpec() {
      return {
        openapi: "3.0.0",
        info: {
          title: "My API",
          version: "1.0.0",
          description: "API Description",
        },
        servers: [{ url: "https://api.example.com" }],
        paths: {},
      };
    }

    // Provide methods to child components
    provide("newSpec", newSpec);
    provide("openSaveDialog", openSaveDialog);
    provide("validateCurrentSpec", validateCurrentSpec);
    provide("loadTemplate", loadTemplate);
    provide("togglePreview", togglePreview);
    provide("viewMode", viewMode);
    // Provide the spec list key ref so children can watch it.
    // Parent increments specListKey.value after save to trigger a refresh in SpecList.
    provide("refreshSpecList", specListKey);
    provide("showTokenDialog", () => (showTokenDialog.value = true));
    // Lint context for Toolbar
    provide("lintScore", lintScore);
    provide("lintLoading", lintLoading);
    provide("runLint", runLint);

    return {
      isAuthenticated,
      currentSpec,
      specContent,
      parsedSpec,
      showSaveDialog,
      showLoginDialog,
      showTokenDialog,
      alert,
      viewMode,
      viewModeOptions,
      showAlert,
      closeAlert,
      updatePreview,
      updateFromForm,
      loadSpec,
      saveSpec,
      // Lint
      editorPanelRef,
      lintResults,
      lintLoading,
      lintError,
      runLint,
      handleGoToLine,
      // OpenAPI file helpers
      fetchOpenApiFile,
      openapiFileRaw,
      openapiBaseline,
      openapiFileDiff,
      openapiFileHasChanges,
      formattedOpenapiFileDiff,
      copyOpenapiFileDiff,
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
