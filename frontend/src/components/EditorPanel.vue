<template>
  <div class="editor-panel">
    <div class="panel-header">
      <h3>Editor</h3>
      <div class="header-controls">
        <SelectButton
          :model-value="format"
          :options="formatOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          size="small"
          aria-label="Editor format"
          class="format-toggle"
          @update:model-value="switchFormat"
        />
        <span class="header-controls__separator"></span>
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
    <Message v-if="switchError" severity="warn" :closable="true" class="switch-error" @close="switchError = null">
      {{ switchError }}
    </Message>
    <div class="panel-content">
      <div ref="editorContainer" class="monaco-editor"></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch, inject } from "vue";
// `monaco-editor`'s default entry (editor.main.js) eagerly pulls in every
// basic-language contribution (abap, sql, php, ruby, ~60 more) plus the
// css/html/typescript language services. edcore.main.js has the full editing
// UX (find, folding, hover, etc.) minus all language contributions, so we add
// back only what's used: JSON (with its validation worker) and YAML
// highlighting.
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main.js";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import Button from "primevue/button";
import Message from "primevue/message";
import SelectButton from "primevue/selectbutton";
import { locatePath, parseSpecText, specToText } from "../utils/specText";

// Spectral severity → Monaco MarkerSeverity
const SPECTRAL_TO_MONACO_SEVERITY = {
  error: monaco.MarkerSeverity.Error,
  warn: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
  hint: monaco.MarkerSeverity.Hint,
};

const FORMAT_STORAGE_KEY = "fastspec.editorFormat";
// While typing YAML, many intermediate states are valid but meaningless
// (a half-typed key parses as `key: null`); wait for a pause before
// updating the rest of the app.
const YAML_SYNC_DELAY_MS = 250;

function storedFormat() {
  try {
    const value = localStorage.getItem(FORMAT_STORAGE_KEY);
    return value === "json" || value === "yaml" ? value : "yaml";
  } catch {
    return "yaml";
  }
}

function rememberFormat(format) {
  try {
    localStorage.setItem(FORMAT_STORAGE_KEY, format);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

export default {
  name: "EditorPanel",
  components: {
    Button,
    Message,
    SelectButton,
  },
  props: {
    /** Canonical spec content as a JSON string (the app's source of truth). */
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
    const format = ref(storedFormat());
    const switchError = ref(null);
    const formatOptions = [
      { label: "YAML", value: "yaml" },
      { label: "JSON", value: "json" },
    ];
    const validateCurrentSpec = inject("validateCurrentSpec");
    const specEditor = inject("specEditor", null);

    let editor = null;
    let syncTimer = null;
    // The JSON we last emitted from YAML edits: when it comes back as
    // modelValue, the editor text must be left alone (the user is typing).
    let lastEmitted = null;
    let applyingExternalValue = false;

    const setSyntaxError = (error) => {
      if (specEditor?.syntaxError) specEditor.syntaxError.value = error;
      const model = editor?.getModel();
      if (!model) return;
      // JSON syntax errors are already reported by Monaco's JSON worker.
      const markers =
        error && error.format === "yaml"
          ? [
              {
                severity: monaco.MarkerSeverity.Error,
                message: error.message,
                startLineNumber: error.line,
                startColumn: error.column,
                endLineNumber: error.line,
                endColumn: error.column + 1,
                source: "YAML",
              },
            ]
          : [];
      monaco.editor.setModelMarkers(model, "yaml", markers);
    };

    /** Text to show for canonical JSON in the given format (null if unparsable). */
    const displayText = (json, targetFormat) => {
      if (targetFormat === "json") return json;
      try {
        return specToText(JSON.parse(json), "yaml");
      } catch {
        return null;
      }
    };

    const setEditorText = (text) => {
      if (!editor || editor.getValue() === text) return;
      applyingExternalValue = true;
      editor.setValue(text);
      applyingExternalValue = false;
    };

    // ── Editing ─────────────────────────────────────────────────────────────
    const syncFromEditor = () => {
      const text = editor.getValue();
      if (format.value === "json") {
        try {
          JSON.parse(text);
          setSyntaxError(null);
        } catch (e) {
          const { error } = parseSpecText(text);
          setSyntaxError({
            format: "json",
            message: error?.message || e.message,
            line: error?.line || 1,
            column: error?.column || 1,
          });
        }
        emit("update:modelValue", text);
        return;
      }
      const { value, error } = parseSpecText(text);
      if (error) {
        setSyntaxError({ format: "yaml", ...error });
        return;
      }
      setSyntaxError(null);
      lastEmitted = JSON.stringify(value, null, 2);
      emit("update:modelValue", lastEmitted);
    };

    const onEditorChange = () => {
      if (applyingExternalValue) return;
      clearTimeout(syncTimer);
      if (format.value === "json") {
        syncFromEditor();
      } else {
        syncTimer = setTimeout(syncFromEditor, YAML_SYNC_DELAY_MS);
      }
    };

    // ── Switching format ────────────────────────────────────────────────────
    const switchFormat = (target) => {
      if (!target || target === format.value) return;
      clearTimeout(syncTimer);
      const current = editor ? editor.getValue() : null;
      if (current !== null) {
        const { value, error } = parseSpecText(current);
        if (error) {
          switchError.value = `Fix the ${format.value.toUpperCase()} syntax error on line ${error.line} before switching to ${target.toUpperCase()}.`;
          return;
        }
        lastEmitted = JSON.stringify(value, null, 2);
        if (lastEmitted !== props.modelValue) emit("update:modelValue", lastEmitted);
        format.value = target;
        monaco.editor.setModelLanguage(editor.getModel(), target);
        setEditorText(specToText(value, target));
      } else {
        format.value = target;
      }
      switchError.value = null;
      setSyntaxError(null);
      rememberFormat(target);
      applyLintMarkers(props.lintResults);
    };

    // ── Lint markers ────────────────────────────────────────────────────────
    // Positions come from each finding's JSON path, resolved in the text on
    // screen — Spectral's own line numbers refer to the JSON it linted, which
    // only matches the editor in JSON mode.
    const rangeFor = (result) => {
      const model = editor?.getModel();
      if (!model) return null;
      if (Array.isArray(result.path)) {
        const found = locatePath(model.getValue(), result.path);
        if (found) {
          const start = model.getPositionAt(found.start);
          const end = model.getPositionAt(Math.max(found.end, found.start + 1));
          return {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
          };
        }
      }
      if (format.value === "json" && result.range?.start) {
        const startLine = (result.range.start.line ?? 0) + 1; // Spectral is 0-based
        const startCol = (result.range.start.character ?? 0) + 1;
        return {
          startLineNumber: startLine,
          startColumn: startCol,
          endLineNumber: (result.range.end?.line ?? startLine - 1) + 1,
          endColumn: (result.range.end?.character ?? startCol) + 1,
        };
      }
      return null;
    };

    function applyLintMarkers(results) {
      const model = editor?.getModel();
      if (!model) return;
      const markers = (results?.results || [])
        .map((r) => {
          const range = rangeFor(r);
          if (!range) return null;
          return {
            ...range,
            severity: SPECTRAL_TO_MONACO_SEVERITY[r.severity] ?? monaco.MarkerSeverity.Warning,
            message: `[${r.code}] ${r.message}`,
            source: "Spectral",
          };
        })
        .filter(Boolean);
      monaco.editor.setModelMarkers(model, "spectral", markers);
    }

    /** Scroll to a lint finding. Called by the parent through a template ref. */
    function goToLine(result) {
      const range = result ? rangeFor(result) : null;
      if (!editor || !range) return;
      editor.revealLineInCenter(range.startLineNumber);
      editor.setPosition({ lineNumber: range.startLineNumber, column: range.startColumn });
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

      let initialText = displayText(props.modelValue, format.value);
      if (initialText === null) {
        // The content isn't valid JSON (yet): show it as-is.
        format.value = "json";
        initialText = props.modelValue;
      }

      editor = monaco.editor.create(editorContainer.value, {
        value: initialText,
        language: format.value,
        theme: "vs-light",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
      });

      editor.onDidChangeModelContent(onEditorChange);

      // Apply markers if lint results were passed before mount
      if (props.lintResults) applyLintMarkers(props.lintResults);
    });

    onBeforeUnmount(() => {
      clearTimeout(syncTimer);
      if (editor) {
        editor.dispose();
        editor = null;
      }
    });

    // Content changed elsewhere (form editor, loading a spec, a template…).
    watch(
      () => props.modelValue,
      (newValue) => {
        if (!editor) return;
        if (format.value === "yaml" && newValue === lastEmitted) return;
        const text = displayText(newValue, format.value);
        if (text === null) return;
        clearTimeout(syncTimer);
        setEditorText(text);
        setSyntaxError(null);
        applyLintMarkers(props.lintResults);
      },
    );

    // Re-apply markers whenever lint results change
    watch(
      () => props.lintResults,
      (newResults) => applyLintMarkers(newResults),
      { deep: true },
    );

    return {
      editorContainer,
      format,
      formatOptions,
      switchError,
      switchFormat,
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

.format-toggle :deep(.p-togglebutton) {
  padding: 4px 10px;
  font-size: 12px;
}

.switch-error {
  margin: 8px 15px 0;
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
