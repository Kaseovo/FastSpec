import { ref, computed, provide, onMounted, nextTick } from "vue";
import { useToast } from "primevue/usetoast";

// Singleton instance so multiple calls to useApp() return the same app state
let _appInstance = null;
import { useAuthStore } from "../stores/auth";
import { lintSpec, lintSpecById, validateSpec } from "../api/specs";
import { useSpecEditor } from "../composables/useSpecEditor";
import { useSpecSave } from "../composables/useSpecSave";
import { useSpecDiff } from "../composables/useSpecDiff";
import { useAlerts } from "../composables/useAlerts";

export function useApp() {
  if (_appInstance) return _appInstance;
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

  // viewMode removed; expose view options for router-driven navigation
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

      if (
        editor.currentSpec.value?.id &&
        editor.currentSpec.value?.version &&
        editor.currentSpec.value.id !== "__unsaved"
      ) {
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

  const handleGoToLine = (result, router) => {
    // navigate to code view; router should be provided by caller
    if (router)
      router.push({ name: "editor", query: { view: "code" } }).catch(() => {});
    nextTick(() => {
      editorPanelRef.value?.goToLine(result);
    });
  };

  const specListKey = ref(0);
  const showLoginDialog = ref(false);
  const showTokenDialog = ref(false);
  const showLivePreview = ref(false);

  const toggleLivePreview = () => {
    showLivePreview.value = !showLivePreview.value;
  };

  const saveSpec = async (payload) => {
    try {
      console.debug(
        "useApp.saveSpec: before save, currentSpec:",
        editor.currentSpec.value,
        "unsavedSpec:",
        editor.unsavedSpec.value,
      );
      await saver.saveSpec(payload);
      console.debug(
        "useApp.saveSpec: after saver.saveSpec, currentSpec:",
        editor.currentSpec.value,
        "unsavedSpec:",
        editor.unsavedSpec.value,
      );
      // Clear transient unsaved spec so the UI selects the persisted spec
      editor.unsavedSpec.value = null;
      console.debug(
        "useApp.saveSpec: cleared unsavedSpec, now",
        editor.unsavedSpec.value,
      );
      specListKey.value++;
      console.debug(
        "useApp.saveSpec: incremented specListKey to",
        specListKey.value,
      );
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
      name: "Untitled Spec",
      spec_json: templateSpec,
      version: templateSpec.info?.version || "1.0.0",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    editor.updatePreview();
  };

  const togglePreview = (router) => {
    if (router) {
      const route = router.currentRoute.value;
      const current = route.query.view || "form";
      const next = current === "preview" ? "code" : "preview";
      router
        .push({
          name: route.name || "editor",
          params: route.params,
          query: { view: next },
        })
        .catch(() => {});
    }
  };

  // provide a toggle for the (future) diff UI so components that inject it don't fail
  const toggleDiff = (router) => {
    if (router) {
      const route = router.currentRoute.value;
      const current = route.query.view || "form";
      const next = current === "preview" ? "code" : "preview";
      router
        .push({
          name: route.name || "editor",
          params: route.params,
          query: { view: next },
        })
        .catch(() => {});
    }
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
  // Wrap editor.newSpec so it also triggers spec list refresh and updates parsed preview
  provide("newSpec", () => {
    try {
      editor.newSpec();
      // update parsed preview immediately so UI reflects the new draft
      editor.updatePreview();
      // log unsavedSpec state so we can diagnose why SpecList doesn't see it
      try {
        console.debug(
          "useApp.newSpec wrapper: editor.unsavedSpec (after newSpec)",
          editor.unsavedSpec ? editor.unsavedSpec.value : null,
        );
      } catch (e) {
        console.debug(
          "useApp.newSpec wrapper: failed to read editor.unsavedSpec",
          e,
        );
      }
      // bump the spec list key so components listening to refreshSpecList reload
      specListKey.value++;
      console.debug(
        "useApp.newSpec wrapper: called editor.newSpec and incremented specListKey to",
        specListKey.value,
      );
      // Also emit a window-level event as a fallback so listeners that for some reason
      // don't see the provided ref update still receive a notification.
      try {
        nextTick(() =>
          window.dispatchEvent(
            new CustomEvent("fastspec:newSpec", {
              detail: { key: specListKey.value },
            }),
          ),
        );
      } catch (e) {
        console.debug(
          "useApp.newSpec wrapper: failed to dispatch global event",
          e,
        );
      }
    } catch (err) {
      console.error("useApp.newSpec wrapper: failed to create new spec", err);
    }
  });
  provide("openSaveDialog", saver.openSaveDialog);
  const toast = useToast();
  provide("validateCurrentSpec", async () => {
    try {
      const spec_json = JSON.parse(editor.specContent.value);
      const result = await validateSpec(spec_json);
      if (result.valid)
        toast.add({ severity: "success", summary: "Valid", detail: "✓ Specification is valid!", life: 4000 });
      else
        toast.add({ severity: "error", summary: "Invalid", detail: "Validation failed", life: 4000 });
    } catch (e) {
      toast.add({ severity: "error", summary: "Invalid JSON", detail: e.message, life: 6000 });
    }
  });
  provide("loadTemplate", loadTemplate);
  provide("togglePreview", togglePreview);
  provide("toggleDiff", toggleDiff);
  // legacy viewMode provide kept for compatibility; value is query-driven in views
  provide("viewMode", ref("form"));
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

  const loadSpec = async (spec) => {
    // call the editor loader (may be sync or async) and then reset lint state
    await Promise.resolve(editor.loadSpec(spec));
    lintResults.value = null;
    lintError.value = null;
    lintLoading.value = false;
  };

  const app = {
    isAuthenticated,
    currentSpec: editor.currentSpec,
    specContent: editor.specContent,
    parsedSpec: editor.parsedSpec,
    selectedSpecId,
    showSaveDialog: saver.showSaveDialog,
    showLoginDialog,
    showTokenDialog,
    alert: alerts.alert,
    viewModeOptions,
    showAlert: alerts.showAlert,
    closeAlert: alerts.closeAlert,
    updatePreview: editor.updatePreview,
    updateFromForm: editor.updateFromForm,
    loadSpec: loadSpec,
    // expose loadTemplate so templates using @load-template="loadTemplate" work
    loadTemplate,
    saveSpec,
    editorPanelRef,
    lintResults,
    lintLoading,
    lintError,
    runLint,
    handleGoToLine,
    showLivePreview,
    toggleLivePreview,
    fetchOpenApiFile: diff.fetchOpenApiFile,
    openapiFileRaw: diff.openapiFileRaw,
    openapiBaseline: diff.openapiBaseline,
    openapiFileDiff: diff.openapiFileDiff,
    openapiFileHasChanges: diff.openapiFileHasChanges,
    formattedOpenapiFileDiff: diff.formattedOpenapiFileDiff,
    copyOpenapiFileDiff: diff.copyOpenapiFileDiff,
  };
  // store singleton and return
  _appInstance = app;
  return app;
}
