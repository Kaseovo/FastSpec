import { ref, computed, provide, onMounted, nextTick } from "vue";
import { useAuthStore } from "../stores/auth";
import { lintSpec, lintSpecById, validateSpec } from "../api/specs";
import { useSpecEditor } from "../composables/useSpecEditor";
import { useSpecSave } from "../composables/useSpecSave";
import { useSpecDiff } from "../composables/useSpecDiff";
import { useAlerts } from "../composables/useAlerts";

export function useApp() {
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
          editor.currentSpec.value.version,
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

  // provide a toggle for the (future) diff UI so components that inject it don't fail
  const toggleDiff = () => {
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
  provide("toggleDiff", toggleDiff);
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
      (editor.unsavedSpec.value ? "__unsaved" : null),
  );
  provide("selectedSpecId", selectedSpecId);
  provide("getCurrentEditorSpec", () => editor.parsedSpec.value);
  provide(
    "lintScore",
    computed(() => lintResults.value?.score ?? null),
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
    // expose loadTemplate so templates using @load-template="loadTemplate" work
    loadTemplate,
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
}
