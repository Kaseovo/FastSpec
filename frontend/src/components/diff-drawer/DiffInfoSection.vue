<template>
  <div v-if="infos.length" class="section-group endpoints-section">
    <div class="section-header">
      <h4>Info ({{ infos.length }})</h4>
      <Button
        icon="pi pi-angle-down"
        class="p-button-text"
        @click="$emit('toggle-section', 'info')"
      />
    </div>
    <div v-show="expanded" class="cards-grid">
      <div v-if="infos.length === 0" class="no-items">No info items</div>
      <div
        v-for="(item, idx) in infos"
        :key="cardKey(item, idx)"
        class="endpoint-card"
      >
        <!-- inline mode card-left -->
        <div v-if="!detailed" class="card-left">
          <Tag severity="info">{{ item.key }}</Tag>
          <div class="short">
            <template
              v-if="
                item.key === 'license' &&
                getFormattedValue(item.value) &&
                typeof getFormattedValue(item.value) === 'object'
              "
            >
              <span class="license-inline">
                <a
                  v-if="getFormattedValue(item.value).url"
                  :href="getFormattedValue(item.value).url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{
                    getFormattedValue(item.value).name ||
                    getFormattedValue(item.value).url
                  }}
                </a>
                <span v-else>{{ getFormattedValue(item.value).name }}</span>
                <span v-if="getFormattedValue(item.value).url" class="license-paren"
                  >({{ getFormattedValue(item.value).url }})</span
                >
              </span>
            </template>
            <template v-else>
              <template
                v-if="
                  getFormattedValue(
                    item.changeType === 'modified' ? item.newValue : item.value
                  ) &&
                  typeof getFormattedValue(
                    item.changeType === 'modified' ? item.newValue : item.value
                  ) === 'object'
                "
              >
                <span class="info-inline">
                  {{
                    getFormattedValue(
                      item.changeType === "modified"
                        ? item.newValue
                        : item.value
                    ).email ||
                    getFormattedValue(
                      item.changeType === "modified"
                        ? item.newValue
                        : item.value
                    ).name ||
                    getFormattedValue(
                      item.changeType === "modified"
                        ? item.newValue
                        : item.value
                    ).url ||
                    prettyJSON(
                      getFormattedValue(
                        item.changeType === "modified"
                          ? item.newValue
                          : item.value
                      )
                    )
                  }}
                </span>
              </template>
              <template v-else>
                {{
                  item.changeType === "modified" ? item.newValue : item.value
                }}
              </template>
            </template>
          </div>
        </div>

        <!-- detailed (drawer) mode card-left -->
        <div v-else class="card-left">
          <Tag v-if="item.key && item.changeType !== 'modified'" severity="info">{{
            item.key
          }}</Tag>
          <div class="short">
            <template
              v-if="
                getFormattedValue(
                  item.changeType === 'modified' ? item.oldValue : item.value
                ) &&
                typeof getFormattedValue(
                  item.changeType === 'modified' ? item.oldValue : item.value
                ) === 'object'
              "
            >
              {{
                getFormattedValue(
                  item.changeType === "modified" ? item.oldValue : item.value
                ).email ||
                getFormattedValue(
                  item.changeType === "modified" ? item.oldValue : item.value
                ).name ||
                getFormattedValue(
                  item.changeType === "modified" ? item.oldValue : item.value
                ).url ||
                prettyJSON(
                  getFormattedValue(
                    item.changeType === "modified"
                      ? item.oldValue
                      : item.value
                  )
                )
              }}
            </template>
            <template v-else>
              {{ item.changeType === "modified" ? item.oldValue : item.value }}
            </template>
          </div>
        </div>

        <!-- inline mode card-details -->
        <div v-if="!detailed" class="card-details">
          <div v-if="item.changeType === 'removed'">
            <div class="change-value removed">
              <template
                v-if="
                  getFormattedValue(item.value) &&
                  typeof getFormattedValue(item.value) === 'object'
                "
              >
              </template>
              <template v-else>
                <code>{{
                  truncate(
                    String(
                      (getFormattedValue(item.value) != null
                        ? getFormattedValue(item.value)
                        : item.value) || ""
                    ),
                    200
                  )
                }}</code>
              </template>
            </div>
          </div>
        </div>

        <!-- detailed mode card-details -->
        <div v-else class="card-details">
          <div v-if="item.changeType !== 'modified'" class="mini-section">
            <div class="mini-label">Value</div>
            <div v-if="item.changeType === 'added'" class="change-value added">
              <span class="label">Added:</span>
              <code>{{
                typeof getFormattedValue(item.value) === "object"
                  ? prettyJSON(getFormattedValue(item.value))
                  : item.value
              }}</code>
            </div>
            <div
              v-if="item.changeType === 'removed'"
              class="removed-block"
            >
              <div
                v-if="
                  getFormattedValue(item.value) &&
                  typeof getFormattedValue(item.value) === 'object'
                "
              ></div>
              <div v-else class="change-value removed">
                <code>{{
                  truncate(
                    String(
                      (getFormattedValue(item.value) != null
                        ? getFormattedValue(item.value)
                        : item.value) || ""
                    ),
                    200
                  )
                }}</code>
              </div>
            </div>
          </div>
          <div
            v-if="item.changeType === 'modified'"
            class="change-value modified"
          ></div>
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
import Tag from "primevue/tag";
import {
  cardKey,
  prettyJSON,
  truncate,
  getFormattedValue,
} from "../../utils/diffDisplay";

// The "Info" diff section. DiffDrawer's inline and drawer modes rendered
// meaningfully different markup here (inline shows the new/current value and
// special-cases "license"; drawer shows the old value and separate
// added/removed/modified value blocks), so both variants are preserved
// verbatim, gated by the `detailed` prop, rather than merged/guessed.
export default {
  name: "DiffInfoSection",
  components: { Button, Tag },
  props: {
    infos: {
      type: Array,
      default: () => [],
    },
    expanded: {
      type: Boolean,
      default: true,
    },
    detailed: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-section", "open-details"],
  setup() {
    return { cardKey, prettyJSON, truncate, getFormattedValue };
  },
};
</script>
