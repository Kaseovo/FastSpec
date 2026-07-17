import { computed, ref, inject } from "vue";
import { useRoute, useRouter } from "vue-router";

// Shared wiring for the page-prototype/ shell variants — same injected
// context EditorView.vue already relies on (specEditor, lint), reached the
// same way (inject(), since useApp()'s provide() calls happen once in
// AppLayout.vue regardless of which shell renders below it). Each page
// variant calls this once and gets real spec state, real lint, and the
// same mode/spec-selection logic EditorView.vue uses — only the
// surrounding chrome differs between variants.
export function usePagePrototypeContent() {
  const specEditor = inject("specEditor");
  const lint = inject("lint");
  const route = useRoute();
  const router = useRouter();

  const mode = computed(() => route.query.view || "form");

  if (route.params.id) {
    specEditor.loadSpec(route.params.id);
  }

  const showLivePreview = ref(false);
  const toggleLivePreview = () => {
    showLivePreview.value = !showLivePreview.value;
  };

  // Note: unlike EditorView.vue, this doesn't scroll to the exact line —
  // switching to Code mode is enough to evaluate the page layout, and
  // wiring the EditorPanel ref through three different shells for a
  // prototype isn't worth it. Real behavior if this direction is adopted.
  const handleGoToLine = () => {
    router.push({ name: "editor", query: { view: "code" } }).catch(() => {});
  };

  const selectedSpecId = computed(
    () =>
      specEditor.currentSpec.value?.id ??
      (specEditor.unsavedSpec.value ? "__unsaved" : null),
  );

  const setMode = (value) => {
    router
      .push({ name: route.name || "editor", params: route.params, query: { view: value } })
      .catch(() => {});
  };

  return {
    route,
    router,
    mode,
    setMode,
    loadSpec: specEditor.loadSpec,
    parsedSpec: specEditor.parsedSpec,
    specContent: specEditor.specContent,
    updateFromForm: specEditor.updateFromForm,
    updatePreview: specEditor.updatePreview,
    lintResults: lint.lintResults,
    lintLoading: lint.lintLoading,
    lintError: lint.lintError,
    runLint: lint.runLint,
    showLivePreview,
    toggleLivePreview,
    handleGoToLine,
    selectedSpecId,
  };
}
