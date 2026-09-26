<template>
                          <div class="operation-step">
                            <div class="operation-step__body">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Summary</label>
                                  <InputText
                                    v-model="
                                      formData.paths[selectedPath][selectedMethod]
                                        .summary
                                    "
                                    placeholder="Brief summary"
                                  />
                                </div>

                                <div class="form-field">
                                  <label>Operation ID</label>
                                  <InputText
                                    v-model="
                                      formData.paths[selectedPath][selectedMethod]
                                        .operationId
                                    "
                                    :class="{ 'p-invalid': isOperationIdDuplicate(selectedPath, selectedMethod) }"
                                    placeholder="operationId"
                                  />
                                  <small v-if="isOperationIdDuplicate(selectedPath, selectedMethod)" class="p-error">
                                    Already used by another operation — operationId must be unique across the whole document.
                                  </small>
                                </div>
                              </div>

                              <div class="form-field">
                                <label>Description</label>
                                <Textarea
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .description
                                  "
                                  rows="3"
                                  placeholder="Detailed description"
                                />
                              </div>

                              <div class="form-row">
                                <div class="form-field">
                                  <label>Tags</label>
                                  <div class="tags-select-row">
                                    <MultiSelect
                                      v-model="formData.paths[selectedPath][selectedMethod].tags"
                                      :options="existingTagNames"
                                      display="chip"
                                      filter
                                      :placeholder="existingTagNames.length ? 'Select tags' : 'No tags defined yet'"
                                      class="tags-select-row__select"
                                    />
                                    <Button
                                      v-tooltip.top="'Create a new tag'"
                                      icon="pi pi-plus"
                                      size="small"
                                      text
                                      rounded
                                      @click="openAddTagDialog"
                                    />
                                  </div>
                                  <small class="helper-text">
                                    Only tags defined in the Tags section can be assigned — create one there if it's missing.
                                  </small>
                                </div>

                                <div class="form-field checkbox-field method-editor-deprecated">
                                  <Checkbox
                                    v-model="
                                      formData.paths[selectedPath][selectedMethod]
                                        .deprecated
                                    "
                                    input-id="deprecated"
                                    :binary="true"
                                  />
                                  <label for="deprecated">Deprecated</label>
                                </div>
                              </div>

                              <div class="form-field operation-security">
                                <label>Security</label>
                                <SelectButton
                                  :model-value="operationSecurityMode(currentMethodData)"
                                  :options="[
                                    { label: 'Inherit global', value: 'inherit' },
                                    { label: 'Public (no auth)', value: 'public' },
                                    { label: 'Custom', value: 'custom' },
                                  ]"
                                  option-label="label"
                                  option-value="value"
                                  @update:model-value="
                                    (mode) => mode && setOperationSecurityMode(currentMethodData, mode)
                                  "
                                />
                                <SecurityRequirementList
                                  v-if="operationSecurityMode(currentMethodData) === 'custom'"
                                  :model-value="currentMethodData.security"
                                  :schemes="availableSecuritySchemes"
                                  hint="Requirements for this operation only, replacing the global list above."
                                  empty-label="No requirements yet — add one below."
                                  @update:model-value="currentMethodData.security = $event"
                                />
                              </div>
                            </div>
                          </div>
</template>

<script>
import { computed } from "vue";
import "../../assets/form-editor-shared.css";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import MultiSelect from "primevue/multiselect";
import Button from "primevue/button";
import SelectButton from "primevue/selectbutton";
import SecurityRequirementList from "./SecurityRequirementList.vue";

// One step ("Basic Info") of the operation editor — used both inline (the
// free-jump step panel in PathsTab.vue, for editing an existing operation)
// and inside AddPathDialog's create wizard (for the operation the wizard
// just created). Receives the same `formData`/`api` props PathsTab.vue
// itself receives — `api` is usePathsEditor()'s return value — so the
// template below, lifted verbatim out of PathsTab.vue, keeps working
// unchanged against the same bare identifiers.
export default {
  name: "OperationBasicInfoStep",
  components: { InputText, Textarea, Checkbox, MultiSelect, Button, SelectButton, SecurityRequirementList },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    // Tags can only be picked from what's already defined in the Tags
    // section — keeps every operation's tags referencing a real Tag object
    // (usage counts, external docs, etc. all key off matching names), same
    // reasoning as why removeTag warns about orphaning references instead
    // of just letting operations point at names that don't exist anywhere.
    const existingTagNames = computed(() =>
      (props.formData.tags || []).map((t) => t.name).filter(Boolean),
    );

    // The template reads `formData` straight from props, which stay reactive.
    // Don't return it from setup(): a copy here would shadow the prop and
    // freeze the editor on the data present at mount (before the spec loads).
    return {
      ...props.api,
      existingTagNames,
    };
  },
};
</script>
