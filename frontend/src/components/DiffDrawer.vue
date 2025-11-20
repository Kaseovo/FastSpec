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
              v-for="item in diff.modified"
              :key="item.path"
              class="change-item modified"
            >
              <div class="endpoint-header">
                <Tag :severity="getMethodSeverity(item.method)">{{
                  item.method
                }}</Tag>
                <code class="path">{{ item.path }}</code>
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
import { computed } from "vue";
import Drawer from "primevue/drawer";
import Tag from "primevue/tag";

export default {
  name: "DiffDrawer",
  components: {
    Drawer,
    Tag,
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
</style>
