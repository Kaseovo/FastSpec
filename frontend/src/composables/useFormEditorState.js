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

  // How many operations reference each tag name — lets the Tags tab show a
  // usage count and flag tags nothing actually uses, the same way lint
  // flags unused components. Scans every path/method's `tags` array rather
  // than trusting formData.tags to stay in sync with operations, since
  // operations can reference tag names freely (OpenAPI doesn't require a
  // matching top-level tag object to exist).
  const tagUsageCounts = computed(() => {
    const counts = {};
    for (const path of Object.values(formData.value.paths || {})) {
      for (const operation of Object.values(path)) {
        for (const tagName of operation?.tags || []) {
          counts[tagName] = (counts[tagName] || 0) + 1;
        }
      }
    }
    return counts;
  });

  // "Add/Edit Tag" wizard — same pattern as usePathsEditor's Add Path/Add
  // Method wizards: step 1 (Basic Info) then step 2 (External Docs, always
  // optional). Creating a tag pushes it into formData.tags immediately so
  // both steps edit the live object directly (editingTag below); cancelling
  // before Finish rolls the just-created tag back out (discardWizardTag).
  // Editing an existing tag reuses the identical dialog, just without that
  // rollback tracking.
  const TAG_DIALOG_STEP_ORDER = ["basicInfo", "externalDocs"];
  const showTagDialog = ref(false);
  const tagDialogStep = ref("basicInfo");
  const editingTagIndex = ref(null);
  const wizardCreatedTagIndex = ref(null);

  const editingTag = computed(() =>
    editingTagIndex.value !== null ? formData.value.tags[editingTagIndex.value] : null,
  );

  const isEditingTagNameInvalid = computed(() => {
    const tag = editingTag.value;
    if (!tag) return true;
    const name = (tag.name || "").trim();
    if (!name) return true;
    return formData.value.tags.some(
      (t, i) => i !== editingTagIndex.value && (t.name || "").trim() === name,
    );
  });

  const resetTagDialog = () => {
    tagDialogStep.value = "basicInfo";
    editingTagIndex.value = null;
    wizardCreatedTagIndex.value = null;
  };

  const openAddTagDialog = () => {
    formData.value.tags.push({
      name: "",
      description: "",
      externalDocs: { description: "", url: "" },
    });
    editingTagIndex.value = formData.value.tags.length - 1;
    wizardCreatedTagIndex.value = editingTagIndex.value;
    tagDialogStep.value = "basicInfo";
    showTagDialog.value = true;
  };

  const openEditTagDialog = (index) => {
    editingTagIndex.value = index;
    wizardCreatedTagIndex.value = null;
    tagDialogStep.value = "basicInfo";
    showTagDialog.value = true;
  };

  // Silent rollback (no confirm dialog) — cancelling mid-wizard should
  // discard the just-created draft tag, not prompt the user to confirm
  // deleting something they made seconds ago in this same flow.
  const discardWizardTag = () => {
    if (wizardCreatedTagIndex.value === null) return;
    formData.value.tags.splice(wizardCreatedTagIndex.value, 1);
  };

  const cancelTagDialog = () => {
    discardWizardTag();
    resetTagDialog();
    showTagDialog.value = false;
  };

  const goToNextTagStep = () => {
    if (isEditingTagNameInvalid.value) return;
    const index = TAG_DIALOG_STEP_ORDER.indexOf(tagDialogStep.value);
    if (index < TAG_DIALOG_STEP_ORDER.length - 1) {
      tagDialogStep.value = TAG_DIALOG_STEP_ORDER[index + 1];
    }
  };

  const goToPrevTagStep = () => {
    const index = TAG_DIALOG_STEP_ORDER.indexOf(tagDialogStep.value);
    if (index > 0) tagDialogStep.value = TAG_DIALOG_STEP_ORDER[index - 1];
  };

  const finishTagDialog = () => {
    wizardCreatedTagIndex.value = null;
    resetTagDialog();
    showTagDialog.value = false;
  };

  const removeTag = (index) => {
    const tagName = (formData.value.tags[index]?.name || "").trim();
    const usageCount = tagName ? tagUsageCounts.value[tagName] || 0 : 0;
    const message =
      usageCount > 0
        ? `This tag is used by ${usageCount} operation${usageCount === 1 ? "" : "s"}. Deleting it won't untag them — they'll keep referencing a tag that no longer exists. Delete anyway?`
        : "Are you sure you want to delete this tag?";
    confirm.require({
      message,
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
    tagUsageCounts,
    removeTag,
    showTagDialog,
    tagDialogStep,
    editingTag,
    wizardCreatedTagIndex,
    isEditingTagNameInvalid,
    openAddTagDialog,
    openEditTagDialog,
    cancelTagDialog,
    goToNextTagStep,
    goToPrevTagStep,
    finishTagDialog,
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
