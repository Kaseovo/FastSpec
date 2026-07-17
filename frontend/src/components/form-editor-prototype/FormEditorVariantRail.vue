<template>
  <div class="fer">
    <aside class="fer-rail">
      <button
        v-for="s in sections"
        :key="s.key"
        class="fer-rail__item"
        :class="{ 'fer-rail__item--active': active === s.key }"
        @click="active = s.key"
        :title="s.label"
      >
        <i :class="s.icon"></i>
        <span class="fer-rail__label">{{ s.label }}</span>
        <span v-if="counts[s.key]" class="fer-rail__count">{{ counts[s.key] }}</span>
      </button>
    </aside>

    <div class="fer-body form-editor">
      <div class="fer-topbar">
        <div class="fer-crumb">
          <i class="pi pi-file-edit"></i>
          <span>Form Editor</span>
          <i class="pi pi-angle-right fer-crumb__sep"></i>
          <strong>{{ activeSection.label }}</strong>
        </div>
        <Button
          :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
          size="small"
          text
          @click="$emit('toggle-live-preview')"
        />
      </div>

      <div class="fer-content">
        <ApiInfoTab v-if="active === 'info'" :form-data="formData" />
        <ServersTab
          v-else-if="active === 'servers'"
          :form-data="formData"
          :has-empty-server-url="hasEmptyServerUrl"
          @add-server="addServer"
          @remove-server="removeServer"
        />
        <PathsTab v-else-if="active === 'paths'" :form-data="formData" :api="pathsApi" />
        <TagsTab
          v-else-if="active === 'tags'"
          :form-data="formData"
          :has-empty-tag-name="hasEmptyTagName"
          :has-duplicate-tag-name="hasDuplicateTagName"
          @add-tag="addTag"
          @remove-tag="removeTag"
        />
        <ComponentsTab v-else-if="active === 'components'" :form-data="formData" :api="componentsApi" />
        <SecurityTab v-else-if="active === 'security'" :form-data="formData" :api="securityApi" />
      </div>
    </div>

    <ResponseCodeDialog
      :visible="showAddResponseDialog"
      @update:visible="showAddResponseDialog = $event"
      :editing-response-code="editingResponseCode"
      :step="responseDialogStep"
      @update:step="responseDialogStep = $event"
      :category="responseDialogCategory"
      @update:category="responseDialogCategory = $event"
      :new-response-code="newResponseCode"
      @update:new-response-code="newResponseCode = $event"
      :status-code-categories="statusCodeCategories"
      :status-codes-for-category="statusCodesForCategory"
      :is-response-code-used="isResponseCodeUsed"
      :get-status-severity="getStatusSeverity"
      @reset="resetResponseDialog"
      @confirm="confirmResponseDialog"
    />
    <AddPathDialog
      :visible="showAddPathDialog"
      @update:visible="showAddPathDialog = $event"
      :http-methods="httpMethods"
      :new-method="newMethod"
      @update:new-method="newMethod = $event"
      :new-path="newPath"
      @update:new-path="newPath = $event"
      @path-keydown="handlePathKeydown"
      @confirm="addPath"
    />
    <AddMethodDialog
      :visible="showAddMethodDialogVisible"
      @update:visible="showAddMethodDialogVisible = $event"
      :available-methods="availableMethodsForPath"
      :method-to-add="methodToAdd"
      @update:method-to-add="methodToAdd = $event"
      @confirm="addMethodToPath"
    />
    <EditPathDialog
      :visible="showEditPathDialog"
      @update:visible="showEditPathDialog = $event"
      :edit-path-value="editPathValue"
      @update:edit-path-value="editPathValue = $event"
      :edit-path-error="editPathError"
      @path-keydown="handleEditPathKeydown"
      @confirm="confirmEditPath"
    />
  </div>
</template>

<script>
import { ref, computed } from "vue";
import Button from "primevue/button";
import ApiInfoTab from "../form-editor/ApiInfoTab.vue";
import ServersTab from "../form-editor/ServersTab.vue";
import TagsTab from "../form-editor/TagsTab.vue";
import PathsTab from "../form-editor/PathsTab.vue";
import ComponentsTab from "../form-editor/ComponentsTab.vue";
import SecurityTab from "../form-editor/SecurityTab.vue";
import AddPathDialog from "../form-editor/AddPathDialog.vue";
import AddMethodDialog from "../form-editor/AddMethodDialog.vue";
import EditPathDialog from "../form-editor/EditPathDialog.vue";
import ResponseCodeDialog from "../form-editor/ResponseCodeDialog.vue";
import { useFormEditorState } from "../../composables/useFormEditorState";

const SECTIONS = [
  { key: "info", label: "Info", icon: "pi pi-info-circle" },
  { key: "servers", label: "Servers", icon: "pi pi-server" },
  { key: "paths", label: "Paths", icon: "pi pi-sitemap" },
  { key: "tags", label: "Tags", icon: "pi pi-tag" },
  { key: "components", label: "Components", icon: "pi pi-box" },
  { key: "security", label: "Security", icon: "pi pi-shield" },
];

export default {
  name: "FormEditorVariantRail",
  components: {
    Button,
    ApiInfoTab,
    ServersTab,
    TagsTab,
    PathsTab,
    ComponentsTab,
    SecurityTab,
    AddPathDialog,
    AddMethodDialog,
    EditPathDialog,
    ResponseCodeDialog,
  },
  props: {
    modelValue: { type: Object, required: true },
    showLivePreview: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup(props, { emit }) {
    const state = useFormEditorState(props, emit);
    const active = ref("info");
    const sections = SECTIONS;
    const counts = computed(() => state.tabCounts.value);
    const activeSection = computed(() => sections.find((s) => s.key === active.value));
    return { ...state, active, sections, counts, activeSection };
  },
};
</script>

<style scoped>
.fer {
  display: grid;
  grid-template-columns: 76px 1fr;
  height: 100%;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.fer-rail {
  background: #14181f;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 12px 8px;
  gap: 4px;
  overflow-y: auto;
}

.fer-rail__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border: none;
  background: transparent;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.fer-rail__item i {
  font-size: 17px;
}

.fer-rail__label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.fer-rail__item:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.06);
}

.fer-rail__item--active {
  color: #fff;
  background: linear-gradient(135deg, #2563ff, #1d4ed8);
}

.fer-rail__count {
  position: absolute;
  top: 4px;
  right: 6px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: #f59e0b;
  color: #1f2937;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* .form-editor (form-editor-shared.css) also sets background/border/
   border-radius/overflow — those are meant for FormEditor.vue's own root,
   not this nested rail body, so they're stripped back out here. Only the
   `.form-editor .p-*` descendant rules (accordions, tabs, chips, buttons)
   are what this class is really here for. */
.fer-body.form-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: visible;
  height: auto;
}

.fer-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.fer-crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 13px;
}

.fer-crumb strong {
  color: #111827;
  font-weight: 600;
}

.fer-crumb__sep {
  font-size: 11px;
  color: #d1d5db;
}

.fer-content {
  flex: 1;
  overflow-y: auto;
}
</style>
