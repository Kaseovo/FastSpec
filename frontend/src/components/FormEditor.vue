<template>
  <div class="form-editor">
    <div class="form-header">
      <h3>Form Editor</h3>
      <div class="form-header__controls">
        <Button
          :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
          class="preview-toggle-btn"
          size="small"
          text
          @click="$emit('toggle-live-preview')"
        />
      </div>
    </div>

    <div class="form-content">
      <Tabs value="0">
        <TabList>
          <Tab value="0">
            <i class="pi pi-info-circle"></i>
            <span>Info</span>
          </Tab>
          <Tab value="1">
            <i class="pi pi-server"></i>
            <span>Servers</span>
          </Tab>
          <Tab value="2">
            <i class="pi pi-sitemap"></i>
            <span>Paths</span>
          </Tab>
          <Tab value="3">
            <i class="pi pi-tag"></i>
            <span>Tags</span>
          </Tab>
          <Tab value="4">
            <i class="pi pi-box"></i>
            <span>Components</span>
          </Tab>
        </TabList>

        <TabPanels>
          <!-- API Info Tab -->
          <TabPanel value="0">
            <ApiInfoTab :form-data="formData" />
          </TabPanel>

          <!-- Servers Tab -->
          <TabPanel value="1">
            <ServersTab
              :form-data="formData"
              :has-empty-server-url="hasEmptyServerUrl"
              @add-server="addServer"
              @remove-server="removeServer"
            />
          </TabPanel>

          <!-- Paths Tab -->
          <TabPanel value="2">
            <PathsTab :form-data="formData" :api="pathsApi" />
          </TabPanel>

          <!-- Tags Tab -->
          <TabPanel value="3">
            <TagsTab
              :form-data="formData"
              :has-empty-tag-name="hasEmptyTagName"
              :has-duplicate-tag-name="hasDuplicateTagName"
              @add-tag="addTag"
              @remove-tag="removeTag"
            />
          </TabPanel>

          <!-- Components Tab -->
          <TabPanel value="4">
            <ComponentsTab :form-data="formData" :api="componentsApi" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <!-- Add / Edit Response Code Dialog (two-step: category → code) -->
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

    <!-- Add Path Dialog -->
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

    <!-- Add Method Dialog -->
    <AddMethodDialog
      :visible="showAddMethodDialogVisible"
      @update:visible="showAddMethodDialogVisible = $event"
      :available-methods="availableMethodsForPath"
      :method-to-add="methodToAdd"
      @update:method-to-add="methodToAdd = $event"
      @confirm="addMethodToPath"
    />

    <!-- Edit Path Dialog -->
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
import { ref, computed, watch } from "vue";
import Button from "primevue/button";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ApiInfoTab from "./form-editor/ApiInfoTab.vue";
import ServersTab from "./form-editor/ServersTab.vue";
import TagsTab from "./form-editor/TagsTab.vue";
import PathsTab from "./form-editor/PathsTab.vue";
import ComponentsTab from "./form-editor/ComponentsTab.vue";
import AddPathDialog from "./form-editor/AddPathDialog.vue";
import AddMethodDialog from "./form-editor/AddMethodDialog.vue";
import EditPathDialog from "./form-editor/EditPathDialog.vue";
import ResponseCodeDialog from "./form-editor/ResponseCodeDialog.vue";
import { usePathsEditor } from "../composables/usePathsEditor";
import { useComponentsEditor } from "../composables/useComponentsEditor";
import {
  normalizeRefsForForm,
  cleanRefsForOutput,
  getMethodSeverity,
  getMethodDescription,
  getStatusSeverity,
  statusCodeCategories,
  statusCodesForCategory,
  getStatusName,
} from "../utils/openApiFormHelpers";

export default {
  name: "FormEditor",
  components: {
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    ApiInfoTab,
    ServersTab,
    TagsTab,
    PathsTab,
    ComponentsTab,
    AddPathDialog,
    AddMethodDialog,
    EditPathDialog,
    ResponseCodeDialog,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    showLivePreview: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup(props, { emit }) {
    const formData = ref({
      openapi: "3.0.0",
      info: {
        title: "",
        version: "",
        description: "",
        contact: { name: "", email: "" },
        license: { name: "", url: "" },
      },
      servers: [],
      tags: [],
      paths: {},
      components: {
        schemas: {},
      },
    });

    const hasChanges = ref(false);

    const confirm = useConfirm();
    const toast = useToast();

    // Initialize form data from prop
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue && Object.keys(newValue).length > 0) {
          formData.value = normalizeRefsForForm(JSON.parse(JSON.stringify(newValue)));
          // Ensure nested objects exist
          if (!formData.value.info) formData.value.info = {};
          if (!formData.value.info.contact) formData.value.info.contact = {};
          if (!formData.value.info.license) formData.value.info.license = {};
          if (!formData.value.servers) formData.value.servers = [];
          if (!formData.value.tags) formData.value.tags = [];
          else {
            // Ensure each tag has the internal _showExternalDocs flag and externalDocs object
            formData.value.tags = formData.value.tags.map(t => ({
              ...t,
              externalDocs: t.externalDocs || { description: '', url: '' },
              _showExternalDocs: !!(t.externalDocs?.description || t.externalDocs?.url),
            }));
          }
          if (!formData.value.paths) formData.value.paths = {};
          if (!formData.value.components) formData.value.components = {};
          if (!formData.value.components.schemas)
            formData.value.components.schemas = {};
        }
      },
      { immediate: true, deep: true }
    );

    // Watch for form changes and emit updates to parent on every deep change
    watch(
      formData,
      (newVal) => {
        hasChanges.value = true;
        try {
          const cleaned = JSON.parse(JSON.stringify(newVal));
          if (cleaned.info) {
            if (
              cleaned.info.contact &&
              !cleaned.info.contact.name &&
              !cleaned.info.contact.email
            ) {
              delete cleaned.info.contact;
            }
            if (
              cleaned.info.license &&
              !cleaned.info.license.name &&
              !cleaned.info.license.url
            ) {
              delete cleaned.info.license;
            }
          }
          // Clean tags: strip internal _showExternalDocs flag; omit empty externalDocs
          if (cleaned.tags) {
            cleaned.tags = cleaned.tags
              .filter((t) => t.name && t.name.trim())
              .map((t) => {
                const out = { name: t.name };
                if (t.description) out.description = t.description;
                if (t.externalDocs?.url || t.externalDocs?.description) {
                  out.externalDocs = {};
                  if (t.externalDocs.description) out.externalDocs.description = t.externalDocs.description;
                  if (t.externalDocs.url) out.externalDocs.url = t.externalDocs.url;
                }
                return out;
              });
            if (cleaned.tags.length === 0) delete cleaned.tags;
          }
          emit("update:modelValue", cleanRefsForOutput(cleaned));
        } catch (e) {
          // Fallback: emit raw value if cloning fails
          emit("update:modelValue", newVal);
        }
      },
      { deep: true }
    );

    // ── Server helpers ───────────────────────────────────────────────────────

    const hasEmptyServerUrl = computed(() => {
      return formData.value.servers.some((server) => !server.url || server.url.trim() === "");
    });

    const addServer = () => {
      if (hasEmptyServerUrl.value) {
        toast.add({
          severity: "error",
          summary: "Cannot Add Server",
          detail: "Please fill in the URL for all existing servers first.",
          life: 3000,
        });
        return;
      }
      formData.value.servers.push({ url: "", description: "" });
      toast.add({
        severity: "success",
        summary: "Server Added",
        detail: "A new server entry has been added.",
        life: 3000,
      });
    };

    const removeServer = (index) => {
      confirm.require({
        message: "Are you sure you want to delete this server?",
        header: "Confirm Deletion",
        icon: "pi pi-exclamation-triangle",
        acceptProps: {
            label: "Yes",
            severity: "danger",
        },
        rejectProps: {
            label: "No",
            outlined: true,
        },
        accept: () => {
          formData.value.servers.splice(index, 1);
          toast.add({
            severity: "success",
            summary: "Server Deleted",
            detail: "The server has been removed.",
            life: 3000,
          });
          confirm.close();
        },
        reject: () => {
          confirm.close();
        }
      });
    };

    // ── Tag helpers ─────────────────────────────────────────────────────────

    const hasEmptyTagName = computed(() => {
      return (formData.value.tags || []).some((tag) => !tag.name || tag.name.trim() === "");
    });

    const hasDuplicateTagName = computed(() => {
      const names = (formData.value.tags || []).map((t) => (t.name || "").trim()).filter(Boolean);
      return names.length !== new Set(names).size;
    });

    const addTag = () => {
      if (hasEmptyTagName.value) {
        toast.add({
          severity: "error",
          summary: "Cannot Add Tag",
          detail: "Please fill in the name for all existing tags first.",
          life: 3000,
        });
        return;
      }
      if (hasDuplicateTagName.value) {
        toast.add({
          severity: "error",
          summary: "Cannot Add Tag",
          detail: "Tag names must be unique. Please resolve duplicate names first.",
          life: 3000,
        });
        return;
      }
      formData.value.tags.push({ name: "", description: "", externalDocs: { description: "", url: "" }, _showExternalDocs: false });
      toast.add({
        severity: "success",
        summary: "Tag Added",
        detail: "A new tag entry has been added.",
        life: 3000,
      });
    };

    const removeTag = (index) => {
      confirm.require({
        message: "Are you sure you want to delete this tag?",
        header: "Confirm Deletion",
        icon: "pi pi-exclamation-triangle",
        acceptProps: {
          label: "Yes",
          severity: "danger",
        },
        rejectProps: {
          label: "No",
          outlined: true,
        },
        accept: () => {
          formData.value.tags.splice(index, 1);
          toast.add({
            severity: "success",
            summary: "Tag Deleted",
            detail: "The tag has been removed.",
            life: 3000,
          });
          confirm.close();
        },
        reject: () => {
          confirm.close();
        },
      });
    };

    // ── Paths & Components tabs (extracted into composables) ──────────────────
    // Each composable is instantiated ONCE here so the trailing path dialogs
    // (mounted in this template) and the PathsTab child bind to the same refs.
    const paths = usePathsEditor(formData, confirm, toast);
    const components = useComponentsEditor(formData, confirm, toast);

    // Shared, cross-tab drag glue. handleDragEnd must clear BOTH tabs' transient
    // drag state (a single handler is bound in both tab templates and asserted
    // by both spec files); path drags and property drags never overlap, so
    // resetting both is safe. handleDragOver is stateless and shared.
    const handleDragOver = components.handleDragOver;
    const handleDragEnd = (event) => {
      event.target.classList.remove("dragging");
      event.target.classList.remove("dragging-method");
      paths.resetPathDrag();
      components.resetPropertyDrag();
    };

    // Bundles passed as a single `api` prop to each tab child (which re-exposes
    // them from its own setup so the moved templates keep using bare names).
    const pathsApi = {
      ...paths,
      handleDragOver,
      handleDragEnd,
      getStatusName,
      getStatusSeverity,
    };
    const componentsApi = { ...components, handleDragOver, handleDragEnd };

    return {
      formData,
      hasChanges,
      // Server / tag helpers (owned by FormEditor)
      hasEmptyServerUrl,
      addServer,
      removeServer,
      hasEmptyTagName,
      hasDuplicateTagName,
      addTag,
      removeTag,
      // Re-exposed pure helpers (used by trailing dialogs / other tabs)
      getMethodSeverity,
      getMethodDescription,
      getStatusSeverity,
      getStatusName,
      statusCodeCategories,
      statusCodesForCategory,
      // Tab api bundles
      pathsApi,
      componentsApi,
      // Shared drag handlers
      handleDragOver,
      handleDragEnd,
      // Spread composable returns so trailing dialogs resolve their bindings and
      // the existing characterization tests (wrapper.vm.<fn>) keep passing.
      ...paths,
      ...components,
    };
  },
};
</script>

<style scoped>
.form-editor {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.form-header {
  padding: 16px 20px;
  background: #1f2937;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.form-header__controls :deep(.p-button) {
  color: rgba(255, 255, 255, 0.85) !important;
  background: transparent;
  border: none;
}

.form-header__controls :deep(.p-button:hover) {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.form-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.form-content::-webkit-scrollbar {
  width: 6px;
}

.form-content::-webkit-scrollbar-track {
  background: transparent;
}

.form-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.form-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.form-section {
  padding: 28px 24px;
}

.form-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.section-header h4 {
  margin-bottom: 0;
}

.section-header h5 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.form-field :deep(.p-inputtext),
.form-field :deep(.p-textarea),
.form-field :deep(.p-select),
.form-field :deep(.p-inputnumber-input) {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 14px;
  transition: border-color 0.15s ease;
  background: #ffffff;
}

.form-field :deep(.p-inputtext:hover),
.form-field :deep(.p-textarea:hover),
.form-field :deep(.p-select:hover),
.form-field :deep(.p-inputnumber-input:hover) {
  border-color: #d1d5db;
}

.form-field :deep(.p-inputtext:focus),
.form-field :deep(.p-textarea:focus),
.form-field :deep(.p-select:focus),
.form-field :deep(.p-inputnumber-input:focus) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  outline: none;
}

.form-field :deep(.p-autocomplete) {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 10px;
  transition: border-color 0.15s ease;
}

.form-field :deep(.p-autocomplete:hover) {
  border-color: #d1d5db;
}

.form-field :deep(.p-autocomplete:focus-within) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #f3f4f6;
}

.checkbox-field:hover {
  background: #f3f4f6;
}

.checkbox-field label {
  margin-bottom: 0;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

:deep(.p-button) {
  border-radius: 6px;
  font-weight: 500;
  padding: 8px 16px;
  transition: background-color 0.15s ease;
  border: none;
  font-size: 13px;
}

:deep(.p-button:hover:not(:disabled)) {
  opacity: 0.9;
  transform: none !important;
}

:deep(.p-button-sm) {
  padding: 6px 12px;
  font-size: 12px;
}

:deep(.p-button-danger) {
  background: #ef4444;
}

:deep(.p-button-danger:hover) {
  background: #dc2626;
}

:deep(.p-button-secondary) {
  background: #f3f4f6;
  color: #374151;
}

:deep(.p-button-secondary:hover) {
  background: #e5e7eb;
}

.list-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 10px;
  align-items: flex-start;
  transition: border-color 0.15s ease;
}

.list-item:hover {
  border-color: #d1d5db;
}

.list-item-content {
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px dashed #e5e7eb;
}

.empty-state i {
  font-size: 40px;
  margin-bottom: 12px;
  color: #d1d5db;
}

.empty-state p {
  font-size: 14px;
  color: #6b7280;
}

.empty-state-small {
  text-align: center;
  padding: 32px 16px;
  color: #9ca3af;
  font-size: 13px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px dashed #e5e7eb;
}

/* ── Path accordion header ── */
.path-header,
.schema-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  cursor: move;
}

.path-header .drag-handle {
  color: #d1d5db;
  cursor: grab;
  flex-shrink: 0;
}

.path-header .drag-handle:hover {
  color: #9ca3af;
}

:deep(.dragging-path) {
  opacity: 0.5;
  background: #f3f4f6;
}

.path-header-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
}

.path-url,
.schema-name {
  font-family: "SF Mono", "Monaco", "Inconsolata", "Courier New", monospace;
  font-weight: 600;
  font-size: 13px;
  color: #111827;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Method pill chips in the accordion header — same design as SelectButton dialog chips ── */
.path-method-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  border-radius: 999px;
  border: 1.5px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  user-select: none;
  box-shadow: none;
}

.path-method-chip:focus {
  box-shadow: none;
}

/* Per-method border + background (mirrors the SelectButton togglebutton rules) */
.path-method-chip:has(.method-chip.method-get)    { border-color: #bfdbfe; background: #eff6ff; }
.path-method-chip:has(.method-chip.method-post)   { border-color: #bbf7d0; background: #f0fdf4; }
.path-method-chip:has(.method-chip.method-put)    { border-color: #fde68a; background: #fffbeb; }
.path-method-chip:has(.method-chip.method-patch)  { border-color: #fed7aa; background: #fff7ed; }
.path-method-chip:has(.method-chip.method-delete) { border-color: #fecaca; background: #fef2f2; }
.path-method-chip:has(.method-chip.method-options),
.path-method-chip:has(.method-chip.method-head)   { border-color: #e5e7eb; background: #f9fafb; }

/* Active state: stronger border, same background (mirrors checked togglebutton rules) */
.path-method-chip.path-method-chip--active:has(.method-chip.method-get)    { border-color: #2563eb; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-post)   { border-color: #16a34a; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-put)    { border-color: #d97706; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-patch)  { border-color: #ea580c; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-delete) { border-color: #dc2626; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-options),
.path-method-chip.path-method-chip--active:has(.method-chip.method-head)   { border-color: #4b5563; border-width: 2px; }

.path-method-chip.dragging-method {
  opacity: 0.4;
}

/* Delete ✕ inside chip */
.chip-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-left: 1px;
  cursor: pointer;
  font-size: 9px;
  opacity: 0.45;
  transition: opacity 0.15s ease;
  color: inherit;
}

.chip-delete-btn:hover {
  opacity: 1;
}

.path-add-method-btn {
  flex-shrink: 0;
}

.path-delete-btn {
  flex-shrink: 0;
}

.path-edit-btn {
  flex-shrink: 0;
  color: #6b7280 !important;
}

.path-edit-btn:hover {
  color: #3b82f6 !important;
}

/* ── Path parameter lock banner ── */
.path-param-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #1d4ed8;
}

.path-param-banner .pi-lock {
  font-size: 12px;
  flex-shrink: 0;
}

.param-item :deep(.p-select),
.param-item :deep(.p-inputtext),
.property-item :deep(.p-select),
.property-item :deep(.p-inputtext) {
  height: 2.375rem;
  min-height: unset;
}

.param-item :deep(.p-select),
.property-item :deep(.p-select) {
  display: flex;
  align-items: center;
}

.param-item :deep(.p-select-label),
.property-item :deep(.p-select-label) {
  padding: 0 0.5rem;
  line-height: normal;
  overflow: visible;
  white-space: nowrap;
  flex: 1;
}

/* ── Item schema entries (oneOf items in array params) ── */
.item-schema-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-schema-controls :deep(.p-multiselect) {
  flex: 1;
}

.item-schemas-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.item-schema-entry {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
}

.item-schema-entry-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

.item-schema-remove {
  margin-left: auto;
}

.item-schema-entry-body {
  padding: 0.75rem;
}

.item-schema-ref-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.type-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #e0e7ff;
  color: #3730a3;
}

.type-badge--string  { background: #dcfce7; color: #166534; }
.type-badge--number  { background: #fef9c3; color: #854d0e; }
.type-badge--integer { background: #ffedd5; color: #9a3412; }
.type-badge--boolean { background: #f3e8ff; color: #6b21a8; }
.type-badge--object  { background: #dbeafe; color: #1e40af; }

.param-item--path {
  border-color: #bfdbfe;
  background: #f8faff;
}

.param-item--path :deep(.p-inputtext:disabled),
.param-item--path :deep(.p-select.p-disabled) {
  opacity: 0.7;
  background: #f0f4ff;
  cursor: not-allowed;
}

/* ── Path methods editor (accordion content) ── */
.path-methods-editor {
  /* empty by default — no space when no method is selected */
}

.path-methods-editor--active {
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #f3f4f6;
}

.method-editor {
  /* no top border needed — content starts directly */
}

.param-item,
.property-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 10px;
  align-items: flex-start;
  cursor: move;
  transition: border-color 0.15s ease;
}

.property-item:hover,
.param-item:hover {
  border-color: #d1d5db;
}

.property-item.dragging {
  opacity: 0.5;
  border-color: #3b82f6;
  background: #f9fafb;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #d1d5db;
  cursor: grab;
  user-select: none;
  border-radius: 4px;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle:hover {
  color: #9ca3af;
  background: #f3f4f6;
}

.param-content,
.property-content {
  flex: 1;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row > .form-field {
  min-width: 0;
}

.schema-selector {
  display: flex;
  gap: 10px;
}

.schema-selector :deep(.p-select) {
  flex: 1;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.response-header span {
  flex: 1;
  font-weight: 500;
  font-size: 13px;
  color: #374151;
}

/* ── Response edit-code button ── */
.response-edit-code-btn {
  flex-shrink: 0;
  color: #6b7280 !important;
}

.response-edit-code-btn:hover {
  color: #3b82f6 !important;
}

/* ── Status code category grid ── */
.status-category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 8px;
}

.status-category-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1.5px solid #e5e7eb;
  background: #f9fafb;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  outline: none;
}

.status-category-btn:hover {
  border-color: #d1d5db;
  background: #f3f4f6;
}

.status-category-btn--active {
  border-width: 2px;
}

.status-category-btn--2xx            { border-color: #bbf7d0; background: #f0fdf4; }
.status-category-btn--2xx.status-category-btn--active { border-color: #16a34a; }
.status-category-btn--3xx            { border-color: #bfdbfe; background: #eff6ff; }
.status-category-btn--3xx.status-category-btn--active { border-color: #2563eb; }
.status-category-btn--4xx            { border-color: #fde68a; background: #fffbeb; }
.status-category-btn--4xx.status-category-btn--active { border-color: #d97706; }
.status-category-btn--5xx            { border-color: #fecaca; background: #fef2f2; }
.status-category-btn--5xx.status-category-btn--active { border-color: #dc2626; }
.status-category-btn--custom         { border-color: #e5e7eb; background: #f9fafb; }
.status-category-btn--custom.status-category-btn--active { border-color: #6b7280; }

.status-category-label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.status-category-desc {
  font-size: 11px;
  color: #6b7280;
}

/* ── Status code list (step 2) ── */
.response-dialog-back {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f3f4f6;
}

.response-dialog-category-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.status-code-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 2px;
}

.status-code-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1.5px solid #e5e7eb;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  outline: none;
}

.status-code-item:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.status-code-item--used {
  opacity: 0.45;
  cursor: not-allowed;
  background: #f9fafb;
  border-color: #e5e7eb;
}

.status-code-item--used .status-code-hint {
  color: #9ca3af;
  font-style: italic;
}

.status-code-item--active {
  border-color: #3b82f6;
  background: #eff6ff;
  border-width: 2px;
}

.status-code-tag {
  flex-shrink: 0;
}

.status-code-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.status-code-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.status-code-hint {
  font-size: 11px;
  color: #6b7280;
}

.schema-builder {
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.schema-builder :deep(.p-select),
.schema-builder :deep(.p-inputtext) {
  height: 2.375rem;
  min-height: unset;
}

.schema-builder :deep(.p-select) {
  display: flex;
  align-items: center;
}

.schema-builder :deep(.p-select-label) {
  padding: 0 0.5rem;
  line-height: normal;
  overflow: visible;
  white-space: nowrap;
  flex: 1;
}

.schema-json-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.json-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.json-editor-header label {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  margin: 0;
}

.json-editor-actions {
  display: flex;
  gap: 4px;
}

.json-editor-wrapper {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  width: 100%;
}

.json-textarea.monaco-style {
  font-family: "SF Mono", "Monaco", "Inconsolata", "Consolas", monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border: none;
  border-radius: 6px;
  resize: vertical;
  min-height: 300px;
  width: 100%;
  box-sizing: border-box;
  tab-size: 2;
  -moz-tab-size: 2;
}

.json-textarea.monaco-style:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.json-textarea.monaco-style::selection {
  background: rgba(59, 130, 246, 0.3);
}

.json-textarea {
  font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
  font-size: 13px;
  line-height: 1.5;
}

.dialog-content {
  padding: 16px 0;
}

:deep(.p-dialog) {
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

:deep(.p-dialog-header) {
  padding: 16px 20px;
  background: #1f2937;
  color: white;
  border-bottom: none;
}

:deep(.p-dialog-title) {
  font-weight: 600;
  font-size: 15px;
}

:deep(.p-dialog-header-close) {
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.15s ease;
}

:deep(.p-dialog-header-close:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

:deep(.p-dialog-content) {
  padding: 20px;
  background: #ffffff;
}

:deep(.p-dialog-footer) {
  padding: 12px 20px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  background: #ffffff;
}

.method-selector-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.method-selector-button {
  padding: 12px 14px;
  border: 1px solid;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  background: #ffffff;
  text-align: left;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.method-selector-button:hover {
  opacity: 0.85;
}

.method-selector-button.selected {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.method-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.method-description {
  font-size: 11px;
  opacity: 0.65;
  font-weight: 400;
}

.method-selector-button.method-get {
  color: #1d4ed8;
  border-color: #bfdbfe;
  background: #eff6ff;
}

.method-selector-button.method-get.selected {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.method-selector-button.method-post {
  color: #166534;
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.method-selector-button.method-post.selected {
  background: #22c55e;
  color: white;
  border-color: #22c55e;
}

.method-selector-button.method-put {
  color: #92400e;
  border-color: #fde68a;
  background: #fffbeb;
}

.method-selector-button.method-put.selected {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.method-selector-button.method-patch {
  color: #9a3412;
  border-color: #fed7aa;
  background: #fff7ed;
}

.method-selector-button.method-patch.selected {
  background: #f97316;
  color: white;
  border-color: #f97316;
}

.method-selector-button.method-delete {
  color: #991b1b;
  border-color: #fecaca;
  background: #fef2f2;
}

.method-selector-button.method-delete.selected {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.method-selector-button.method-options,
.method-selector-button.method-head {
  color: #4b5563;
  border-color: #e5e7eb;
  background: #f9fafb;
}

.method-selector-button.method-options.selected,
.method-selector-button.method-head.selected {
  background: #6b7280;
  color: white;
  border-color: #6b7280;
}

/* ── New SelectButton method chips ── */
.method-select-button {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

:deep(.method-select-button .p-selectbutton) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 0;
}

:deep(.method-select-button .p-togglebutton) {
  flex: 0 0 auto;
  min-width: 0;
  padding: 4px 10px;
  border-radius: 999px !important;
  border: 1.5px solid #e5e7eb !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: all 0.15s ease;
}

:deep(.method-select-button .p-togglebutton:focus) {
  box-shadow: none !important;
}

.method-chip {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 0;
}

.method-chip.method-get   { color: #1d4ed8; }
.method-chip.method-post  { color: #166534; }
.method-chip.method-put   { color: #92400e; }
.method-chip.method-patch { color: #9a3412; }
.method-chip.method-delete { color: #991b1b; }
.method-chip.method-options,
.method-chip.method-head  { color: #4b5563; }

:deep(.method-select-button .p-togglebutton:has(.method-chip.method-get))    { border-color: #bfdbfe !important; background: #eff6ff !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-post))   { border-color: #bbf7d0 !important; background: #f0fdf4 !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-put))    { border-color: #fde68a !important; background: #fffbeb !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-patch))  { border-color: #fed7aa !important; background: #fff7ed !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-delete)) { border-color: #fecaca !important; background: #fef2f2 !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-options)),
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-head))   { border-color: #e5e7eb !important; background: #f9fafb !important; }


/* Checked state: stronger border, no background/shadow change */
:deep(.method-select-button .p-togglebutton-checked .p-togglebutton-content) {
  background: transparent !important;
  box-shadow: none !important;
}

/* Checked state: stronger border, no background change */
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-get))    { border-color: #2563eb !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-post))   { border-color: #16a34a !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-put))    { border-color: #d97706 !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-patch))  { border-color: #ea580c !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-delete)) { border-color: #dc2626 !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-options)),
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-head))   { border-color: #4b5563 !important; border-width: 2px !important; }


/* ── Path input helpers ── */
.helper-text {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
  display: block;
}

:deep(.path-addon) {
  font-weight: 600;
  font-size: 15px;
  color: #6b7280;
  min-width: 2rem;
  justify-content: center;
}

.w-full {
  width: 100%;
}

:deep(.p-tabs-nav) {
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 20px;
}

:deep(.p-tab) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  font-weight: 500;
  font-size: 13px;
  color: #6b7280;
  transition: color 0.15s ease;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

:deep(.p-tab:hover) {
  color: #374151;
}

:deep(.p-tab[aria-selected="true"]) {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

:deep(.p-tab i) {
  font-size: 14px;
}

:deep(.p-accordion-panel) {
  margin-bottom: 8px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  background: #ffffff;
  transition: border-color 0.15s ease;
}

:deep(.p-accordion-panel:hover) {
  border-color: #d1d5db;
}

:deep(.p-accordion-header) {
  padding: 14px 16px;
  background: #ffffff;
  transition: background-color 0.15s ease;
}

:deep(.p-accordion-header:hover) {
  background: #f9fafb;
}

:deep(.p-accordion-panel[data-p-active="true"] .p-accordion-header) {
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.p-accordion-panel[data-p-active="true"]) {
  border-color: #d1d5db;
}

:deep(.p-accordion-content) {
  padding: 16px;
  background: #ffffff;
}

:deep(.p-accordion-header-content) {
  width: 100%;
}

/* Focus states for accessibility */
:deep(.p-inputtext:focus-visible),
:deep(.p-textarea:focus-visible),
:deep(.p-select:focus-visible),
:deep(.p-button:focus-visible) {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

:deep(.p-button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.p-chip) {
  background: #3b82f6;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 12px;
}

:deep(.p-chip .p-chip-remove-icon) {
  color: rgba(255, 255, 255, 0.8);
}

:deep(.p-chip .p-chip-remove-icon:hover) {
  color: white;
}

.form-field label.required::after {
  content: ' *';
  color: #ef4444;
}
</style>
