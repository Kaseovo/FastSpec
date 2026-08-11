import { ref, computed } from "vue";

// State + logic for FormEditor's "Components / schemas" tab, extracted verbatim
// from FormEditor.vue's setup(). Takes the reactive `formData` ref plus the
// PrimeVue `confirm` / `toast` services (side effects stay caller-provided).
//
// A few pure, formData-derived helpers (schemasList, availableSchemas,
// isOpenAPI31, addSchema, onPropertyTypeChange, onItemTypesChange,
// addChipOnEnter) are intentionally duplicated here and in usePathsEditor: both
// tabs need them and duplicating derived/stateless logic keeps the two
// composables independent (no shared mutable closure state). Property drag
// state is owned here since it is transient and tab-scoped; the parent composes
// a shared handleDragEnd from resetPropertyDrag().
export function useComponentsEditor(formData, confirm, toast) {
  // ── Transient drag state (schema property reordering) ────────────────────
  const draggedProperty = ref(null);
  const draggedPropertyIndex = ref(null);
  const draggedSchemaName = ref(null);

  const schemasList = computed(() => {
    return Object.keys(formData.value.components?.schemas || {}).map((name) => ({
      name,
      data: formData.value.components.schemas[name],
    }));
  });

  // ── Search filter ───────────────────────────────────────────────────────
  const schemaSearchQuery = ref("");

  const filteredSchemasList = computed(() => {
    const query = schemaSearchQuery.value.trim().toLowerCase();
    if (!query) return schemasList.value;
    return schemasList.value.filter(({ name, data }) => {
      if (name.toLowerCase().includes(query)) return true;
      const propNames = Object.keys(data.properties || {});
      return propNames.some((p) => p.toLowerCase().includes(query));
    });
  });

  const hasActiveSchemaFilter = computed(() => schemaSearchQuery.value.trim() !== "");

  const clearSchemaFilter = () => {
    schemaSearchQuery.value = "";
  };

  // ── Open/close state for the schemas Accordion ────────────────────────────
  // Mirrors usePathsEditor's openPaths: without a controlled `:value`, the
  // Accordion manages its own open state internally and can't be opened
  // programmatically (e.g. from the tree nav's "jump to this schema").
  const openSchemas = ref([]);

  const selectAndOpenSchema = (name) => {
    // Clear any active search first so the schema is guaranteed to be in
    // filteredSchemasList (and its index — which the Accordion keys panels
    // by — matches schemasList's).
    schemaSearchQuery.value = "";
    const index = schemasList.value.findIndex((s) => s.name === name);
    if (index !== -1) {
      const key = index.toString();
      if (!openSchemas.value.includes(key)) {
        openSchemas.value = [...openSchemas.value, key];
      }
    }
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

  const removeSchema = (name) => {
    confirm.require({
      message: `Are you sure you want to delete the schema "${name}"? Any references to it will become invalid.`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        delete formData.value.components.schemas[name];
        toast.add({
          severity: "success",
          summary: "Schema Deleted",
          detail: `Schema "${name}" has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  const renameSchema = (oldName, newName) => {
    if (!newName || oldName === newName) return;
    if (formData.value.components.schemas[newName]) return; // already exists

    // Rename the key (preserve order)
    const schemasArray = Object.entries(formData.value.components.schemas);
    const idx = schemasArray.findIndex(([k]) => k === oldName);
    if (idx === -1) return;
    schemasArray[idx] = [newName, schemasArray[idx][1]];
    formData.value.components.schemas = Object.fromEntries(schemasArray);

    // Update all $ref strings pointing to the old schema name
    const oldRef = `#/components/schemas/${oldName}`;
    const newRef = `#/components/schemas/${newName}`;
    const updateRefs = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        obj.forEach(updateRefs);
        return;
      }
      for (const key of Object.keys(obj)) {
        if (key === "$ref" && obj[key] === oldRef) {
          obj[key] = newRef;
        } else {
          updateRefs(obj[key]);
        }
      }
    };
    updateRefs(formData.value);
  };

  const updateSchema = (name, jsonString) => {
    try {
      formData.value.components.schemas[name] = JSON.parse(jsonString);
    } catch (e) {
      // Invalid JSON, don't update
    }
  };

  // Add/Edit Schema dialog — same shape as every other Add/Edit dialog in
  // this app (parameters, request body/schema properties): one dialog
  // handles both creating and editing, keyed by name since
  // components.schemas is a plain object. A schema being edited is a
  // *component in its own right*, not just something with properties, so
  // this covers the schema's own Basic Info plus whichever of
  // Composition (oneOf/anyOf/allOf) / Properties (object) / Validation
  // (string/number/integer/boolean/array) applies to its current kind —
  // Properties itself defers per-property editing to
  // openAddSchemaPropertyDialog/openEditSchemaPropertyDialog above, same
  // nesting relationship as a parameter's Array Items step.
  const showEditSchemaDialog = ref(false);
  const editingSchemaName = ref(null);
  const wizardCreatedSchemaName = ref(null);
  const editSchemaDialogStep = ref("basicInfo");

  const editingSchema = computed(() => {
    const name = editingSchemaName.value;
    if (name === null) return null;
    return formData.value.components?.schemas?.[name] ?? null;
  });

  const isEditingSchemaNameInvalid = computed(() => !(editingSchemaName.value || "").trim());

  const renameSchemaInDialog = (newName) => {
    const oldName = editingSchemaName.value;
    if (!newName || newName === oldName) return;
    if (formData.value.components?.schemas?.[newName]) return;
    renameSchema(oldName, newName);
    editingSchemaName.value = newName;
    if (wizardCreatedSchemaName.value === oldName) wizardCreatedSchemaName.value = newName;
  };

  const editSchemaDialogStepOrder = computed(() => {
    const schema = editingSchema.value;
    if (!schema) return ["basicInfo"];
    const kind = getSchemaKind(schema);
    if (isCompositionKind(kind)) return ["basicInfo", "composition"];
    if (kind === "object") return ["basicInfo", "properties"];
    return ["basicInfo", "validation"];
  });

  const goToNextEditSchemaStep = () => {
    if (isEditingSchemaNameInvalid.value) return;
    const order = editSchemaDialogStepOrder.value;
    const index = order.indexOf(editSchemaDialogStep.value);
    if (index < order.length - 1) editSchemaDialogStep.value = order[index + 1];
  };

  const goToPrevEditSchemaStep = () => {
    const order = editSchemaDialogStepOrder.value;
    const index = order.indexOf(editSchemaDialogStep.value);
    if (index > 0) editSchemaDialogStep.value = order[index - 1];
  };

  const openEditSchemaDialog = (name) => {
    editingSchemaName.value = name;
    wizardCreatedSchemaName.value = null;
    editSchemaDialogStep.value = "basicInfo";
    showEditSchemaDialog.value = true;
  };

  // Every "New Schema" button next to a $ref picker (parameter/property/
  // response item schemas, request body reference schema, etc.) opens this
  // same dialog instead of a blind instant create. `onCreated` is called
  // with the new schema's name once the dialog finishes (Done clicked),
  // letting each caller point its own $ref field at it — plain closure
  // state (not a ref) since it's pure control flow, never read by a
  // template.
  let pendingSchemaCreatedCallback = null;

  const openAddSchemaDialog = (onCreated) => {
    pendingSchemaCreatedCallback = typeof onCreated === "function" ? onCreated : null;

    let name = "NewSchema";
    let counter = 1;
    while (formData.value.components.schemas[name]) {
      name = `NewSchema${counter}`;
      counter++;
    }
    formData.value.components.schemas[name] = { type: "object", properties: {} };

    editingSchemaName.value = name;
    wizardCreatedSchemaName.value = name;
    editSchemaDialogStep.value = "basicInfo";
    showEditSchemaDialog.value = true;
  };

  const openAddSchemaDialogFor = (onCreated) => openAddSchemaDialog(onCreated);

  const resetEditSchemaDialog = () => {
    editingSchemaName.value = null;
    wizardCreatedSchemaName.value = null;
    editSchemaDialogStep.value = "basicInfo";
    showEditSchemaDialog.value = false;
  };

  const cancelEditSchemaDialog = () => {
    pendingSchemaCreatedCallback = null;
    if (wizardCreatedSchemaName.value !== null) {
      delete formData.value.components.schemas[wizardCreatedSchemaName.value];
    }
    resetEditSchemaDialog();
  };

  const finishEditSchemaDialog = () => {
    if (isEditingSchemaNameInvalid.value) return;
    const name = editingSchemaName.value;
    selectAndOpenSchema(name);
    resetEditSchemaDialog();

    if (pendingSchemaCreatedCallback) {
      const callback = pendingSchemaCreatedCallback;
      pendingSchemaCreatedCallback = null;
      callback(name);
    }
  };

  // Schema builder methods
  const addSchemaProperty = (schemaName) => {
    const schema = formData.value.components.schemas[schemaName];
    if (!schema.properties) schema.properties = {};

    let propName = "newProperty";
    let counter = 1;
    while (schema.properties[propName]) {
      propName = `newProperty${counter}`;
      counter++;
    }

    schema.properties[propName] = {
      type: "string",
      description: "",
      items: { type: "string" },
    };

    return propName;
  };

  const removeSchemaProperty = (schemaName, propName) => {
    confirm.require({
      message: `Are you sure you want to delete the property "${propName}"?`,
      header: "Confirm Deletion",
      icon: "pi pi-exclamation-triangle",
      acceptProps: { label: "Yes", severity: "danger" },
      rejectProps: { label: "No", outlined: true },
      accept: () => {
        const schema = formData.value.components.schemas[schemaName];
        delete schema.properties[propName];
        if (schema.required) {
          schema.required = schema.required.filter((r) => r !== propName);
        }
        toast.add({
          severity: "success",
          summary: "Property Deleted",
          detail: `Property "${propName}" has been removed.`,
          life: 3000,
        });
        confirm.close();
      },
      reject: () => {
        confirm.close();
      },
    });
  };

  const renameSchemaProperty = (schemaName, oldName, newName) => {
    if (oldName === newName || !newName) return;

    const schema = formData.value.components.schemas[schemaName];
    if (!schema.properties) return;

    if (schema.properties[newName]) {
      // New name already exists
      return;
    }

    schema.properties[newName] = schema.properties[oldName];
    delete schema.properties[oldName];

    // Update required array
    if (schema.required) {
      const index = schema.required.indexOf(oldName);
      if (index !== -1) {
        schema.required[index] = newName;
      }
    }
  };

  const toggleSchemaPropertyRequired = (schemaName, propName, isRequired) => {
    const schema = formData.value.components.schemas[schemaName];
    if (!schema.required) schema.required = [];

    if (isRequired) {
      if (!schema.required.includes(propName)) {
        schema.required.push(propName);
      }
    } else {
      schema.required = schema.required.filter((r) => r !== propName);
    }
  };

  // Add/Edit Schema Property dialog — same shape as usePathsEditor.js's
  // Add/Edit Property dialog for request bodies (Basic Info / Type &
  // Validation, collapsed "advanced" fields), duplicated rather than shared
  // for the same reason the rest of this file's property helpers are
  // duplicated: independent composables, no cross-tab coupling. The one
  // real difference is that a schema property needs an *owner* (which
  // schema it belongs to) tracked alongside its name, since ComponentsTab
  // can have many schemas' property lists in play, not just "the current
  // operation's" like request bodies.
  const showSchemaPropertyDialog = ref(false);
  const editingSchemaPropertyOwner = ref(null);
  const editingSchemaPropertyName = ref(null);
  const wizardCreatedSchemaPropertyName = ref(null);
  const schemaPropertyDialogStep = ref("basicInfo");

  const editingSchemaProperty = computed(() => {
    const owner = editingSchemaPropertyOwner.value;
    const name = editingSchemaPropertyName.value;
    if (!owner || name === null) return null;
    return formData.value.components?.schemas?.[owner]?.properties?.[name] ?? null;
  });

  // "Required" lives as membership in the *owner* schema's `required[]`,
  // not on the property itself — this is what the dialog's Required
  // checkbox reads/toggles, same reasoning as
  // usePathsEditor.js's toggleRequestBodyPropertyRequired.
  const isEditingSchemaPropertyRequired = computed(() => {
    const owner = editingSchemaPropertyOwner.value;
    const name = editingSchemaPropertyName.value;
    const schema = owner ? formData.value.components?.schemas?.[owner] : null;
    return !!schema?.required?.includes(name);
  });

  const toggleEditingSchemaPropertyRequired = (isRequired) => {
    if (!editingSchemaPropertyOwner.value) return;
    toggleSchemaPropertyRequired(
      editingSchemaPropertyOwner.value,
      editingSchemaPropertyName.value,
      isRequired,
    );
  };

  const isEditingSchemaPropertyInvalid = computed(
    () => !(editingSchemaPropertyName.value || "").trim(),
  );

  const renameSchemaPropertyInDialog = (newName) => {
    const owner = editingSchemaPropertyOwner.value;
    const oldName = editingSchemaPropertyName.value;
    if (!owner || !newName || newName === oldName) return;
    const schema = formData.value.components?.schemas?.[owner];
    if (!schema?.properties || schema.properties[newName]) return;
    renameSchemaProperty(owner, oldName, newName);
    editingSchemaPropertyName.value = newName;
    if (wizardCreatedSchemaPropertyName.value === oldName) {
      wizardCreatedSchemaPropertyName.value = newName;
    }
  };

  const schemaPropertyDialogStepOrder = computed(() =>
    editingSchemaProperty.value?.type === "$ref" ? ["basicInfo"] : ["basicInfo", "validation"],
  );

  const goToNextSchemaPropertyStep = () => {
    if (isEditingSchemaPropertyInvalid.value) return;
    const order = schemaPropertyDialogStepOrder.value;
    const index = order.indexOf(schemaPropertyDialogStep.value);
    if (index < order.length - 1) schemaPropertyDialogStep.value = order[index + 1];
  };

  const goToPrevSchemaPropertyStep = () => {
    const order = schemaPropertyDialogStepOrder.value;
    const index = order.indexOf(schemaPropertyDialogStep.value);
    if (index > 0) schemaPropertyDialogStep.value = order[index - 1];
  };

  const openAddSchemaPropertyDialog = (schemaName) => {
    const name = addSchemaProperty(schemaName);
    if (!name) return;
    editingSchemaPropertyOwner.value = schemaName;
    editingSchemaPropertyName.value = name;
    wizardCreatedSchemaPropertyName.value = name;
    schemaPropertyDialogStep.value = "basicInfo";
    showSchemaPropertyDialog.value = true;
  };

  const openEditSchemaPropertyDialog = (schemaName, propName) => {
    editingSchemaPropertyOwner.value = schemaName;
    editingSchemaPropertyName.value = propName;
    wizardCreatedSchemaPropertyName.value = null;
    schemaPropertyDialogStep.value = "basicInfo";
    showSchemaPropertyDialog.value = true;
  };

  const resetSchemaPropertyDialog = () => {
    editingSchemaPropertyOwner.value = null;
    editingSchemaPropertyName.value = null;
    wizardCreatedSchemaPropertyName.value = null;
    schemaPropertyDialogStep.value = "basicInfo";
    showSchemaPropertyDialog.value = false;
  };

  const cancelSchemaPropertyDialog = () => {
    if (wizardCreatedSchemaPropertyName.value !== null && editingSchemaPropertyOwner.value) {
      const schema = formData.value.components?.schemas?.[editingSchemaPropertyOwner.value];
      if (schema?.properties) delete schema.properties[wizardCreatedSchemaPropertyName.value];
    }
    resetSchemaPropertyDialog();
  };

  const finishSchemaPropertyDialog = () => {
    if (isEditingSchemaPropertyInvalid.value) return;
    resetSchemaPropertyDialog();
  };

  // ── Schema composition (oneOf/anyOf/allOf) ─────────────────────────────
  // Composition members are $ref-only for now (by far the most common real
  // usage — e.g. `Pet: oneOf: [Cat, Dog]`); inline member schemas aren't
  // editable through this UI yet. A schema is EITHER a plain typed schema
  // (type: object/array/string/...) OR a composition (oneOf/anyOf/allOf
  // array present, no `type`) — OpenAPI allows both to coexist but that's
  // an advanced case this editor doesn't attempt to support, to keep the
  // "what kind is this schema" control a single Select.
  const compositionKinds = ["oneOf", "anyOf", "allOf"];

  const getSchemaKind = (schema) => {
    for (const kind of compositionKinds) {
      if (Array.isArray(schema[kind])) return kind;
    }
    return schema.type || "object";
  };

  const setSchemaKind = (schema, kind) => {
    // Switching kind invalidates every type-specific field (properties,
    // items, oneOf members, discriminator, format/pattern/enum/etc.) —
    // same full-reset approach as onSecuritySchemeTypeChange, since a
    // half-migrated schema is worse than a clean one. description survives.
    const description = schema.description;
    for (const key of Object.keys(schema)) {
      delete schema[key];
    }
    if (description) schema.description = description;

    if (compositionKinds.includes(kind)) {
      schema[kind] = [];
    } else {
      schema.type = kind;
      if (kind === "object") schema.properties = {};
      if (kind === "array") schema.items = { type: "string" };
    }
  };

  const isCompositionKind = (kind) => compositionKinds.includes(kind);

  const compositionMemberRefs = (schema, kind) => {
    return (schema[kind] || []).map((m) => m.$ref).filter((ref) => ref !== undefined);
  };

  const setCompositionMembers = (schema, kind, refs) => {
    schema[kind] = refs.map((ref) => ({ $ref: ref }));
  };

  const setDiscriminatorEnabled = (schema, enabled) => {
    if (enabled) {
      schema.discriminator = { propertyName: "", mapping: {} };
    } else {
      delete schema.discriminator;
    }
  };

  const addDiscriminatorMapping = (schema) => {
    if (!schema.discriminator) return;
    if (!schema.discriminator.mapping) schema.discriminator.mapping = {};
    let key = "newKey";
    let counter = 1;
    while (Object.prototype.hasOwnProperty.call(schema.discriminator.mapping, key)) {
      key = `newKey${counter}`;
      counter++;
    }
    schema.discriminator.mapping[key] = "";
  };

  const removeDiscriminatorMapping = (schema, key) => {
    if (!schema.discriminator?.mapping) return;
    delete schema.discriminator.mapping[key];
  };

  const renameDiscriminatorMappingKey = (schema, oldKey, newKey) => {
    if (!newKey || oldKey === newKey) return;
    const mapping = schema.discriminator?.mapping;
    if (!mapping || Object.prototype.hasOwnProperty.call(mapping, newKey)) return;
    const entries = Object.entries(mapping);
    const idx = entries.findIndex(([k]) => k === oldKey);
    if (idx === -1) return;
    entries[idx] = [newKey, entries[idx][1]];
    schema.discriminator.mapping = Object.fromEntries(entries);
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

  // Sync MultiSelect type selection with _itemSchemas array
  // object type: selecting adds one object entry; deselecting removes ALL object entries
  const onItemTypesChange = (schema, newTypes) => {
    const current = schema._itemSchemas || [];
    const hadObject = current.some((s) => s.type === "object");
    const wantsObject = newTypes.includes("object");

    // rebuild scalar entries preserving existing constraints
    const newScalars = newTypes
      .filter((t) => t !== "object")
      .map((t) => current.find((s) => s.type === t) || { type: t });

    // handle object entries
    let objectEntries;
    if (wantsObject && hadObject) {
      // keep all existing object entries (user may have added multiples)
      objectEntries = current.filter((s) => s.type === "object");
    } else if (wantsObject && !hadObject) {
      // add first object entry
      objectEntries = [{ type: "object", $ref: "" }];
    } else {
      // deselected object — remove all
      objectEntries = [];
    }

    schema._itemSchemas = [...newScalars, ...objectEntries];
  };

  // Drag and drop handlers (schema properties)
  const handleDragStart = (event, schemaName, propName, index) => {
    draggedProperty.value = propName;
    draggedPropertyIndex.value = index;
    draggedSchemaName.value = schemaName;
    event.target.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/html", event.target.innerHTML);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event, schemaName, dropIndex) => {
    event.preventDefault();
    event.stopPropagation();

    if (draggedSchemaName.value !== schemaName) return;
    if (draggedPropertyIndex.value === dropIndex) return;

    const schema = formData.value.components.schemas[schemaName];
    const properties = schema.properties;

    // Convert properties object to array to reorder
    const propsArray = Object.entries(properties);
    const [movedItem] = propsArray.splice(draggedPropertyIndex.value, 1);
    propsArray.splice(dropIndex, 0, movedItem);

    // Rebuild properties object with new order
    schema.properties = Object.fromEntries(propsArray);
  };

  // Resets only this tab's transient property-drag refs. The parent composes a
  // shared handleDragEnd that calls this alongside usePathsEditor's reset.
  const resetPropertyDrag = () => {
    draggedProperty.value = null;
    draggedPropertyIndex.value = null;
    draggedSchemaName.value = null;
  };

  return {
    draggedProperty,
    draggedPropertyIndex,
    draggedSchemaName,
    schemasList,
    schemaSearchQuery,
    filteredSchemasList,
    hasActiveSchemaFilter,
    clearSchemaFilter,
    openSchemas,
    selectAndOpenSchema,
    availableSchemas,
    isOpenAPI31,
    addChipOnEnter,
    addSchema,
    showEditSchemaDialog,
    editingSchemaName,
    wizardCreatedSchemaName,
    editSchemaDialogStep,
    editingSchema,
    isEditingSchemaNameInvalid,
    renameSchemaInDialog,
    goToNextEditSchemaStep,
    goToPrevEditSchemaStep,
    openEditSchemaDialog,
    openAddSchemaDialog,
    openAddSchemaDialogFor,
    cancelEditSchemaDialog,
    finishEditSchemaDialog,
    removeSchema,
    renameSchema,
    updateSchema,
    addSchemaProperty,
    removeSchemaProperty,
    renameSchemaProperty,
    toggleSchemaPropertyRequired,
    showSchemaPropertyDialog,
    editingSchemaPropertyOwner,
    editingSchemaPropertyName,
    wizardCreatedSchemaPropertyName,
    schemaPropertyDialogStep,
    editingSchemaProperty,
    isEditingSchemaPropertyInvalid,
    isEditingSchemaPropertyRequired,
    toggleEditingSchemaPropertyRequired,
    renameSchemaPropertyInDialog,
    openAddSchemaPropertyDialog,
    openEditSchemaPropertyDialog,
    goToNextSchemaPropertyStep,
    goToPrevSchemaPropertyStep,
    cancelSchemaPropertyDialog,
    finishSchemaPropertyDialog,
    getSchemaKind,
    setSchemaKind,
    isCompositionKind,
    compositionMemberRefs,
    setCompositionMembers,
    setDiscriminatorEnabled,
    addDiscriminatorMapping,
    removeDiscriminatorMapping,
    renameDiscriminatorMappingKey,
    onPropertyTypeChange,
    onItemTypesChange,
    handleDragStart,
    handleDragOver,
    handleDrop,
    resetPropertyDrag,
  };
}
