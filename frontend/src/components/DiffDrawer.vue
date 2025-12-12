<template>
  <Drawer
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
        />
      </div>
    </template>

    <div class="diff-container">
      <div v-if="!hasChanges" class="no-changes">
        <i
          class="pi pi-check-circle"
          style="font-size: 3rem; color: #10b981"
        ></i>
        <h3>No Changes</h3>
        <p>The specification hasn't been modified.</p>
      </div>

      <div v-else class="changes-content">
        <!-- Summary -->
        <div class="summary-card">
          <h3>📊 Summary</h3>
          <div class="summary-grid">
            <div class="summary-item added">
              <i class="pi pi-plus-circle"></i>
              <span class="count">{{ summary.added }}</span>
              <span class="label">Added</span>
            </div>
            <div class="summary-item modified">
              <i class="pi pi-pencil"></i>
              <span class="count">{{ summary.modified }}</span>
              <span class="label">Modified</span>
            </div>
            <div class="summary-item removed">
              <i class="pi pi-minus-circle"></i>
              <span class="count">{{ summary.removed }}</span>
              <span class="label">Removed</span>
            </div>
          </div>
        </div>

        <!-- Added Info Fields -->
        <div v-if="diff.infoAdded?.length" class="change-section">
          <h3>➕ Added Information ({{ diff.infoAdded.length }})</h3>
          <div class="change-list">
            <div
              v-for="item in diff.infoAdded"
              :key="item.key"
              class="change-item added"
            >
              <Tag severity="success">{{ item.key }}</Tag>
              <div class="single-value">
                <code>{{ item.value }}</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Modified Info Fields -->
        <div v-if="diff.infoModified?.length" class="change-section">
          <h3>✏️ Modified Information ({{ diff.infoModified.length }})</h3>
          <div class="change-list">
            <div
              v-for="item in diff.infoModified"
              :key="item.key"
              class="change-item modified"
            >
              <Tag severity="warn">{{ item.key }}</Tag>
              <div class="change-values">
                <div class="old-value">
                  <span class="value-label">Before:</span>
                  <code>{{ item.old }}</code>
                </div>
                <i class="pi pi-arrow-right"></i>
                <div class="new-value">
                  <span class="value-label">After:</span>
                  <code>{{ item.new }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Removed Info Fields -->
        <div v-if="diff.infoRemoved?.length" class="change-section">
          <h3>➖ Removed Information ({{ diff.infoRemoved.length }})</h3>
          <div class="change-list">
            <div
              v-for="item in diff.infoRemoved"
              :key="item.key"
              class="change-item removed"
            >
              <Tag severity="danger">{{ item.key }}</Tag>
              <div class="single-value">
                <code>{{ item.value }}</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Added Schemas -->
        <div v-if="diff.schemaAdded?.length" class="change-section">
          <h3>➕ Added Schemas ({{ diff.schemaAdded.length }})</h3>
          <div class="change-list">
            <div
              v-for="item in diff.schemaAdded"
              :key="item.name"
              class="change-item added"
            >
              <div class="schema-name-header">
                <i class="pi pi-sitemap"></i>
                <code class="schema-name">{{ item.name }}</code>
                <Tag v-if="item.schema.type" severity="info" size="small">
                  {{ item.schema.type }}
                </Tag>
              </div>
              <pre
                class="schema-preview"
              ><code>{{ JSON.stringify(item.schema, null, 2) }}</code></pre>
            </div>
          </div>
        </div>

        <!-- Modified Schemas Section -->
        <div
          v-if="diff.schemaModified?.length"
          class="change-section schema-section"
        >
          <h3>🔄 Modified Schemas ({{ diff.schemaModified.length }})</h3>
          <div class="change-list">
            <div
              v-for="(item, index) in diff.schemaModified"
              :key="`schema-${item.name}-${index}`"
              class="change-item schema-modified"
            >
              <div class="schema-name-header">
                <i class="pi pi-sitemap"></i>
                <code class="schema-name">{{ item.name }}</code>
              </div>

              <div v-if="item.typeChanged" class="type-change-inline">
                <span class="change-label">Type:</span>
                <code>{{ item.oldType }}</code>
                <i class="pi pi-arrow-right"></i>
                <code>{{ item.newType }}</code>
              </div>

              <div v-if="item.requiredChanged" class="required-change">
                <i class="pi pi-exclamation-triangle"></i>
                <span class="change-label">Required fields changed</span>
                <div class="required-badges">
                  <div v-if="item.requiredAdded?.length" class="required-group">
                    <span class="required-label added">Added:</span>
                    <Tag
                      v-for="field in item.requiredAdded"
                      :key="field"
                      severity="danger"
                      size="small"
                    >
                      {{ field }}
                    </Tag>
                  </div>
                  <div
                    v-if="item.requiredRemoved?.length"
                    class="required-group"
                  >
                    <span class="required-label removed">Removed:</span>
                    <Tag
                      v-for="field in item.requiredRemoved"
                      :key="field"
                      severity="success"
                      size="small"
                    >
                      {{ field }}
                    </Tag>
                  </div>
                </div>
              </div>

              <div v-if="item.enumChanged" class="validation-change">
                <i class="pi pi-list"></i>
                <span>Enum values changed</span>
              </div>

              <div v-if="item.formatChanged" class="validation-change">
                <i class="pi pi-palette"></i>
                <span>Format changed</span>
              </div>

              <div
                v-if="item.validationChanged?.length"
                class="validation-changes"
              >
                <i class="pi pi-shield"></i>
                <span class="change-label">Validation rules changed:</span>
                <div class="validation-list">
                  <div
                    v-for="(validation, idx) in item.validationChanged"
                    :key="idx"
                    class="validation-item"
                  >
                    <code>{{ validation.field }}</code>
                    <span class="validation-arrow">:</span>
                    <code class="old-val">{{ validation.old ?? "none" }}</code>
                    <i class="pi pi-arrow-right"></i>
                    <code class="new-val">{{ validation.new ?? "none" }}</code>
                  </div>
                </div>
              </div>

              <div
                v-if="item.propertiesAdded?.length"
                class="properties-summary added"
              >
                <i class="pi pi-plus-circle"></i>
                <span>{{ item.propertiesAdded.length }} properties added</span>
                <div class="property-badges">
                  <Tag
                    v-for="prop in item.propertiesAdded"
                    :key="prop.name"
                    severity="success"
                    size="small"
                  >
                    {{ prop.name }}
                  </Tag>
                </div>
              </div>

              <div
                v-if="item.propertiesRemoved?.length"
                class="properties-summary removed"
              >
                <i class="pi pi-minus-circle"></i>
                <span
                  >{{ item.propertiesRemoved.length }} properties removed</span
                >
                <div class="property-badges">
                  <Tag
                    v-for="prop in item.propertiesRemoved"
                    :key="prop.name"
                    severity="danger"
                    size="small"
                  >
                    {{ prop.name }}
                  </Tag>
                </div>
              </div>

              <div
                v-if="item.propertiesModified?.length"
                class="properties-summary modified"
              >
                <i class="pi pi-pencil"></i>
                <span
                  >{{ item.propertiesModified.length }} properties
                  modified</span
                >
                <div class="property-badges">
                  <Tag
                    v-for="prop in item.propertiesModified"
                    :key="prop.name"
                    severity="warn"
                    size="small"
                  >
                    {{ prop.name }}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Removed Schemas -->
      <div v-if="diff.schemaRemoved?.length" class="change-section">
        <h3>➖ Removed Schemas ({{ diff.schemaRemoved.length }})</h3>
        <div class="change-list">
          <div
            v-for="(item, index) in diff.schemaRemoved"
            :key="item.name"
            class="change-item removed"
          >
            <div class="schema-name-header">
              <i class="pi pi-sitemap"></i>
              <code class="schema-name">{{ item.name }}</code>
              <Tag v-if="item.schema.type" severity="danger" size="small">
                {{ item.schema.type }}
              </Tag>
              <Button
                icon="pi pi-chevron-down"
                :class="{ 'rotate-180': expandedRemovedSchemas[index] }"
                text
                size="small"
                @click="toggleRemovedSchema(index)"
                class="expand-button"
                severity="secondary"
              />
            </div>
            <div v-if="expandedRemovedSchemas[index]" class="expanded-details">
              <pre
                class="schema-preview"
              ><code>{{ JSON.stringify(item.schema, null, 2) }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Added Paths -->
      <div v-if="diff.added?.length" class="change-section">
        <h3>➕ Added Endpoints ({{ diff.added.length }})</h3>
        <div class="change-list">
          <div
            v-for="item in diff.added"
            :key="item.path"
            class="change-item added"
          >
            <div class="endpoint-header">
              <Tag :severity="getMethodSeverity(item.method)">{{
                item.method
              }}</Tag>
              <code class="path">{{ item.path }}</code>
              <Tag v-if="item.deprecated" severity="danger" size="small">
                Deprecated
              </Tag>
            </div>
            <div v-if="item.summary" class="endpoint-summary">
              <strong>Summary:</strong> {{ item.summary }}
            </div>
            <div v-if="item.description" class="endpoint-description">
              <strong>Description:</strong> {{ item.description }}
            </div>
            <div v-if="item.operationId" class="endpoint-operation-id">
              <strong>Operation ID:</strong> <code>{{ item.operationId }}</code>
            </div>
            <div v-if="item.tags?.length" class="endpoint-tags">
              <span class="tags-label">Tags:</span>
              <Tag
                v-for="tag in item.tags"
                :key="tag"
                severity="secondary"
                size="small"
              >
                {{ tag }}
              </Tag>
            </div>
            <div v-if="item.parameters?.length" class="endpoint-details">
              <strong>Parameters ({{ item.parameters.length }}):</strong>
              <div class="parameter-list">
                <div
                  v-for="param in item.parameters"
                  :key="param.name"
                  class="parameter-item"
                >
                  <code>{{ param.name }}</code>
                  <Tag
                    :severity="param.required ? 'warn' : 'secondary'"
                    size="small"
                  >
                    {{ param.in }}
                  </Tag>
                  <Tag v-if="param.required" severity="danger" size="small"
                    >required</Tag
                  >
                  <span v-if="param.schema?.type" class="param-type"
                    >({{ param.schema.type }})</span
                  >
                </div>
              </div>
            </div>
            <div v-if="item.requestBody" class="endpoint-details">
              <strong>Request Body:</strong>
              <Tag
                v-if="item.requestBody.required"
                severity="danger"
                size="small"
                >required</Tag
              >
              <pre
                class="json-preview"
              ><code>{{ JSON.stringify(item.requestBody, null, 2) }}</code></pre>
            </div>
            <div
              v-if="item.responses && Object.keys(item.responses).length"
              class="endpoint-details"
            >
              <strong>Responses:</strong>
              <div class="response-list">
                <div
                  v-for="(response, statusCode) in item.responses"
                  :key="statusCode"
                  class="response-item"
                >
                  <Tag :severity="getStatusSeverity(statusCode)" size="small">{{
                    statusCode
                  }}</Tag>
                  <span v-if="response.description">{{
                    response.description
                  }}</span>
                </div>
              </div>
            </div>
            <div v-if="item.security?.length" class="endpoint-details">
              <strong>Security:</strong>
              <pre
                class="json-preview"
              ><code>{{ JSON.stringify(item.security, null, 2) }}</code></pre>
            </div>
          </div>
        </div>
      </div>
      <!-- Modified Paths -->
      <div v-if="diff.modified?.length" class="change-section">
        <h3>✏️ Modified Endpoints ({{ diff.modified.length }})</h3>
        <div class="change-list">
          <div
            v-for="(item, index) in diff.modified"
            :key="item.path + item.method"
            class="change-item modified"
          >
            <div class="endpoint-header">
              <Tag :severity="getMethodSeverity(item.method)">{{
                item.method
              }}</Tag>
              <code class="path">{{ item.path }}</code>
              <Button
                icon="pi pi-chevron-down"
                :class="{ 'rotate-180': expandedItems[index] }"
                text
                size="small"
                @click="toggleExpand(index)"
                class="expand-button"
              />
            </div>
            <div v-if="item.changes?.length" class="endpoint-changes">
              <div
                v-for="(change, idx) in item.changes"
                :key="idx"
                class="field-change"
              >
                <i class="pi pi-angle-right"></i>
                <span>{{ change }}</span>
              </div>
            </div>

            <!-- Expanded Details -->
            <div v-if="expandedItems[index]" class="expanded-details">
              <div
                v-for="(detail, field) in item.details"
                :key="field"
                class="detail-section"
              >
                <h4 class="detail-title">{{ formatFieldName(field) }}</h4>

                <!-- String fields (summary, description, operationId) -->
                <div
                  v-if="
                    typeof detail.old === 'string' &&
                    typeof detail.new === 'string'
                  "
                  class="change-values"
                >
                  <div class="old-value">
                    <span class="value-label">Before:</span>
                    <code>{{ detail.old || "(empty)" }}</code>
                  </div>
                  <i class="pi pi-arrow-right"></i>
                  <div class="new-value">
                    <span class="value-label">After:</span>
                    <code>{{ detail.new || "(empty)" }}</code>
                  </div>
                </div>

                <!-- Boolean fields (deprecated) -->
                <div
                  v-else-if="
                    typeof detail.old === 'boolean' &&
                    typeof detail.new === 'boolean'
                  "
                  class="change-values"
                >
                  <div class="old-value">
                    <span class="value-label">Before:</span>
                    <Tag :severity="detail.old ? 'danger' : 'success'">
                      {{ detail.old ? "Deprecated" : "Active" }}
                    </Tag>
                  </div>
                  <i class="pi pi-arrow-right"></i>
                  <div class="new-value">
                    <span class="value-label">After:</span>
                    <Tag :severity="detail.new ? 'danger' : 'success'">
                      {{ detail.new ? "Deprecated" : "Active" }}
                    </Tag>
                  </div>
                </div>

                <!-- Parameters with detailed breakdown -->
                <div
                  v-else-if="field === 'parameters'"
                  class="parameters-detail"
                >
                  <div v-if="detail.added?.length" class="param-group added">
                    <h5>➕ Added Parameters ({{ detail.added.length }})</h5>
                    <div
                      v-for="param in detail.added"
                      :key="param.name + param.in"
                      class="param-detail-item"
                    >
                      <div class="param-header">
                        <code class="param-name">{{ param.name }}</code>
                        <Tag severity="info" size="small">{{ param.in }}</Tag>
                        <Tag
                          v-if="param.required"
                          severity="danger"
                          size="small"
                          >required</Tag
                        >
                      </div>
                      <div v-if="param.description" class="param-description">
                        {{ param.description }}
                      </div>
                      <div v-if="param.schema" class="param-schema">
                        <span class="schema-label">Type:</span>
                        <code>{{ param.schema.type || "any" }}</code>
                        <span v-if="param.schema.format" class="schema-format">
                          ({{ param.schema.format }})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="detail.modified?.length"
                    class="param-group modified"
                  >
                    <h5>
                      ✏️ Modified Parameters ({{ detail.modified.length }})
                    </h5>
                    <div
                      v-for="param in detail.modified"
                      :key="param.name + param.in"
                      class="param-detail-item"
                    >
                      <div class="param-header">
                        <code class="param-name">{{ param.name }}</code>
                        <Tag severity="warn" size="small">{{ param.in }}</Tag>
                      </div>
                      <div class="param-diff-grid">
                        <div class="param-diff-side">
                          <span class="value-label">Before:</span>
                          <div class="param-info">
                            <div
                              v-if="param.old.description"
                              class="param-description"
                            >
                              {{ param.old.description }}
                            </div>
                            <div class="param-meta">
                              <Tag
                                v-if="param.old.required"
                                severity="danger"
                                size="small"
                                >required</Tag
                              >
                              <Tag v-else severity="secondary" size="small"
                                >optional</Tag
                              >
                              <span v-if="param.old.schema">
                                {{ param.old.schema.type || "any" }}
                                <span v-if="param.old.schema.format"
                                  >({{ param.old.schema.format }})</span
                                >
                              </span>
                            </div>
                          </div>
                        </div>
                        <i class="pi pi-arrow-right"></i>
                        <div class="param-diff-side">
                          <span class="value-label">After:</span>
                          <div class="param-info">
                            <div
                              v-if="param.new.description"
                              class="param-description"
                            >
                              {{ param.new.description }}
                            </div>
                            <div class="param-meta">
                              <Tag
                                v-if="param.new.required"
                                severity="danger"
                                size="small"
                                >required</Tag
                              >
                              <Tag v-else severity="secondary" size="small"
                                >optional</Tag
                              >
                              <span v-if="param.new.schema">
                                {{ param.new.schema.type || "any" }}
                                <span v-if="param.new.schema.format"
                                  >({{ param.new.schema.format }})</span
                                >
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="detail.removed?.length"
                    class="param-group removed"
                  >
                    <h5>➖ Removed Parameters ({{ detail.removed.length }})</h5>
                    <div
                      v-for="param in detail.removed"
                      :key="param.name + param.in"
                      class="param-detail-item"
                    >
                      <div class="param-header">
                        <code class="param-name">{{ param.name }}</code>
                        <Tag severity="info" size="small">{{ param.in }}</Tag>
                        <Tag
                          v-if="param.required"
                          severity="danger"
                          size="small"
                          >required</Tag
                        >
                      </div>
                      <div v-if="param.description" class="param-description">
                        {{ param.description }}
                      </div>
                      <div v-if="param.schema" class="param-schema">
                        <span class="schema-label">Type:</span>
                        <code>{{ param.schema.type || "any" }}</code>
                        <span v-if="param.schema.format" class="schema-format">
                          ({{ param.schema.format }})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tags array -->
                <div v-else-if="field === 'tags'" class="tags-comparison">
                  <div class="tags-side">
                    <span class="value-label">Before:</span>
                    <div class="tags-list">
                      <Tag
                        v-for="tag in detail.old"
                        :key="tag"
                        severity="secondary"
                      >
                        {{ tag }}
                      </Tag>
                      <span v-if="!detail.old?.length" class="empty-text"
                        >(none)</span
                      >
                    </div>
                  </div>
                  <i class="pi pi-arrow-right"></i>
                  <div class="tags-side">
                    <span class="value-label">After:</span>
                    <div class="tags-list">
                      <Tag
                        v-for="tag in detail.new"
                        :key="tag"
                        severity="secondary"
                      >
                        {{ tag }}
                      </Tag>
                      <span v-if="!detail.new?.length" class="empty-text"
                        >(none)</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Responses with detailed status code comparison -->
                <div v-else-if="field === 'responses'" class="responses-detail">
                  <div v-if="detail.added?.length" class="response-group added">
                    <h5>➕ Added Responses</h5>
                    <div
                      v-for="resp in detail.added"
                      :key="resp.statusCode"
                      class="status-code-item"
                    >
                      <Tag severity="success">{{ resp.statusCode }}</Tag>
                      <span class="response-description">
                        {{ resp.response.description || "(no description)" }}
                      </span>
                    </div>
                  </div>

                  <div
                    v-if="detail.modified?.length"
                    class="response-group modified"
                  >
                    <h5>✏️ Modified Responses</h5>
                    <div
                      v-for="resp in detail.modified"
                      :key="resp.statusCode"
                      class="status-code-item"
                    >
                      <Tag severity="warn">{{ resp.statusCode }}</Tag>
                      <div class="response-diff">
                        <div class="response-side">
                          <span class="value-label">Before:</span>
                          <pre><code>{{ JSON.stringify(resp.old, null, 2) }}</code></pre>
                        </div>
                        <div class="response-side">
                          <span class="value-label">After:</span>
                          <pre><code>{{ JSON.stringify(resp.new, null, 2) }}</code></pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="detail.removed?.length"
                    class="response-group removed"
                  >
                    <h5>➖ Removed Responses</h5>
                    <div
                      v-for="resp in detail.removed"
                      :key="resp.statusCode"
                      class="status-code-item"
                    >
                      <Tag severity="danger">{{ resp.statusCode }}</Tag>
                      <span class="response-description">
                        {{ resp.response.description || "(no description)" }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Other JSON fields -->
                <div v-else class="json-comparison">
                  <div class="json-side">
                    <span class="value-label">Before:</span>
                    <pre><code>{{ JSON.stringify(detail.old, null, 2) }}</code></pre>
                  </div>
                  <div class="json-side">
                    <span class="value-label">After:</span>
                    <pre><code>{{ JSON.stringify(detail.new, null, 2) }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Removed Paths -->
      <div v-if="diff.removed?.length" class="change-section">
        <h3>➖ Removed Endpoints ({{ diff.removed.length }})</h3>
        <div class="change-list">
          <div
            v-for="(item, index) in diff.removed"
            :key="item.path"
            class="change-item removed"
          >
            <div class="endpoint-header">
              <Tag :severity="getMethodSeverity(item.method)">{{
                item.method
              }}</Tag>
              <code class="path">{{ item.path }}</code>
              <Button
                icon="pi pi-chevron-down"
                :class="{ 'rotate-180': expandedRemovedEndpoints[index] }"
                text
                size="small"
                @click="toggleRemovedEndpoint(index)"
                class="expand-button"
                severity="secondary"
              />
            </div>
            <div
              v-if="expandedRemovedEndpoints[index]"
              class="expanded-details"
            >
              <div v-if="item.summary" class="endpoint-summary">
                <strong>Summary:</strong> {{ item.summary }}
              </div>
              <div v-if="item.description" class="endpoint-description">
                <strong>Description:</strong> {{ item.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Drawer>
</template>

<script>
import { computed, ref } from "vue";
import Drawer from "primevue/drawer";
import Tag from "primevue/tag";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";
import { generateMarkdownReport } from "../utils/markdownGenerator";

export default {
  name: "DiffDrawer",
  components: {
    Drawer,
    Tag,
    Button,
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

    const copyAsMarkdown = async () => {
      copying.value = true;
      try {
        const markdown = generateMarkdownReport(props.diff);

        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(markdown);
        } else {
          // Fallback for older browsers or non-secure context
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

    const getStatusSeverity = (statusCode) => {
      const code = parseInt(statusCode);
      if (code >= 200 && code < 300) return "success";
      if (code >= 300 && code < 400) return "info";
      if (code >= 400 && code < 500) return "warn";
      if (code >= 500) return "danger";
      return "secondary";
    };

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
      getStatusSeverity,
    };
  },
};
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.drawer-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.diff-container {
  padding: 1.5rem;
  background: linear-gradient(to bottom, #fafbfc, #ffffff);
  min-height: 100%;
}

.no-changes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem;
  text-align: center;
  gap: 1.5rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 16px;
  border: 2px dashed #e2e8f0;
  margin: 2rem 0;
}

.no-changes i {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.no-changes h3 {
  color: #1e293b;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.no-changes p {
  color: #64748b;
  margin: 0;
  font-size: 1rem;
}

.changes-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 2rem;
  color: white;
  box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3),
    0 8px 16px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.summary-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  pointer-events: none;
}

.summary-card h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.4rem;
  font-weight: 700;
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  position: relative;
  z-index: 1;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.summary-item:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.summary-item i {
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.summary-item .count {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.summary-item .label {
  font-size: 0.875rem;
  opacity: 0.95;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.change-section {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}

.change-section:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  border-color: #e2e8f0;
}

.change-section h3 {
  margin: 0 0 1.5rem 0;
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: -0.01em;
}

.change-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.change-item {
  padding: 1.25rem;
  border-radius: 12px;
  border-left: 4px solid #e5e7eb;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.change-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.change-item.added {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border-left-color: #10b981;
  border-left-width: 5px;
}

.change-item.added:hover {
  background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.15);
}

.change-item.modified {
  background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%);
  border-left-color: #f59e0b;
  border-left-width: 5px;
}

.change-item.modified:hover {
  background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);
}

.change-item.removed {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left-color: #ef4444;
  border-left-width: 5px;
}

.change-item.removed:hover {
  background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.15);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.endpoint-header .path {
  font-family: "Monaco", "Courier New", monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
  letter-spacing: -0.01em;
}

.expand-button {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-left: auto;
  border-radius: 8px;
}

.expand-button:hover {
  background: rgba(102, 126, 234, 0.1);
}

.expand-button.rotate-180 {
  transform: rotate(180deg);
}

.endpoint-summary {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.endpoint-description {
  color: #4b5563;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  line-height: 1.5;
}

.endpoint-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.tags-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
}

.endpoint-operation-id {
  color: #4b5563;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.endpoint-operation-id code {
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.endpoint-details {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  border-left: 3px solid #10b981;
}

.endpoint-details strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
  font-size: 0.875rem;
}

.parameter-list,
.response-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.parameter-item,
.response-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border-radius: 3px;
  font-size: 0.875rem;
}

.parameter-item code {
  font-weight: 600;
  color: #1f2937;
}

.param-type {
  color: #6b7280;
  font-size: 0.8rem;
  margin-left: auto;
}

.json-preview {
  margin-top: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 10px;
  overflow-x: auto;
  max-height: 300px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.json-preview code {
  color: #34d399;
  font-family: "Monaco", "Courier New", monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.3);
}

.endpoint-changes {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.field-change i {
  color: #9ca3af;
}

.change-values {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.old-value,
.new-value {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.value-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 500;
}

.old-value code,
.new-value code {
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  word-break: break-all;
}

.change-values > i {
  color: #9ca3af;
  flex-shrink: 0;
}

.single-value {
  margin-top: 0.5rem;
}

.single-value code {
  display: block;
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  word-break: break-all;
}

.expanded-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.json-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 0.5rem;
}

.json-side {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.json-side pre {
  margin: 0;
  padding: 0.75rem;
  background: #1f2937;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 300px;
}

.json-side code {
  color: #10b981;
  font-family: "Monaco", "Courier New", monospace;
  font-size: 0.8rem;
  line-height: 1.5;
}

.tags-comparison {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-top: 0.5rem;
}

.tags-side {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 2rem;
  align-items: center;
}

.empty-text {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.875rem;
}

.responses-detail {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.response-group {
  padding: 1rem;
  border-radius: 6px;
  border-left: 3px solid;
}

.response-group.added {
  background: #f0fdf4;
  border-left-color: #10b981;
}

.response-group.modified {
  background: #fef3c7;
  border-left-color: #f59e0b;
}

.response-group.removed {
  background: #fee2e2;
  border-left-color: #ef4444;
}

.response-group h5 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.status-code-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.status-code-item:last-child {
  margin-bottom: 0;
}

.response-description {
  color: #6b7280;
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.response-diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 0.5rem;
}

.response-side {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.response-side pre {
  margin: 0;
  padding: 0.5rem;
  background: #1f2937;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  font-size: 0.75rem;
}

.response-side code {
  color: #10b981;
  font-family: "Monaco", "Courier New", monospace;
  line-height: 1.4;
}

.schema-changes {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}

.schema-changes.full-width {
  grid-column: 1 / -1;
  margin-bottom: 1rem;
}

.schema-changes-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: #1f2937;
  font-size: 0.875rem;
}

.schema-changes-header i {
  color: #3b82f6;
}

.type-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #dbeafe;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.type-change code {
  padding: 0.25rem 0.5rem;
  background: #1f2937;
  color: #10b981;
  border-radius: 3px;
  font-size: 0.8rem;
}

.properties-change {
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.properties-change.added {
  background: #f0fdf4;
  border-left: 3px solid #10b981;
}

.properties-change.removed {
  background: #fee2e2;
  border-left: 3px solid #ef4444;
}

.properties-change.modified {
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
}

.properties-change:last-child {
  margin-bottom: 0;
}

.change-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.property-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.property-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  font-size: 0.875rem;
}

.property-item.modified {
  flex-direction: column;
  align-items: flex-start;
}

.property-item code {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border-radius: 3px;
  font-weight: 600;
  color: #1f2937;
}

.property-type {
  color: #6b7280;
  font-size: 0.8rem;
}

.property-diff {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.5rem;
}

.property-diff pre {
  flex: 1;
  margin: 0;
  padding: 0.5rem;
  background: #1f2937;
  border-radius: 3px;
  overflow-x: auto;
  font-size: 0.75rem;
}

.property-diff code {
  color: #10b981;
  font-family: "Monaco", "Courier New", monospace;
  background: transparent;
  padding: 0;
}

.property-diff i {
  color: #9ca3af;
  flex-shrink: 0;
}

/* Schema Section Styles */
.schema-section {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.08) 0%,
    rgba(118, 75, 162, 0.08) 100%
  );
  border: 2px solid #667eea;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
}

.schema-section:hover {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.12) 0%,
    rgba(118, 75, 162, 0.12) 100%
  );
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
}

.schema-section h3 {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 800;
}

.change-item.schema-modified {
  background: white;
  border-left-color: #667eea;
}

.type-tag {
  margin-left: auto;
  font-size: 0.8rem;
}

.schema-changes-inline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.schema-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #4b5563;
  font-family: "Monaco", "Courier New", monospace;
}

.schema-meta i {
  color: #667eea;
}

.type-change-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #dbeafe;
  border-radius: 4px;
  font-size: 0.875rem;
}

.type-change-inline .change-label {
  display: inline;
  margin: 0;
  color: #1e40af;
}

.type-change-inline code {
  padding: 0.25rem 0.5rem;
  background: #1f2937;
  color: #10b981;
  border-radius: 3px;
  font-size: 0.8rem;
}

.type-change-inline i {
  color: #60a5fa;
}

.properties-summary {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.properties-summary:hover {
  transform: translateX(2px);
}

.properties-summary.added {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border-left: 4px solid #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
}

.properties-summary.removed {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left: 4px solid #ef4444;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
}

.properties-summary.modified {
  background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%);
  border-left: 4px solid #f59e0b;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);
}

.properties-summary > span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.properties-summary i {
  font-size: 1rem;
}

.properties-summary.added i {
  color: #10b981;
}

.properties-summary.removed i {
  color: #ef4444;
}

.properties-summary.modified i {
  color: #f59e0b;
}

.property-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.schema-name-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.schema-name-header i {
  color: #667eea;
  font-size: 1.1rem;
}

.schema-name {
  font-family: "Monaco", "Courier New", monospace;
  font-size: 1rem;
  color: #1f2937;
  font-weight: 600;
}

.schema-preview {
  margin: 0;
  padding: 1rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 10px;
  overflow-x: auto;
  max-height: 400px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.schema-preview code {
  color: #34d399;
  font-family: "Monaco", "Courier New", monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.3);
}

/* Parameter Details */
.parameters-detail {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.param-group {
  padding: 1rem;
  border-radius: 10px;
  border-left: 4px solid;
  transition: all 0.2s ease;
}

.param-group:hover {
  transform: translateX(2px);
}

.param-group.added {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border-left-color: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
}

.param-group.modified {
  background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%);
  border-left-color: #f59e0b;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);
}

.param-group.removed {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left-color: #ef4444;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
}

.param-group h5 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.param-detail-item {
  background: rgba(255, 255, 255, 0.7);
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}

.param-detail-item:last-child {
  margin-bottom: 0;
}

.param-detail-item:hover {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.param-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.param-name {
  font-family: "Monaco", "Courier New", monospace;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  border-radius: 6px;
}

.param-description {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-top: 0.5rem;
}

.param-schema {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.schema-label {
  color: #64748b;
  font-weight: 600;
}

.param-schema code {
  background: #1e293b;
  color: #34d399;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.schema-format {
  color: #94a3b8;
  font-style: italic;
}

.param-diff-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: start;
  margin-top: 0.75rem;
}

.param-diff-side {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-info {
  background: rgba(255, 255, 255, 0.5);
  padding: 0.75rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: #475569;
  font-family: "Monaco", "Courier New", monospace;
}

/* Schema Validation Changes */
.required-change {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%);
  border-radius: 10px;
  border-left: 4px solid #f59e0b;
  margin-bottom: 0.75rem;
}

.required-change > i {
  color: #f59e0b;
  font-size: 1.1rem;
}

.required-change .change-label {
  font-weight: 700;
  color: #92400e;
  font-size: 0.9rem;
}

.required-badges {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.required-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.required-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.required-label.added {
  color: #dc2626;
}

.required-label.removed {
  color: #059669;
}

.validation-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e40af;
}

.validation-change i {
  color: #3b82f6;
  font-size: 1rem;
}

.validation-changes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 10px;
  border-left: 4px solid #3b82f6;
  margin-bottom: 0.75rem;
}

.validation-changes > i {
  color: #3b82f6;
  font-size: 1.1rem;
}

.validation-changes .change-label {
  font-weight: 700;
  color: #1e40af;
  font-size: 0.9rem;
}

.validation-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  font-size: 0.875rem;
}

.validation-item code {
  background: #1e293b;
  color: #34d399;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: "Monaco", "Courier New", monospace;
}

.validation-arrow {
  color: #64748b;
  font-weight: 600;
}

.old-val {
  background: #fee2e2 !important;
  color: #991b1b !important;
}

.new-val {
  background: #dcfce7 !important;
  color: #166534 !important;
}

.validation-item i {
  color: #60a5fa;
  font-size: 0.875rem;
}
</style>
