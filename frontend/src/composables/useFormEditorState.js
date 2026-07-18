import { ref, computed, watch } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { usePathsEditor } from "./usePathsEditor";
import { useComponentsEditor } from "./useComponentsEditor";
import { useSecurityEditor } from "./useSecurityEditor";
import { useReusableComponentsEditor } from "./useReusableComponentsEditor";
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

// FormEditor.vue's state/logic, extracted into its own composable so the
// data-wiring (formData init/normalization, server/tag helpers, the four
// per-tab composables) stays in exactly one place, independent of how the
// six tabs are arranged on screen.
export function useFormEditorState(props, emit) {
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

  const tabCounts = computed(() => ({
    servers: (formData.value.servers || []).length,
    paths: Object.keys(formData.value.paths || {}).length,
    tags: (formData.value.tags || []).length,
    components: Object.keys(formData.value.components?.schemas || {}).length,
    security: (formData.value.security || []).length,
  }));

  const confirm = useConfirm();
  const toast = useToast();

  watch(
    () => props.modelValue,
    (newValue) => {
      if (newValue && Object.keys(newValue).length > 0) {
        formData.value = normalizeRefsForForm(JSON.parse(JSON.stringify(newValue)));
        if (!formData.value.info) formData.value.info = {};
        if (!formData.value.info.contact) formData.value.info.contact = {};
        if (!formData.value.info.license) formData.value.info.license = {};
        if (!formData.value.servers) formData.value.servers = [];
        if (!formData.value.tags) formData.value.tags = [];
        else {
          formData.value.tags = formData.value.tags.map((t) => ({
            ...t,
            externalDocs: t.externalDocs || { description: "", url: "" },
            _showExternalDocs: !!(t.externalDocs?.description || t.externalDocs?.url),
          }));
        }
        if (!formData.value.paths) formData.value.paths = {};
        if (!formData.value.components) formData.value.components = {};
        if (!formData.value.components.schemas) formData.value.components.schemas = {};
        if (!formData.value.components.securitySchemes)
          formData.value.components.securitySchemes = {};
        if (!formData.value.components.parameters) formData.value.components.parameters = {};
        if (!formData.value.components.responses) formData.value.components.responses = {};
        if (!formData.value.security) formData.value.security = [];
      }
    },
    { immediate: true, deep: true },
  );

  watch(
    formData,
    (newVal) => {
      hasChanges.value = true;
      try {
        const cleaned = JSON.parse(JSON.stringify(newVal));
        if (cleaned.info) {
          if (cleaned.info.contact && !cleaned.info.contact.name && !cleaned.info.contact.email) {
            delete cleaned.info.contact;
          }
          if (cleaned.info.license && !cleaned.info.license.name && !cleaned.info.license.url) {
            delete cleaned.info.license;
          }
        }
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
        if (cleaned.security && cleaned.security.length === 0) {
          delete cleaned.security;
        }
        emit("update:modelValue", cleanRefsForOutput(cleaned));
      } catch (e) {
        emit("update:modelValue", newVal);
      }
    },
    { deep: true },
  );

  const hasEmptyServerUrl = computed(() =>
    formData.value.servers.some((server) => !server.url || server.url.trim() === ""),
  );

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
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
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
      reject: () => confirm.close(),
    });
  };

  const hasEmptyTagName = computed(() =>
    (formData.value.tags || []).some((tag) => !tag.name || tag.name.trim() === ""),
  );

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
    formData.value.tags.push({
      name: "",
      description: "",
      externalDocs: { description: "", url: "" },
      _showExternalDocs: false,
    });
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
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
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
      reject: () => confirm.close(),
    });
  };

  const paths = usePathsEditor(formData, confirm, toast);
  const components = useComponentsEditor(formData, confirm, toast);
  const security = useSecurityEditor(formData, confirm, toast);
  const reusable = useReusableComponentsEditor(formData, confirm, toast);

  const handleDragOver = components.handleDragOver;
  const handleDragEnd = (event) => {
    event.target.classList.remove("dragging");
    event.target.classList.remove("dragging-method");
    paths.resetPathDrag();
    components.resetPropertyDrag();
  };

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
    hasEmptyServerUrl,
    addServer,
    removeServer,
    hasEmptyTagName,
    hasDuplicateTagName,
    addTag,
    removeTag,
    getMethodSeverity,
    getMethodDescription,
    getStatusSeverity,
    getStatusName,
    statusCodeCategories,
    statusCodesForCategory,
    pathsApi,
    componentsApi,
    securityApi,
    handleDragOver,
    handleDragEnd,
    ...paths,
    ...components,
    ...security,
    ...reusable,
  };
}
