<template>
  <div>
    <!-- Inline panel (when inline prop true) -->
    <div v-if="inline" class="diff-panel">
      <div class="drawer-header">
        <h3>Changes Overview</h3>
        <Button
          v-if="hasChanges"
          icon="pi pi-copy"
          label="Copy as Markdown"
          size="small"
          severity="secondary"
          @click="copyAsMarkdown"
          :loading="copying"
          aria-label="Copy changes as markdown"
        />
      </div>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <div
            class="toc-and-search"
            style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            "
          >
            <div
              class="toc-badges"
              role="navigation"
              aria-label="Changes table of contents"
            ></div>
            <div style="flex: 1">
              <input
                v-model="search"
                type="text"
                placeholder="Filter changes..."
                class="p-inputtext p-component"
                style="width: 100%"
              />
            </div>
          </div>

          <div v-if="!hasChanges" class="no-changes">
            <i
              class="pi pi-check-circle"
              style="font-size: 3rem; color: #10b981"
            ></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="changes-content">
            <Accordion multiple>
              <AccordionTab>
                <template #header>
                  <div style="display: flex; align-items: center; gap: 0.5rem">
                    <span>📊 Summary</span>
                  </div>
                </template>

                <div class="summary-grid">
                  <div class="summary-item added">
                    <Tag severity="success">Added</Tag>
                    <div class="count">{{ summary.added }}</div>
                  </div>
                  <div class="summary-item modified">
                    <Tag severity="warn">Modified</Tag>
                    <div class="count">{{ summary.modified }}</div>
                  </div>
                  <div class="summary-item removed">
                    <Tag severity="danger">Removed</Tag>
                    <div class="count">{{ summary.removed }}</div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.infoAdded?.length">
                <template #header>
                  <div>
                    ➕ Added Information ({{ filteredDiff.infoAdded.length }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.infoAdded"
                    :key="item.key"
                    class="change-item added"
                  >
                    <Tag severity="success">{{ item.key }}</Tag>
                    <div class="single-value">
                      <code>{{ item.value }}</code>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.infoModified?.length">
                <template #header>
                  <div>
                    ✏️ Modified Information ({{
                      filteredDiff.infoModified.length
                    }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.infoModified"
                    :key="item.key"
                    class="change-item modified"
                  >
                    <Tag severity="warning">{{ item.key }}</Tag>
                    <div class="change-values">
                      <div class="old-value">
                        <span class="value-label">Before:</span
                        ><code>{{ item.old }}</code>
                      </div>
                      <i class="pi pi-arrow-right"></i>
                      <div class="new-value">
                        <span class="value-label">After:</span
                        ><code>{{ item.new }}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.infoRemoved?.length">
                <template #header>
                  <div>
                    ➖ Removed Information ({{
                      filteredDiff.infoRemoved.length
                    }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.infoRemoved"
                    :key="item.key"
                    class="change-item removed"
                  >
                    <Tag severity="danger">{{ item.key }}</Tag>
                    <div class="single-value">
                      <code>{{ item.value }}</code>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.schemaAdded?.length">
                <template #header>
                  <div>
                    ➕ Added Schemas ({{ filteredDiff.schemaAdded.length }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.schemaAdded"
                    :key="item.name"
                    class="change-item added"
                  >
                    <div class="schema-name-header">
                      <i class="pi pi-sitemap"></i
                      ><code class="schema-name">{{ item.name }}</code
                      ><Tag v-if="item.schema.type" severity="info">{{
                        item.schema.type
                      }}</Tag>
                    </div>
                    <pre
                      class="schema-preview"
                    ><code>{{ JSON.stringify(item.schema, null, 2) }}</code></pre>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.schemaModified?.length">
                <template #header>
                  <div>
                    🔄 Modified Schemas ({{
                      filteredDiff.schemaModified.length
                    }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="(item, index) in filteredDiff.schemaModified"
                    :key="`schema-${item.name}-${index}`"
                    class="change-item schema-modified"
                  >
                    <div class="schema-name-header">
                      <i class="pi pi-sitemap"></i
                      ><code class="schema-name">{{ item.name }}</code>
                    </div>

                    <div v-if="item.typeChanged" class="type-change-inline">
                      <span class="change-label">Type:</span
                      ><code>{{ item.oldType }}</code
                      ><i class="pi pi-arrow-right"></i
                      ><code>{{ item.newType }}</code>
                    </div>

                    <div v-if="item.requiredChanged" class="required-change">
                      <i class="pi pi-exclamation-triangle"></i
                      ><span class="change-label">Required fields changed</span>
                      <div class="required-badges">
                        <div
                          v-if="item.requiredAdded?.length"
                          class="required-group"
                        >
                          <span class="required-label added">Added:</span
                          ><Tag
                            v-for="field in item.requiredAdded"
                            :key="field"
                            severity="danger"
                            size="small"
                            >{{ field }}</Tag
                          >
                        </div>
                        <div
                          v-if="item.requiredRemoved?.length"
                          class="required-group"
                        >
                          <span class="required-label removed">Removed:</span
                          ><Tag
                            v-for="field in item.requiredRemoved"
                            :key="field"
                            severity="success"
                            size="small"
                            >{{ field }}</Tag
                          >
                        </div>
                      </div>
                    </div>

                    <div v-if="item.enumChanged" class="validation-change">
                      <i class="pi pi-list"></i><span>Enum values changed</span>
                    </div>
                    <div v-if="item.formatChanged" class="validation-change">
                      <i class="pi pi-palette"></i><span>Format changed</span>
                    </div>

                    <div
                      v-if="item.validationChanged?.length"
                      class="validation-changes"
                    >
                      <i class="pi pi-shield"></i
                      ><span class="change-label"
                        >Validation rules changed:</span
                      >
                      <div class="validation-list">
                        <div
                          v-for="(validation, idx) in item.validationChanged"
                          :key="idx"
                          class="validation-item"
                        >
                          <code>{{ validation.field }}</code
                          ><span class="validation-arrow">:</span
                          ><code class="old-val">{{
                            validation.old ?? "none"
                          }}</code
                          ><i class="pi pi-arrow-right"></i
                          ><code class="new-val">{{
                            validation.new ?? "none"
                          }}</code>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="item.propertiesAdded?.length"
                      class="properties-summary added"
                    >
                      <i class="pi pi-plus-circle"></i
                      ><span
                        >{{ item.propertiesAdded.length }} properties
                        added</span
                      >
                      <div class="property-badges">
                        <Tag
                          v-for="prop in item.propertiesAdded"
                          :key="prop.name"
                          severity="success"
                          size="small"
                          >{{ prop.name }}</Tag
                        >
                      </div>
                    </div>

                    <div
                      v-if="item.propertiesRemoved?.length"
                      class="properties-summary removed"
                    >
                      <i class="pi pi-minus-circle"></i
                      ><span
                        >{{ item.propertiesRemoved.length }} properties
                        removed</span
                      >
                      <div class="property-badges">
                        <Tag
                          v-for="prop in item.propertiesRemoved"
                          :key="prop.name"
                          severity="danger"
                          size="small"
                          >{{ prop.name }}</Tag
                        >
                      </div>
                    </div>

                    <div
                      v-if="item.propertiesModified?.length"
                      class="properties-summary modified"
                    >
                      <i class="pi pi-pencil"></i
                      ><span
                        >{{ item.propertiesModified.length }} properties
                        modified</span
                      >
                      <div class="property-badges">
                        <Tag
                          v-for="prop in item.propertiesModified"
                          :key="prop.name"
                          severity="warn"
                          size="small"
                          >{{ prop.name }}</Tag
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.schemaRemoved?.length">
                <template #header>
                  <div>
                    ➖ Removed Schemas ({{ filteredDiff.schemaRemoved.length }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="(item, index) in filteredDiff.schemaRemoved"
                    :key="item.name"
                    class="change-item removed"
                  >
                    <div class="schema-name-header">
                      <i class="pi pi-sitemap"></i
                      ><code class="schema-name">{{ item.name }}</code
                      ><Tag
                        v-if="item.schema.type"
                        severity="danger"
                        size="small"
                        >{{ item.schema.type }}</Tag
                      >
                    </div>
                    <Button
                      class="p-button-text"
                      @click="toggleRemovedSchema(index)"
                      icon="pi pi-chevron-down"
                      :class="{ 'rotate-180': expandedRemovedSchemas[index] }"
                    />
                    <div
                      v-if="expandedRemovedSchemas[index]"
                      class="expanded-details"
                    >
                      <pre
                        class="schema-preview"
                      ><code>{{ JSON.stringify(item.schema, null, 2) }}</code></pre>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.added?.length">
                <template #header>
                  <div>
                    ➕ Added Endpoints ({{ filteredDiff.added.length }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.added"
                    :key="item.path"
                    class="change-item added"
                  >
                    <div class="endpoint-header">
                      <Tag :severity="getMethodSeverity(item.method)">{{
                        item.method
                      }}</Tag
                      ><code class="path">{{ item.path }}</code
                      ><Tag
                        v-if="item.deprecated"
                        severity="danger"
                        size="small"
                        >Deprecated</Tag
                      >
                    </div>
                    <div v-if="item.summary" class="endpoint-summary">
                      <strong>Summary:</strong> {{ item.summary }}
                    </div>
                    <div v-if="item.description" class="endpoint-description">
                      <strong>Description:</strong> {{ item.description }}
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.modified?.length">
                <template #header>
                  <div>
                    ✏️ Modified Endpoints ({{ filteredDiff.modified.length }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.modified"
                    :key="item.path + item.method"
                    class="change-item modified"
                  >
                    <div class="endpoint-header">
                      <Tag :severity="getMethodSeverity(item.method)">{{
                        item.method
                      }}</Tag
                      ><code class="path">{{ item.path }}</code>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab v-if="filteredDiff.removed?.length">
                <template #header>
                  <div>
                    ➖ Removed Endpoints ({{ filteredDiff.removed.length }})
                  </div>
                </template>
                <div class="change-list">
                  <div
                    v-for="item in filteredDiff.removed"
                    :key="item.path"
                    class="change-item removed"
                  >
                    <div class="endpoint-header">
                      <Tag :severity="getMethodSeverity(item.method)">{{
                        item.method
                      }}</Tag
                      ><code class="path">{{ item.path }}</code>
                    </div>
                  </div>
                </div>
              </AccordionTab>
            </Accordion>
          </div>
        </div>
      </ScrollPanel>
    </div>

    <!-- Drawer mode (when inline prop false) -->
    <Drawer
      v-else
      :visible="visible"
      @update:visible="$emit('update:visible', $event)"
      position="right"
      :style="{ width: '60vw' }"
    >
      <template #header>
        <div class="drawer-header">
          <h3>Changes Overview</h3>
          <Button
            v-if="hasChanges"
            icon="pi pi-copy"
            label="Copy as Markdown"
            size="small"
            severity="secondary"
            @click="copyAsMarkdown"
            :loading="copying"
            aria-label="Copy changes as markdown"
          />
        </div>
      </template>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <!-- reuse same internal content as inline -->
          <div
            class="toc-and-search"
            style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            "
          >
            <div
              class="toc-badges"
              role="navigation"
              aria-label="Changes table of contents"
            ></div>
            <div style="flex: 1">
              <input
                v-model="search"
                type="text"
                placeholder="Filter changes..."
                class="p-inputtext p-component"
                style="width: 100%"
              />
            </div>
          </div>

          <div v-if="!hasChanges" class="no-changes">
            <i
              class="pi pi-check-circle"
              style="font-size: 3rem; color: #10b981"
            ></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="changes-content">
            <Accordion multiple>
              <!-- (same Accordion content omitted for brevity; inline mode provides full UI) -->
              <AccordionTab>
                <template #header>
                  <div>Summary</div>
                </template>
                <div class="summary-grid">
                  <div class="summary-item added">
                    <Tag severity="success">Added</Tag>
                    <div class="count">{{ summary.added }}</div>
                  </div>
                  <div class="summary-item modified">
                    <Tag severity="warn">Modified</Tag>
                    <div class="count">{{ summary.modified }}</div>
                  </div>
                  <div class="summary-item removed">
                    <Tag severity="danger">Removed</Tag>
                    <div class="count">{{ summary.removed }}</div>
                  </div>
                </div>
              </AccordionTab>
            </Accordion>
          </div>
        </div>
      </ScrollPanel>
    </Drawer>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted } from "vue";
import Drawer from "primevue/drawer";
import Tag from "primevue/tag";
import Button from "primevue/button";
import Accordion from "primevue/accordion";
import AccordionTab from "primevue/accordiontab";
import ScrollPanel from "primevue/scrollpanel";
import { useToast } from "primevue/usetoast";
import { generateMarkdownReport } from "../utils/markdownGenerator";

export default {
  name: "DiffDrawer",
  components: {
    Drawer,
    Tag,
    Button,
    Accordion,
    AccordionTab,
    ScrollPanel,
  },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    diff: {
      type: Object,
      required: true,
    },
    inline: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:visible"],
  setup(props) {
    const expandedItems = ref({});
    const expandedRemovedSchemas = ref({});
    const expandedRemovedEndpoints = ref({});
    const copying = ref(false);
    const toast = useToast();

    const diffContainer = ref(null);
    const search = ref("");
    let debounceTimer = null;

    const sectionKeys = [
      "summary",
      "infoAdded",
      "infoModified",
      "infoRemoved",
      "schemaAdded",
      "schemaModified",
      "schemaRemoved",
      "added",
      "modified",
      "removed",
    ];

    const expandedSections = ref({});
    const initExpanded = () => {
      sectionKeys.forEach((k) => {
        if (k === "summary") expandedSections.value[k] = true;
        else expandedSections.value[k] = !!props.diff[k]?.length;
      });
    };
    initExpanded();

    watch(
      () => props.diff,
      () => {
        initExpanded();
      },
      { deep: true }
    );

    const toggleSection = (key) => {
      expandedSections.value[key] = !expandedSections.value[key];
    };

    const copyAsMarkdown = async () => {
      copying.value = true;
      try {
        const markdown = generateMarkdownReport(props.diff);

        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(markdown);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = markdown;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand("copy");
            textArea.remove();
          } catch (err) {
            textArea.remove();
            throw new Error("Copy command failed");
          }
        }

        toast.add({
          severity: "success",
          summary: "Copied!",
          detail: "Changes copied as markdown to clipboard",
          life: 3000,
        });
      } catch (error) {
        console.error("Copy failed:", error);
        toast.add({
          severity: "error",
          summary: "Copy Failed",
          detail: error.message || "Failed to copy to clipboard",
          life: 3000,
        });
      } finally {
        copying.value = false;
      }
    };

    const toggleExpand = (index) => {
      expandedItems.value[index] = !expandedItems.value[index];
    };

    const toggleRemovedSchema = (index) => {
      expandedRemovedSchemas.value[index] =
        !expandedRemovedSchemas.value[index];
    };

    const toggleRemovedEndpoint = (index) => {
      expandedRemovedEndpoints.value[index] =
        !expandedRemovedEndpoints.value[index];
    };

    const formatFieldName = (field) => {
      return field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    };

    const hasChanges = computed(() => {
      return (
        props.diff.infoAdded?.length > 0 ||
        props.diff.infoModified?.length > 0 ||
        props.diff.infoRemoved?.length > 0 ||
        props.diff.added?.length > 0 ||
        props.diff.modified?.length > 0 ||
        props.diff.removed?.length > 0 ||
        props.diff.schemaAdded?.length > 0 ||
        props.diff.schemaModified?.length > 0 ||
        props.diff.schemaRemoved?.length > 0
      );
    });

    const summary = computed(() => {
      return {
        added:
          (props.diff.infoAdded?.length || 0) +
          (props.diff.added?.length || 0) +
          (props.diff.schemaAdded?.length || 0),
        modified:
          (props.diff.infoModified?.length || 0) +
          (props.diff.modified?.length || 0) +
          (props.diff.schemaModified?.length || 0),
        removed:
          (props.diff.infoRemoved?.length || 0) +
          (props.diff.removed?.length || 0) +
          (props.diff.schemaRemoved?.length || 0),
      };
    });

    const getMethodSeverity = (method) => {
      const severities = {
        GET: "info",
        POST: "success",
        PUT: "warn",
        PATCH: "warn",
        DELETE: "danger",
      };
      return severities[method?.toUpperCase()] || "secondary";
    };

    const filterList = (list, q) => {
      if (!list || !list.length) return [];
      const term = q.toLowerCase();
      return list.filter((item) => {
        try {
          return JSON.stringify(item).toLowerCase().includes(term);
        } catch (e) {
          return false;
        }
      });
    };

    const filteredDiff = computed(() => {
      const q = (search.value || "").trim().toLowerCase();
      if (!q) return props.diff;
      return {
        infoAdded: filterList(props.diff.infoAdded, q),
        infoModified: filterList(props.diff.infoModified, q),
        infoRemoved: filterList(props.diff.infoRemoved, q),
        schemaAdded: filterList(props.diff.schemaAdded, q),
        schemaModified: filterList(props.diff.schemaModified, q),
        schemaRemoved: filterList(props.diff.schemaRemoved, q),
        added: filterList(props.diff.added, q),
        modified: filterList(props.diff.modified, q),
        removed: filterList(props.diff.removed, q),
      };
    });

    watch(search, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
      }, 250);
    });

    const scrollToSection = (section) => {
      const id = `${section}-section`;
      const el = document.getElementById(id);
      if (!el) return;
      if (props.inline && diffContainer.value) {
        const container = diffContainer.value;
        const headerEl = container.querySelector(".diff-header-sticky");
        const headerOffset = headerEl ? headerEl.offsetHeight : 0;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scrollTop =
          container.scrollTop +
          (elRect.top - containerRect.top) -
          headerOffset -
          8;
        container.scrollTo({ top: scrollTop, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    onMounted(() => {});

    return {
      expandedItems,
      expandedRemovedSchemas,
      expandedRemovedEndpoints,
      copying,
      copyAsMarkdown,
      toggleExpand,
      toggleRemovedSchema,
      toggleRemovedEndpoint,
      formatFieldName,
      hasChanges,
      summary,
      getMethodSeverity,
      diffContainer,
      search,
      filteredDiff,
      expandedSections,
      toggleSection,
      scrollToSection,
    };
  },
};
</script>

<style scoped>
/* Modernized DiffDrawer styles */
.diff-panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.04);
  overflow: hidden;
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.6),
    rgba(255, 255, 255, 0)
  );
}
.diff-container {
  padding: 1rem;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    Roboto, "Helvetica Neue", Arial;
  color: #0f1724;
  background: transparent;
}
.toc-and-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.toc-badges {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.toc-pill {
  background: #fff7ed;
  color: #b45309;
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px rgba(2, 6, 23, 0.04);
}
input.p-inputtext {
  border-radius: 8px;
  padding: 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: none;
}
.no-changes {
  text-align: center;
  padding: 2rem 1rem;
  color: #475569;
}
.no-changes i {
  color: #10b981;
  font-size: 3rem;
}
.changes-content {
  padding-top: 0.5rem;
}
.change-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.change-item {
  padding: 0.75rem;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.03);
  box-shadow: 0 2px 6px rgba(2, 6, 23, 0.03);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
  padding: 0.75rem;
  background: linear-gradient(180deg, #fff, #fffbf7);
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.12);
}
.summary-item .count {
  color: #f59e0b;
  font-weight: 800;
  font-size: 1.1rem;
}
.schema-preview,
.json-preview {
  background: #0f1724;
  color: #d1fae5;
  padding: 0.75rem;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.82rem;
  overflow: auto;
}
/* small screens */
@media (max-width: 900px) {
  .diff-container {
    padding: 0.5rem;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
