<template>
  <div class="fed form-editor">
    <div class="fed-stats">
      <div class="fed-stat fed-stat--paths">
        <i class="pi pi-sitemap"></i>
        <div><strong>{{ tabCounts.paths }}</strong><span>Paths</span></div>
      </div>
      <div class="fed-stat fed-stat--components">
        <i class="pi pi-box"></i>
        <div><strong>{{ tabCounts.components }}</strong><span>Schemas</span></div>
      </div>
      <div class="fed-stat fed-stat--tags">
        <i class="pi pi-tag"></i>
        <div><strong>{{ tabCounts.tags }}</strong><span>Tags</span></div>
      </div>
      <div class="fed-stat fed-stat--security">
        <i class="pi pi-shield"></i>
        <div><strong>{{ tabCounts.security }}</strong><span>Security Reqs</span></div>
      </div>
      <Button
        class="fed-preview-btn"
        :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
        :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
        size="small"
        outlined
        @click="$emit('toggle-live-preview')"
      />
    </div>

    <div class="fed-pills">
      <button
        v-for="s in sections"
        :key="s.key"
        class="fed-pill"
        :class="[`fed-pill--${s.key}`, { 'fed-pill--active': active === s.key }]"
        @click="active = s.key"
      >
        <i :class="s.icon"></i> {{ s.label }}
        <span v-if="tabCounts[s.key]" class="fed-pill__count">{{ tabCounts[s.key] }}</span>
      </button>
    </div>

    <div class="fed-content">
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
import { ref } from "vue";
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
  name: "FormEditorVariantDashboard",
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
    return { ...state, active, sections: SECTIONS };
  },
};
</script>

<style scoped>
.fed.form-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.fed-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #0b1220 0%, #1c2333 100%);
}

.fed-stat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.fed-stat i {
  font-size: 18px;
  color: #fff;
  opacity: 0.85;
}

.fed-stat div {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.fed-stat strong {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}

.fed-stat span {
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fed-stat--paths i { color: #60a5fa; }
.fed-stat--components i { color: #c4b5fd; }
.fed-stat--tags i { color: #fbbf24; }
.fed-stat--security i { color: #34d399; }

.fed-preview-btn {
  margin-left: auto;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

.fed-pills {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  flex-wrap: wrap;
  border-bottom: 1px solid #e5e7eb;
}

.fed-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1.5px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.fed-pill:hover {
  border-color: #d1d5db;
}

.fed-pill__count {
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
}

.fed-pill--active {
  color: #fff;
  border-color: transparent;
}

.fed-pill--active .fed-pill__count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.fed-pill--info.fed-pill--active { background: #6b7280; }
.fed-pill--servers.fed-pill--active { background: #2563eb; }
.fed-pill--paths.fed-pill--active { background: #1d4ed8; }
.fed-pill--tags.fed-pill--active { background: #d97706; }
.fed-pill--components.fed-pill--active { background: #7c3aed; }
.fed-pill--security.fed-pill--active { background: #059669; }

.fed-content {
  flex: 1;
  overflow-y: auto;
}
</style>
