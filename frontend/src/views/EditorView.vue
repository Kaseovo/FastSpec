<template>
  <div class="editor-view">
    <div class="editor-left">
      <ErrorBoundary v-if="isAuthenticated">
        <SpecList @spec-selected="loadSpec" :selected-id="selectedSpecId" />
      </ErrorBoundary>
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
import { useApp } from "../composables/useApp";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

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
    const app = useApp();
    const route = useRoute();
    const router = useRouter();

    const mode = computed(() => route.query.view || "form");

    // if route has :id param, load spec
    if (route.params.id) {
      app.loadSpec(route.params.id).catch(() => {});
    }

    return {
      ...app,
      mode,
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
}

.editor-left {
  min-height: 0;
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
