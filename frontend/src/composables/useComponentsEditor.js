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

  // "Add Schema" wizard — step 1 (name + type + description) then, for
  // object schemas, step 2 (a quick-start property list) — instead of the
  // old instant "NewSchema" creation. Non-object kinds have nothing
  // meaningful to configure up front (composition members, formats, etc.
  // are all edited fine afterward in the full schema editor), so they skip
  // straight to creation once step 1 is valid.
  const showAddSchemaDialog = ref(false);
  const addSchemaStep = ref(1);
  const newSchemaName = ref("");
  const newSchemaKind = ref("object");
  const newSchemaDescription = ref("");
  const newSchemaProperties = ref([]);

  const isNewSchemaNameDuplicate = computed(() => {
    const name = newSchemaName.value.trim();
    return !!name && !!formData.value.components?.schemas?.[name];
  });

  const resetAddSchemaWizard = () => {
    newSchemaName.value = "";
    newSchemaKind.value = "object";
    newSchemaDescription.value = "";
    newSchemaProperties.value = [];
    addSchemaStep.value = 1;
  };

  const openAddSchemaDialog = () => {
    resetAddSchemaWizard();
    showAddSchemaDialog.value = true;
  };

  const cancelAddSchemaDialog = () => {
    resetAddSchemaWizard();
    showAddSchemaDialog.value = false;
  };

  const addWizardProperty = () => {
    let name = "property";
    let counter = 1;
    const existing = new Set(newSchemaProperties.value.map((p) => p.name));
    while (existing.has(name)) {
      name = `property${counter}`;
      counter++;
    }
    newSchemaProperties.value.push({ name, type: "string", required: false });
  };

  const removeWizardProperty = (index) => {
    newSchemaProperties.value.splice(index, 1);
  };

  const confirmAddSchema = () => {
    const name = newSchemaName.value.trim();
    if (!name || formData.value.components.schemas[name]) return;

    const schema = {};
    setSchemaKind(schema, newSchemaKind.value);
    if (newSchemaDescription.value.trim()) {
      schema.description = newSchemaDescription.value.trim();
    }

    if (newSchemaKind.value === "object") {
      const required = [];
      for (const prop of newSchemaProperties.value) {
        const propName = prop.name.trim();
        if (!propName) continue;
        schema.properties[propName] = { type: prop.type };
        if (prop.required) required.push(propName);
      }
      if (required.length) schema.required = required;
    }

    formData.value.components.schemas[name] = schema;
    selectAndOpenSchema(name);
    resetAddSchemaWizard();
    showAddSchemaDialog.value = false;
  };

  const goToAddSchemaStep2 = () => {
    if (!newSchemaName.value.trim() || isNewSchemaNameDuplicate.value) return;
    if (newSchemaKind.value === "object") {
      addSchemaStep.value = 2;
    } else {
      confirmAddSchema();
    }
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

  // Type change handlers - initialize sub-structures
  const onSchemaTypeChange = (schema) => {
    if (schema.data.type === "array" && !schema.data.items) {
      schema.data.items = { type: "string" };
    }
    if (schema.data.type === "object" && !schema.data.properties) {
      schema.data.properties = {};
    }
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
    showAddSchemaDialog,
    addSchemaStep,
    newSchemaName,
    newSchemaKind,
    newSchemaDescription,
    newSchemaProperties,
    isNewSchemaNameDuplicate,
    openAddSchemaDialog,
    cancelAddSchemaDialog,
    goToAddSchemaStep2,
    confirmAddSchema,
    addWizardProperty,
    removeWizardProperty,
    removeSchema,
    renameSchema,
    updateSchema,
    addSchemaProperty,
    removeSchemaProperty,
    renameSchemaProperty,
    toggleSchemaPropertyRequired,
    onSchemaTypeChange,
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
