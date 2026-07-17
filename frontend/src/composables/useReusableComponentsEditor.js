import { computed } from "vue";
import {
  getResponseContentType,
  setResponseContentType,
  getResponseSchemaType,
  setResponseSchemaType,
  getResponseSchemaRef,
  setResponseSchemaRef,
  getResponseInlineSchema,
  getResponseInlineSchemaType,
  setResponseInlineSchemaType,
  addResponseProperty,
  removeResponseProperty,
  renameResponseProperty,
  toggleResponsePropertyRequired,
} from "../utils/openApiFormHelpers";

// State + logic for FormEditor's "Reusable Parameters" and "Reusable
// Responses" sections (components.parameters / components.responses),
// referenced from operations via $ref instead of being redefined inline
// every time. Follows the same extraction pattern as useComponentsEditor/
// useSecurityEditor. The response-editing helpers are shared (imported, not
// duplicated) with usePathsEditor's inline response editor, since a
// components.responses entry has the exact same {description, content}
// shape as an inline one — see openApiFormHelpers.js's header comment on
// those functions for why they live there.
export function useReusableComponentsEditor(formData, confirm, toast) {
  // ── Reusable parameters ──────────────────────────────────────────────
  const parametersList = computed(() => {
    return Object.keys(formData.value.components?.parameters || {}).map((name) => ({
      name,
      data: formData.value.components.parameters[name],
    }));
  });

  const availableParameters = computed(() => {
    return Object.keys(formData.value.components?.parameters || {}).map((name) => ({
      label: name,
      value: `#/components/parameters/${name}`,
    }));
  });

  const addReusableParameter = () => {
    if (!formData.value.components) formData.value.components = {};
    if (!formData.value.components.parameters) formData.value.components.parameters = {};

    let baseName = "NewParameter";
    let name = baseName;
    let counter = 1;
    while (formData.value.components.parameters[name]) {
      name = `${baseName}${counter}`;
      counter++;
    }

    formData.value.components.parameters[name] = {
      name: "",
      in: "query",
      description: "",
      required: false,
      schema: { type: "string" },
    };
  };

  const renameReusableParameter = (oldName, newName) => {
    if (!newName || oldName === newName) return;
    const params = formData.value.components.parameters;
    if (params[newName]) return; // already exists

    const entries = Object.entries(params);
    const idx = entries.findIndex(([k]) => k === oldName);
    if (idx === -1) return;
    entries[idx] = [newName, entries[idx][1]];
    formData.value.components.parameters = Object.fromEntries(entries);

    const oldRef = `#/components/parameters/${oldName}`;
    const newRef = `#/components/parameters/${newName}`;
    for (const pathItem of Object.values(formData.value.paths || {})) {
      for (const operation of Object.values(pathItem || {})) {
        if (!Array.isArray(operation?.parameters)) continue;
        for (const p of operation.parameters) {
          if (p && p.$ref === oldRef) p.$ref = newRef;
        }
      }
    }
  };

  const removeReusableParameter = (name) => {
    confirm.require({
      message: `Are you sure you want to delete the reusable parameter "${name}"? Any operations using it will lose that parameter.`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        delete formData.value.components.parameters[name];
        const ref = `#/components/parameters/${name}`;
        // A dangling parameter reference isn't a slot worth keeping blank
        // (unlike a response, a parameter has no meaningful identity once
        // its definition is gone) — drop it from every operation.
        for (const pathItem of Object.values(formData.value.paths || {})) {
          for (const operation of Object.values(pathItem || {})) {
            if (!Array.isArray(operation?.parameters)) continue;
            operation.parameters = operation.parameters.filter(
              (p) => !(p && p.$ref === ref)
            );
          }
        }
        toast.add({
          severity: "success",
          summary: "Parameter Deleted",
          detail: `Reusable parameter "${name}" has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  // ── Reusable responses ───────────────────────────────────────────────
  const responsesList = computed(() => {
    return Object.keys(formData.value.components?.responses || {}).map((name) => ({
      name,
      data: formData.value.components.responses[name],
    }));
  });

  const availableResponses = computed(() => {
    return Object.keys(formData.value.components?.responses || {}).map((name) => ({
      label: name,
      value: `#/components/responses/${name}`,
    }));
  });

  const addReusableResponse = () => {
    if (!formData.value.components) formData.value.components = {};
    if (!formData.value.components.responses) formData.value.components.responses = {};

    let baseName = "NewResponse";
    let name = baseName;
    let counter = 1;
    while (formData.value.components.responses[name]) {
      name = `${baseName}${counter}`;
      counter++;
    }

    formData.value.components.responses[name] = { description: "", content: {} };
  };

  const renameReusableResponse = (oldName, newName) => {
    if (!newName || oldName === newName) return;
    const responses = formData.value.components.responses;
    if (responses[newName]) return;

    const entries = Object.entries(responses);
    const idx = entries.findIndex(([k]) => k === oldName);
    if (idx === -1) return;
    entries[idx] = [newName, entries[idx][1]];
    formData.value.components.responses = Object.fromEntries(entries);

    const oldRef = `#/components/responses/${oldName}`;
    const newRef = `#/components/responses/${newName}`;
    for (const pathItem of Object.values(formData.value.paths || {})) {
      for (const operation of Object.values(pathItem || {})) {
        if (!operation?.responses) continue;
        for (const response of Object.values(operation.responses)) {
          if (response && response.$ref === oldRef) response.$ref = newRef;
        }
      }
    }
  };

  const removeReusableResponse = (name) => {
    confirm.require({
      message: `Are you sure you want to delete the reusable response "${name}"? Operations referencing it will fall back to a blank inline response so their status code isn't lost.`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        delete formData.value.components.responses[name];
        const ref = `#/components/responses/${name}`;
        for (const pathItem of Object.values(formData.value.paths || {})) {
          for (const operation of Object.values(pathItem || {})) {
            if (!operation?.responses) continue;
            for (const code of Object.keys(operation.responses)) {
              if (operation.responses[code]?.$ref === ref) {
                operation.responses[code] = { description: "", content: {} };
              }
            }
          }
        }
        toast.add({
          severity: "success",
          summary: "Response Deleted",
          detail: `Reusable response "${name}" has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  return {
    // Reusable parameters
    parametersList,
    availableParameters,
    addReusableParameter,
    renameReusableParameter,
    removeReusableParameter,
    // Reusable responses
    responsesList,
    availableResponses,
    addReusableResponse,
    renameReusableResponse,
    removeReusableResponse,
    // Shared response content/schema editing (re-exported so callers only
    // need this one composable's `api` bundle)
    getResponseContentType,
    setResponseContentType,
    getResponseSchemaType,
    setResponseSchemaType,
    getResponseSchemaRef,
    setResponseSchemaRef,
    getResponseInlineSchema,
    getResponseInlineSchemaType,
    setResponseInlineSchemaType,
    addResponseProperty,
    removeResponseProperty,
    renameResponseProperty,
    toggleResponsePropertyRequired,
  };
}
