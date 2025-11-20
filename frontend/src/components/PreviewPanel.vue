<template>
  <div class="preview-panel">
    <div class="panel-header">
      <h3>Swagger Preview</h3>
    </div>
    <div class="panel-content">
      <div v-if="error" class="error-message">
        <Message severity="error">
          <strong>{{ error.title }}</strong>
          <p>{{ error.message }}</p>
        </Message>
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

export default {
  name: "PreviewPanel",
  components: {
    Message,
    ProgressSpinner,
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
      await nextTick();
      await updatePreview();
    });

    onBeforeUnmount(() => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    });

    watch(() => props.spec, updatePreview, { deep: true });

    return {
      swaggerContainer,
      error,
      loading,
      containerKey,
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

<style>
/* Global Swagger UI overrides */
.swagger-ui .topbar {
  display: none;
}

.swagger-ui .info {
  margin: 20px 0;
}
</style>
