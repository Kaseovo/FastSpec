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
                                  <AutoComplete
                                    multiple
                                    typeahead
                                    v-model="formData.paths[selectedPath][selectedMethod].tags"
                                    :suggestions="globalTagNames"
                                    placeholder="Add tag and press Enter"
                                    @keydown.enter.prevent="addChipOnEnter($event, formData.paths[selectedPath][selectedMethod], 'tags')"
                                  />
                                </div>

                                <div class="form-field checkbox-field method-editor-deprecated">
                                  <Checkbox
                                    v-model="
                                      formData.paths[selectedPath][selectedMethod]
                                        .deprecated
                                    "
                                    inputId="deprecated"
                                    :binary="true"
                                  />
                                  <label for="deprecated">Deprecated</label>
                                </div>
                              </div>

                              <div class="form-field operation-security">
                                <label>Security</label>
                                <SelectButton
                                  :modelValue="operationSecurityMode(currentMethodData)"
                                  @update:modelValue="
                                    (mode) => mode && setOperationSecurityMode(currentMethodData, mode)
                                  "
                                  :options="[
                                    { label: 'Inherit global', value: 'inherit' },
                                    { label: 'Public (no auth)', value: 'public' },
                                    { label: 'Custom', value: 'custom' },
                                  ]"
                                  optionLabel="label"
                                  optionValue="value"
                                />
                                <SecurityRequirementList
                                  v-if="operationSecurityMode(currentMethodData) === 'custom'"
                                  :model-value="currentMethodData.security"
                                  @update:model-value="currentMethodData.security = $event"
                                  :schemes="availableSecuritySchemes"
                                  hint="Requirements for this operation only, replacing the global list above."
                                  empty-label="No requirements yet — add one below."
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
import AutoComplete from "primevue/autocomplete";
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
  components: { InputText, Textarea, Checkbox, AutoComplete, SelectButton, SecurityRequirementList },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    // See PathsTab.vue/ComponentsTab.vue for why this must be computed()
    // rather than a plain snapshot: `formData` loads asynchronously after
    // this component's first render, and a bare `props.formData` would
    // freeze the whole step on the pre-load default data forever.
    return {
      formData: computed(() => props.formData),
      ...props.api,
    };
  },
};
</script>
