<template>
  <div class="editor-panel">
    <div class="panel-header">
      <h3>Editor</h3>
    </div>
    <div class="panel-content">
      <div ref="editorContainer" class="monaco-editor"></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from "vue";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

export default {
  name: "EditorPanel",
  props: {
    modelValue: {
      type: String,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const editorContainer = ref(null);
    let editor = null;

    onMounted(() => {
      // Configure Monaco Editor worker
      self.MonacoEnvironment = {
        getWorker(_, label) {
          if (label === "json") {
            return new jsonWorker();
          }
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
    });

    watch(
      () => props.modelValue,
      (newValue) => {
        if (editor && editor.getValue() !== newValue) {
          editor.setValue(newValue);
        }
      }
    );

    return {
      editorContainer,
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
  color: #1f2937;
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
