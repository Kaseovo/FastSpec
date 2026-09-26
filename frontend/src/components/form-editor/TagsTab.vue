<template>
  <div class="form-section">
    <div class="section-header">
      <h4>Tags</h4>
      <Button label="Add Tag" icon="pi pi-plus" size="small" @click="$emit('add-tag')" />
    </div>

    <div v-if="formData.tags.length === 0" class="empty-state">
      <i class="pi pi-tag"></i>
      <p>No tags defined. Add one to get started.</p>
    </div>

    <div v-for="(tag, index) in formData.tags" :key="index" class="tag-row-wrap">
      <div class="tag-row" @click="toggleExpanded(index)">
        <i
          class="pi pi-chevron-right item-row-caret"
          :class="{ 'item-row-caret--open': isExpanded(index) }"
        ></i>
        <span class="tag-row__name" :class="{ 'tag-row__name--empty': !tag.name }">
          {{ tag.name || "Untitled tag" }}
        </span>
        <span
          v-if="usageCount(tag.name) > 0"
          v-tooltip.top="
            'Referenced by ' + usageCount(tag.name) + ' operation' + (usageCount(tag.name) === 1 ? '' : 's')
          "
          class="section-header__count"
          >{{ usageCount(tag.name) }} {{ usageCount(tag.name) === 1 ? "operation" : "operations" }}</span
        >
        <span v-else v-tooltip.top="'No operation currently uses this tag'" class="tag-unused-badge">Unused</span>
        <span class="tag-row__desc">{{ tag.description }}</span>
        <div class="tag-row__actions">
          <Button
            v-tooltip.top="'Edit tag'"
            icon="pi pi-pencil"
            size="small"
            text
            rounded
            class="tag-row__edit-btn"
            @click.stop="$emit('edit-tag', index)"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            size="small"
            @click.stop="$emit('remove-tag', index)"
          />
        </div>
      </div>

      <div v-show="isExpanded(index)" class="item-row-body tag-row__body">
        <div class="tag-row__section">
          <h6 class="tag-row__section-title">External Docs</h6>
          <a
            v-if="tag.externalDocs && tag.externalDocs.url"
            :href="tag.externalDocs.url"
            target="_blank"
            rel="noopener noreferrer"
            class="tag-row__doc-link"
            @click.stop
          >
            <i class="pi pi-external-link"></i>
            {{ tag.externalDocs.description || tag.externalDocs.url }}
          </a>
          <p v-else class="tag-row__empty-hint">
            No external docs — click <i class="pi pi-pencil"></i> to add some.
          </p>
        </div>

        <div class="tag-row__section">
          <h6 class="tag-row__section-title">Used by</h6>
          <div v-if="operationsForTag(tag.name).length === 0" class="tag-row__empty-hint">
            Not used by any operation yet.
          </div>
          <button
            v-for="op in operationsForTag(tag.name)"
            :key="op.path + op.method"
            class="tag-row__op"
            @click.stop="$emit('open-operation', op.path, op.method)"
          >
            <span class="path-method-chip tag-row__op-chip">
              <span :class="['method-chip', 'method-' + op.method]">{{ op.method.toUpperCase() }}</span>
            </span>
            <span class="tag-row__op-path">{{ op.path }}</span>
            <span v-if="op.summary" class="tag-row__op-summary">{{ op.summary }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";

// The "Tags" tab of FormEditor: a compact, click-to-expand list (same
// pattern as the Paths list). Clicking a row reveals its external docs link
// and the operations that reference it, in place — actual field editing
// still happens in AddTagDialog's wizard, opened via the pencil icon.
// FormEditor.vue keeps ownership of formData and of the
// add-tag/edit-tag/remove-tag/open-operation handlers: add/remove involve
// confirm/toast side effects, add/edit open the shared wizard dialog, and
// open-operation switches to the Paths tab and opens that operation there.
export default {
  name: "TagsTab",
  components: { Button },
  props: {
    formData: {
      type: Object,
      required: true,
    },
    tagUsageCounts: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["add-tag", "edit-tag", "remove-tag", "open-operation"],
  setup() {
    const expanded = ref({});
    const isExpanded = (index) => !!expanded.value[index];
    const toggleExpanded = (index) => {
      expanded.value[index] = !expanded.value[index];
    };
    return { isExpanded, toggleExpanded };
  },
  methods: {
    usageCount(name) {
      return this.tagUsageCounts[(name || "").trim()] || 0;
    },
    operationsForTag(name) {
      const tagName = (name || "").trim();
      if (!tagName) return [];
      const results = [];
      for (const [path, methods] of Object.entries(this.formData.paths || {})) {
        for (const [method, operation] of Object.entries(methods)) {
          if ((operation?.tags || []).includes(tagName)) {
            results.push({ path, method, summary: operation.summary || "" });
          }
        }
      }
      return results;
    },
  },
};
</script>
