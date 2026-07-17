<template>
  <div class="ppc">
    <FormEditorVariantTree
      v-if="mode === 'form'"
      :model-value="parsedSpec"
      :show-live-preview="showLivePreview"
      @update:modelValue="updateFromForm"
      @toggle-live-preview="$emit('toggle-live-preview')"
    />
    <EditorPanel
      v-else-if="mode === 'code'"
      :model-value="specContent"
      :show-validate="true"
      :lint-results="lintResults"
      :show-live-preview="showLivePreview"
      @update:modelValue="updatePreview"
      @toggle-live-preview="$emit('toggle-live-preview')"
    />
    <PreviewPanel v-else-if="mode === 'preview'" :spec="parsedSpec" />
    <LintPanel
      v-else-if="mode === 'lint'"
      :results="lintResults"
      :loading="lintLoading"
      :error="lintError"
      @run-lint="$emit('run-lint')"
      @go-to-line="$emit('go-to-line', $event)"
    />
  </div>
</template>

<script>
// Shared mode-based content pane reused by every page-prototype/ shell
// variant — only the surrounding chrome (header, sidebar, mode switcher
// placement) differs per variant, not what actually renders for a given
// mode. Mirrors EditorView.vue's own mode switch. `updateFromForm` and
// `updatePreview` are passed straight through as functions (from
// usePagePrototypeContent) rather than re-wrapped in an emit, since they're
// two genuinely different write paths (form-driven vs raw-code-driven) that
// EditorView.vue itself keeps separate.
import EditorPanel from "../EditorPanel.vue";
import PreviewPanel from "../PreviewPanel.vue";
import LintPanel from "../LintPanel.vue";
import FormEditorVariantTree from "../form-editor-prototype/FormEditorVariantTree.vue";

export default {
  name: "PagePrototypeContent",
  components: { EditorPanel, PreviewPanel, LintPanel, FormEditorVariantTree },
  props: {
    mode: { type: String, required: true },
    parsedSpec: { type: Object, required: true },
    specContent: { type: String, required: true },
    lintResults: { type: Object, default: null },
    lintLoading: { type: Boolean, default: false },
    lintError: { type: String, default: null },
    showLivePreview: { type: Boolean, default: false },
    updateFromForm: { type: Function, required: true },
    updatePreview: { type: Function, required: true },
  },
  emits: ["toggle-live-preview", "run-lint", "go-to-line"],
};
</script>

<style scoped>
.ppc {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ppc > * {
  flex: 1;
  min-height: 0;
}
</style>
