import { ref, computed, watch, nextTick } from "vue";
import {
  extractPathParams,
  buildPathParam,
  computePathParamDiff,
  getStatusName,
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
  const newResponseCode = ref("");
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
  const draggedMethod = ref(null);
  const draggedMethodIndex = ref(null);
  const draggedMethodPath = ref(null);

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
      methods: Object.keys(formData.value.paths[path]),
    }));
  });

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

  const addPath = () => {
    if (!newMethod.value) return;

    const fullPath = newPath.value
      ? newPath.value.startsWith("/")
        ? newPath.value
        : "/" + newPath.value
      : "/";

    if (!formData.value.paths[fullPath]) {
      formData.value.paths[fullPath] = {};
    }

    const pathParamNames = extractPathParams(fullPath);
    const pathParams = pathParamNames.map(buildPathParam);

    formData.value.paths[fullPath][newMethod.value] = {
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

    selectedPath.value = fullPath;
    selectedMethod.value = newMethod.value;
    newPath.value = "";
    newMethod.value = "";
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
    showAddMethodDialogVisible.value = true;
  };

  const addMethodToPath = () => {
    if (!methodToAdd.value || !currentPathForMethod.value) return;

    const pathParamNames = extractPathParams(currentPathForMethod.value);
    const pathParams = pathParamNames.map(buildPathParam);

    formData.value.paths[currentPathForMethod.value][methodToAdd.value] = {
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

    selectedPath.value = currentPathForMethod.value;
    selectedMethod.value = methodToAdd.value;
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

  const getResponseContentType = (response) => {
    if (!response.content) return "";
    return Object.keys(response.content)[0] || "";
  };

  const setResponseContentType = (response, contentType) => {
    if (!response.content) response.content = {};
    const oldContent = response.content;
    response.content = {};
    if (contentType) {
      response.content[contentType] = oldContent[Object.keys(oldContent)[0]] || {
        schema: { type: "object" },
      };
    }
  };

  const getResponseSchemaType = (response) => {
    const contentType = getResponseContentType(response);
    if (!contentType || !response.content[contentType]?.schema) return "inline";
    const schema = response.content[contentType].schema;
    // Use hasOwnProperty so { $ref: "" } (empty ref) is still detected as reference
    return Object.prototype.hasOwnProperty.call(schema, "$ref")
      ? "reference"
      : "inline";
  };

  const setResponseSchemaType = (response, type) => {
    const contentType = getResponseContentType(response);
    if (!contentType) return;
    if (!response.content[contentType]) response.content[contentType] = {};

    if (type === "reference") {
      response.content[contentType].schema = { $ref: "" };
    } else {
      response.content[contentType].schema = { type: "object", properties: {} };
    }
  };

  const getResponseSchemaRef = (response) => {
    const contentType = getResponseContentType(response);
    if (!contentType) return "";
    return response.content[contentType]?.schema?.$ref || "";
  };

  const setResponseSchemaRef = (response, ref) => {
    const contentType = getResponseContentType(response);
    if (!contentType) return;
    response.content[contentType].schema = { $ref: ref };
  };

  // Returns the live schema object for inline response (writable)
  const getResponseInlineSchema = (response) => {
    const contentType = getResponseContentType(response);
    if (!contentType) return {};
    if (!response.content) response.content = {};
    if (!response.content[contentType])
      response.content[contentType] = {
        schema: { type: "object", properties: {} },
      };
    if (!response.content[contentType].schema)
      response.content[contentType].schema = {
        type: "object",
        properties: {},
      };
    const schema = response.content[contentType].schema;
    // Treat any schema that has a $ref key (even empty string) as a reference schema
    if (Object.prototype.hasOwnProperty.call(schema, "$ref")) return {};
    return schema;
  };

  const getResponseInlineSchemaType = (response) => {
    const schema = getResponseInlineSchema(response);
    if (!schema || !schema.type) return "object";
    return Array.isArray(schema.type)
      ? schema.type.find((t) => t !== "null") || "object"
      : schema.type;
  };

  const setResponseInlineSchemaType = (response, type) => {
    const contentType = getResponseContentType(response);
    if (!contentType) return;
    if (!response.content) response.content = {};
    const newSchema = { type };
    if (type === "object") {
      newSchema.properties = {};
    } else if (type === "array") {
      newSchema._itemSchemas = [];
    }
    response.content[contentType] = { schema: newSchema };
  };

  const addResponseProperty = (response) => {
    const schema = getResponseInlineSchema(response);
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

  const removeResponseProperty = (response, propName) => {
    const schema = getResponseInlineSchema(response);
    if (!schema || !schema.properties) return;
    delete schema.properties[propName];
    if (schema.required)
      schema.required = schema.required.filter((r) => r !== propName);
  };

  const renameResponseProperty = (response, oldName, newName) => {
    if (oldName === newName || !newName) return;
    const schema = getResponseInlineSchema(response);
    if (!schema || !schema.properties || schema.properties[newName]) return;
    schema.properties[newName] = schema.properties[oldName];
    delete schema.properties[oldName];
    if (schema.required) {
      const idx = schema.required.indexOf(oldName);
      if (idx !== -1) schema.required[idx] = newName;
    }
  };

  const toggleResponsePropertyRequired = (response, propName, isRequired) => {
    const schema = getResponseInlineSchema(response);
    if (!schema) return;
    if (!schema.required) schema.required = [];
    if (isRequired) {
      if (!schema.required.includes(propName)) schema.required.push(propName);
    } else {
      schema.required = schema.required.filter((r) => r !== propName);
    }
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

  // Method drag and drop handlers
  const handleMethodDragStart = (event, path, method, index) => {
    draggedMethod.value = method;
    draggedMethodIndex.value = index;
    draggedMethodPath.value = path;
    event.target.classList.add("dragging-method");
    event.dataTransfer.effectAllowed = "move";
    event.stopPropagation();
  };

  const handleMethodDrop = (event, path, dropIndex) => {
    event.preventDefault();
    event.stopPropagation();

    if (draggedMethodPath.value !== path) return;
    if (draggedMethodIndex.value === dropIndex) return;

    const pathData = formData.value.paths[path];

    // Get the HTTP methods in order
    const methodsArray = Object.keys(pathData);

    // Get the method data before reordering
    const methodDataMap = {};
    methodsArray.forEach((method) => {
      methodDataMap[method] = pathData[method];
    });

    // Reorder methods
    const [movedMethod] = methodsArray.splice(draggedMethodIndex.value, 1);
    methodsArray.splice(dropIndex, 0, movedMethod);

    // Rebuild path object with new method order
    const newPathData = {};
    methodsArray.forEach((method) => {
      newPathData[method] = methodDataMap[method];
    });

    formData.value.paths[path] = newPathData;
  };

  // Resets only this tab's transient path/method-drag refs. The parent composes
  // a shared handleDragEnd that calls this alongside useComponentsEditor's reset.
  const resetPathDrag = () => {
    draggedPath.value = null;
    draggedPathIndex.value = null;
    draggedMethod.value = null;
    draggedMethodIndex.value = null;
    draggedMethodPath.value = null;
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
    draggedMethod,
    httpMethods,
    pathsList,
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
    handleMethodDragStart,
    handleMethodDrop,
    handlePathKeydown,
    handleEditPathKeydown,
    resetPathDrag,
  };
}
