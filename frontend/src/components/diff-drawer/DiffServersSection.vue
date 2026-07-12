<template>
  <div class="section-group endpoints-section" v-if="servers.length">
    <div class="section-header">
      <h4>Servers</h4>
      <Button
        icon="pi pi-angle-down"
        class="p-button-text"
        @click="$emit('toggle-section', 'servers')"
      />
    </div>
    <div v-show="expanded" class="cards-grid">
      <div v-if="servers.length === 0" class="no-items">No servers</div>
      <div
        v-for="(item, idx) in servers"
        :key="cardKey(item, idx)"
        class="schema-card"
      >
        <div class="card-left">
          <div class="schema-header">
            <i class="pi pi-server"></i>
            <div>
              <div class="server-name">
                {{
                  getFormattedValue(item.value)?.url ||
                  item.key ||
                  getFormattedValue(item.value)?.description ||
                  item.value
                }}
              </div>
              <div class="server-desc">
                {{
                  getFormattedValue(item.value)?.description ||
                  getFormattedValue(item.value)?.url ||
                  ""
                }}
              </div>
            </div>
          </div>
        </div>
        <div class="card-details">
          <div v-if="item.changeType === 'removed'" class="mini-section">
            <div class="mini-label">Value</div>
            <div class="change-value removed">
              <span class="label">Removed:</span>
              <code>{{ item.value }}</code>
            </div>
          </div>
        </div>
        <div class="card-right">
          <div class="card-actions">
            <Button
              icon="pi pi-eye"
              class="p-button-text"
              @click="$emit('open-details', item)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from "primevue/button";
import { cardKey, getFormattedValue } from "../../utils/diffDisplay";

// The "Servers" diff section. Markup was byte-identical between DiffDrawer's
// inline and drawer render modes, so it's shared by both here.
export default {
  name: "DiffServersSection",
  components: { Button },
  props: {
    servers: {
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
    return { cardKey, getFormattedValue };
  },
};
</script>
