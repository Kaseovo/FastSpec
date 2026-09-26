<template>
  <div v-if="endpoints.length" class="section-group endpoints-section">
    <div class="section-header">
      <h4>Paths ({{ endpoints.length }})</h4>
      <Button
        icon="pi pi-angle-down"
        class="p-button-text"
        @click="$emit('toggle-section', 'endpoints')"
      />
    </div>
    <div v-show="expanded" class="endpoints-list">
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
            aria-label="Open details"
            @click="$emit('open-details', item)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from "primevue/button";
import Tag from "primevue/tag";
import { getMethodColor, cardKey } from "../../utils/diffDisplay";

// The "Paths" diff section. Markup was byte-identical between DiffDrawer's
// inline and drawer render modes, so it's shared by both here.
export default {
  name: "DiffEndpointsSection",
  components: { Button, Tag },
  props: {
    endpoints: {
      type: Array,
      default: () => [],
    },
    expanded: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["toggle-section", "open-details"],
  setup() {
    return { getMethodColor, cardKey };
  },
};
</script>
