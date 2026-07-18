<template>
  <div class="preview-view">
    <div class="preview-full">
      <div
        v-if="!parsedSpec || Object.keys(parsedSpec).length === 0"
        class="empty-preview"
        style="padding: 16px; text-align: center"
      >
        <p>No specification is loaded for preview.</p>
      </div>
      <PreviewPanel v-else :spec="parsedSpec" />
    </div>
  </div>
</template>

<script>
import PreviewPanel from "../components/PreviewPanel.vue";
import { inject } from "vue";
import { useRoute } from "vue-router";

export default {
  name: "PreviewView",
  components: { PreviewPanel },
  setup() {
    const specEditor = inject("specEditor");
    const route = useRoute();

    // if route has :id param, load spec
    if (route.params.id) {
      specEditor.loadSpec(route.params.id);
    }

    return {
      parsedSpec: specEditor.parsedSpec,
    };
  },
};
</script>

<style scoped>
.preview-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.preview-view > .preview-full {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  background: var(--fs-surface);
}
</style>
