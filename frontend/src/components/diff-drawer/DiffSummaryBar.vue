<template>
  <div class="summary-sticky">
    <div class="summary-grid">
      <button
        class="summary-pill added"
        :class="{ active: filter === 'added' }"
        @click="$emit('set-filter', 'added')"
      >
        <Tag severity="success">Added</Tag>
        <div class="pill-count">
          {{
            typeCounts.added.endpoints +
            typeCounts.added.components +
            typeCounts.added.info +
            typeCounts.added.servers
          }}
        </div>
        <div class="pill-sub">
          <span>{{ typeCounts.added.endpoints }} paths</span>
          <span v-if="typeCounts.added.components"
            >, {{ typeCounts.added.components }} components</span
          >
          <span v-if="typeCounts.added.info"
            >, {{ typeCounts.added.info }} info</span
          >
          <span v-if="typeCounts.added.servers"
            >, {{ typeCounts.added.servers }} servers</span
          >
        </div>
      </button>

      <button
        class="summary-pill modified"
        :class="{ active: filter === 'modified' }"
        @click="$emit('set-filter', 'modified')"
      >
        <Tag severity="warn">Modified</Tag>
        <div class="pill-count">
          {{
            typeCounts.modified.endpoints +
            typeCounts.modified.components +
            typeCounts.modified.info +
            typeCounts.modified.servers
          }}
        </div>
        <div class="pill-sub">
          <span>{{ typeCounts.modified.endpoints }} paths</span>
          <span v-if="typeCounts.modified.components"
            >, {{ typeCounts.modified.components }} components</span
          >
          <span v-if="typeCounts.modified.info"
            >, {{ typeCounts.modified.info }} info</span
          >
          <span v-if="typeCounts.modified.servers"
            >, {{ typeCounts.modified.servers }} servers</span
          >
        </div>
      </button>

      <button
        class="summary-pill removed"
        :class="{ active: filter === 'removed' }"
        @click="$emit('set-filter', 'removed')"
      >
        <Tag severity="danger">Removed</Tag>
        <div class="pill-count">
          {{
            typeCounts.removed.endpoints +
            typeCounts.removed.components +
            typeCounts.removed.info +
            typeCounts.removed.servers
          }}
        </div>
        <div class="pill-sub">
          <span>{{ typeCounts.removed.endpoints }} paths</span>
          <span v-if="typeCounts.removed.components"
            >, {{ typeCounts.removed.components }} components</span
          >
          <span v-if="typeCounts.removed.info"
            >, {{ typeCounts.removed.info }} info</span
          >
          <span v-if="typeCounts.removed.servers"
            >, {{ typeCounts.removed.servers }} servers</span
          >
        </div>
      </button>

      <div class="search-wrap">
        <input
          :value="search"
          type="text"
          placeholder="Filter changes..."
          class="p-inputtext p-component"
          @input="$emit('update:search', $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import Tag from "primevue/tag";

// The filter-pill + search bar shown above the diff cards. Identical markup
// was previously duplicated between DiffDrawer's "inline" and "drawer"
// render modes — extracted here since the two blocks were byte-identical.
export default {
  name: "DiffSummaryBar",
  components: { Tag },
  props: {
    typeCounts: {
      type: Object,
      required: true,
    },
    filter: {
      type: String,
      default: "added",
    },
    search: {
      type: String,
      default: "",
    },
  },
  emits: ["set-filter", "update:search"],
};
</script>
