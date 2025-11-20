<template>
  <Drawer
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    position="right"
    :style="{ width: '60vw' }"
    header="Changes Overview"
  >
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
              </div>
              <div v-if="item.summary" class="endpoint-summary">
                {{ item.summary }}
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
                  <div
                    v-else-if="field === 'responses'"
                    class="responses-detail"
                  >
                    <div
                      v-if="detail.added?.length"
                      class="response-group added"
                    >
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
              v-for="item in diff.removed"
              :key="item.path"
              class="change-item removed"
            >
              <div class="endpoint-header">
                <Tag :severity="getMethodSeverity(item.method)">{{
                  item.method
                }}</Tag>
                <code class="path">{{ item.path }}</code>
              </div>
              <div v-if="item.summary" class="endpoint-summary">
                {{ item.summary }}
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
      required: true,
    },
    diff: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:visible"],
  setup(props) {
    const expandedItems = ref({});

    const toggleExpand = (index) => {
      expandedItems.value[index] = !expandedItems.value[index];
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
        props.diff.removed?.length > 0
      );
    });

    const summary = computed(() => {
      return {
        added:
          (props.diff.infoAdded?.length || 0) + (props.diff.added?.length || 0),
        modified:
          (props.diff.infoModified?.length || 0) +
          (props.diff.modified?.length || 0),
        removed:
          (props.diff.infoRemoved?.length || 0) +
          (props.diff.removed?.length || 0),
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

    return {
      expandedItems,
      toggleExpand,
      formatFieldName,
      hasChanges,
      summary,
      getMethodSeverity,
    };
  },
};
</script>

<style scoped>
.diff-container {
  padding: 1rem;
}

.no-changes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  gap: 1rem;
}

.no-changes h3 {
  color: #1f2937;
  margin: 0;
}

.no-changes p {
  color: #6b7280;
  margin: 0;
}

.changes-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 1.5rem;
  color: white;
}

.summary-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.summary-item i {
  font-size: 1.5rem;
}

.summary-item .count {
  font-size: 2rem;
  font-weight: bold;
}

.summary-item .label {
  font-size: 0.875rem;
  opacity: 0.9;
}

.change-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.change-section h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.change-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.change-item {
  padding: 1rem;
  border-radius: 6px;
  border-left: 4px solid #e5e7eb;
}

.change-item.added {
  background: #f0fdf4;
  border-left-color: #10b981;
}

.change-item.modified {
  background: #fef3c7;
  border-left-color: #f59e0b;
}

.change-item.removed {
  background: #fee2e2;
  border-left-color: #ef4444;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.endpoint-header .path {
  font-family: "Monaco", "Courier New", monospace;
  font-size: 0.95rem;
  color: #1f2937;
  flex: 1;
}

.expand-button {
  transition: transform 0.2s;
  margin-left: auto;
}

.expand-button.rotate-180 {
  transform: rotate(180deg);
}

.endpoint-summary {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 0.5rem;
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
</style>
