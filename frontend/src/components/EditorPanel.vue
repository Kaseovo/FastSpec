<template>
  <div class="editor-panel">
    <div class="panel-header">
      <h3>Editor</h3>
      <div class="header-controls">
        <Button
          :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
          :severity="showLivePreview ? 'primary' : 'secondary'"
          size="small"
          outlined
          @click="$emit('toggle-live-preview')"
        />
        <span class="header-controls__separator"></span>
        <Button
          v-if="showValidate"
          label="Validate"
          icon="pi pi-check-circle"
          severity="info"
          size="small"
          @click="validateCurrentSpec"
        />
      </div>
    </div>
    <div class="panel-content">
      <div ref="editorContainer" class="monaco-editor"></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch, inject } from "vue";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import Button from "primevue/button";

// Spectral severity (int) → Monaco MarkerSeverity
const SPECTRAL_TO_MONACO_SEVERITY = {
  error: monaco.MarkerSeverity.Error,
  warn:  monaco.MarkerSeverity.Warning,
  info:  monaco.MarkerSeverity.Info,
  hint:  monaco.MarkerSeverity.Hint,
};

export default {
  name: "EditorPanel",
  components: {
    Button,
  },
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    showValidate: {
      type: Boolean,
      default: false,
    },
    /**
     * Lint results from the backend: { score, summary, results[] }
     * When set, Monaco markers (squiggles) are applied automatically.
     */
    lintResults: {
      type: Object,
      default: null,
    },
    showLivePreview: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup(props, { emit }) {
    const editorContainer = ref(null);
    let editor = null;
    const validateCurrentSpec = inject("validateCurrentSpec");

    // ── Monaco markers ──────────────────────────────────────────────────────
    function applyLintMarkers(results) {
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      if (!results || !results.results || results.results.length === 0) {
        monaco.editor.setModelMarkers(model, "spectral", []);
        return;
      }

      const markers = results.results.map((r) => {
        const startLine   = (r.range?.start?.line   ?? 0) + 1; // Spectral is 0-based
        const startCol    = (r.range?.start?.character ?? 0) + 1;
        const endLine     = (r.range?.end?.line     ?? startLine - 1) + 1;
        const endCol      = (r.range?.end?.character ?? startCol) + 1;

        return {
          severity : SPECTRAL_TO_MONACO_SEVERITY[r.severity] ?? monaco.MarkerSeverity.Warning,
          message  : `[${r.code}] ${r.message}`,
          startLineNumber: startLine,
          startColumn    : startCol,
          endLineNumber  : endLine,
          endColumn      : endCol,
          source         : "Spectral",
        };
      });

      monaco.editor.setModelMarkers(model, "spectral", markers);
    }

    /**
     * Scroll Monaco to the line reported by a lint result.
     * Call this from the parent via a provide/inject or emitted event.
     */
    function goToLine(result) {
      if (!editor || !result?.range?.start) return;
      const line = (result.range.start.line ?? 0) + 1;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: (result.range.start.character ?? 0) + 1 });
      editor.focus();
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────
    onMounted(() => {
      self.MonacoEnvironment = {
        getWorker(_, label) {
          if (label === "json") return new jsonWorker();
          return new editorWorker();
        },
      };

      editor = monaco.editor.create(editorContainer.value, {
        value: props.modelValue,
        language: "json",
        theme: "vs-light",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
      });

      editor.onDidChangeModelContent(() => {
        emit("update:modelValue", editor.getValue());
      });

      // Apply markers if lint results were passed before mount
      if (props.lintResults) applyLintMarkers(props.lintResults);
    });

    onBeforeUnmount(() => {
      if (editor) {
        editor.dispose();
        editor = null;
      }
    });

    watch(
      () => props.modelValue,
      (newValue) => {
        if (editor && editor.getValue() !== newValue) {
          editor.setValue(newValue);
        }
      }
    );

    // Re-apply markers whenever lint results change
    watch(
      () => props.lintResults,
      (newResults) => applyLintMarkers(newResults),
      { deep: true }
    );

    return {
      editorContainer,
      validateCurrentSpec,
      goToLine,
    };
  },
};
</script>

<style scoped>
.editor-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 15px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 16px;
  color: var(--p-text-color, #1f2937);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-controls__separator {
  width: 1px;
  height: 24px;
  background: var(--p-surface-border, #e5e7eb);
}

.panel-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.monaco-editor {
  width: 100%;
  height: 100%;
}
</style>
