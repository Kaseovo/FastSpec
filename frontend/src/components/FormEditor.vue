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
            <span v-if="tabCounts.servers" class="tab-count-badge">{{ tabCounts.servers }}</span>
          </Tab>
          <Tab value="2">
            <i class="pi pi-sitemap"></i>
            <span>Paths</span>
            <span v-if="tabCounts.paths" class="tab-count-badge">{{ tabCounts.paths }}</span>
          </Tab>
          <Tab value="3">
            <i class="pi pi-tag"></i>
            <span>Tags</span>
            <span v-if="tabCounts.tags" class="tab-count-badge">{{ tabCounts.tags }}</span>
          </Tab>
          <Tab value="4">
            <i class="pi pi-box"></i>
            <span>Components</span>
            <span v-if="tabCounts.components" class="tab-count-badge">{{ tabCounts.components }}</span>
          </Tab>
          <Tab value="5">
            <i class="pi pi-shield"></i>
            <span>Security</span>
            <span v-if="tabCounts.security" class="tab-count-badge">{{ tabCounts.security }}</span>
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

          <!-- Security Tab -->
          <TabPanel value="5">
            <SecurityTab :form-data="formData" :api="securityApi" />
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
import SecurityTab from "./form-editor/SecurityTab.vue";
import AddPathDialog from "./form-editor/AddPathDialog.vue";
import AddMethodDialog from "./form-editor/AddMethodDialog.vue";
import EditPathDialog from "./form-editor/EditPathDialog.vue";
import ResponseCodeDialog from "./form-editor/ResponseCodeDialog.vue";
import { usePathsEditor } from "../composables/usePathsEditor";
import { useComponentsEditor } from "../composables/useComponentsEditor";
import { useSecurityEditor } from "../composables/useSecurityEditor";
import { useReusableComponentsEditor } from "../composables/useReusableComponentsEditor";
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
    SecurityTab,
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
        securitySchemes: {},
        parameters: {},
        responses: {},
      },
      security: [],
    });

    const hasChanges = ref(false);

    // At-a-glance sizing for each tab, shown as a small badge next to its
    // label so you can tell a spec's shape apart before opening a tab.
    const tabCounts = computed(() => ({
      servers: (formData.value.servers || []).length,
      paths: Object.keys(formData.value.paths || {}).length,
      tags: (formData.value.tags || []).length,
      components: Object.keys(formData.value.components?.schemas || {}).length,
      security: (formData.value.security || []).length,
    }));

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
          if (!formData.value.components.securitySchemes)
            formData.value.components.securitySchemes = {};
          if (!formData.value.components.parameters)
            formData.value.components.parameters = {};
          if (!formData.value.components.responses)
            formData.value.components.responses = {};
          if (!formData.value.security) formData.value.security = [];
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
          // Top-level `security: []` is meaningfully different from an
          // omitted key (empty array literally means "no auth required at
          // all"), but nobody ever means that when they haven't touched this
          // tab — only strip it when the user never added a requirement.
          if (cleaned.security && cleaned.security.length === 0) {
            delete cleaned.security;
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
    const security = useSecurityEditor(formData, confirm, toast);
    const reusable = useReusableComponentsEditor(formData, confirm, toast);

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
      availableSecuritySchemes: security.availableSecuritySchemes,
      availableParameters: reusable.availableParameters,
      availableResponses: reusable.availableResponses,
    };
    const componentsApi = {
      ...components,
      handleDragOver,
      handleDragEnd,
      ...reusable,
    };
    const securityApi = { ...security };

    return {
      formData,
      hasChanges,
      tabCounts,
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
      securityApi,
      // Shared drag handlers
      handleDragOver,
      handleDragEnd,
      // Spread composable returns so trailing dialogs resolve their bindings and
      // the existing characterization tests (wrapper.vm.<fn>) keep passing.
      ...paths,
      ...components,
      ...security,
      ...reusable,
    };
  },
};
</script>

<style>
/* Shared, unscoped by design: PathsTab/ComponentsTab/ServersTab/TagsTab/
   ApiInfoTab/SecurityTab and the Add/Edit dialogs were split out of this
   component into their own SFCs, but Vue's `scoped` CSS only reaches a
   component's OWN template — it does not reach into child components'
   internals. These classes need to be visible across that whole family
   (including inside PrimeVue Dialogs, which teleport their content out of
   this component's DOM subtree entirely), so they live in a real global
   stylesheet instead. See src/assets/form-editor-shared.css's header
   comment for how collisions with the rest of the app are avoided. */
@import "../assets/form-editor-shared.css";
</style>
