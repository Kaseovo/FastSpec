import { ref, computed, watch, nextTick } from "vue";
import {
  extractPathParams,
  buildPathParam,
  computePathParamDiff,
  getStatusName,
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

// State + logic for FormEditor's "Paths" tab, extracted verbatim from
// FormEditor.vue's setup(). Takes the reactive `formData` ref plus the PrimeVue
// `confirm` / `toast` services.
//
// Some pure, formData-derived helpers (availableSchemas, isOpenAPI31,
// globalTagNames, addSchema, onPropertyTypeChange, onItemTypesChange,
// addChipOnEnter) are intentionally duplicated with useComponentsEditor: both
// tabs need them and duplicating derived/stateless logic keeps the two
// composables independent. Path/method drag state is owned here (transient,
// tab-scoped); the parent composes a shared handleDragEnd from resetPathDrag().
export function usePathsEditor(formData, confirm, toast) {
  const showAddPathDialog = ref(false);
  const showEditPathDialog = ref(false);
  const editingPath = ref("");
  const editPathValue = ref("");
  const editPathError = ref("");
  const showAddMethodDialogVisible = ref(false);
  const showAddResponseDialog = ref(false);
  const responseDialogStep = ref(1);
  const responseDialogCategory = ref("");
  const editingResponseCode = ref(""); // non-empty = edit mode (old code being replaced)
  const newPath = ref("");
  const newMethod = ref("");
  // "Add Path" wizard — method + path, then the same Basic Info /
  // Parameters / Request Body / Responses steps the inline editor uses
  // (OperationBasicInfoStep etc.), free-jumpable once the operation exists.
  // The operation is created as soon as step 1 is confirmed (see
  // createWizardOperation below) so those steps can edit it live via
  // selectedPath/selectedMethod, exactly like editing an existing
  // operation — cancelling after that discards the draft (discardWizardPath).
  const ADD_PATH_STEP_ORDER = ["methodPath", "basicInfo", "parameters", "requestBody", "responses"];
  const addPathStep = ref("methodPath");
  // Shared by both the "Add Path" and "Add Method" wizards below — whichever
  // one is open, this tracks the operation IT just created, so cancelling
  // either one rolls back the same way (discardWizardPath).
  const wizardCreatedPath = ref(null);
  const wizardCreatedMethod = ref(null);
  const newResponseCode = ref("");
  // "Add Method to Path" wizard — same shape as "Add Path" minus the path
  // template step, since the path already exists (see ADD_METHOD_STEP_ORDER
  // below, alongside showAddMethodDialog/addMethodToPath/addMethodStep).
  const ADD_METHOD_STEP_ORDER = ["method", "basicInfo", "parameters", "requestBody", "responses"];
  const addMethodStep = ref("method");
  const methodToAdd = ref("");
  const currentPathForMethod = ref("");
  const selectedPath = ref("");
  const selectedMethod = ref("");
  const openPaths = ref([]);
  const requestBodyContentType = ref("application/json");
  const requestBodySchemaType = ref("reference");
  const requestBodySchemaRef = ref("");
  const requestBodyInlineSchemaType = ref("object");

  // Transient drag state (path + method reordering)
  const draggedPath = ref(null);
  const draggedPathIndex = ref(null);

  const httpMethods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "options",
    "head",
  ];

  const pathsList = computed(() => {
    return Object.keys(formData.value.paths).map((path) => ({
      path,
      // Canonical method order (GET, POST, PUT, ...) rather than whatever
      // order the methods happen to be stored/added in — a path with several
      // methods reads as a consistent, scannable row instead of shuffling
      // around based on authoring history. Display-only: doesn't touch
      // formData's actual key order (e.g. YAML export).
      methods: Object.keys(formData.value.paths[path]).sort(
        (a, b) => httpMethods.indexOf(a) - httpMethods.indexOf(b)
      ),
    }));
  });

  // ── Search / method filter ─────────────────────────────────────────────
  const pathSearchQuery = ref("");
  const pathMethodFilter = ref([]); // uppercase method strings; empty = all

  const pathMatchesQuery = (pathItem, query) => {
    if (pathItem.path.toLowerCase().includes(query)) return true;
    return pathItem.methods.some((method) => {
      const op = formData.value.paths[pathItem.path][method] || {};
      const haystack = [op.summary, op.operationId, ...(op.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  };

  const filteredPathsList = computed(() => {
    const query = pathSearchQuery.value.trim().toLowerCase();
    const methods = pathMethodFilter.value;
    return pathsList.value.filter((pathItem) => {
      if (methods.length > 0) {
        const hasMatchingMethod = pathItem.methods.some((m) =>
          methods.includes(m.toUpperCase())
        );
        if (!hasMatchingMethod) return false;
      }
      if (query && !pathMatchesQuery(pathItem, query)) return false;
      return true;
    });
  });

  const hasActivePathFilter = computed(
    () => pathSearchQuery.value.trim() !== "" || pathMethodFilter.value.length > 0
  );

  // Drag-to-reorder indexes into the full (unfiltered) `formData.paths`
  // object, so the accordion must keep iterating pathsList (not
  // filteredPathsList) to preserve correct indices — reordering a filtered
  // subset would splice at the wrong positions in the real list. This Set
  // is what the template uses to v-show/hide non-matching entries instead.
  const visiblePathSet = computed(() => new Set(filteredPathsList.value.map((p) => p.path)));

  const togglePathMethodFilter = (method) => {
    const upper = method.toUpperCase();
    const idx = pathMethodFilter.value.indexOf(upper);
    if (idx === -1) {
      pathMethodFilter.value = [...pathMethodFilter.value, upper];
    } else {
      pathMethodFilter.value = pathMethodFilter.value.filter((m) => m !== upper);
    }
  };

  const clearPathFilters = () => {
    pathSearchQuery.value = "";
    pathMethodFilter.value = [];
  };

  // ── Inline validation ──────────────────────────────────────────────────
  // OpenAPI requires operationId to be unique across the ENTIRE document
  // (not just within a path), so this checks every other operation, not
  // just siblings of the current path.
  const isOperationIdDuplicate = (path, method) => {
    const operation = formData.value.paths[path]?.[method];
    const operationId = operation?.operationId?.trim();
    if (!operationId) return false;
    for (const [otherPath, methods] of Object.entries(formData.value.paths)) {
      for (const [otherMethod, otherOp] of Object.entries(methods)) {
        if (otherPath === path && otherMethod === method) continue;
        if (otherOp?.operationId?.trim() === operationId) return true;
      }
    }
    return false;
  };

  // The OpenAPI Parameter Object is uniquely identified by (name, in) within
  // a single operation's parameter list — two parameters with the same name
  // but different `in` are fine (e.g. a path param and a query param both
  // named "id"), but two with the same name AND location are not.
  const isParameterDuplicate = (parameters, index) => {
    const param = parameters[index];
    const name = param?.name?.trim();
    if (!name) return false;
    return parameters.some(
      (p, i) => i !== index && p.name?.trim() === name && p.in === param.in
    );
  };

  // OpenAPI's Response Object has exactly one required field: description.
  const isResponseDescriptionMissing = (response) => {
    return !response?.description || !response.description.trim();
  };

  const availableSchemas = computed(() => {
    return Object.keys(formData.value.components?.schemas || {}).map((name) => ({
      label: name,
      value: `#/components/schemas/${name}`,
    }));
  });

  const isOpenAPI31 = computed(() => {
    const v = formData.value.openapi || "";
    return v.startsWith("3.1");
  });

  const globalTagNames = computed(() =>
    (formData.value.tags || []).map((t) => t.name).filter(Boolean)
  );

  const availableMethodsForPath = computed(() => {
    if (!currentPathForMethod.value) return httpMethods;
    const existingMethods = Object.keys(
      formData.value.paths[currentPathForMethod.value] || {}
    );
    return httpMethods.filter((m) => !existingMethods.includes(m));
  });

  const addChipOnEnter = (event, obj, key) => {
    const input = event.target;
    const value = input.value?.trim();
    if (!value) return;
    if (!Array.isArray(obj[key])) obj[key] = [];
    if (!obj[key].includes(value)) {
      obj[key] = [...obj[key], value];
    }
    input.value = "";
  };

  const addSchema = () => {
    // Generate a unique name
    let baseName = "NewSchema";
    let name = baseName;
    let counter = 1;
    while (formData.value.components.schemas[name]) {
      name = `${baseName}${counter}`;
      counter++;
    }

    formData.value.components.schemas[name] = {
      type: "object",
      properties: {},
    };
  };

  // ── Path Parameter helpers ──────────────────────────────────────────────

  const applyPathParamSync = (path, methodKey, toAdd, toRemove) => {
    const method = formData.value.paths[path]?.[methodKey];
    if (!method) return;
    if (!method.parameters) method.parameters = [];
    // Remove dropped params
    method.parameters = method.parameters.filter(
      (p) => !(p.in === "path" && toRemove.includes(p.name))
    );
    // Add new params (prepend so path params appear first)
    const newParams = toAdd.map(buildPathParam);
    method.parameters = [...newParams, ...method.parameters];
  };

  const buildNewOperation = (fullPath) => {
    const pathParamNames = extractPathParams(fullPath);
    const pathParams = pathParamNames.map(buildPathParam);
    return {
      summary: "",
      description: "",
      operationId: "",
      tags: [],
      deprecated: false,
      parameters: pathParams,
      responses: {
        200: {
          description: "Successful response",
        },
      },
    };
  };

  const resolveNewPath = () =>
    newPath.value ? (newPath.value.startsWith("/") ? newPath.value : "/" + newPath.value) : "/";

  // One-shot creation: used directly by tests and available for any other
  // caller that just wants a path/method created with blank defaults,
  // selected, and the dialog closed — no wizard steps involved.
  const addPath = () => {
    if (!newMethod.value) return;

    const fullPath = resolveNewPath();
    if (!formData.value.paths[fullPath]) {
      formData.value.paths[fullPath] = {};
    }
    formData.value.paths[fullPath][newMethod.value] = buildNewOperation(fullPath);

    selectedPath.value = fullPath;
    selectedMethod.value = newMethod.value;
    newPath.value = "";
    newMethod.value = "";
    addPathStep.value = "methodPath";
    showAddPathDialog.value = false;
  };

  const resetAddPathWizard = () => {
    newPath.value = "";
    newMethod.value = "";
    addPathStep.value = "methodPath";
    wizardCreatedPath.value = null;
    wizardCreatedMethod.value = null;
  };

  // Silent rollback (no confirm dialog) — cancelling mid-wizard should
  // discard the just-created draft operation, not prompt the user to
  // confirm deleting something they made seconds ago in this same flow.
  const discardWizardPath = () => {
    if (!wizardCreatedPath.value || !wizardCreatedMethod.value) return;
    const pathEntry = formData.value.paths[wizardCreatedPath.value];
    if (pathEntry) {
      delete pathEntry[wizardCreatedMethod.value];
      if (Object.keys(pathEntry).length === 0) {
        delete formData.value.paths[wizardCreatedPath.value];
      }
    }
    if (
      selectedPath.value === wizardCreatedPath.value &&
      selectedMethod.value === wizardCreatedMethod.value
    ) {
      selectedPath.value = "";
      selectedMethod.value = "";
    }
  };

  const cancelAddPathDialog = () => {
    discardWizardPath();
    resetAddPathWizard();
    showAddPathDialog.value = false;
  };

  const createWizardOperation = () => {
    const fullPath = resolveNewPath();
    if (!formData.value.paths[fullPath]) {
      formData.value.paths[fullPath] = {};
    }
    formData.value.paths[fullPath][newMethod.value] = buildNewOperation(fullPath);

    selectedPath.value = fullPath;
    selectedMethod.value = newMethod.value;
    wizardCreatedPath.value = fullPath;
    wizardCreatedMethod.value = newMethod.value;
  };

  const goToNextAddPathStep = () => {
    if (addPathStep.value === "methodPath") {
      if (!newMethod.value) return;
      createWizardOperation();
    }
    const index = ADD_PATH_STEP_ORDER.indexOf(addPathStep.value);
    if (index < ADD_PATH_STEP_ORDER.length - 1) {
      addPathStep.value = ADD_PATH_STEP_ORDER[index + 1];
    }
  };

  const goToPrevAddPathStep = () => {
    const index = ADD_PATH_STEP_ORDER.indexOf(addPathStep.value);
    if (index > 0) addPathStep.value = ADD_PATH_STEP_ORDER[index - 1];
  };

  const finishAddPathWizard = () => {
    resetAddPathWizard();
    showAddPathDialog.value = false;
  };

  const removePath = (path) => {
    confirm.require({
      message: `Are you sure you want to delete the path "${path}" and all its methods?`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        delete formData.value.paths[path];
        if (selectedPath.value === path) {
          selectedPath.value = "";
          selectedMethod.value = "";
        }
        toast.add({
          severity: "success",
          summary: "Path Deleted",
          detail: `Path "${path}" has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  const removeMethod = (path, method) => {
    if (!formData.value.paths[path]) return;

    confirm.require({
      message: `Are you sure you want to remove the ${method.toUpperCase()} method from ${path}?`,
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
        // Delete the method from the path
        delete formData.value.paths[path][method];

        // If this was the selected method, clear the selection
        if (selectedPath.value === path && selectedMethod.value === method) {
          selectedMethod.value = "";
        }

        // If no methods left for this path, remove the path entirely
        const remainingMethods = Object.keys(formData.value.paths[path]).filter(
          (key) =>
            !["summary", "description", "servers", "parameters"].includes(key)
        );

        if (remainingMethods.length === 0) {
          delete formData.value.paths[path];
          selectedPath.value = "";
        }

        toast.add({
          severity: "success",
          summary: "Method Removed",
          detail: `${method.toUpperCase()} removed from ${path}.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  const showAddMethodDialog = (path) => {
    currentPathForMethod.value = path;
    methodToAdd.value = "";
    addMethodStep.value = "method";
    showAddMethodDialogVisible.value = true;
  };

  // One-shot creation (used directly by tests and available for any caller
  // that just wants a method added with blank defaults, selected, and the
  // dialog closed — no wizard steps involved). Mirrors addPath()'s split
  // from createWizardOperation() above.
  const addMethodToPath = () => {
    if (!methodToAdd.value || !currentPathForMethod.value) return;

    formData.value.paths[currentPathForMethod.value][methodToAdd.value] =
      buildNewOperation(currentPathForMethod.value);

    selectedPath.value = currentPathForMethod.value;
    selectedMethod.value = methodToAdd.value;
    methodToAdd.value = "";
    addMethodStep.value = "method";
    showAddMethodDialogVisible.value = false;
  };

  const resetAddMethodWizard = () => {
    methodToAdd.value = "";
    addMethodStep.value = "method";
    wizardCreatedPath.value = null;
    wizardCreatedMethod.value = null;
  };

  const cancelAddMethodDialog = () => {
    discardWizardPath();
    resetAddMethodWizard();
    showAddMethodDialogVisible.value = false;
  };

  const createWizardMethod = () => {
    const path = currentPathForMethod.value;
    formData.value.paths[path][methodToAdd.value] = buildNewOperation(path);

    selectedPath.value = path;
    selectedMethod.value = methodToAdd.value;
    wizardCreatedPath.value = path;
    wizardCreatedMethod.value = methodToAdd.value;
  };

  const goToNextAddMethodStep = () => {
    if (addMethodStep.value === "method") {
      if (!methodToAdd.value) return;
      createWizardMethod();
    }
    const index = ADD_METHOD_STEP_ORDER.indexOf(addMethodStep.value);
    if (index < ADD_METHOD_STEP_ORDER.length - 1) {
      addMethodStep.value = ADD_METHOD_STEP_ORDER[index + 1];
    }
  };

  const goToPrevAddMethodStep = () => {
    const index = ADD_METHOD_STEP_ORDER.indexOf(addMethodStep.value);
    if (index > 0) addMethodStep.value = ADD_METHOD_STEP_ORDER[index - 1];
  };

  const finishAddMethodWizard = () => {
    resetAddMethodWizard();
    showAddMethodDialogVisible.value = false;
  };

  // ── Edit Path ────────────────────────────────────────────────────────────

  const editPath = (path) => {
    editingPath.value = path;
    // Strip leading slash for the input (same convention as Add Path)
    editPathValue.value = path.startsWith("/") ? path.slice(1) : path;
    editPathError.value = "";
    showEditPathDialog.value = true;
  };

  const confirmEditPath = () => {
    const newFullPath = editPathValue.value
      ? editPathValue.value.startsWith("/")
        ? editPathValue.value
        : "/" + editPathValue.value
      : "/";
    const oldFullPath = editingPath.value;

    // Conflict check
    if (newFullPath !== oldFullPath && formData.value.paths[newFullPath]) {
      editPathError.value = "Path already exists";
      return;
    }
    editPathError.value = "";

    const oldParamNames = extractPathParams(oldFullPath);
    const newParamNames = extractPathParams(newFullPath);

    const methods = Object.keys(formData.value.paths[oldFullPath] || {});

    // Collect all content-filled removals across all methods
    const allFilledRemovals = [];
    const diffsByMethod = {};
    for (const methodKey of methods) {
      const method = formData.value.paths[oldFullPath][methodKey];
      const diff = computePathParamDiff(method, oldParamNames, newParamNames);
      diffsByMethod[methodKey] = diff;
      for (const p of diff.filledRemovals) {
        if (!allFilledRemovals.find((x) => x.name === p.name)) {
          allFilledRemovals.push(p);
        }
      }
    }

    const doRename = () => {
      // Apply param sync to all methods
      for (const methodKey of methods) {
        const { toAdd, toRemove } = diffsByMethod[methodKey];
        applyPathParamSync(oldFullPath, methodKey, toAdd, toRemove);
      }

      // Rename path key (preserve order)
      const pathsArray = Object.entries(formData.value.paths);
      const idx = pathsArray.findIndex(([k]) => k === oldFullPath);
      if (idx !== -1) {
        pathsArray[idx] = [newFullPath, pathsArray[idx][1]];
      }
      formData.value.paths = Object.fromEntries(pathsArray);

      // Update selection if the renamed path was selected
      if (selectedPath.value === oldFullPath) {
        selectedPath.value = newFullPath;
      }

      showEditPathDialog.value = false;
      editingPath.value = "";
      editPathValue.value = "";

      toast.add({
        severity: "success",
        summary: "Path Updated",
        detail: `Path renamed to ${newFullPath}`,
        life: 3000,
      });
    };

    if (allFilledRemovals.length > 0) {
      const names = allFilledRemovals.map((p) => `{${p.name}}`).join(", ");
      confirm.require({
        message: `Editing this path will remove path parameters: ${names}. Their definitions will be lost. Continue?`,
        header: "Remove Path Parameters?",
        icon: "pi pi-exclamation-triangle",
        acceptProps: { label: "Yes, remove them", severity: "danger" },
        rejectProps: { label: "Cancel", outlined: true },
        accept: () => {
          doRename();
          confirm.close();
        },
        reject: () => {
          confirm.close();
        },
      });
    } else {
      doRename();
    }
  };

  const selectPathMethod = (path, method) => {
    selectedPath.value = path;
    selectedMethod.value = method;
  };

  const selectFirstMethod = (pathItem) => {
    // Only auto-select first method if no method chip was directly clicked
    if (selectedPath.value === pathItem.path && selectedMethod.value) return;
    if (pathItem.methods && pathItem.methods.length > 0) {
      selectedPath.value = pathItem.path;
      selectedMethod.value = pathItem.methods[0];
      // Ensure the panel is open after PrimeVue toggles it
      const index = pathsList.value.findIndex((p) => p.path === pathItem.path);
      if (index !== -1) {
        const key = index.toString();
        // Use nextTick so this runs after PrimeVue's internal @update:value
        nextTick(() => {
          if (!openPaths.value.includes(key)) {
            openPaths.value = [...openPaths.value, key];
          }
        });
      }
    }
  };

  const selectAndOpenPath = (path, method) => {
    selectedPath.value = path;
    selectedMethod.value = method;
    // Ensure the accordion panel for this path is open
    const index = pathsList.value.findIndex((p) => p.path === path);
    if (index !== -1) {
      const key = index.toString();
      if (!openPaths.value.includes(key)) {
        openPaths.value = [...openPaths.value, key];
      }
    }
  };

  // Computed properties for current method
  const currentMethodData = computed(() => {
    if (!selectedPath.value || !selectedMethod.value) return {};
    const methodData =
      formData.value.paths[selectedPath.value]?.[selectedMethod.value] || {};

    // Ensure structures exist
    if (!methodData.parameters) methodData.parameters = [];
    if (!methodData.requestBody)
      methodData.requestBody = { required: false, description: "" };
    if (!methodData.responses) methodData.responses = {};

    return methodData;
  });

  // Parameter methods
  const addParameter = (path, method) => {
    if (!formData.value.paths[path][method].parameters) {
      formData.value.paths[path][method].parameters = [];
    }
    formData.value.paths[path][method].parameters.push({
      name: "",
      in: "query",
      description: "",
      required: false,
      schema: { type: "string" },
    });
  };

  // A parameter list entry is either inline (has name/in/schema) or a
  // reference to components.parameters (has only $ref) — OpenAPI's
  // Reference Object and Parameter Object are mutually exclusive shapes.
  // New parameters always start inline (addParameter above); these two
  // convert an existing entry between the two shapes in place.
  const isParameterRef = (param) => !!param && "$ref" in param;

  const convertParameterToRef = (path, method, index) => {
    formData.value.paths[path][method].parameters[index] = { $ref: "" };
  };

  const convertParameterToInline = (path, method, index) => {
    formData.value.paths[path][method].parameters[index] = {
      name: "",
      in: "query",
      description: "",
      required: false,
      schema: { type: "string" },
    };
  };

  const removeParameter = (path, method, index) => {
    confirm.require({
      message: "Are you sure you want to delete this parameter?",
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        formData.value.paths[path][method].parameters.splice(index, 1);
        toast.add({
          severity: "success",
          summary: "Parameter Deleted",
          detail: "The parameter has been removed.",
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  // Request body methods

  // Returns the live schema object for the current inline request body (writable via v-model on its properties)
  const currentRequestBodySchema = computed(() => {
    if (!selectedPath.value || !selectedMethod.value) return null;
    if (requestBodySchemaType.value !== "inline" || !requestBodyContentType.value)
      return null;
    const methodData =
      formData.value.paths[selectedPath.value]?.[selectedMethod.value];
    if (!methodData) return null;
    if (!methodData.requestBody) methodData.requestBody = { required: false };
    if (!methodData.requestBody.content) methodData.requestBody.content = {};
    if (!methodData.requestBody.content[requestBodyContentType.value]) {
      methodData.requestBody.content[requestBodyContentType.value] = {
        schema: { type: requestBodyInlineSchemaType.value },
      };
    }
    if (!methodData.requestBody.content[requestBodyContentType.value].schema) {
      methodData.requestBody.content[requestBodyContentType.value].schema = {
        type: requestBodyInlineSchemaType.value,
      };
    }
    return methodData.requestBody.content[requestBodyContentType.value].schema;
  });

  // Sync requestBodyInlineSchemaType from the live schema when selection changes
  watch(
    [selectedPath, selectedMethod, requestBodyContentType, requestBodySchemaType],
    () => {
      if (requestBodySchemaType.value !== "inline") return;
      const schema = currentRequestBodySchema.value;
      if (schema) {
        const t = Array.isArray(schema.type)
          ? schema.type.find((x) => x !== "null") || "object"
          : schema.type || "object";
        requestBodyInlineSchemaType.value = t;
      } else {
        requestBodyInlineSchemaType.value = "object";
      }
    }
  );

  // Called when the type selector in the inline builder changes
  const onRequestBodyTypeChange = () => {
    if (!selectedPath.value || !selectedMethod.value || !requestBodyContentType.value)
      return;
    const methodData =
      formData.value.paths[selectedPath.value][selectedMethod.value];
    if (!methodData.requestBody) methodData.requestBody = { required: false };
    if (!methodData.requestBody.content) methodData.requestBody.content = {};
    const t = requestBodyInlineSchemaType.value;
    const newSchema = { type: t };
    if (t === "object") {
      newSchema.properties = {};
    } else if (t === "array") {
      newSchema._itemSchemas = [];
    }
    methodData.requestBody.content[requestBodyContentType.value] = {
      schema: newSchema,
    };
  };

  // Property helpers for the inline object request body
  const addRequestBodyProperty = () => {
    const schema = currentRequestBodySchema.value;
    if (!schema || schema.type !== "object") return;
    if (!schema.properties) schema.properties = {};
    let propName = "newProperty";
    let counter = 1;
    while (schema.properties[propName]) {
      propName = `newProperty${counter}`;
      counter++;
    }
    schema.properties[propName] = { type: "string", description: "" };
  };

  const removeRequestBodyProperty = (propName) => {
    const schema = currentRequestBodySchema.value;
    if (!schema || !schema.properties) return;
    delete schema.properties[propName];
    if (schema.required)
      schema.required = schema.required.filter((r) => r !== propName);
  };

  const renameRequestBodyProperty = (oldName, newName) => {
    if (oldName === newName || !newName) return;
    const schema = currentRequestBodySchema.value;
    if (!schema || !schema.properties || schema.properties[newName]) return;
    schema.properties[newName] = schema.properties[oldName];
    delete schema.properties[oldName];
    if (schema.required) {
      const idx = schema.required.indexOf(oldName);
      if (idx !== -1) schema.required[idx] = newName;
    }
  };

  const toggleRequestBodyPropertyRequired = (propName, isRequired) => {
    const schema = currentRequestBodySchema.value;
    if (!schema) return;
    if (!schema.required) schema.required = [];
    if (isRequired) {
      if (!schema.required.includes(propName)) schema.required.push(propName);
    } else {
      schema.required = schema.required.filter((r) => r !== propName);
    }
  };

  // Watch for request body schema type changes (reference mode)
  watch(
    [requestBodySchemaType, requestBodySchemaRef, requestBodyContentType],
    () => {
      if (!selectedPath.value || !selectedMethod.value) return;

      const methodData =
        formData.value.paths[selectedPath.value][selectedMethod.value];
      if (!methodData.requestBody) methodData.requestBody = { required: false };
      if (!methodData.requestBody.content) methodData.requestBody.content = {};

      if (
        requestBodyContentType.value &&
        requestBodySchemaType.value === "reference" &&
        requestBodySchemaRef.value
      ) {
        methodData.requestBody.content[requestBodyContentType.value] = {
          schema: { $ref: requestBodySchemaRef.value },
        };
      }
    }
  );

  // Returns true if the given status code is already used by the current operation
  // In edit mode (editingResponseCode set), the original code being renamed is excluded
  const isResponseCodeUsed = (code) => {
    if (!selectedPath.value || !selectedMethod.value) return false;
    const responses =
      formData.value.paths[selectedPath.value]?.[selectedMethod.value]
        ?.responses || {};
    const usedCodes = Object.keys(responses);
    if (editingResponseCode.value) {
      // Exclude the code currently being edited so it doesn't block re-selecting itself
      return usedCodes
        .filter((c) => c !== editingResponseCode.value)
        .includes(String(code));
    }
    return usedCodes.includes(String(code));
  };

  // ── Response dialog helpers ──────────────────────────────────────────────

  const openAddResponseDialog = () => {
    editingResponseCode.value = "";
    newResponseCode.value = "";
    responseDialogStep.value = 1;
    responseDialogCategory.value = "";
    showAddResponseDialog.value = true;
  };

  const openEditResponseCodeDialog = (statusCode) => {
    editingResponseCode.value = statusCode;
    newResponseCode.value = statusCode;
    // Pre-select category from existing code
    const code = parseInt(statusCode);
    if (code >= 200 && code < 300) responseDialogCategory.value = "2xx";
    else if (code >= 300 && code < 400) responseDialogCategory.value = "3xx";
    else if (code >= 400 && code < 500) responseDialogCategory.value = "4xx";
    else if (code >= 500 && code < 600) responseDialogCategory.value = "5xx";
    else responseDialogCategory.value = "custom";
    responseDialogStep.value = 2;
    showAddResponseDialog.value = true;
  };

  const resetResponseDialog = () => {
    responseDialogStep.value = 1;
    responseDialogCategory.value = "";
    editingResponseCode.value = "";
    newResponseCode.value = "";
  };

  const confirmResponseDialog = () => {
    if (!newResponseCode.value || !selectedPath.value || !selectedMethod.value)
      return;

    const responses =
      formData.value.paths[selectedPath.value][selectedMethod.value].responses;
    if (!responses) {
      formData.value.paths[selectedPath.value][selectedMethod.value].responses =
        {};
    }

    const code = newResponseCode.value;

    if (editingResponseCode.value && editingResponseCode.value !== code) {
      // Rename: preserve existing response data under new key
      const existing = responses[editingResponseCode.value];
      delete responses[editingResponseCode.value];
      responses[code] = existing || { description: "", content: {} };
    } else if (!editingResponseCode.value) {
      // Add new
      if (!responses[code]) {
        const defaultDesc = getStatusName(code) ? getStatusName(code) : "";
        responses[code] = { description: defaultDesc, content: {} };
      }
    }

    showAddResponseDialog.value = false;
    resetResponseDialog();
  };

  // ── Response methods ─────────────────────────────────────────────────────

  const removeResponse = (path, method, statusCode) => {
    confirm.require({
      message: `Are you sure you want to delete the ${statusCode} response?`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        delete formData.value.paths[path][method].responses[statusCode];
        toast.add({
          severity: "success",
          summary: "Response Deleted",
          detail: `Response ${statusCode} has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  // A response is either inline (has description/content) or a reference to
  // components.responses (has only $ref). New responses always start inline
  // (confirmResponseDialog above); these convert an existing entry in place.
  const isResponseRef = (response) => !!response && "$ref" in response;

  const convertResponseToRef = (path, method, statusCode) => {
    formData.value.paths[path][method].responses[statusCode] = { $ref: "" };
  };

  const convertResponseToInline = (path, method, statusCode) => {
    formData.value.paths[path][method].responses[statusCode] = {
      description: "",
      content: {},
    };
  };

  const onPropertyTypeChange = (prop) => {
    if (prop.type === "array") {
      if (!prop.items) prop.items = {};
      if (!prop._itemSchemas) prop._itemSchemas = [];
    }
    if (prop.type === "$ref" && !prop.$ref) {
      prop.$ref = "";
    }
  };

  const onItemTypesChange = (schema, newTypes) => {
    const current = schema._itemSchemas || [];
    const hadObject = current.some((s) => s.type === "object");
    const wantsObject = newTypes.includes("object");

    const newScalars = newTypes
      .filter((t) => t !== "object")
      .map((t) => current.find((s) => s.type === t) || { type: t });

    let objectEntries;
    if (wantsObject && hadObject) {
      objectEntries = current.filter((s) => s.type === "object");
    } else if (wantsObject && !hadObject) {
      objectEntries = [{ type: "object", $ref: "" }];
    } else {
      objectEntries = [];
    }

    schema._itemSchemas = [...newScalars, ...objectEntries];
  };

  // Path drag and drop handlers
  const handlePathDragStart = (event, path, index) => {
    draggedPath.value = path;
    draggedPathIndex.value = index;
    event.target.classList.add("dragging-path");
    event.dataTransfer.effectAllowed = "move";
  };

  const handlePathDrop = (event, dropIndex) => {
    event.preventDefault();
    event.stopPropagation();

    if (draggedPathIndex.value === dropIndex) return;

    // Convert paths object to array to reorder
    const pathsArray = Object.entries(formData.value.paths);
    const [movedItem] = pathsArray.splice(draggedPathIndex.value, 1);
    pathsArray.splice(dropIndex, 0, movedItem);

    // Rebuild paths object with new order
    formData.value.paths = Object.fromEntries(pathsArray);
  };

  // Resets only this tab's transient path-drag refs. The parent composes
  // a shared handleDragEnd that calls this alongside useComponentsEditor's reset.
  const resetPathDrag = () => {
    draggedPath.value = null;
    draggedPathIndex.value = null;
  };

  const handlePathKeydown = (event) => {
    if (event.key === "{") {
      event.preventDefault();
      const input = event.target;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const value = input.value;
      const newValue = value.substring(0, start) + "{}" + value.substring(end);
      newPath.value = newValue;
      // Move cursor inside the braces on next tick
      setTimeout(() => {
        input.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  const handleEditPathKeydown = (event) => {
    if (event.key === "{") {
      event.preventDefault();
      const input = event.target;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const value = input.value;
      const newValue = value.substring(0, start) + "{}" + value.substring(end);
      editPathValue.value = newValue;
      setTimeout(() => {
        input.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  // ── Per-operation security override ────────────────────────────────────
  // Three states, distinguished by the shape of `operation.security`:
  //   - key absent            → "inherit" the top-level `security` list
  //   - present, empty array  → "public" (explicitly no auth required)
  //   - present, non-empty    → "custom" per-operation requirements
  const operationSecurityMode = (operation) => {
    if (!operation || !("security" in operation)) return "inherit";
    return operation.security.length === 0 ? "public" : "custom";
  };

  const setOperationSecurityMode = (operation, mode) => {
    if (mode === "inherit") {
      delete operation.security;
    } else if (mode === "public") {
      operation.security = [];
    } else {
      operation.security = operation.security?.length ? operation.security : [{}];
    }
  };

  return {
    showAddPathDialog,
    showEditPathDialog,
    editingPath,
    editPathValue,
    editPathError,
    showAddMethodDialogVisible,
    showAddResponseDialog,
    responseDialogStep,
    responseDialogCategory,
    editingResponseCode,
    newPath,
    newMethod,
    addPathStep,
    cancelAddPathDialog,
    goToNextAddPathStep,
    goToPrevAddPathStep,
    finishAddPathWizard,
    newResponseCode,
    methodToAdd,
    currentPathForMethod,
    selectedPath,
    selectedMethod,
    openPaths,
    requestBodyContentType,
    requestBodySchemaType,
    requestBodySchemaRef,
    requestBodyInlineSchemaType,
    draggedPath,
    httpMethods,
    pathsList,
    pathSearchQuery,
    pathMethodFilter,
    filteredPathsList,
    visiblePathSet,
    hasActivePathFilter,
    togglePathMethodFilter,
    clearPathFilters,
    isOperationIdDuplicate,
    isParameterDuplicate,
    isResponseDescriptionMissing,
    availableSchemas,
    isOpenAPI31,
    globalTagNames,
    availableMethodsForPath,
    currentMethodData,
    currentRequestBodySchema,
    addChipOnEnter,
    addSchema,
    addPath,
    removePath,
    removeMethod,
    showAddMethodDialog,
    addMethodToPath,
    addMethodStep,
    cancelAddMethodDialog,
    goToNextAddMethodStep,
    goToPrevAddMethodStep,
    finishAddMethodWizard,
    editPath,
    confirmEditPath,
    selectPathMethod,
    selectFirstMethod,
    selectAndOpenPath,
    addParameter,
    removeParameter,
    onRequestBodyTypeChange,
    addRequestBodyProperty,
    removeRequestBodyProperty,
    renameRequestBodyProperty,
    toggleRequestBodyPropertyRequired,
    isResponseCodeUsed,
    openAddResponseDialog,
    openEditResponseCodeDialog,
    resetResponseDialog,
    confirmResponseDialog,
    removeResponse,
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
    onPropertyTypeChange,
    onItemTypesChange,
    handlePathDragStart,
    handlePathDrop,
    handlePathKeydown,
    handleEditPathKeydown,
    resetPathDrag,
    operationSecurityMode,
    setOperationSecurityMode,
    isParameterRef,
    convertParameterToRef,
    convertParameterToInline,
    isResponseRef,
    convertResponseToRef,
    convertResponseToInline,
  };
}
