<template>
            <div class="form-section">
              <div class="section-header">
                <h4>API Paths</h4>
                <Button
                  label="Add Path"
                  icon="pi pi-plus"
                  size="small"
                  @click="showAddPathDialog = true"
                />
              </div>

              <div v-if="pathsList.length === 0" class="empty-state">
                <i class="pi pi-sitemap"></i>
                <p>No paths defined. Add one to get started.</p>
              </div>

              <div v-else class="filter-bar">
                <IconField class="filter-bar__search">
                  <InputIcon class="pi pi-search" />
                  <InputText
                    v-model="pathSearchQuery"
                    placeholder="Search paths, summaries, operationIds, tags…"
                    class="w-full"
                  />
                </IconField>
                <div class="filter-bar__methods">
                  <button
                    v-for="method in httpMethods"
                    :key="method"
                    type="button"
                    :class="[
                      'method-filter-chip',
                      'method-' + method,
                      { 'method-filter-chip--active': pathMethodFilter.includes(method.toUpperCase()) },
                    ]"
                    @click="togglePathMethodFilter(method)"
                  >
                    {{ method.toUpperCase() }}
                  </button>
                </div>
                <Button
                  v-if="hasActivePathFilter"
                  label="Clear"
                  icon="pi pi-times"
                  size="small"
                  text
                  @click="clearPathFilters"
                />
              </div>

              <div
                v-if="pathsList.length > 0 && filteredPathsList.length === 0"
                class="empty-state-small"
              >
                <p>No paths match your search.</p>
              </div>

              <Accordion v-if="pathsList.length > 0" :multiple="true" :value="openPaths" @update:value="openPaths = $event">
                <AccordionPanel
                  v-for="(pathItem, index) in pathsList"
                  v-show="visiblePathSet.has(pathItem.path)"
                  :key="index"
                  :value="index.toString()"
                  :draggable="!hasActivePathFilter"
                  v-tooltip.top="hasActivePathFilter ? 'Clear filters to reorder paths' : null"
                  @dragstart="handlePathDragStart($event, pathItem.path, index)"
                  @dragover="handleDragOver($event)"
                  @drop="handlePathDrop($event, index)"
                  @dragend="handleDragEnd"
                  :class="{ 'dragging-path': draggedPath === pathItem.path }"
                >
                  <AccordionHeader @click="selectFirstMethod(pathItem)">
                    <div class="path-header">
                      <div class="drag-handle" title="Drag to reorder">
                        <i class="pi pi-bars"></i>
                      </div>
                      <div class="path-header-chips">
                        <button
                          v-for="(method, methodIndex) in pathItem.methods"
                          :key="method"
                          :class="[
                            'path-method-chip',
                            {
                              'path-method-chip--active':
                                selectedPath === pathItem.path &&
                                selectedMethod === method,
                            },
                          ]"
                          draggable="true"
                          v-tooltip.top="'Drag to reorder'"
                          @dragstart="
                            handleMethodDragStart(
                              $event,
                              pathItem.path,
                              method,
                              methodIndex
                            )
                          "
                          @dragover="handleDragOver($event)"
                          @drop="
                            handleMethodDrop($event, pathItem.path, methodIndex)
                          "
                          @dragend="handleDragEnd"
                          @click.stop="selectAndOpenPath(pathItem.path, method)"
                        >
                          <span :class="['method-chip', 'method-' + method.toLowerCase()]">
                            {{ method.toUpperCase() }}
                          </span>
                          <span
                            class="chip-delete-btn"
                            @click.stop="removeMethod(pathItem.path, method)"
                            v-tooltip.top="'Remove ' + method.toUpperCase()"
                          >
                            <i class="pi pi-times"></i>
                          </span>
                        </button>
                      </div>
                      <span class="path-url" @click.stop="selectFirstMethod(pathItem)">{{ pathItem.path }}</span>
                      <Button
                        icon="pi pi-pencil"
                        size="small"
                        text
                        rounded
                        class="path-edit-btn"
                        v-tooltip.top="'Edit path'"
                        @click.stop="editPath(pathItem.path)"
                      />
                      <Button
                        icon="pi pi-plus"
                        size="small"
                        text
                        rounded
                        class="path-add-method-btn"
                        v-tooltip.top="'Add method'"
                        @click.stop="showAddMethodDialog(pathItem.path)"
                      />
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        size="small"
                        class="path-delete-btn"
                        @click.stop="removePath(pathItem.path)"
                      />
                    </div>
                  </AccordionHeader>
                  <AccordionContent>
                    <div :class="['path-methods-editor', { 'path-methods-editor--active': selectedPath === pathItem.path && selectedMethod }]">
                      <div
                        v-if="selectedPath === pathItem.path && selectedMethod && formData.paths[selectedPath]?.[selectedMethod]"
                        class="method-editor"
                      >
                        <OperationStepNav v-model="activeOperationStep" :steps="operationSteps" />
                        <OperationBasicInfoStep v-if="activeOperationStep === 'basicInfo'" :form-data="formData" :api="api" />
                        <OperationParametersStep v-else-if="activeOperationStep === 'parameters'" :form-data="formData" :api="api" />
                        <OperationRequestBodyStep v-else-if="activeOperationStep === 'requestBody'" :form-data="formData" :api="api" />
                        <OperationResponsesStep v-else :form-data="formData" :api="api" />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import OperationStepNav from "./OperationStepNav.vue";
import OperationBasicInfoStep from "./OperationBasicInfoStep.vue";
import OperationParametersStep from "./OperationParametersStep.vue";
import OperationRequestBodyStep from "./OperationRequestBodyStep.vue";
import OperationResponsesStep from "./OperationResponsesStep.vue";

// The "Paths" tab of FormEditor. Receives the whole reactive `formData` object
// as one mutable prop (nested mutation is safe) plus an `api` bundle — the
// return value of usePathsEditor() instantiated once in FormEditor — carrying
// this tab's UI state (refs), computed lists and handlers. Re-exposing them
// from setup() lets the moved template keep using bare names unchanged; the
// refs stay the same instances FormEditor binds its dialogs to.
export default {
  name: "PathsTab",
  components: {
    Button,
    InputText,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    IconField,
    InputIcon,
    OperationStepNav,
    OperationBasicInfoStep,
    OperationParametersStep,
    OperationRequestBodyStep,
    OperationResponsesStep,
  },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    // Which step of the operation editor is showing. Free-jump (see
    // OperationStepNav) rather than a locked Next/Back sequence — editing an
    // existing operation is usually "fix one thing", not "walk through
    // Basic Info, Parameters, Request Body and Responses in order" every
    // time. Resets to Basic Info whenever the selected path/method changes,
    // so switching operations doesn't strand you on a step ("Responses")
    // that seems oddly picked for the new one.
    const activeOperationStep = ref("basicInfo");
    watch([() => props.api.selectedPath.value, () => props.api.selectedMethod.value], () => {
      activeOperationStep.value = "basicInfo";
    });

    const operationSteps = computed(() => {
      const method = props.api.currentMethodData.value;
      return [
        { key: "basicInfo", label: "Basic Info" },
        { key: "parameters", label: "Parameters", count: method.parameters?.length || 0 },
        { key: "requestBody", label: "Request Body" },
        {
          key: "responses",
          label: "Responses",
          count: method.responses ? Object.keys(method.responses).length : 0,
        },
      ];
    });

    return {
      // A plain `props.formData` snapshot only captures whatever the prop
      // was AT MOUNT TIME — it never updates when the parent later swaps
      // in the real spec (loaded asynchronously after this component's
      // first render), permanently freezing the whole method editor on
      // blank default data. `computed()` re-reads the prop on every
      // access instead, and — like `formData` itself — gets auto-unwrapped
      // by Vue since it's a top-level key in this returned object.
      formData: computed(() => props.formData),
      ...props.api,
      // The flattened spread above is what the rest of this template (path
      // list, accordion headers, etc.) uses. The four step components need
      // the whole bundle back together, though — same `api` prop contract
      // PathsTab itself receives from FormEditor.vue — so it's exposed
      // here too under its own name for the OperationXStep tags below.
      api: props.api,
      activeOperationStep,
      operationSteps,
    };
  },
};
</script>
