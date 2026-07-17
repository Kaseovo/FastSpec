<template>
  <FormEditorVariantRail
    v-if="variant === 'rail'"
    :model-value="modelValue"
    :show-live-preview="showLivePreview"
    @update:modelValue="$emit('update:modelValue', $event)"
    @toggle-live-preview="$emit('toggle-live-preview')"
  />
  <FormEditorVariantTree
    v-else-if="variant === 'tree'"
    :model-value="modelValue"
    :show-live-preview="showLivePreview"
    @update:modelValue="$emit('update:modelValue', $event)"
    @toggle-live-preview="$emit('toggle-live-preview')"
  />
  <FormEditorVariantDashboard
    v-else
    :model-value="modelValue"
    :show-live-preview="showLivePreview"
    @update:modelValue="$emit('update:modelValue', $event)"
    @toggle-live-preview="$emit('toggle-live-preview')"
  />
  <PrototypeSwitcher :variants="VARIANTS" query-param="variant" label="FORM EDITOR" />
</template>

<script>
// Design-direction prototype host for the Form Editor. Dev-only — see
// NOTES.md in this folder. Mounted from EditorView.vue only when
// import.meta.env.DEV && route.query.variant is set.
import { computed } from "vue";
import { useRoute } from "vue-router";
import FormEditorVariantRail from "./FormEditorVariantRail.vue";
import FormEditorVariantTree from "./FormEditorVariantTree.vue";
import FormEditorVariantDashboard from "./FormEditorVariantDashboard.vue";
import PrototypeSwitcher from "./PrototypeSwitcher.vue";

const VARIANTS = [
  { key: "rail", name: "Icon Rail" },
  { key: "tree", name: "Search & Tree" },
  { key: "dashboard", name: "Dashboard Pills" },
];

export default {
  name: "FormEditorPrototypeHost",
  components: {
    FormEditorVariantRail,
    FormEditorVariantTree,
    FormEditorVariantDashboard,
    PrototypeSwitcher,
  },
  props: {
    modelValue: { type: Object, required: true },
    showLivePreview: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup() {
    const route = useRoute();
    const variant = computed(() => route.query.variant || "rail");
    return { variant, VARIANTS };
  },
};
</script>
