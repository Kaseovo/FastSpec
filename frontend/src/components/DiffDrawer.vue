<template>
  <div>
    <!-- Inline mode panel -->
    <div v-if="inline" class="diff-panel">
      <div class="drawer-header">
        <h3>Changes Overview</h3>
        <div class="header-actions">
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
      </div>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <div class="summary-sticky">
            <div class="summary-grid">
              <button
                class="summary-pill added"
                :class="{ active: filter === 'added' }"
                @click="filter = 'added'"
              >
                <Tag severity="success">Added</Tag>
                <div class="pill-count">{{ summary.added }}</div>
                <div class="pill-sub">
                  {{ diff.added?.length || 0 }} endpoints
                </div>
              </button>

              <button
                class="summary-pill modified"
                :class="{ active: filter === 'modified' }"
                @click="filter = 'modified'"
              >
                <Tag severity="warn">Modified</Tag>
                <div class="pill-count">{{ summary.modified }}</div>
                <div class="pill-sub">
                  {{ diff.modified?.length || 0 }} endpoints
                </div>
              </button>

              <button
                class="summary-pill removed"
                :class="{ active: filter === 'removed' }"
                @click="filter = 'removed'"
              >
                <Tag severity="danger">Removed</Tag>
                <div class="pill-count">{{ summary.removed }}</div>
                <div class="pill-sub">
                  {{ diff.removed?.length || 0 }} endpoints
                </div>
              </button>

              <div class="search-wrap">
                <input
                  v-model="search"
                  type="text"
                  placeholder="Filter changes..."
                  class="p-inputtext p-component"
                />
              </div>
            </div>
          </div>

          <div v-if="!hasChanges" class="no-changes">
            <i class="pi pi-check-circle"></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="cards-area">
            <div v-if="groupedList.length === 0" class="no-results">
              No items match the filter.
            </div>

            <div class="cards-grid">
              <div
                v-for="(item, idx) in groupedList"
                :key="cardKey(item, idx)"
                class="endpoint-card"
              >
                <!-- Left column varies by item kind -->
                <div class="card-left">
                  <template v-if="item.__kind === 'endpoint'">
                    <Tag
                      :severity="getMethodSeverity(item.method)"
                      class="method-tag"
                      >{{ item.method }}</Tag
                    >
                    <div class="path">{{ item.path }}</div>
                    <div v-if="item.summary" class="short">
                      {{ item.summary }}
                    </div>
                  </template>

                  <template v-else-if="item.__kind === 'schema'">
                    <div class="schema-header">
                      <i class="pi pi-sitemap" aria-hidden="true"></i>
                      <code class="schema-name">{{ item.name }}</code>
                    </div>
                    <div class="short">Schema</div>
                  </template>

                  <template v-else>
                    <Tag severity="info">{{ item.key }}</Tag>
                    <div class="short">{{ item.value }}</div>
                  </template>
                </div>

                <!-- Inline details: expanded for added/removed; preview for modified -->
                <div class="card-details">
                  <template v-if="item.__kind === 'schema'">
                    <div class="mini-section">
                      <div class="mini-label">Schema preview</div>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON(item.schema || item.schemaPreview || item.type) }}</code></pre>
                    </div>
                  </template>

                  <template v-else-if="item.__kind === 'info'">
                    <div class="mini-section">
                      <div class="mini-label">Info</div>
                      <div class="mini-desc">{{ item.value }}</div>
                    </div>
                  </template>

                  <template v-else>
                    <template
                      v-if="
                        item.changeType === 'added' ||
                        item.changeType === 'removed'
                      "
                    >
                      <div v-if="item.schema" class="mini-section">
                        <div class="mini-label">Schema preview</div>
                        <pre
                          class="mini-json"
                        ><code>{{ prettyJSON(item.schema) }}</code></pre>
                      </div>
                      <div v-else-if="item.description" class="mini-section">
                        <div class="mini-label">Description</div>
                        <div class="mini-desc">{{ item.description }}</div>
                      </div>
                      <div v-else-if="item.example" class="mini-section">
                        <div class="mini-label">Example</div>
                        <pre
                          class="mini-json"
                        ><code>{{ prettyJSON(item.example) }}</code></pre>
                      </div>
                    </template>

                    <template v-else>
                      <div
                        v-if="item.diffDetails?.fields?.length"
                        class="mini-section"
                      >
                        <div class="mini-label">Top field changes</div>
                        <div
                          class="modified-inline"
                          v-for="(f, i) in item.diffDetails.fields.slice(0, 3)"
                          :key="i"
                        >
                          <span class="mf">{{ formatFieldName(f.field) }}</span>
                          <span class="mv old">{{
                            truncate(String(f.old ?? "—"), 36)
                          }}</span>
                          <span class="marr">→</span>
                          <span class="mv new">{{
                            truncate(String(f.new ?? "—"), 36)
                          }}</span>
                        </div>
                      </div>
                      <div v-else class="mini-label">
                        No field-level summary available
                      </div>
                    </template>
                  </template>
                </div>

                <div class="card-right">
                  <div class="change-hints">
                    <span v-if="item.changeCount" class="hint"
                      >{{ item.changeCount }} changes</span
                    >
                    <span v-if="item.deprecated" class="hint deprecated"
                      >Deprecated</span
                    >
                  </div>
                  <div class="card-actions">
                    <Button
                      icon="pi pi-eye"
                      class="p-button-text"
                      @click="openDetails(item)"
                      aria-label="Open details"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollPanel>
    </div>

    <!-- Drawer mode -->
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
          <div class="header-actions">
            <Button
              v-if="hasChanges"
              icon="pi pi-copy"
              label="Copy as Markdown"
              size="small"
              severity="secondary"
              @click="copyAsMarkdown"
              :loading="copying"
            />
          </div>
        </div>
      </template>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <div class="summary-sticky">
            <div class="summary-grid">
              <button
                class="summary-pill added"
                :class="{ active: filter === 'added' }"
                @click="filter = 'added'"
              >
                <Tag severity="success">Added</Tag>
                <div class="pill-count">{{ summary.added }}</div>
                <div class="pill-sub">
                  {{ diff.added?.length || 0 }} endpoints
                </div>
              </button>

              <button
                class="summary-pill modified"
                :class="{ active: filter === 'modified' }"
                @click="filter = 'modified'"
              >
                <Tag severity="warn">Modified</Tag>
                <div class="pill-count">{{ summary.modified }}</div>
                <div class="pill-sub">
                  {{ diff.modified?.length || 0 }} endpoints
                </div>
              </button>

              <button
                class="summary-pill removed"
                :class="{ active: filter === 'removed' }"
                @click="filter = 'removed'"
              >
                <Tag severity="danger">Removed</Tag>
                <div class="pill-count">{{ summary.removed }}</div>
                <div class="pill-sub">
                  {{ diff.removed?.length || 0 }} endpoints
                </div>
              </button>

              <div class="search-wrap">
                <input
                  v-model="search"
                  type="text"
                  placeholder="Filter changes..."
                  class="p-inputtext p-component"
                />
              </div>
            </div>
          </div>

          <div v-if="!hasChanges" class="no-changes">
            <i class="pi pi-check-circle"></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="cards-area">
            <div v-if="groupedList.length === 0" class="no-results">
              No items match the filter.
            </div>

            <div class="cards-grid">
              <div
                v-for="(item, idx) in groupedList"
                :key="cardKey(item, idx)"
                class="endpoint-card"
              >
                <!-- Left column varies by item kind -->
                <div class="card-left">
                  <template v-if="item.__kind === 'endpoint'">
                    <Tag
                      :severity="getMethodSeverity(item.method)"
                      class="method-tag"
                      >{{ item.method }}</Tag
                    >
                    <div class="path">{{ item.path }}</div>
                    <div v-if="item.summary" class="short">
                      {{ item.summary }}
                    </div>
                  </template>

                  <template v-else-if="item.__kind === 'schema'">
                    <div class="schema-header">
                      <i class="pi pi-sitemap" aria-hidden="true"></i>
                      <code class="schema-name">{{ item.name }}</code>
                    </div>
                    <div class="short">Schema</div>
                  </template>

                  <template v-else>
                    <Tag severity="info">{{ item.key }}</Tag>
                    <div class="short">{{ item.value }}</div>
                  </template>
                </div>

                <!-- Inline details: expanded for added/removed; preview for modified -->
                <div class="card-details">
                  <template v-if="item.__kind === 'schema'">
                    <div class="mini-section">
                      <div class="mini-label">Schema preview</div>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON(item.schema || item.schemaPreview || item.type) }}</code></pre>
                    </div>
                  </template>

                  <template v-else-if="item.__kind === 'info'">
                    <div class="mini-section">
                      <div class="mini-label">Info</div>
                      <div class="mini-desc">{{ item.value }}</div>
                    </div>
                  </template>

                  <template v-else>
                    <template
                      v-if="
                        item.changeType === 'added' ||
                        item.changeType === 'removed'
                      "
                    >
                      <div v-if="item.schema" class="mini-section">
                        <div class="mini-label">Schema preview</div>
                        <pre
                          class="mini-json"
                        ><code>{{ prettyJSON(item.schema) }}</code></pre>
                      </div>
                      <div v-else-if="item.description" class="mini-section">
                        <div class="mini-label">Description</div>
                        <div class="mini-desc">{{ item.description }}</div>
                      </div>
                      <div v-else-if="item.example" class="mini-section">
                        <div class="mini-label">Example</div>
                        <pre
                          class="mini-json"
                        ><code>{{ prettyJSON(item.example) }}</code></pre>
                      </div>
                    </template>

                    <template v-else>
                      <div
                        v-if="item.diffDetails?.fields?.length"
                        class="mini-section"
                      >
                        <div class="mini-label">Top field changes</div>
                        <div
                          class="modified-inline"
                          v-for="(f, i) in item.diffDetails.fields.slice(0, 3)"
                          :key="i"
                        >
                          <span class="mf">{{ formatFieldName(f.field) }}</span>
                          <span class="mv old">{{
                            truncate(String(f.old ?? "—"), 36)
                          }}</span>
                          <span class="marr">→</span>
                          <span class="mv new">{{
                            truncate(String(f.new ?? "—"), 36)
                          }}</span>
                        </div>
                      </div>
                      <div v-else class="mini-label">
                        No field-level summary available
                      </div>
                    </template>
                  </template>
                </div>

                <div class="card-right">
                  <div class="change-hints">
                    <span v-if="item.changeCount" class="hint"
                      >{{ item.changeCount }} changes</span
                    >
                    <span v-if="item.deprecated" class="hint deprecated"
                      >Deprecated</span
                    >
                  </div>
                  <div class="card-actions">
                    <Button
                      icon="pi pi-eye"
                      class="p-button-text"
                      @click="openDetails(item)"
                      aria-label="Open details"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollPanel>
    </Drawer>

    <!-- Details dialog -->
    <Dialog
      :visible="detailOpen"
      @update:visible="setDetailOpen"
      header="Change Details"
      :modal="true"
      :closable="true"
      :style="{ width: '70vw' }"
    >
      <div v-if="selectedItem">
        <div class="detail-header">
          <div class="detail-left">
            <Tag :severity="getMethodSeverity(selectedItem.method)">{{
              selectedItem.method
            }}</Tag>
            <code class="detail-path">{{ selectedItem.path }}</code>
            <div v-if="selectedItem.summary" class="detail-summary">
              {{ selectedItem.summary }}
            </div>
          </div>
          <div class="detail-actions">
            <Button
              icon="pi pi-copy"
              label="Copy Markdown"
              class="p-button-text"
              @click="copyItemMarkdown"
            />
            <Button
              icon="pi pi-download"
              label="Export JSON"
              class="p-button-text"
              @click="exportItemJSON"
            />
          </div>
        </div>

        <div class="detail-body">
          <section v-if="selectedItem.diffDetails">
            <h5>Field-level changes</h5>
            <div class="fields-grid">
              <div
                v-for="(f, i) in selectedItem.diffDetails.fields || []"
                :key="i"
                class="field-row"
              >
                <div class="field-name">{{ formatFieldName(f.field) }}</div>
                <div class="field-old">
                  <code>{{ f.old ?? "—" }}</code>
                </div>
                <div class="field-arrow">➡</div>
                <div class="field-new">
                  <code>{{ f.new ?? "—" }}</code>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h5>JSON Preview</h5>
            <pre
              class="json-preview"
            ><code>{{ prettyJSON(selectedItem.raw || selectedItem) }}</code></pre>
          </section>
        </div>
      </div>
      <template #footer>
        <Button label="Close" icon="pi pi-times" @click="detailOpen = false" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import Drawer from "primevue/drawer";
import Tag from "primevue/tag";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ScrollPanel from "primevue/scrollpanel";
import { useToast } from "primevue/usetoast";
import { generateMarkdownReport } from "../utils/markdownGenerator";

export default {
  name: "DiffDrawer",
  components: { Drawer, Tag, Button, Dialog, ScrollPanel },
  props: {
    visible: { type: Boolean, default: false },
    diff: { type: Object, required: true },
    inline: { type: Boolean, default: false },
  },
  emits: ["update:visible"],
  setup(props) {
    const toast = useToast();
    const diffContainer = ref(null);
    const search = ref("");
    const copying = ref(false);
    const filter = ref("modified");

    const detailOpen = ref(false);
    const selectedItem = ref(null);

    const hasChanges = computed(() => {
      return (
        props.diff &&
        (props.diff.infoAdded?.length ||
          props.diff.infoModified?.length ||
          props.diff.infoRemoved?.length ||
          props.diff.added?.length ||
          props.diff.modified?.length ||
          props.diff.removed?.length ||
          props.diff.schemaAdded?.length ||
          props.diff.schemaModified?.length ||
          props.diff.schemaRemoved?.length)
      );
    });

    const summary = computed(() => ({
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
    }));

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

    const formatFieldName = (field) => {
      if (!field) return "";
      return field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
    };

    const prettyJSON = (obj) => {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    };

    const truncate = (s, n) => {
      if (s == null) return s;
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    };

    const filterList = (list, q) => {
      if (!list || !list.length) return [];
      if (!q) return list;
      const term = q.toLowerCase();
      return list.filter((item) => {
        try {
          return JSON.stringify(item).toLowerCase().includes(term);
        } catch (e) {
          return false;
        }
      });
    };

    const mapEndpoints = (list, type) =>
      (list || []).map((it) => ({
        ...it,
        __kind: "endpoint",
        changeType: type,
        changeCount: estimateChangeCount(it),
        diffDetails: computeDetails(it),
      }));
    const mapSchemas = (list, type) =>
      (list || []).map((it) => ({
        ...it,
        __kind: "schema",
        changeType: type,
        changeCount: it.schema ? 1 : 0,
        schema: it.schema,
        name: it.name || it.title,
      }));
    const mapInfos = (list, type) =>
      (list || []).map((it) => ({
        ...it,
        __kind: "info",
        changeType: type,
        changeCount: 1,
        key: it.key,
        value: it.value,
      }));

    // helper to compute compact details per item
    const computeDetails = (item) => {
      if (!item) return null;
      const details = { fields: [] };
      if (item.fieldDiffs && Array.isArray(item.fieldDiffs)) {
        details.fields = item.fieldDiffs.map((f) => ({
          field: f.field,
          old: f.old,
          new: f.new,
        }));
      } else if (item.changes && Array.isArray(item.changes)) {
        details.fields = item.changes.map((c) => ({
          field: c.key || c.field || "unknown",
          old: c.old,
          new: c.new,
        }));
      }
      return details;
    };

    const estimateChangeCount = (item) => {
      let c = 0;
      if (item.deprecated) c += 1;
      if (item.fieldDiffs) c += item.fieldDiffs.length;
      if (item.changes)
        c += Array.isArray(item.changes) ? item.changes.length : 0;
      return c;
    };

    // Produce a flat list including endpoints, schemas and info depending on filter
    const groupedList = computed(() => {
      const q = (search.value || "").trim().toLowerCase();
      if (filter.value === "added") {
        const endpoints = q
          ? filterList(props.diff.added, q)
          : props.diff.added || [];
        const schemas = q
          ? filterList(props.diff.schemaAdded, q)
          : props.diff.schemaAdded || [];
        const infos = q
          ? filterList(props.diff.infoAdded, q)
          : props.diff.infoAdded || [];
        return [
          ...mapEndpoints(endpoints, "added"),
          ...mapSchemas(schemas, "added"),
          ...mapInfos(infos, "added"),
        ];
      }
      if (filter.value === "removed") {
        const endpoints = q
          ? filterList(props.diff.removed, q)
          : props.diff.removed || [];
        const schemas = q
          ? filterList(props.diff.schemaRemoved, q)
          : props.diff.schemaRemoved || [];
        const infos = q
          ? filterList(props.diff.infoRemoved, q)
          : props.diff.infoRemoved || [];
        return [
          ...mapEndpoints(endpoints, "removed"),
          ...mapSchemas(schemas, "removed"),
          ...mapInfos(infos, "removed"),
        ];
      }
      // modified
      const endpoints = q
        ? filterList(props.diff.modified, q)
        : props.diff.modified || [];
      const schemas = q
        ? filterList(props.diff.schemaModified, q)
        : props.diff.schemaModified || [];
      const infos = q
        ? filterList(props.diff.infoModified, q)
        : props.diff.infoModified || [];
      return [
        ...mapEndpoints(endpoints, "modified"),
        ...mapSchemas(schemas, "modified"),
        ...mapInfos(infos, "modified"),
      ];
    });

    const openDetails = (item) => {
      selectedItem.value = {
        ...item,
        diffDetails: item.diffDetails || computeDetails(item),
        raw: item,
      };
      detailOpen.value = true;
    };

    const setDetailOpen = (v) => {
      detailOpen.value = v;
    };

    const copyAsMarkdown = async () => {
      copying.value = true;
      try {
        const markdown = generateMarkdownReport(props.diff);
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(markdown);
        } else {
          const ta = document.createElement("textarea");
          ta.value = markdown;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        toast.add({
          severity: "success",
          summary: "Copied",
          detail: "Changes copied as markdown",
          life: 2500,
        });
      } catch (err) {
        toast.add({
          severity: "error",
          summary: "Copy failed",
          detail: err.message || String(err),
          life: 3000,
        });
      } finally {
        copying.value = false;
      }
    };

    const copyItemMarkdown = async () => {
      if (!selectedItem.value) return;
      try {
        const md =
          `### ${
            selectedItem.value.method ||
            selectedItem.value.name ||
            selectedItem.value.key ||
            ""
          } ${selectedItem.value.path || ""}\n\n` +
          (selectedItem.value.short || selectedItem.value.summary || "") +
          "\n\n" +
          (selectedItem.value.diffDetails?.fields
            ?.map((f) => `- **${f.field}**: ${f.old ?? "—"} → ${f.new ?? "—"}`)
            .join("\n") || "No field-level details");
        await navigator.clipboard.writeText(md);
        toast.add({
          severity: "success",
          summary: "Copied",
          detail: "Item markdown copied",
          life: 2000,
        });
      } catch (e) {
        toast.add({
          severity: "error",
          summary: "Copy failed",
          detail: String(e),
          life: 3000,
        });
      }
    };

    const exportItemJSON = async () => {
      if (!selectedItem.value) return;
      try {
        const compact = {
          path: selectedItem.value.path,
          method: selectedItem.value.method,
          kind: selectedItem.value.__kind,
          changeType: selectedItem.value.changeType || "modified",
          fieldsChanged: selectedItem.value.diffDetails?.fields || [],
        };
        const json = JSON.stringify(compact, null, 2);
        await navigator.clipboard.writeText(json);
        toast.add({
          severity: "success",
          summary: "Exported",
          detail: "Compact JSON copied to clipboard",
          life: 2500,
        });
      } catch (e) {
        toast.add({
          severity: "error",
          summary: "Export failed",
          detail: String(e),
          life: 3000,
        });
      }
    };

    const cardKey = (item, idx) =>
      `${item.__kind || "item"}::${
        item.path || item.name || item.key || idx
      }::${item.method || ""}::${idx}`;

    watch(
      () => props.diff,
      () => {},
      { deep: true }
    );

    return {
      diffContainer,
      search,
      copyAsMarkdown,
      copying,
      hasChanges,
      summary,
      filter,
      groupedList,
      getMethodSeverity,
      openDetails,
      detailOpen,
      selectedItem,
      formatFieldName,
      prettyJSON,
      copyItemMarkdown,
      exportItemJSON,
      cardKey,
      setDetailOpen,
      truncate,
    };
  },
};
</script>

<style scoped>
.diff-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.04);
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
}
.drawer-header h3 {
  margin: 0;
  font-size: 1rem;
}
.drawer-header .header-actions {
  display: flex;
  gap: 8px;
}
.diff-container {
  padding: 12px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    Roboto, "Helvetica Neue", Arial;
  color: #0f1724;
}
.summary-sticky {
  position: sticky;
  top: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.9),
    rgba(255, 255, 255, 0.6)
  );
  padding-bottom: 8px;
  z-index: 4;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px 0;
}
.summary-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.04);
  background: #fff;
  cursor: pointer;
}
.summary-pill.added {
  border-color: rgba(16, 185, 129, 0.06);
}
.summary-pill.modified {
  border-color: rgba(245, 158, 11, 0.06);
}
.summary-pill.removed {
  border-color: rgba(244, 63, 94, 0.06);
}
.summary-pill .pill-count {
  font-weight: 700;
  color: #0f1724;
}
.summary-pill.active {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}
.search-wrap {
  display: flex;
  align-items: center;
}
input.p-inputtext {
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}
.no-changes {
  text-align: center;
  padding: 2rem 1rem;
  color: #475569;
}
.no-changes i {
  font-size: 3rem;
  color: #10b981;
}
.cards-area {
  margin-top: 12px;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.endpoint-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  box-shadow: 0 2px 8px rgba(2, 6, 23, 0.03);
  gap: 12px;
}
.card-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}
.method-tag {
  font-weight: 700;
}
.path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
}
.short {
  color: #6b7280;
  font-size: 0.9rem;
}
.card-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mini-section {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
.mini-label {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 6px;
}
.mini-json {
  background: #0b1220;
  color: #d1fae5;
  padding: 8px;
  border-radius: 6px;
  max-height: 96px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.78rem;
}
.mini-desc {
  color: #374151;
  font-size: 0.9rem;
}
.modified-inline {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
.mf {
  font-weight: 600;
  width: 120px;
}
.mv {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  padding: 4px 6px;
  border-radius: 4px;
}
.mv.old {
  background: #fff7ed;
  color: #92400e;
}
.mv.new {
  background: #ecfdf5;
  color: #064e3b;
}
.marr {
  color: #6b7280;
}
.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 120px;
}
.change-hints .hint {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  margin-left: 6px;
}
.change-hints .deprecated {
  background: #fff1f2;
  color: #b91c1c;
}
.card-actions button {
  margin-left: 6px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.detail-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
}
.detail-summary {
  color: #6b7280;
}
.detail-body {
  margin-top: 12px;
}
.fields-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr 40px 1fr;
  gap: 8px;
  align-items: center;
  padding: 6px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
.field-name {
  font-weight: 600;
}
.field-old code,
.field-new code {
  background: #0f1724;
  color: #d1fae5;
  padding: 6px;
  border-radius: 6px;
  display: block;
}
.json-preview {
  background: #0b1220;
  color: #d1fae5;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  max-height: 320px;
}
@media (max-width: 900px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .endpoint-card {
    flex-direction: column;
    align-items: stretch;
  }
  .card-right {
    align-items: flex-start;
  }
}
</style>
