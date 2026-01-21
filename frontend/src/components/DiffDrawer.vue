<template>
  <div>
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
                @click="setFilter('added')"
              >
                <Tag severity="success">Added</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.added.endpoints +
                    typeCounts.added.components +
                    typeCounts.added.info
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.added.endpoints }} endpoints</span>
                  <span v-if="typeCounts.added.components"
                    >, {{ typeCounts.added.components }} components</span
                  >
                  <span v-if="typeCounts.added.info"
                    >, {{ typeCounts.added.info }} info</span
                  >
                </div>
              </button>

              <button
                class="summary-pill modified"
                :class="{ active: filter === 'modified' }"
                @click="setFilter('modified')"
              >
                <Tag severity="warn">Modified</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.modified.endpoints +
                    typeCounts.modified.components +
                    typeCounts.modified.info
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.modified.endpoints }} endpoints</span>
                  <span v-if="typeCounts.modified.components"
                    >, {{ typeCounts.modified.components }} components</span
                  >
                  <span v-if="typeCounts.modified.info"
                    >, {{ typeCounts.modified.info }} info</span
                  >
                </div>
              </button>

              <button
                class="summary-pill removed"
                :class="{ active: filter === 'removed' }"
                @click="setFilter('removed')"
              >
                <Tag severity="danger">Removed</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.removed.endpoints +
                    typeCounts.removed.components +
                    typeCounts.removed.info
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.removed.endpoints }} endpoints</span>
                  <span v-if="typeCounts.removed.components"
                    >, {{ typeCounts.removed.components }} components</span
                  >
                  <span v-if="typeCounts.removed.info"
                    >, {{ typeCounts.removed.info }} info</span
                  >
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
            <!-- Endpoints -->
            <div
              class="section-group endpoints-section"
              v-if="endpoints.length"
            >
              <div class="section-header">
                <h4>Endpoints ({{ endpoints.length }})</h4>
              </div>
              <div class="endpoints-list">
                <div
                  v-for="(item, idx) in endpoints"
                  :key="cardKey(item, idx)"
                  class="endpoint-line"
                >
                  <span class="endpoint-text"
                    ><span class="endpoint-left"
                      ><Tag
                        :style="{
                          backgroundColor: getMethodColor(item.method),
                          color: 'white',
                        }"
                        >{{ item.method }}</Tag
                      >
                      {{ item.path }}</span
                    ></span
                  >
                  <span class="endpoint-summary">{{ item.summary }}</span>
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

            <!-- Schemas / Components -->
            <div v-if="schemas.length" class="section-group">
              <div class="section-header">
                <h4>Components / Schemas ({{ schemas.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('schemas')"
                />
              </div>
              <div v-show="expandedSections.schemas" class="cards-grid">
                <div v-if="schemas.length === 0" class="no-items">
                  No components/schemas
                </div>
                <div
                  v-for="(item, idx) in schemas"
                  :key="cardKey(item, idx)"
                  class="endpoint-card"
                >
                  <div class="card-left">
                    <div class="schema-header">
                      <i class="pi pi-sitemap"></i>
                      <code class="schema-name">{{ item.name }}</code>
                    </div>
                    <div class="short">Component/schema</div>
                  </div>
                  <div class="card-details">
                    <div class="mini-section">
                      <div class="mini-label">Schema reference</div>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON({ "$ref": "#/components/schemas/" + item.name }) }}</code></pre>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="change-hints">
                      <span class="hint">{{ item.changeCount }} changes</span>
                    </div>
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div v-if="infos.length" class="section-group">
              <div class="section-header">
                <h4>Info ({{ infos.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('info')"
                />
              </div>
              <div v-show="expandedSections.info" class="cards-grid">
                <div v-if="infos.length === 0" class="no-items">
                  No info items
                </div>
                <div
                  v-for="(item, idx) in infos"
                  :key="cardKey(item, idx)"
                  class="endpoint-card"
                >
                  <div class="card-left">
                    <Tag severity="info">{{ item.key }}</Tag>
                    <div class="short">{{ item.value }}</div>
                  </div>
                  <div class="card-details">
                    <div class="mini-section">
                      <div class="mini-label">Value</div>
                      <div class="mini-desc">{{ item.value }}</div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="change-hints">
                      <span class="hint">1 change</span>
                    </div>
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
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
                @click="setFilter('added')"
              >
                <Tag severity="success">Added</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.added.endpoints +
                    typeCounts.added.components +
                    typeCounts.added.info
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.added.endpoints }} endpoints</span>
                  <span v-if="typeCounts.added.components"
                    >, {{ typeCounts.added.components }} components</span
                  >
                  <span v-if="typeCounts.added.info"
                    >, {{ typeCounts.added.info }} info</span
                  >
                </div>
              </button>

              <button
                class="summary-pill modified"
                :class="{ active: filter === 'modified' }"
                @click="setFilter('modified')"
              >
                <Tag severity="warn">Modified</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.modified.endpoints +
                    typeCounts.modified.components +
                    typeCounts.modified.info
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.modified.endpoints }} endpoints</span>
                  <span v-if="typeCounts.modified.components"
                    >, {{ typeCounts.modified.components }} components</span
                  >
                  <span v-if="typeCounts.modified.info"
                    >, {{ typeCounts.modified.info }} info</span
                  >
                </div>
              </button>

              <button
                class="summary-pill removed"
                :class="{ active: filter === 'removed' }"
                @click="setFilter('removed')"
              >
                <Tag severity="danger">Removed</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.removed.endpoints +
                    typeCounts.removed.components +
                    typeCounts.removed.info
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.removed.endpoints }} endpoints</span>
                  <span v-if="typeCounts.removed.components"
                    >, {{ typeCounts.removed.components }} components</span
                  >
                  <span v-if="typeCounts.removed.info"
                    >, {{ typeCounts.removed.info }} info</span
                  >
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
            <!-- Endpoints -->
            <div
              class="section-group endpoints-section"
              v-if="endpoints.length"
            >
              <div class="section-header">
                <h4>Endpoints ({{ endpoints.length }})</h4>
              </div>
              <div class="endpoints-list">
                <div
                  v-for="(item, idx) in endpoints"
                  :key="cardKey(item, idx)"
                  class="endpoint-line"
                >
                  <span class="endpoint-text"
                    ><span class="endpoint-left"
                      ><Tag
                        :style="{
                          backgroundColor: getMethodColor(item.method),
                          color: 'white',
                        }"
                        >{{ item.method }}</Tag
                      >
                      {{ item.path }}</span
                    ></span
                  >
                  <span class="endpoint-summary">{{ item.summary }}</span>
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

            <!-- Schemas / Components -->
            <div v-if="schemas.length" class="section-group">
              <div class="section-header">
                <h4>Components / Schemas ({{ schemas.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('schemas')"
                />
              </div>
              <div v-show="expandedSections.schemas" class="cards-grid">
                <div v-if="schemas.length === 0" class="no-items">
                  No components/schemas
                </div>
                <div
                  v-for="(item, idx) in schemas"
                  :key="cardKey(item, idx)"
                  class="endpoint-card"
                >
                  <div class="card-left">
                    <div class="schema-header">
                      <i class="pi pi-sitemap"></i>
                      <code class="schema-name">{{ item.name }}</code>
                    </div>
                    <div class="short">Component/schema</div>
                  </div>
                  <div class="card-details">
                    <div class="mini-section">
                      <div class="mini-label">Schema reference</div>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON({ "$ref": "#/components/schemas/" + item.name }) }}</code></pre>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="change-hints">
                      <span class="hint">{{ item.changeCount }} changes</span>
                    </div>
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div v-if="infos.length" class="section-group">
              <div class="section-header">
                <h4>Info ({{ infos.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('info')"
                />
              </div>
              <div v-show="expandedSections.info" class="cards-grid">
                <div v-if="infos.length === 0" class="no-items">
                  No info items
                </div>
                <div
                  v-for="(item, idx) in infos"
                  :key="cardKey(item, idx)"
                  class="endpoint-card"
                >
                  <div class="card-left">
                    <Tag severity="info">{{ item.key }}</Tag>
                    <div class="short">{{ item.value }}</div>
                  </div>
                  <div class="card-details">
                    <div class="mini-section">
                      <div class="mini-label">Value</div>
                      <div class="mini-desc">{{ item.value }}</div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="change-hints">
                      <span class="hint">1 change</span>
                    </div>
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
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

          <section v-if="selectedItem.method">
            <h5>Endpoint Details</h5>
            <div class="endpoint-details">
              <div v-if="selectedItem.description" class="detail-section">
                <h6>📝 Description</h6>
                <p>{{ selectedItem.description }}</p>
              </div>

              <div
                v-if="selectedItem.parameters && selectedItem.parameters.length"
                class="detail-section"
              >
                <h6>📋 Parameters</h6>
                <div class="parameters-table">
                  <table class="p-datatable p-datatable-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>Required</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="param in selectedItem.parameters"
                        :key="param.name"
                      >
                        <td>
                          <code>{{ param.name }}</code>
                        </td>
                        <td>{{ param.in }}</td>
                        <td>
                          <Tag v-if="param.required" severity="danger"
                            >Required</Tag
                          >
                          <Tag v-else severity="success">Optional</Tag>
                        </td>
                        <td>{{ param.schema?.type || "object" }}</td>
                        <td>{{ param.description || "-" }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="selectedItem.requestBody" class="detail-section">
                <h6>📤 Request Body</h6>
                <div
                  v-if="selectedItem.requestBody.description"
                  class="body-desc"
                >
                  {{ selectedItem.requestBody.description }}
                </div>
                <div
                  v-if="selectedItem.requestBody.content"
                  class="content-list"
                >
                  <div
                    v-for="(content, type) in selectedItem.requestBody.content"
                    :key="type"
                    class="content-item"
                  >
                    <h6>{{ type }}</h6>
                    <div v-if="content.schema" class="schema-preview">
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON(dereferenceSchema(content.schema)) }}</code></pre>
                    </div>
                    <div v-if="content.example" class="example-preview">
                      <strong>Example:</strong>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON(content.example) }}</code></pre>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="selectedItem.responses" class="detail-section">
                <h6>📥 Responses</h6>
                <div class="responses-list">
                  <div
                    v-for="(response, code) in selectedItem.responses"
                    :key="code"
                    class="response-item"
                  >
                    <div class="response-header">
                      <Tag :severity="getResponseSeverity(code)" size="small">{{
                        code
                      }}</Tag>
                      <span class="response-desc">{{
                        response.description
                      }}</span>
                    </div>
                    <div v-if="response.content" class="response-content">
                      <div
                        v-for="(content, type) in response.content"
                        :key="type"
                        class="content-item"
                      >
                        <h6>{{ type }}</h6>
                        <div v-if="content.schema" class="schema-preview">
                          <pre
                            class="mini-json"
                          ><code>{{ prettyJSON(dereferenceSchema(content.schema)) }}</code></pre>
                        </div>
                        <div v-if="content.example" class="example-preview">
                          <strong>Example:</strong>
                          <pre
                            class="mini-json"
                          ><code>{{ prettyJSON(content.example) }}</code></pre>
                        </div>
                      </div>
                    </div>
                    <div v-else>No content defined</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div class="json-toggle">
            <Button
              :icon="showJson ? 'pi pi-eye-slash' : 'pi pi-eye'"
              :label="showJson ? 'Hide JSON' : 'Show JSON'"
              class="p-button-text p-button-sm"
              @click="showJson = !showJson"
            />
          </div>

          <section v-if="showJson">
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
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ScrollPanel from "primevue/scrollpanel";
import { generateMarkdownReport } from "../utils/markdownGenerator";

export default {
  name: "DiffDrawer",
  components: {
    Drawer,
    Dialog,
    Button,
    Tag,
    ScrollPanel,
  },
  props: {
    diff: {
      type: Object,
      default: () => ({ info: null, added: [], modified: [], removed: [] }),
    },
    spec: {
      type: Object,
      default: () => ({}),
    },
    inline: {
      type: Boolean,
      default: false,
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:visible"],
  setup(props, { emit }) {
    const filter = ref("added");
    const search = ref("");
    const copying = ref(false);
    const detailOpen = ref(false);
    const selectedItem = ref(null);
    const showJson = ref(false);
    const expandedSections = ref({
      schemas: true,
      info: true,
    });

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
          (d.schemaAdded?.length || 0),
        modified:
          (d.infoModified?.length || 0) +
          (d.modified?.length || 0) +
          (d.schemaModified?.length || 0),
        removed:
          (d.infoRemoved?.length || 0) +
          (d.removed?.length || 0) +
          (d.schemaRemoved?.length || 0),
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

    // debug watcher to log counts and current filter to help reproduce
    // cases where selecting an empty category shows other items
    watch(
      [addedEndpoints, modifiedEndpoints, removedEndpoints, filter, endpoints],
      () => {
        try {
          const d = props.diff || {};
          console.debug("[DiffDrawer] counts", {
            added: addedEndpoints.value.length,
            modified: modifiedEndpoints.value.length,
            removed: removedEndpoints.value.length,
            filter: filter.value,
            endpoints: Object.keys(endpoints.value).length,
          });

          // snapshot of incoming diff for quick inspection
          console.debug("[DiffDrawer] diff-keys", Object.keys(d));
          console.debug("[DiffDrawer] diff-snapshot", {
            addedSample: (d.added || []).slice(0, 3),
            modifiedSample: (d.modified || []).slice(0, 3),
            removedSample: (d.removed || []).slice(0, 3),
            infoAdded: (d.infoAdded || []).slice(0, 3),
            infoModified: (d.infoModified || []).slice(0, 3),
            infoRemoved: (d.infoRemoved || []).slice(0, 3),
            schemaAdded: (d.schemaAdded || []).slice(0, 3),
            schemaModified: (d.schemaModified || []).slice(0, 3),
            schemaRemoved: (d.schemaRemoved || []).slice(0, 3),
          });

          // detect possible inconsistency: diff.removed present but computed removedEndpoints empty
          if (
            d.removed &&
            (Array.isArray(d.removed) ? d.removed.length : 1) > 0 &&
            removedEndpoints.value.length === 0
          ) {
            console.warn(
              "[DiffDrawer] Inconsistency: props.diff.removed exists but removedEndpoints computed is empty",
              d.removed
            );
          }
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
        },
        modified: {
          endpoints: (d.modified || []).length,
          components: (d.schemaModified || []).length,
          info: (d.infoModified || []).length,
        },
        removed: {
          endpoints: (d.removed || []).length,
          components: (d.schemaRemoved || []).length,
          info: (d.infoRemoved || []).length,
        },
      };
    });

    const addedSchemas = computed(() => {
      const d = props.diff || {};
      return (d.schemaAdded || []).map((it) => ({
        ...it,
        changeType: "added",
        name: it.name || it.key,
        dereferencedSchema: dereferenceSchema(it.schema),
      }));
    });

    const modifiedSchemas = computed(() => {
      const d = props.diff || {};
      return (d.schemaModified || []).map((it) => {
        const fullSchema = props.spec?.components?.schemas?.[it.name];
        return {
          ...it,
          changeType: "modified",
          name: it.name || it.key,
          dereferencedSchema: dereferenceSchema(fullSchema),
        };
      });
    });

    const removedSchemas = computed(() => {
      const d = props.diff || {};
      return (d.schemaRemoved || []).map((it) => ({
        ...it,
        changeType: "removed",
        name: it.name || it.key,
        dereferencedSchema: dereferenceSchema(it.schema),
      }));
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

      if (!q) return list;
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
      const list = [
        ...(d.infoAdded || []).map((i) => ({
          key: i.key,
          value: i.value,
          changeType: "added",
        })),
        ...(d.infoModified || []).map((i) => ({
          key: i.key,
          value: i.new,
          changeType: "modified",
        })),
        ...(d.infoRemoved || []).map((i) => ({
          key: i.key,
          value: i.value,
          changeType: "removed",
        })),
      ];

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
      if (!q) return filtered;
      return filtered.filter((it) => {
        return (
          (it.key || "").toLowerCase().includes(q) ||
          (String(it.value || "") || "").toLowerCase().includes(q)
        );
      });
    });

    function getMethodSeverity(method) {
      const m = (method || "").toUpperCase();
      if (m === "GET") return "success";
      if (m === "POST") return "info";
      if (m === "PUT" || m === "PATCH") return "warn";
      if (m === "DELETE") return "danger";
      return "info";
    }

    function getResponseSeverity(code) {
      const c = parseInt(code);
      if (c >= 200 && c < 300) return "success";
      if (c >= 300 && c < 400) return "warn";
      if (c >= 400 && c < 500) return "danger";
      if (c >= 500) return "danger";
      return "info";
    }

    function getMethodColor(method) {
      const m = (method || "").toUpperCase();
      if (m === "GET") return "#10b981";
      if (m === "POST") return "#3b82f6";
      if (m === "PUT") return "#f59e0b";
      if (m === "PATCH") return "#eab308";
      if (m === "DELETE") return "#ef4444";
      return "#6b7280";
    }

    function prettyJSON(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    }

    function truncate(str, n = 80) {
      if (!str) return "";
      return str.length > n ? str.slice(0, n - 1) + "…" : str;
    }

    function formatFieldName(f) {
      if (!f) return "";
      return String(f).replace(/\./g, " → ");
    }

    function getComponentName(ref) {
      if (!ref) return "";
      return ref.split("/").pop();
    }

    function dereferenceSchema(schema, visited = new Set()) {
      if (!schema || typeof schema !== "object") return schema;

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
            return { ...deref, _resolvedFrom: refPath };
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
      return result;
    }

    function cardKey(item, idx) {
      return `${item.path || ""}-${item.method || ""}-${idx}`;
    }

    function openDetails(item) {
      selectedItem.value = item;
      detailOpen.value = true;
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

    async function copyAsMarkdown() {
      copying.value = true;
      try {
        const md = generateMarkdownReport(props.diff || {});
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
      expandedSections,
      toggleSection,
      setFilter,
      getMethodSeverity,
      getMethodColor,
      getResponseSeverity,
      prettyJSON,
      truncate,
      formatFieldName,
      getComponentName,
      dereferenceSchema,
      cardKey,
      openDetails,
      detailOpen,
      selectedItem,
      setDetailOpen,
      showJson,
      copyItemMarkdown,
      copyAsMarkdown,
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
.endpoints-section {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}
.endpoints-list {
  margin-top: 12px;
}
.endpoint-line {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 20px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  margin-bottom: 12px;
  gap: 12px;
  font-size: 1rem;
}
.endpoint-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  flex: 1;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}
.endpoint-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.endpoint-summary {
  margin-left: auto;
}
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
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
  transition: all 0.2s ease;
  cursor: pointer;
}

.endpoint-card:hover {
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.08);
  transform: translateY(-2px);
  border-color: rgba(15, 23, 42, 0.08);
}
.card-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
.path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
  font-weight: 600;
}
.short {
  color: #475569;
  font-size: 0.85rem;
}
.endpoint-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
  font-weight: 600;
}
.method-text {
  font-weight: bold;
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
.endpoint-details {
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin-top: 16px;
}

.detail-section {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
}

.detail-section:hover {
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.detail-section h6 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: #0f1724;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-section h6::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 2px;
}

.parameters-table .p-datatable {
  border: none;
  background: transparent;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
}

.parameters-table .p-datatable thead th {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: none;
  padding: 12px 8px;
  font-weight: 600;
  color: #f1f5f9;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.parameters-table .p-datatable tbody td {
  border: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding: 10px 8px;
  font-size: 0.85rem;
  background: #ffffff;
}

.parameters-table .p-datatable tbody tr:nth-child(even) {
  background: #f8fafc;
}

.parameters-table .p-datatable tbody tr:hover {
  background: #e2e8f0;
  transition: background-color 0.2s ease;
}

.parameters-table code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.content-list,
.response-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-item {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  transition: all 0.2s ease;
}

.content-item:hover {
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.content-item h6 {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  color: #0f1724;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.content-item h6::before {
  content: "📄";
  font-size: 0.9rem;
}

.schema-preview,
.example-preview {
  margin-top: 8px;
}

.schema-preview .mini-json,
.example-preview .mini-json {
  max-height: 150px;
}

.schema-ref {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0c4a6e;
  font-weight: 500;
  font-size: 0.85rem;
}

.schema-ref i {
  color: #0ea5e9;
}

.schema-properties {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.property-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 0.85rem;
}

.prop-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #1e293b;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.prop-type {
  color: #3b82f6;
  font-weight: 500;
}

.prop-desc {
  color: #6b7280;
  font-style: italic;
}

.body-desc {
  color: #374151;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.json-toggle {
  display: flex;
  justify-content: center;
  margin: 12px 0;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.response-desc {
  color: #374151;
  font-size: 0.9rem;
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
