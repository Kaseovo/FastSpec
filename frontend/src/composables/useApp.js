import { ref, computed, provide, nextTick } from "vue";

import { useAuthStore } from "../stores/auth";
import { useSpecEditor } from "./useSpecEditor";
import { useSpecSave } from "./useSpecSave";
import { useSpecDiff } from "./useSpecDiff";
import { useAlerts } from "./useAlerts";
import { useLint } from "./useLint";

export function useApp() {
  const auth = useAuthStore();
  const isAuthenticated = computed(() => auth.isAuthenticated);

  const alerts = useAlerts();
  const editor = useSpecEditor();
  const diff = useSpecDiff();
  const lint = useLint({
    specContentRef: editor.specContent,
    currentSpecRef: editor.currentSpec,
  });
  const saver = useSpecSave({
    isAuthenticatedRef: isAuthenticated,
    specContentRef: editor.specContent,
    currentSpecRef: editor.currentSpec,
    initialSpecRef: editor.initialSpec,
    showAlert: alerts.showAlert,
  });

  const { lintResults, lintLoading, lintError, runLint } = lint;

  const specListKey = ref(0);

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

  const loadTemplate = editor.loadTemplate;

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

  // provide grouped composables
  provide("specEditor", editor);
  provide("specSave", saver);
  provide("specDiff", diff);
  provide("alerts", alerts);
  provide("lint", lint);

  // legacy provides
  // Wrap editor.newSpec so it also triggers spec list refresh and updates parsed preview
  const newSpec = () => {
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
  };
  const discardUnsaved = () => {
    editor.unsavedSpec.value = null;
    editor.hasUnsavedChanges.value = false;
  };

  provide("newSpec", newSpec);
  provide("openSaveDialog", saver.openSaveDialog);
  provide("loadTemplate", loadTemplate);
  provide("togglePreview", togglePreview);
  provide("toggleDiff", toggleDiff);
  // legacy viewMode provide kept for compatibility; value is query-driven in views
  provide("viewMode", ref("form"));
  provide("refreshSpecList", specListKey);
  provide("unsavedSpec", editor.unsavedSpec);
  provide("hasUnsavedChanges", editor.hasUnsavedChanges);
  provide("discardUnsaved", discardUnsaved);
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
    showSaveDialog: saver.showSaveDialog,
    alert: alerts.alert,
    showAlert: alerts.showAlert,
    closeAlert: alerts.closeAlert,
    updatePreview: editor.updatePreview,
    updateFromForm: editor.updateFromForm,
    loadSpec: loadSpec,
    loadTemplate,
    newSpec,
    hasUnsavedChanges: editor.hasUnsavedChanges,
    discardUnsaved,
    saveSpec,
    lintResults,
    lintLoading,
    lintError,
    runLint,
    fetchOpenApiFile: diff.fetchOpenApiFile,
    openapiFileRaw: diff.openapiFileRaw,
    openapiBaseline: diff.openapiBaseline,
    openapiFileDiff: diff.openapiFileDiff,
    openapiFileHasChanges: diff.openapiFileHasChanges,
    formattedOpenapiFileDiff: diff.formattedOpenapiFileDiff,
    copyOpenapiFileDiff: diff.copyOpenapiFileDiff,
  };
  // store and return
  return app;
}
