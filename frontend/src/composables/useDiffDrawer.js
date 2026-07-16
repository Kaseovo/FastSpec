import { ref, computed, watch } from "vue";
import { generateMarkdownReport } from "../utils/markdownGenerator";
import { prettyJSON } from "../utils/diffDisplay";

// All of DiffDrawer.vue's reactive state, computed lists and imperative
// helpers, extracted verbatim from its setup() so DiffDrawer.vue (and its
// child components) can stay small. Behavior-preserving: this is the same
// code, just relocated — `props` is the same reactive props object Vue
// passes into setup(), so all reactivity tracking is unchanged.
export function useDiffDrawer(props) {
  const filter = ref("added");
  const search = ref("");
  const copying = ref(false);
  const detailOpen = ref(false);
  const selectedItem = ref(null);
  const showJson = ref(false);
  const expandedSections = ref({
    endpoints: true,
    schemas: true,
    info: true,
    servers: true,
  });
  const expandedSchemas = ref({});

  watch(
    () => props.diff,
    () => {
      // no-op for now; placeholder if we need to react to incoming diffs
    },
    { deep: true }
  );

  const summary = computed(() => {
    const d = props.diff || {};
    return {
      added:
        (d.infoAdded?.length || 0) +
        (d.added?.length || 0) +
        (d.schemaAdded?.length || 0) +
        (d.serverAdded?.length || 0),
      modified:
        (d.infoModified?.length || 0) +
        (d.modified?.length || 0) +
        (d.schemaModified?.length || 0) +
        (d.serverModified?.length || 0),
      removed:
        (d.infoRemoved?.length || 0) +
        (d.removed?.length || 0) +
        (d.schemaRemoved?.length || 0) +
        (d.serverRemoved?.length || 0),
    };
  });

  const hasChanges = computed(() => {
    const d = props.diff || {};
    return (
      (d.infoAdded?.length || 0) +
        (d.infoModified?.length || 0) +
        (d.infoRemoved?.length || 0) +
        (d.added?.length || 0) +
        (d.modified?.length || 0) +
        (d.removed?.length || 0) +
        (d.schemaAdded?.length || 0) +
        (d.schemaModified?.length || 0) +
        (d.schemaRemoved?.length || 0) >
      0
    );
  });

  const addedEndpoints = computed(() => {
    const d = props.diff || {};
    return (d.added || []).map((it) => ({ ...it, changeType: "added" }));
  });

  const modifiedEndpoints = computed(() => {
    const d = props.diff || {};
    return (d.modified || []).map((it) => ({
      ...it,
      changeType: "modified",
    }));
  });

  const removedEndpoints = computed(() => {
    const d = props.diff || {};
    return (d.removed || []).map((it) => ({ ...it, changeType: "removed" }));
  });

  const endpointsTotal = computed(
    () =>
      addedEndpoints.value.length +
      modifiedEndpoints.value.length +
      removedEndpoints.value.length
  );

  const endpoints = computed(() => {
    const q = search.value.trim().toLowerCase();

    let list = [];
    if (filter.value === "added") list = addedEndpoints.value;
    else if (filter.value === "modified") list = modifiedEndpoints.value;
    else if (filter.value === "removed") list = removedEndpoints.value;
    else
      list = [
        ...addedEndpoints.value,
        ...modifiedEndpoints.value,
        ...removedEndpoints.value,
      ];

    let filtered = list;
    if (q) {
      filtered = list.filter((it) => {
        return (
          (it.path || "").toLowerCase().includes(q) ||
          (it.method || "").toLowerCase().includes(q) ||
          (it.summary || "").toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  });

  // enhanced debug watcher — clearer, grouped, and includes server/info/schema lists
  watch(
    [addedEndpoints, modifiedEndpoints, removedEndpoints, filter, endpoints],
    () => {
      try {
        const d = props.diff || {};

        const sample = (arr, n = 5) =>
          Array.isArray(arr) ? arr.slice(0, n) : [];

        console.groupCollapsed("[DiffDrawer] Debug snapshot");
        console.log("counts", {
          added: addedEndpoints.value.length,
          modified: modifiedEndpoints.value.length,
          removed: removedEndpoints.value.length,
          filter: filter.value,
          endpointsVisible: endpoints.value.length,
        });

        console.log("diffKeys", Object.keys(d));

        // Log trimmed samples for quick inspection
        console.log("diffSamples", {
          added: sample(d.added),
          modified: sample(d.modified),
          removed: sample(d.removed),
          schemaAdded: sample(d.schemaAdded),
          schemaModified: sample(d.schemaModified),
          schemaRemoved: sample(d.schemaRemoved),
          serverAdded: sample(d.serverAdded),
          serverModified: sample(d.serverModified),
          serverRemoved: sample(d.serverRemoved),
          infoAdded: sample(d.infoAdded),
          infoModified: sample(d.infoModified),
          infoRemoved: sample(d.infoRemoved),
        });

        // If there's an apparent inconsistency, print the full arrays for diagnosis
        if (
          Array.isArray(d.removed) &&
          d.removed.length > 0 &&
          removedEndpoints.value === 0
        ) {
          console.warn(
            "[DiffDrawer] Inconsistency: props.diff.removed exists but removedEndpoints computed is empty — full lists below"
          );
          try {
            console.log("props.diff.removed (full)", d.removed);
          } catch (e) {
            console.log(
              "props.diff.removed (full) stringified",
              JSON.stringify(d.removed)
            );
          }
        }

        // Also show servers from diff and the current spec for context
        try {
          console.log("spec.servers", props.spec?.servers || []);
          console.log("serverRemoved (full)", d.serverRemoved || []);
          console.log("serverAdded (full)", d.serverAdded || []);
          console.log("serverModified (full)", d.serverModified || []);
        } catch (e) {
          // fall back to stringified output if structured objects cause issues
          console.log(
            "spec.servers (string)",
            JSON.stringify(props.spec?.servers || [])
          );
        }

        // Single structured summary (counts + full arrays) for copy/paste
        try {
          const summaryObj = {
            counts: {
              added: {
                endpoints: (d.added || []).length,
                schemas: (d.schemaAdded || []).length,
                servers: (d.serverAdded || []).length,
                info: (d.infoAdded || []).length,
              },
              modified: {
                endpoints: (d.modified || []).length,
                schemas: (d.schemaModified || []).length,
                servers: (d.serverModified || []).length,
                info: (d.infoModified || []).length,
              },
              removed: {
                endpoints: (d.removed || []).length,
                schemas: (d.schemaRemoved || []).length,
                servers: (d.serverRemoved || []).length,
                info: (d.infoRemoved || []).length,
              },
            },
            changes: {
              added: {
                endpoints: d.added || [],
                schemas: d.schemaAdded || [],
                servers: d.serverAdded || [],
                info: d.infoAdded || [],
              },
              modified: {
                endpoints: d.modified || [],
                schemas: d.schemaModified || [],
                servers: d.serverModified || [],
                info: d.infoModified || [],
              },
              removed: {
                endpoints: d.removed || [],
                schemas: d.schemaRemoved || [],
                servers: d.serverRemoved || [],
                info: d.infoRemoved || [],
              },
            },
          };

          // Print a pretty JSON string so it's easy to copy/paste into the chat
          console.log("diffSummary", JSON.stringify(summaryObj, null, 2));
        } catch (e) {
          console.log("diffSummary (error building summary)", e);
        }

        console.groupEnd();
      } catch (e) {
        // ignore logging errors in non-browser environments
      }
    }
  );

  // ensure that when user selects a filter with no items we collapse the endpoints
  // section so the UI doesn't accidentally show other lists.
  watch([filter, endpoints], () => {
    try {
      console.debug(
        "[DiffDrawer] endpoints items sample",
        Object.entries(endpoints.value).slice(0, 6)
      );
      // sections are dynamically managed by the watch on Object.keys(endpoints.value)
      try {
        console.debug("[DiffDrawer] schema lists", {
          schemaAdded: props.diff?.schemaAdded?.length ?? null,
          schemaModified: props.diff?.schemaModified?.length ?? null,
          schemaRemoved: props.diff?.schemaRemoved?.length ?? null,
        });
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  });

  const typeCounts = computed(() => {
    const d = props.diff || {};
    return {
      added: {
        endpoints: (d.added || []).length,
        components: (d.schemaAdded || []).length,
        info: (d.infoAdded || []).length,
        servers: (d.serverAdded || []).length,
      },
      modified: {
        endpoints: (d.modified || []).length,
        components: (d.schemaModified || []).length,
        info: (d.infoModified || []).length,
        servers: (d.serverModified || []).length,
      },
      removed: {
        endpoints: (d.removed || []).length,
        components: (d.schemaRemoved || []).length,
        info: (d.infoRemoved || []).length,
        servers: (d.serverRemoved || []).length,
      },
    };
  });

  function dereferenceSchema(schema, visited = new Set()) {
    if (!schema || typeof schema !== "object") {
      console.log(
        "[dereferenceSchema] Invalid schema:",
        schema,
        "returning original"
      );
      return schema;
    }

    // Handle $ref
    if (schema.$ref) {
      const refPath = schema.$ref;
      if (refPath.startsWith("#/")) {
        const path = refPath.slice(2).split("/");
        let resolved = props.spec;
        for (const segment of path) {
          resolved = resolved?.[segment];
          if (resolved === undefined) break;
        }
        if (resolved && !visited.has(refPath)) {
          visited.add(refPath);
          const deref = dereferenceSchema(resolved, visited);
          visited.delete(refPath);
          return deref;
        }
      }
      // If can't resolve, return as is
      return schema;
    }

    // Recursively dereference nested objects
    const result = { ...schema };
    for (const key in result) {
      if (result[key] && typeof result[key] === "object") {
        result[key] = dereferenceSchema(result[key], visited);
      }
    }

    // Fix required field if it's not an array
    if (
      result &&
      typeof result.required !== "undefined" &&
      !Array.isArray(result.required)
    ) {
      console.log(
        "[Fixing] required is not an array, converting:",
        result.required
      );
      if (typeof result.required === "object") {
        result.required = Object.keys(result.required);
      } else {
        result.required = [];
      }
    }

    return result || {};
  }

  const addedSchemas = computed(() => {
    const d = props.diff || {};
    return (d.schemaAdded || []).map((it) => {
      console.log(
        "[addedSchemas] Processing",
        it.name || it.key,
        "schema:",
        it.schema
      );
      const deref = dereferenceSchema(it.schema);
      console.log("[addedSchemas] Dereferenced:", deref);
      return {
        ...it,
        changeType: "added",
        name: it.name || it.key,
        dereferencedSchema: deref || {},
        changeCount: 1,
      };
    });
  });

  const modifiedSchemas = computed(() => {
    const d = props.diff || {};
    return (d.schemaModified || []).map((it) => {
      const fullSchema = props.spec?.components?.schemas?.[it.name];
      console.log(
        "[modifiedSchemas] Processing",
        it.name || it.key,
        "fullSchema:",
        fullSchema
      );
      const deref = dereferenceSchema(fullSchema);
      console.log("[modifiedSchemas] Dereferenced:", deref);
      const changeCount =
        (it.propertiesAdded?.length || 0) +
        (it.propertiesRemoved?.length || 0) +
        (it.propertiesModified?.length || 0) +
        (it.typeChanged ? 1 : 0) +
        (it.requiredChanged ? 1 : 0) +
        (it.enumChanged ? 1 : 0) +
        (it.formatChanged ? 1 : 0) +
        (it.validationChanged?.length || 0);
      return {
        ...it,
        changeType: "modified",
        name: it.name || it.key,
        dereferencedSchema: deref,
        changeCount,
      };
    });
  });

  const removedSchemas = computed(() => {
    const d = props.diff || {};
    return (d.schemaRemoved || []).map((it) => {
      console.log(
        "[removedSchemas] Processing",
        it.name || it.key,
        "schema:",
        it.schema
      );
      const deref = dereferenceSchema(it.schema);
      console.log("[removedSchemas] Dereferenced:", deref);
      return {
        ...it,
        changeType: "removed",
        name: it.name || it.key,
        dereferencedSchema: deref,
        changeCount: 1,
      };
    });
  });

  const schemas = computed(() => {
    const q = search.value.trim().toLowerCase();
    let list = [];
    if (filter.value === "added") list = addedSchemas.value;
    else if (filter.value === "modified") list = modifiedSchemas.value;
    else if (filter.value === "removed") list = removedSchemas.value;
    else
      list = [
        ...addedSchemas.value,
        ...modifiedSchemas.value,
        ...removedSchemas.value,
      ];

    if (!q) {
      const totalSchemaChanges =
        (addedSchemas.value?.length || 0) +
        (modifiedSchemas.value?.length || 0) +
        (removedSchemas.value?.length || 0);

      // Only inject current components when there are NO schema changes at all.
      if (!list.length && totalSchemaChanges === 0) {
        const currentSchemas = props.spec?.components?.schemas || {};
        list.push(
          ...Object.keys(currentSchemas).map((name) => ({
            key: name,
            name,
            changeType: "added",
            dereferencedSchema: dereferenceSchema(currentSchemas[name]),
          }))
        );
      }
      return list;
    }
    return list.filter((it) => {
      const name = (it.name || it.key || "").toLowerCase();
      const schemaText = JSON.stringify(
        it.dereferencedSchema || {}
      ).toLowerCase();
      return name.includes(q) || schemaText.includes(q);
    });
  });

  const schemasTotal = computed(
    () =>
      addedSchemas.value.length +
      modifiedSchemas.value.length +
      removedSchemas.value.length
  );

  const infos = computed(() => {
    const d = props.diff || {};
    const q = search.value.trim().toLowerCase();

    // build full list grouped by change type so we can apply filter
    let list = [
      ...(d.infoAdded || []).map((i) => ({
        key: i.key,
        value: i.value,
        changeType: "added",
      })),
      ...(d.infoModified || []).map((i) => ({
        key: i.key,
        oldValue: i.old,
        newValue: i.new,
        changeType: "modified",
      })),
      ...(d.infoRemoved || []).map((i) => ({
        key: i.key,
        value: i.value,
        changeType: "removed",
      })),
    ];

    // if no changes, add current info
    if (!list.length) {
      const currentInfo = props.spec?.info || {};
      for (const field of ["title", "version", "description"]) {
        if (currentInfo[field]) {
          list.push({
            key: field,
            value: currentInfo[field],
            changeType: "added",
          });
        }
      }
    }

    // apply top-level filter (added/modified/removed) similar to endpoints/schemas
    let filtered = [];
    if (filter.value === "added")
      filtered = list.filter((it) => it.changeType === "added");
    else if (filter.value === "modified")
      filtered = list.filter((it) => it.changeType === "modified");
    else if (filter.value === "removed")
      filtered = list.filter((it) => it.changeType === "removed");
    else filtered = list;

    // apply search
    if (q) {
      filtered = filtered.filter((it) => {
        return (
          (it.key || "").toLowerCase().includes(q) ||
          (String(it.value || "") || "").toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  });

  const servers = computed(() => {
    const d = props.diff || {};
    const q = search.value.trim().toLowerCase();

    // build full list grouped by change type so we can apply filter
    let list = [
      ...(d.serverAdded || []).map((i) => ({
        key: i.key,
        value: i.value,
        changeType: "added",
      })),
      ...(d.serverModified || []).map((i) => ({
        key: i.key,
        oldValue: i.old,
        newValue: i.new,
        changeType: "modified",
      })),
      ...(d.serverRemoved || []).map((i) => ({
        key: i.key,
        value: i.value,
        changeType: "removed",
      })),
    ];

    // if no server diff entries, only inject current servers when there are no other changes
    if (!list.length) {
      const totalOtherChanges =
        (d.added?.length || 0) +
        (d.modified?.length || 0) +
        (d.removed?.length || 0) +
        (d.schemaAdded?.length || 0) +
        (d.schemaModified?.length || 0) +
        (d.schemaRemoved?.length || 0) +
        (d.infoAdded?.length || 0) +
        (d.infoModified?.length || 0) +
        (d.infoRemoved?.length || 0);

      const totalServerChanges =
        (d.serverAdded?.length || 0) +
        (d.serverModified?.length || 0) +
        (d.serverRemoved?.length || 0);

      if (totalOtherChanges === 0 && totalServerChanges === 0) {
        const currentServers = props.spec?.servers || [];
        list.push(
          ...currentServers.map((s, i) => ({
            key: s.url || s.description || s.name || String(i),
            value: s,
            changeType: "added",
          }))
        );
      }
    }

    // apply top-level filter (added/modified/removed) similar to endpoints/schemas
    let filtered = [];
    if (filter.value === "added")
      filtered = list.filter((it) => it.changeType === "added");
    else if (filter.value === "modified")
      filtered = list.filter((it) => it.changeType === "modified");
    else if (filter.value === "removed")
      filtered = list.filter((it) => it.changeType === "removed");
    else filtered = list;

    // apply search
    if (q) {
      filtered = filtered.filter((it) => {
        return (
          (it.key || "").toLowerCase().includes(q) ||
          (String(it.value || "") || "").toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  });

  function openDetails(item) {
    selectedItem.value = item;
    detailOpen.value = true;
    showJson.value = false;
  }

  function setDetailOpen(val) {
    detailOpen.value = val;
    if (!val) {
      selectedItem.value = null;
      showJson.value = false;
    }
  }

  const userSelectedFilter = ref(false);

  function setFilter(val) {
    // record user selection so we can show the endpoints section even when
    // the selected category is empty (shows "No endpoints")
    userSelectedFilter.value = true;
    filter.value = val;
  }

  function toggleSection(key) {
    expandedSections.value[key] = !expandedSections.value[key];
  }

  function toggleSchemaExpand(name) {
    expandedSchemas.value[name] = !expandedSchemas.value[name];
  }

  async function copyAsMarkdown() {
    copying.value = true;
    try {
      // Prefer the server-rendered markdown (present whenever the diff was
      // sourced from the backend /compare endpoint) to avoid recomputing
      // the same report client-side. Fall back to the local formatter for
      // diffs that never touch the backend (e.g. live/unsaved-edit diffs).
      const md = props.markdown || generateMarkdownReport(props.diff || {});
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(md);
      } else {
        const t = document.createElement("textarea");
        t.value = md;
        t.style.position = "fixed";
        t.style.left = "-9999px";
        document.body.appendChild(t);
        t.select();
        try {
          document.execCommand("copy");
        } finally {
          t.remove();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      copying.value = false;
    }
  }

  async function copyItemMarkdown() {
    if (!selectedItem.value) return;
    const md = "```json\n" + prettyJSON(selectedItem.value) + "\n```";
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(md);
    } else {
      const t = document.createElement("textarea");
      t.value = md;
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
      } finally {
        t.remove();
      }
    }
  }

  function exportItemJSON() {
    if (!selectedItem.value) return;
    const data = JSON.stringify(selectedItem.value, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "item.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return {
    filter,
    search,
    copying,
    summary,
    typeCounts,
    hasChanges,
    endpoints,
    addedEndpoints,
    modifiedEndpoints,
    removedEndpoints,
    endpointsTotal,
    schemas,
    schemasTotal,
    infos,
    servers,
    expandedSections,
    expandedSchemas,
    toggleSection,
    toggleSchemaExpand,
    setFilter,
    dereferenceSchema,
    openDetails,
    detailOpen,
    selectedItem,
    setDetailOpen,
    showJson,
    copyItemMarkdown,
    copyAsMarkdown,
    exportItemJSON,
  };
}
