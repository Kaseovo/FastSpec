<template>
  <div v-if="schemas.length" class="section-group endpoints-section">
    <div class="section-header">
      <h4>Components ({{ schemas.length }})</h4>
      <Button
        icon="pi pi-angle-down"
        class="p-button-text"
        @click="$emit('toggle-section', 'schemas')"
      />
    </div>
    <div v-show="expanded" class="cards-grid">
      <div v-if="schemas.length === 0" class="no-items">
        No components/schemas
      </div>
      <div
        v-for="(item, idx) in schemas"
        :key="cardKey(item, idx)"
        class="schema-card"
      >
        <div class="card-left">
          <div class="schema-header">
            <i class="pi pi-sitemap"></i>
            <code class="schema-name">{{ item.name }}</code>
            <Tag
              v-if="detailed"
              :severity="getChangeSeverity(item.changeType)"
              size="small"
              class="change-type-tag"
              >{{ item.changeType }}</Tag
            >
          </div>
        </div>

        <!-- detailed (drawer mode) card body -->
        <div v-if="detailed" class="card-details">
          <div class="schema-overview">
            <div
              v-if="
                item.dereferencedSchema?.type &&
                item.dereferencedSchema?.type !== 'object'
              "
              class="schema-type"
            >
              <strong>Type:</strong>
              {{ item.dereferencedSchema?.type }}
            </div>
            <div
              v-if="item.dereferencedSchema?.description"
              class="schema-desc"
            >
              {{ item.dereferencedSchema?.description }}
            </div>
            <div
              v-if="item.changeType === 'modified'"
              class="schema-changes"
            >
              <div class="change-summary">
                <span v-if="item.propertiesAdded?.length" class="change-added"
                  >+{{ item.propertiesAdded.length }} added</span
                >
                <span
                  v-if="item.propertiesRemoved?.length"
                  class="change-removed"
                  >-{{ item.propertiesRemoved.length }} removed</span
                >
                <span
                  v-if="item.propertiesModified?.length"
                  class="change-modified"
                  >~{{ item.propertiesModified.length }} modified</span
                >
                <span v-if="item.typeChanged" class="change-modified"
                  >Type changed</span
                >
                <span v-if="item.requiredChanged" class="change-modified"
                  >Required changed</span
                >
              </div>
            </div>
          </div>
          <div
            v-if="item.dereferencedSchema?.properties"
            class="schema-properties"
          >
            <Button
              :icon="
                expandedSchemas[item.name]
                  ? 'pi pi-chevron-down'
                  : 'pi pi-chevron-right'
              "
              class="p-button-text p-button-sm expand-btn"
              aria-label="Toggle properties"
              @click="$emit('toggle-schema-expand', item.name)"
            />
            <span class="properties-count"
              >{{
                Object.keys(item.dereferencedSchema?.properties || {}).length
              }}
              properties</span
            >
            <div
              v-show="expandedSchemas[item.name]"
              class="properties-list"
            >
              <div
                v-for="(prop, propName) in item.dereferencedSchema.properties"
                :key="propName"
                class="property-item"
                :class="getPropertyChangeClass(item, propName)"
              >
                <div class="prop-left">
                  <code class="prop-name">{{ propName }}</code>
                  <span class="prop-type">{{ prop.type || "object" }}</span>
                  <Tag
                    v-if="
                      (item.dereferencedSchema?.required || []).includes(
                        propName
                      )
                    "
                    severity="danger"
                    size="small"
                    >Req</Tag
                  >
                </div>
                <div class="prop-right">
                  <span
                    v-if="getPropertyChangeType(item, propName)"
                    class="change-indicator"
                    >{{ getPropertyChangeType(item, propName) }}</span
                  >
                </div>
                <span v-if="prop.title" class="prop-title">{{
                  prop.title
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- non-detailed (inline mode) card body -->
        <div v-else class="card-details">
          <div
            v-if="
              item.changeType === 'added' || item.changeType === 'removed'
            "
            class="schema-preview"
          >
            <div
              v-if="
                item.dereferencedSchema?.title &&
                item.dereferencedSchema?.title !== item.name
              "
              class="schema-title"
            >
              {{ item.dereferencedSchema?.title }}
            </div>
            <div
              v-if="item.dereferencedSchema?.description"
              class="schema-desc"
            >
              {{ item.dereferencedSchema?.description }}
            </div>
            <div
              v-if="
                item.dereferencedSchema?.type &&
                item.dereferencedSchema?.type !== 'object'
              "
              class="schema-type"
            >
              Type: {{ item.dereferencedSchema?.type }}
            </div>
            <div
              v-if="item.dereferencedSchema?.properties"
              class="schema-properties"
            >
              <div
                v-for="(prop, propName) in item.dereferencedSchema.properties"
                :key="propName"
                class="property-item"
              >
                <div class="prop-left">
                  <code class="prop-name">{{ propName }}</code>
                  <span class="prop-type">{{ prop.type || "object" }}</span>
                  <Tag
                    v-if="
                      (item.dereferencedSchema?.required || []).includes(
                        propName
                      )
                    "
                    severity="danger"
                    size="small"
                    >Req</Tag
                  >
                </div>
                <span v-if="prop.title" class="prop-title">{{
                  prop.title
                }}</span>
              </div>
            </div>
            <div v-else>
              <pre
                class="mini-json"
              ><code>{{ prettyJSON(item.dereferencedSchema) }}</code></pre>
            </div>
          </div>
          <div v-else class="mini-section">
            <div class="mini-label">Schema reference</div>
            <pre
              class="mini-json"
            ><code>{{ prettyJSON({ "$ref": "#/components/schemas/" + item.name }) }}</code></pre>
          </div>
        </div>

        <div class="card-right">
          <div v-if="detailed" class="change-hints">
            <span v-if="item.changeType !== 'added'" class="hint"
              >{{ item.changeCount }} changes</span
            >
          </div>
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
import Tag from "primevue/tag";
import {
  cardKey,
  prettyJSON,
  getChangeSeverity,
  getPropertyChangeType,
  getPropertyChangeClass,
} from "../../utils/diffDisplay";

// The "Components/Schemas" diff section. DiffDrawer's inline and drawer
// modes rendered meaningfully different markup here (the drawer mode adds a
// change-type tag, a collapsible property list with per-property change
// indicators, and change-count hints) so both variants are preserved
// verbatim, gated by the `detailed` prop, rather than merged/guessed.
export default {
  name: "DiffSchemasSection",
  components: { Button, Tag },
  props: {
    schemas: {
      type: Array,
      default: () => [],
    },
    expanded: {
      type: Boolean,
      default: true,
    },
    expandedSchemas: {
      type: Object,
      default: () => ({}),
    },
    detailed: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-section", "toggle-schema-expand", "open-details"],
  setup() {
    return {
      cardKey,
      prettyJSON,
      getChangeSeverity,
      getPropertyChangeType,
      getPropertyChangeClass,
    };
  },
};
</script>
