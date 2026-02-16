<template>
  <div class="preview-panel">
    <div class="panel-header">
      <h3>Swagger Preview</h3>
      <div class="header-controls">
        <div v-if="spec?.id" class="version-compare">
          <label>Base</label>
          <select v-model="baseVersion" class="p-inputtext">
            <option
              v-for="v in versions"
              :key="v.id + '-base'"
              :value="v.version"
            >
              {{ v.version }}{{ v.is_published ? " (published)" : "" }}
            </option>
          </select>
          <label>Compare</label>
          <select v-model="compareVersion" class="p-inputtext">
            <option
              v-for="v in versions"
              :key="v.id + '-cmp'"
              :value="v.version"
            >
              {{ v.version }}{{ v.is_published ? " (published)" : "" }}
            </option>
          </select>
          <Button
            class="p-button-sm"
            :loading="comparing"
            label="Compare"
            icon="pi pi-exchange"
            @click="runCompare"
          />
        </div>
      </div>
    </div>

    <div class="panel-content">
      <div v-if="error" class="error-message">
        <Message severity="error">
          <strong>{{ error.title }}</strong>
          <p>{{ error.message }}</p>
        </Message>
      </div>

      <div v-if="versionsLoading" class="loading">
        <ProgressSpinner />
        <div style="margin-left: 8px">Loading versions...</div>
      </div>

      <div v-if="diffResult" style="margin-bottom: 12px">
        <DiffDrawer :diff="diffResult" :spec="spec" inline />
      </div>

      <div v-if="loading" class="loading">
        <ProgressSpinner />
      </div>
      <div
        v-if="!loading && !error"
        :key="containerKey"
        ref="swaggerContainer"
        class="swagger-container"
      ></div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import { listSpecVersions, compareSpecVersions } from "../api/specs";
import DiffDrawer from "./DiffDrawer.vue";
import { adaptBackendDiff } from "../utils/diffUtils";

export default {
  name: "PreviewPanel",
  components: {
    Message,
    ProgressSpinner,
    Button,
    DiffDrawer,
  },
  props: {
    spec: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const swaggerContainer = ref(null);
    const error = ref(null);
    const loading = ref(true);
    const containerKey = ref(0);
    let swaggerUI = null;
    let updateTimeout = null;

    // Version compare state
    const versions = ref([]);
    const versionsLoading = ref(false);
    const baseVersion = ref(null);
    const compareVersion = ref(null);
    const comparing = ref(false);
    const diffResult = ref(null);

    const loadVersions = async () => {
      if (!props.spec?.id) return;
      versionsLoading.value = true;
      try {
        versions.value = await listSpecVersions(props.spec.id);
        if (versions.value && versions.value.length > 0) {
          // Prefer published versions where possible: choose latest published as compare
          // and the previous published as base. Fallback to list ordering when needed.
          const published = versions.value.filter((v) => v.is_published);

          if (published.length >= 2) {
            compareVersion.value = published[0].version;
            baseVersion.value = published[1].version;
          } else if (published.length === 1) {
            compareVersion.value = published[0].version;
            // pick the next available older version from the main list
            const idx = versions.value.findIndex(
              (v) => v.version === published[0].version
            );
            const baseIdx = idx + 1 < versions.value.length ? idx + 1 : 0;
            baseVersion.value =
              versions.value[baseIdx]?.version || versions.value[0].version;
          } else {
            // no published versions known - fall back to first (latest) and last (previous)
            compareVersion.value =
              versions.value[0]?.version ||
              versions.value[versions.value.length - 1]?.version;
            baseVersion.value =
              versions.value[versions.value.length - 1]?.version ||
              versions.value[0]?.version;
          }
        }
      } catch (e) {
        console.error("Failed to load versions:", e);
        versions.value = [];
      } finally {
        versionsLoading.value = false;
      }
    };

    const runCompare = async () => {
      if (!props.spec?.id || !baseVersion.value || !compareVersion.value)
        return;
      // Prevent comparing identical versions
      if (baseVersion.value === compareVersion.value) {
        diffResult.value = null;
        return;
      }
      comparing.value = true;
      error.value = null;
      try {
        const res = await compareSpecVersions(
          props.spec.id,
          baseVersion.value,
          compareVersion.value
        );
        // adapt backend payload to diff object
        const diff = adaptBackendDiff(res);
        diffResult.value = diff;
      } catch (e) {
        console.error("Compare failed:", e);
        error.value = {
          title: "Failed to compare versions",
          message: e.message || String(e),
        };
      } finally {
        comparing.value = false;
      }
    };

    const loadSwaggerUI = async () => {
      if (window.SwaggerUIBundle) {
        return true;
      }

      return new Promise((resolve, reject) => {
        const bundleScript = document.createElement("script");
        bundleScript.src =
          "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js";
        bundleScript.crossOrigin = "anonymous";

        const presetScript = document.createElement("script");
        presetScript.src =
          "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js";
        presetScript.crossOrigin = "anonymous";

        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href =
          "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css";

        let bundleLoaded = false;
        let presetLoaded = false;

        const checkBothLoaded = () => {
          if (bundleLoaded && presetLoaded) {
            resolve(true);
          }
        };

        bundleScript.onload = () => {
          bundleLoaded = true;
          checkBothLoaded();
        };

        bundleScript.onerror = () => {
          reject(new Error("Failed to load Swagger UI Bundle"));
        };

        presetScript.onload = () => {
          presetLoaded = true;
          checkBothLoaded();
        };

        presetScript.onerror = () => {
          reject(new Error("Failed to load Swagger UI Preset"));
        };

        document.head.appendChild(cssLink);
        document.body.appendChild(bundleScript);
        document.body.appendChild(presetScript);
      });
    };

    const updatePreview = async () => {
      // Clear any pending updates
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      // Debounce the update
      updateTimeout = setTimeout(async () => {
        error.value = null;

        if (!props.spec) {
          loading.value = false;
          return;
        }

        // Validate it's an OpenAPI spec
        if (!props.spec.openapi && !props.spec.swagger) {
          loading.value = false;
          error.value = {
            title: "⚠️ Not an OpenAPI Specification",
            message:
              'The JSON is missing the required "openapi" or "swagger" field.',
          };
          return;
        }

        if (!props.spec.info) {
          loading.value = false;
          error.value = {
            title: "⚠️ Missing Required Field",
            message: 'The "info" object is required in OpenAPI specifications.',
          };
          return;
        }

        try {
          await loadSwaggerUI();

          // Increment key to force new container creation
          containerKey.value++;

          // Set loading to false so the container is rendered
          loading.value = false;

          // Wait for the new container to be available in the DOM
          await nextTick();

          if (!swaggerContainer.value) {
            return;
          }

          // Create new Swagger UI instance in the fresh container
          swaggerUI = window.SwaggerUIBundle({
            spec: props.spec,
            domNode: swaggerContainer.value,
            deepLinking: true,
            presets: [
              window.SwaggerUIBundle.presets.apis,
              window.SwaggerUIStandalonePreset,
            ],
            plugins: [window.SwaggerUIBundle.plugins.DownloadUrl],
            layout: "BaseLayout",
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1,
            docExpansion: "list",
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
          });
        } catch (err) {
          loading.value = false;
          error.value = {
            title: "❌ Failed to load Swagger UI",
            message: err.message,
          };
        }
      }, 500); // 500ms debounce
    };

    onMounted(async () => {
      await loadVersions();
      // Trigger initial compare if defaults were set
      if (baseVersion.value && compareVersion.value) {
        try {
          await runCompare();
        } catch (e) {
          // runCompare handles errors
        }
      }
      await nextTick();
      await updatePreview();
    });

    onBeforeUnmount(() => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    });

    watch(
      () => props.spec,
      async () => {
        await loadVersions();
        await updatePreview();
      },
      { deep: true }
    );

    // When either version selector changes, trigger a compare automatically
    watch(
      () => [baseVersion.value, compareVersion.value],
      async ([newBase, newCompare], [oldBase, oldCompare]) => {
        if (versionsLoading.value) return;
        if (!newBase || !newCompare) return;
        if (newBase === oldBase && newCompare === oldCompare) return;
        try {
          await runCompare();
        } catch (e) {
          // no-op
        }
      }
    );

    return {
      swaggerContainer,
      error,
      loading,
      containerKey,
      versions,
      versionsLoading,
      baseVersion,
      compareVersion,
      comparing,
      runCompare,
      diffResult,
    };
  },
};
</script>

<style scoped>
.preview-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 15px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 16px;
  color: #1f2937;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
}

.swagger-container {
  height: 100%;
  padding: 10px;
}

.version-compare {
  display: flex;
  gap: 8px;
  align-items: center;
}

.version-compare label {
  font-size: 12px;
  color: #6b7280;
}

.error-message,
.loading {
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.error-message p {
  margin-top: 10px;
}
</style>
