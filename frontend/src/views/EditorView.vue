<template>
  <div :class="['editor-view', { 'sidebar-collapsed': sidebarCollapsed }]">
    <div class="editor-left">
      <div v-show="!sidebarCollapsed">
        <ErrorBoundary v-if="isAuthenticated">
          <SpecList @spec-selected="loadSpec" :selected-id="selectedSpecId" />
        </ErrorBoundary>
      </div>
    </div>

    <div class="editor-main">
      <template v-if="mode === 'form'">
        <div :class="['code-split', { 'with-preview': showLivePreview }]">
          <div class="code-split__editor">
            <FormEditor
              :model-value="parsedSpec"
              :show-live-preview="showLivePreview"
              @update:modelValue="updateFromForm"
              @toggle-live-preview="toggleLivePreview"
            />
          </div>
          <div v-if="showLivePreview" class="code-split__preview">
            <PreviewPanel :spec="parsedSpec" />
          </div>
        </div>
      </template>

      <template v-else-if="mode === 'code'">
        <div :class="['code-split', { 'with-preview': showLivePreview }]">
          <div class="code-split__editor">
            <EditorPanel
              ref="editorPanelRef"
              v-model="specContent"
              :show-validate="true"
              :lint-results="lintResults"
              :show-live-preview="showLivePreview"
              @update:modelValue="updatePreview"
              @toggle-live-preview="toggleLivePreview"
            />
          </div>
          <div v-if="showLivePreview" class="code-split__preview">
            <PreviewPanel :spec="parsedSpec" />
          </div>
        </div>
      </template>

      <template v-else-if="mode === 'preview'">
        <PreviewPanel :spec="parsedSpec" />
      </template>

      <template v-else-if="mode === 'lint'">
        <LintPanel
          :results="lintResults"
          :loading="lintLoading"
          :error="lintError"
          @run-lint="runLint"
          @go-to-line="handleGoToLine"
        />
      </template>
    </div>
  </div>
</template>

<script>
import SpecList from "../components/SpecList.vue";
import EditorPanel from "../components/EditorPanel.vue";
import FormEditor from "../components/FormEditor.vue";
import LintPanel from "../components/LintPanel.vue";
import PreviewPanel from "../components/PreviewPanel.vue";
import ErrorBoundary from "../components/ErrorBoundary.vue";
import { computed, ref, inject, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

export default {
  name: "EditorView",
  components: {
    SpecList,
    EditorPanel,
    FormEditor,
    LintPanel,
    PreviewPanel,
    ErrorBoundary,
  },
  setup() {
    const specEditor = inject("specEditor");
    const lint = inject("lint");
    const auth = useAuthStore();
    const isAuthenticated = computed(() => auth.isAuthenticated);

    const route = useRoute();
    const router = useRouter();

    const mode = computed(() => route.query.view || "form");

    // if route has :id param, load spec
    if (route.params.id) {
      specEditor.loadSpec(route.params.id);
    }

    const sidebarCollapsed = inject("sidebarCollapsed", { value: false });

    // Local state
    const showLivePreview = ref(false);
    const toggleLivePreview = () => {
      showLivePreview.value = !showLivePreview.value;
    };

    const editorPanelRef = ref(null);
    const handleGoToLine = (result) => {
      router.push({ name: "editor", query: { view: "code" } }).catch(() => {});
      nextTick(() => {
        editorPanelRef.value?.goToLine(result);
      });
    };

    const selectedSpecId = computed(
      () =>
        specEditor.currentSpec.value?.id ??
        (specEditor.unsavedSpec.value ? "__unsaved" : null),
    );

    return {
      isAuthenticated,
      loadSpec: specEditor.loadSpec,
      parsedSpec: specEditor.parsedSpec,
      specContent: specEditor.specContent,
      updateFromForm: specEditor.updateFromForm,
      updatePreview: specEditor.updatePreview,
      lintResults: lint.lintResults,
      lintLoading: lint.lintLoading,
      lintError: lint.lintError,
      runLint: lint.runLint,
      mode,
      sidebarCollapsed,
      showLivePreview,
      toggleLivePreview,
      editorPanelRef,
      handleGoToLine,
      selectedSpecId,
    };
  },
};
</script>

<style scoped>
.editor-view {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  height: 100%;
  transition: grid-template-columns 0.2s ease;
}

.editor-view.sidebar-collapsed {
  grid-template-columns: 0 1fr;
  gap: 0;
}

.editor-view.sidebar-collapsed .editor-left {
  overflow: hidden;
  width: 0;
}

.editor-left {
  min-height: 0;
  position: relative;
}

.sidebar-toggle {
  margin-bottom: 8px;
}

.editor-main {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ensure the EditorPanel or FormEditor fill the column */
.editor-main > * {
  flex: 1 1 auto;
  min-height: 0;
}

/* Split pane layout for code + live preview */
.code-split {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  gap: 0;
  height: 100%;
  position: relative;
}

.code-split.with-preview {
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.code-split__editor {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.code-split__editor > * {
  flex: 1;
  min-height: 0;
}

.code-split__preview {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e5e7eb;
}

.code-split__preview > * {
  flex: 1;
  min-height: 0;
}

</style>
