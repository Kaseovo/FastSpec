<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="editingResponseCode ? 'Change Status Code' : 'Add Response'"
    :style="{ width: '560px' }"
    modal
    :draggable="false"
    @hide="$emit('reset')"
  >
    <div class="dialog-content">
      <!-- Step 1: category -->
      <div v-if="step === 1" class="form-field">
        <label>Category</label>
        <div class="status-category-grid">
          <button
            v-for="cat in statusCodeCategories"
            :key="cat.value"
            :class="[
              'status-category-btn',
              'status-category-btn--' + cat.value,
              { 'status-category-btn--active': category === cat.value },
            ]"
            @click="$emit('update:category', cat.value); $emit('update:step', 2)"
          >
            <span class="status-category-label">{{ cat.label }}</span>
            <span class="status-category-desc">{{ cat.description }}</span>
          </button>
          <button
            :class="[
              'status-category-btn',
              'status-category-btn--custom',
              { 'status-category-btn--active': category === 'custom' },
            ]"
            @click="$emit('update:category', 'custom'); $emit('update:step', 2)"
          >
            <span class="status-category-label">Custom</span>
            <span class="status-category-desc">Non-standard or wildcards (e.g. default, 4xx)</span>
          </button>
        </div>
      </div>

      <!-- Step 2: pick code from category -->
      <div v-if="step === 2">
        <div class="response-dialog-back">
          <Button icon="pi pi-arrow-left" label="Back" text size="small" @click="$emit('update:step', 1)" />
          <span class="response-dialog-category-title">{{
            statusCodeCategories.find((c) => c.value === category)?.label || "Custom"
          }}</span>
        </div>

        <!-- custom: free-text input -->
        <div v-if="category === 'custom'" class="form-field" style="margin-top: 12px">
          <label for="custom-status-code">Status Code</label>
          <InputText
            id="custom-status-code"
            :modelValue="newResponseCode"
            @update:modelValue="$emit('update:newResponseCode', $event)"
            placeholder="e.g. 418 or default"
            class="w-full"
          />
          <small class="helper-text">Enter a numeric code or "default"</small>
        </div>

        <!-- code list from category -->
        <div v-else class="status-code-list">
          <button
            v-for="entry in statusCodesForCategory(category)"
            :key="entry.code"
            :class="[
              'status-code-item',
              { 'status-code-item--active': newResponseCode === String(entry.code) },
              { 'status-code-item--used': isResponseCodeUsed(String(entry.code)) },
            ]"
            :disabled="isResponseCodeUsed(String(entry.code))"
            @click="!isResponseCodeUsed(String(entry.code)) && $emit('update:newResponseCode', String(entry.code))"
          >
            <Tag :value="String(entry.code)" :severity="getStatusSeverity(String(entry.code))" class="status-code-tag" />
            <div class="status-code-info">
              <span class="status-code-name">{{ entry.name }}</span>
              <span class="status-code-hint">{{
                isResponseCodeUsed(String(entry.code)) ? "Already added" : entry.hint
              }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false); $emit('reset')" />
      <Button
        v-if="step === 2"
        :label="editingResponseCode ? 'Change Code' : 'Add Response'"
        icon="pi pi-check"
        :disabled="!newResponseCode"
        @click="$emit('confirm')"
      />
    </template>
  </Dialog>
</template>

<script>
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";

// The two-step "Add/Edit Response Code" dialog (category → code), extracted
// verbatim from FormEditor.vue's trailing dialogs. FormEditor.vue keeps
// ownership of all the dialog-local refs (step/category/newResponseCode)
// and of confirmResponseDialog()/resetResponseDialog(), since committing a
// response code mutates the shared formData.
export default {
  name: "ResponseCodeDialog",
  components: { Dialog, Button, InputText, Tag },
  props: {
    visible: { type: Boolean, default: false },
    editingResponseCode: { type: String, default: "" },
    step: { type: Number, default: 1 },
    category: { type: String, default: "" },
    newResponseCode: { type: String, default: "" },
    statusCodeCategories: { type: Array, required: true },
    statusCodesForCategory: { type: Function, required: true },
    isResponseCodeUsed: { type: Function, required: true },
    getStatusSeverity: { type: Function, required: true },
  },
  emits: [
    "update:visible",
    "update:step",
    "update:category",
    "update:newResponseCode",
    "reset",
    "confirm",
  ],
};
</script>
