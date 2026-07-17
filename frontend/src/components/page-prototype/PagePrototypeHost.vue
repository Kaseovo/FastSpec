<template>
  <div class="pph">
    <PageVariantUnifiedBar v-if="variant === 'unified'" />
    <PageVariantSidebar v-else-if="variant === 'sidebar'" />
    <PageVariantWorkbench v-else />
    <PrototypeSwitcher :variants="VARIANTS" query-param="pageVariant" label="WHOLE PAGE" />
  </div>
</template>

<script>
// Design-direction prototype for the whole /specs page (header, spec
// switcher, mode switcher, content — not just the Form Editor panel).
// Dev-only, mounted from AppLayout.vue when import.meta.env.DEV &&
// route.query.pageVariant is set. See NOTES.md in this folder.
import { computed } from "vue";
import { useRoute } from "vue-router";
import PageVariantUnifiedBar from "./PageVariantUnifiedBar.vue";
import PageVariantSidebar from "./PageVariantSidebar.vue";
import PageVariantWorkbench from "./PageVariantWorkbench.vue";
import PrototypeSwitcher from "../form-editor-prototype/PrototypeSwitcher.vue";

const VARIANTS = [
  { key: "unified", name: "Unified Bar" },
  { key: "sidebar", name: "Dark Sidebar" },
  { key: "workbench", name: "Workbench Tabs" },
];

export default {
  name: "PagePrototypeHost",
  components: { PageVariantUnifiedBar, PageVariantSidebar, PageVariantWorkbench, PrototypeSwitcher },
  setup() {
    const route = useRoute();
    const variant = computed(() => route.query.pageVariant || "unified");
    return { variant, VARIANTS };
  },
};
</script>

<style scoped>
.pph {
  min-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}

.pph > *:first-child {
  flex: 1;
  min-height: 0;
}
</style>
