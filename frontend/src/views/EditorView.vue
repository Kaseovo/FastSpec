<template>
  <div class="editor-view">
    <div class="editor-left">
      <SpecList
        v-if="isAuthenticated"
        @spec-selected="loadSpec"
        :selected-id="selectedSpecId"
      />
    </div>

    <div class="editor-main">
      <template v-if="mode === 'form'">
        <FormEditor
          :model-value="parsedSpec"
          @update:modelValue="updateFromForm"
        />
      </template>

      <template v-else-if="mode === 'code'">
        <EditorPanel
          ref="editorPanelRef"
          v-model="specContent"
          :show-validate="true"
          :lint-results="lintResults"
          @update:modelValue="updatePreview"
        />
      </template>

      <template v-else-if="mode === 'preview'">
        <!-- Preview injected into the editor main when router query view=preview is set -->
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
import { useApp } from "../composables/useApp";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export default {
  name: "EditorView",
  components: { SpecList, EditorPanel, FormEditor, LintPanel, PreviewPanel },
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
</style>
