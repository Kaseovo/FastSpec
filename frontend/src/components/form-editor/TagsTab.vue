<template>
  <div class="form-section">
    <div class="section-header">
      <h4>Tags</h4>
      <Button
        label="Add Tag"
        icon="pi pi-plus"
        size="small"
        @click="$emit('add-tag')"
        :disabled="hasEmptyTagName || hasDuplicateTagName"
        v-tooltip.left="
          hasEmptyTagName
            ? 'Please fill in the name for all existing tags before adding a new one.'
            : hasDuplicateTagName
            ? 'Tag names must be unique. Please resolve duplicates first.'
            : ''
        "
      />
    </div>

    <div v-if="formData.tags.length === 0" class="empty-state">
      <i class="pi pi-tag"></i>
      <p>No tags defined. Add one to get started.</p>
    </div>

    <div v-for="(tag, index) in formData.tags" :key="index" class="list-item">
      <div class="list-item-content">
        <div class="form-field">
          <label class="required">Name</label>
          <InputText v-model="tag.name" placeholder="pet" />
        </div>
        <div class="form-field">
          <label>Description</label>
          <InputText v-model="tag.description" placeholder="Everything about your Pets" />
        </div>
        <div class="form-field">
          <div
            class="external-docs-toggle"
            @click="tag._showExternalDocs = !tag._showExternalDocs"
            style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem; color: var(--p-primary-color, #6366f1); font-size: 0.85rem; user-select: none;"
          >
            <i
              :class="tag._showExternalDocs ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
              style="font-size: 0.75rem;"
            ></i>
            <span>External Docs</span>
          </div>
          <div
            v-if="tag._showExternalDocs"
            class="external-docs-fields"
            style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"
          >
            <div class="form-field" style="margin-bottom: 0;">
              <label>Docs Description</label>
              <InputText v-model="tag.externalDocs.description" placeholder="Find out more" />
            </div>
            <div class="form-field" style="margin-bottom: 0;">
              <label>Docs URL</label>
              <InputText v-model="tag.externalDocs.url" placeholder="https://example.com" />
            </div>
          </div>
        </div>
      </div>
      <Button
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        @click="$emit('remove-tag', index)"
      />
    </div>
  </div>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";

// The "Tags" tab of FormEditor. Receives the whole reactive `formData`
// object (not a copy) as a prop and mutates `tag.*` fields directly on its
// array items — same mutation pattern used before this was extracted.
// Add/remove are emitted since they involve confirm/toast side effects that
// stay owned by FormEditor.vue.
export default {
  name: "TagsTab",
  components: { Button, InputText },
  props: {
    formData: {
      type: Object,
      required: true,
    },
    hasEmptyTagName: {
      type: Boolean,
      default: false,
    },
    hasDuplicateTagName: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["add-tag", "remove-tag"],
};
</script>
