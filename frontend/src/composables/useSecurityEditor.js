import { computed } from "vue";

// State + logic for FormEditor's "Security" tab: defining
// `components.securitySchemes` and the global `security` requirement list.
// Follows the same extraction pattern as useComponentsEditor/usePathsEditor —
// takes the reactive `formData` ref plus the PrimeVue `confirm`/`toast`
// services owned by the caller.
export function useSecurityEditor(formData, confirm, toast) {
  const securitySchemesList = computed(() => {
    return Object.keys(formData.value.components?.securitySchemes || {}).map(
      (name) => ({
        name,
        data: formData.value.components.securitySchemes[name],
      })
    );
  });

  // {name, type, scopes: string[]}[] — the shape SecurityRequirementList
  // needs to render scheme checkboxes and, for oauth2/openIdConnect, the
  // scope multiselect options.
  const availableSecuritySchemes = computed(() => {
    return securitySchemesList.value.map(({ name, data }) => ({
      name,
      type: data.type,
      scopes: collectScopes(data),
    }));
  });

  function collectScopes(scheme) {
    if (scheme.type === "oauth2") {
      const scopeSet = new Set();
      for (const flow of Object.values(scheme.flows || {})) {
        for (const scopeName of Object.keys(flow.scopes || {})) {
          scopeSet.add(scopeName);
        }
      }
      return Array.from(scopeSet);
    }
    return [];
  }

  const defaultDataForType = (type) => {
    switch (type) {
      case "apiKey":
        return { type, name: "", in: "header" };
      case "http":
        return { type, scheme: "bearer", bearerFormat: "" };
      case "oauth2":
        return { type, flows: {} };
      case "openIdConnect":
        return { type, openIdConnectUrl: "" };
      default:
        return { type };
    }
  };

  const addSecurityScheme = () => {
    if (!formData.value.components) formData.value.components = {};
    if (!formData.value.components.securitySchemes)
      formData.value.components.securitySchemes = {};

    let baseName = "NewSecurityScheme";
    let name = baseName;
    let counter = 1;
    while (formData.value.components.securitySchemes[name]) {
      name = `${baseName}${counter}`;
      counter++;
    }

    formData.value.components.securitySchemes[name] =
      defaultDataForType("apiKey");
  };

  // Strip any reference to `schemeName` from the global security list and
  // every operation's security override — mirrors renameSchema/removeSchema's
  // $ref cleanup in useComponentsEditor, applied to security requirement
  // objects instead of $ref strings.
  const pruneSecurityReferences = (schemeName) => {
    const pruneList = (list) => {
      if (!Array.isArray(list)) return list;
      return list
        .map((requirement) => {
          if (!requirement || !(schemeName in requirement)) return requirement;
          const { [schemeName]: _removed, ...rest } = requirement;
          return rest;
        })
        .filter((requirement) => Object.keys(requirement).length > 0);
    };

    if (formData.value.security) {
      formData.value.security = pruneList(formData.value.security);
    }
    for (const pathItem of Object.values(formData.value.paths || {})) {
      for (const operation of Object.values(pathItem || {})) {
        if (operation && Array.isArray(operation.security)) {
          operation.security = pruneList(operation.security);
        }
      }
    }
  };

  const renameSecurityScheme = (oldName, newName) => {
    if (!newName || oldName === newName) return;
    const schemes = formData.value.components.securitySchemes;
    if (schemes[newName]) return; // already exists

    const entries = Object.entries(schemes);
    const idx = entries.findIndex(([k]) => k === oldName);
    if (idx === -1) return;
    entries[idx] = [newName, entries[idx][1]];
    formData.value.components.securitySchemes = Object.fromEntries(entries);

    const renameInList = (list) => {
      if (!Array.isArray(list)) return list;
      return list.map((requirement) => {
        if (!requirement || !(oldName in requirement)) return requirement;
        const { [oldName]: scopes, ...rest } = requirement;
        return { ...rest, [newName]: scopes };
      });
    };

    if (formData.value.security) {
      formData.value.security = renameInList(formData.value.security);
    }
    for (const pathItem of Object.values(formData.value.paths || {})) {
      for (const operation of Object.values(pathItem || {})) {
        if (operation && Array.isArray(operation.security)) {
          operation.security = renameInList(operation.security);
        }
      }
    }
  };

  const removeSecurityScheme = (name) => {
    confirm.require({
      message: `Are you sure you want to delete the security scheme "${name}"? Any requirements referencing it will be removed.`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        delete formData.value.components.securitySchemes[name];
        pruneSecurityReferences(name);
        toast.add({
          severity: "success",
          summary: "Security Scheme Deleted",
          detail: `Security scheme "${name}" has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  const onSecuritySchemeTypeChange = (scheme) => {
    const fresh = defaultDataForType(scheme.type);
    for (const key of Object.keys(scheme)) {
      if (key !== "type" && key !== "description") delete scheme[key];
    }
    Object.assign(scheme, fresh, { type: scheme.type });
  };

  const oauth2FlowFields = {
    implicit: ["authorizationUrl", "refreshUrl", "scopes"],
    password: ["tokenUrl", "refreshUrl", "scopes"],
    clientCredentials: ["tokenUrl", "refreshUrl", "scopes"],
    authorizationCode: ["authorizationUrl", "tokenUrl", "refreshUrl", "scopes"],
  };

  const addOAuth2Flow = (scheme, flowType) => {
    if (!scheme.flows) scheme.flows = {};
    if (scheme.flows[flowType]) return;
    const flow = { scopes: {} };
    for (const field of oauth2FlowFields[flowType]) {
      if (field !== "scopes" && field !== "refreshUrl") flow[field] = "";
    }
    scheme.flows[flowType] = flow;
  };

  const removeOAuth2Flow = (scheme, flowType) => {
    if (!scheme.flows) return;
    delete scheme.flows[flowType];
  };

  const addScope = (flow) => {
    if (!flow.scopes) flow.scopes = {};
    let baseName = "newScope";
    let name = baseName;
    let counter = 1;
    while (Object.prototype.hasOwnProperty.call(flow.scopes, name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    flow.scopes[name] = "";
  };

  const removeScope = (flow, scopeName) => {
    if (!flow.scopes) return;
    delete flow.scopes[scopeName];
  };

  const renameScope = (flow, oldName, newName) => {
    if (!newName || oldName === newName) return;
    if (!flow.scopes || Object.prototype.hasOwnProperty.call(flow.scopes, newName))
      return;
    const entries = Object.entries(flow.scopes);
    const idx = entries.findIndex(([k]) => k === oldName);
    if (idx === -1) return;
    entries[idx] = [newName, entries[idx][1]];
    flow.scopes = Object.fromEntries(entries);
  };

  return {
    securitySchemesList,
    availableSecuritySchemes,
    addSecurityScheme,
    removeSecurityScheme,
    renameSecurityScheme,
    onSecuritySchemeTypeChange,
    oauth2FlowFields,
    addOAuth2Flow,
    removeOAuth2Flow,
    addScope,
    removeScope,
    renameScope,
  };
}
