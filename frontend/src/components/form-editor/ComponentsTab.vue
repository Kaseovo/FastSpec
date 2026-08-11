<template>
            <div class="form-section">
              <div class="section-header">
                <h4>Component Schemas</h4>
                <Button
                  label="Add Schema"
                  icon="pi pi-plus"
                  size="small"
                  @click="openAddSchemaDialog"
                />
              </div>

              <div v-if="schemasList.length === 0" class="empty-state">
                <i class="pi pi-box"></i>
                <p>No schemas defined. Add one to get started.</p>
              </div>

              <div v-else class="filter-bar">
                <IconField class="filter-bar__search">
                  <InputIcon class="pi pi-search" />
                  <InputText
                    v-model="schemaSearchQuery"
                    placeholder="Search schema or property names…"
                    class="w-full"
                  />
                </IconField>
                <Button
                  v-if="hasActiveSchemaFilter"
                  label="Clear"
                  icon="pi pi-times"
                  size="small"
                  text
                  @click="clearSchemaFilter"
                />
              </div>

              <div
                v-if="schemasList.length > 0 && filteredSchemasList.length === 0"
                class="empty-state-small"
              >
                <p>No schemas match your search.</p>
              </div>

              <div v-if="filteredSchemasList.length > 0" class="schema-summary-list">
                <div
                  v-for="schema in filteredSchemasList"
                  :key="schema.name"
                  class="param-item"
                >
                  <div class="item-row-header" @click="openEditSchemaDialog(schema.name)">
                    <span class="item-row-name">{{ schema.name }}</span>
                    <div class="item-row-badges">
                      <Tag :value="getSchemaKind(schema.data)" severity="info" />
                      <span v-if="getSchemaKind(schema.data) === 'object' && schema.data.properties" class="section-header__count">
                        {{ Object.keys(schema.data.properties).length }} propert{{ Object.keys(schema.data.properties).length === 1 ? 'y' : 'ies' }}
                      </span>
                    </div>
                    <Button
                      icon="pi pi-pencil"
                      text
                      rounded
                      size="small"
                      class="item-row-edit"
                      @click.stop="openEditSchemaDialog(schema.name)"
                    />
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      size="small"
                      class="item-row-delete"
                      @click.stop="removeSchema(schema.name)"
                    />
                  </div>
                </div>
              </div>

              <!-- ── Reusable Parameters ── -->
              <div class="components-subsection">
                <div class="section-header">
                  <button class="section-header__toggle" @click="reusableParamsCollapsed = !reusableParamsCollapsed">
                    <i
                      class="pi pi-chevron-right method-section-caret"
                      :class="{ 'method-section-caret--open': !reusableParamsCollapsed }"
                    ></i>
                    <h4>Reusable Parameters</h4>
                    <span v-if="parametersList.length" class="section-header__count">{{ parametersList.length }}</span>
                  </button>
                  <Button
                    label="Add Parameter"
                    icon="pi pi-plus"
                    size="small"
                    @click="reusableParamsCollapsed = false; addReusableParameter()"
                  />
                </div>

                <div v-show="!reusableParamsCollapsed">
                <div v-if="parametersList.length === 0" class="empty-state-small">
                  <p>No reusable parameters yet. Define one here to reference it from any operation's Parameters tab.</p>
                </div>

                <Accordion v-if="parametersList.length > 0">
                  <AccordionPanel
                    v-for="(parameter, index) in parametersList"
                    :key="parameter.name"
                    :value="index.toString()"
                  >
                    <AccordionHeader>
                      <div class="schema-header">
                        <span class="schema-name">{{ parameter.name }}</span>
                        <Tag :value="parameter.data.in" severity="info" />
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          @click.stop="removeReusableParameter(parameter.name)"
                        />
                      </div>
                    </AccordionHeader>
                    <AccordionContent>
                      <div class="form-row">
                        <div class="form-field">
                          <label class="required">Component Name</label>
                          <InputText
                            :value="parameter.name"
                            @input="renameReusableParameter(parameter.name, $event.target.value)"
                            placeholder="e.g. PageOffset"
                          />
                        </div>
                        <div class="form-field">
                          <label class="required">Parameter Name</label>
                          <InputText v-model="parameter.data.name" placeholder="offset" />
                        </div>
                      </div>
                      <div class="form-row">
                        <div class="form-field">
                          <label class="required">Location</label>
                          <Select
                            v-model="parameter.data.in"
                            :options="['query', 'header', 'cookie']"
                          />
                        </div>
                        <div class="form-field">
                          <label class="required">Type</label>
                          <Select
                            v-model="parameter.data.schema.type"
                            :options="['string', 'number', 'integer', 'boolean', 'array']"
                            @change="onReusableParameterTypeChange(parameter)"
                          />
                        </div>
                      </div>
                      <div
                        v-if="parameter.data.schema.type === 'array'"
                        class="form-field"
                      >
                        <label>Item Type</label>
                        <Select
                          :modelValue="parameter.data.schema.items?.type || 'string'"
                          @update:modelValue="parameter.data.schema.items = { type: $event }"
                          :options="['string', 'number', 'integer', 'boolean']"
                        />
                      </div>
                      <div class="form-field">
                        <label>Description</label>
                        <Textarea v-model="parameter.data.description" rows="2" />
                      </div>
                      <div class="form-field checkbox-field">
                        <Checkbox
                          v-model="parameter.data.required"
                          :inputId="'reusable-param-required-' + parameter.name"
                          :binary="true"
                        />
                        <label :for="'reusable-param-required-' + parameter.name">Required</label>
                      </div>
                    </AccordionContent>
                  </AccordionPanel>
                </Accordion>
                </div>
              </div>

              <!-- ── Reusable Responses ── -->
              <div class="components-subsection">
                <div class="section-header">
                  <button class="section-header__toggle" @click="reusableResponsesCollapsed = !reusableResponsesCollapsed">
                    <i
                      class="pi pi-chevron-right method-section-caret"
                      :class="{ 'method-section-caret--open': !reusableResponsesCollapsed }"
                    ></i>
                    <h4>Reusable Responses</h4>
                    <span v-if="responsesList.length" class="section-header__count">{{ responsesList.length }}</span>
                  </button>
                  <Button
                    label="Add Response"
                    icon="pi pi-plus"
                    size="small"
                    @click="reusableResponsesCollapsed = false; addReusableResponse()"
                  />
                </div>

                <div v-show="!reusableResponsesCollapsed">
                <div v-if="responsesList.length === 0" class="empty-state-small">
                  <p>No reusable responses yet. Define one here to reference it from any operation's Responses tab.</p>
                </div>

                <Accordion v-if="responsesList.length > 0">
                  <AccordionPanel
                    v-for="(response, index) in responsesList"
                    :key="response.name"
                    :value="index.toString()"
                  >
                    <AccordionHeader>
                      <div class="schema-header">
                        <span class="schema-name">{{ response.name }}</span>
                        <span
                          :class="{ 'response-header__missing-desc': !response.data.description || !response.data.description.trim() }"
                        >
                          {{ response.data.description || "Description required" }}
                        </span>
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          @click.stop="removeReusableResponse(response.name)"
                        />
                      </div>
                    </AccordionHeader>
                    <AccordionContent>
                      <div class="form-field">
                        <label class="required">Component Name</label>
                        <InputText
                          :value="response.name"
                          @input="renameReusableResponse(response.name, $event.target.value)"
                          placeholder="e.g. NotFoundError"
                        />
                      </div>
                      <div class="form-field">
                        <label class="required">Description</label>
                        <Textarea
                          v-model="response.data.description"
                          rows="2"
                          placeholder="Response description"
                          :class="{ 'p-invalid': !response.data.description || !response.data.description.trim() }"
                        />
                      </div>

                      <div class="form-field checkbox-field">
                        <Checkbox
                          :modelValue="!!getResponseContentType(response.data)"
                          @update:modelValue="setResponseContentType(response.data, $event ? 'application/json' : '')"
                          :inputId="'reusable-response-has-body-' + response.name"
                          :binary="true"
                        />
                        <label :for="'reusable-response-has-body-' + response.name">Has a response body</label>
                      </div>

                      <template v-if="getResponseContentType(response.data)">
                        <div class="form-field">
                          <label>Content Type</label>
                          <InputText
                            :modelValue="getResponseContentType(response.data)"
                            @update:modelValue="setResponseContentType(response.data, $event)"
                            placeholder="application/json"
                          />
                        </div>
                        <div class="form-field">
                          <label>Schema</label>
                          <Select
                            :modelValue="getResponseSchemaType(response.data)"
                            @update:modelValue="setResponseSchemaType(response.data, $event)"
                            :options="[
                              { label: 'Inline object', value: 'inline' },
                              { label: 'Reference to a schema', value: 'reference' },
                            ]"
                            optionLabel="label"
                            optionValue="value"
                          />
                        </div>

                        <div v-if="getResponseSchemaType(response.data) === 'reference'" class="form-field">
                          <label>Schema Reference</label>
                          <Select
                            :modelValue="getResponseSchemaRef(response.data)"
                            @update:modelValue="setResponseSchemaRef(response.data, $event)"
                            :options="availableSchemas"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Select a schema"
                          />
                        </div>

                        <template v-else>
                          <div class="section-header">
                            <h5>Properties</h5>
                            <Button
                              label="Add Property"
                              icon="pi pi-plus"
                              size="small"
                              @click="addResponseProperty(response.data)"
                            />
                          </div>
                          <div
                            v-if="Object.keys(getResponseInlineSchema(response.data).properties || {}).length === 0"
                            class="empty-state-small"
                          >
                            <p>No properties defined</p>
                          </div>
                          <div
                            v-for="(propSchema, propName) in getResponseInlineSchema(response.data).properties"
                            :key="propName"
                            class="list-item"
                          >
                            <div class="list-item-content">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Name</label>
                                  <InputText
                                    :value="propName"
                                    @input="renameResponseProperty(response.data, propName, $event.target.value)"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Type</label>
                                  <Select
                                    v-model="propSchema.type"
                                    :options="['string', 'number', 'integer', 'boolean', 'array', 'object']"
                                  />
                                </div>
                              </div>
                            </div>
                            <Button
                              icon="pi pi-trash"
                              severity="danger"
                              text
                              rounded
                              @click="removeResponseProperty(response.data, propName)"
                            />
                          </div>
                        </template>
                      </template>
                    </AccordionContent>
                  </AccordionPanel>
                </Accordion>
                </div>
              </div>
            </div>
</template>

<script>
import { ref, computed } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

// The "Components / schemas" tab of FormEditor. Receives the whole reactive
// `formData` object as one mutable prop plus an `api` bundle (the return value
// of useComponentsEditor() instantiated once in FormEditor). Re-exposing the
// bundle from setup() keeps the moved template's bare identifiers working.
// Schemas themselves are edited via EditSchemaDialog.vue (opened through
// api.openEditSchemaDialog/openAddSchemaDialog) — this tab only renders their
// summary rows, same split as OperationParametersStep.vue/
// EditParameterDialog.vue. Reusable Parameters/Responses below keep their
// original inline Accordion editing (out of scope for this pass).
export default {
  name: "ComponentsTab",
  components: {
    Button,
    InputText,
    Textarea,
    Select,
    Checkbox,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Tag,
    IconField,
    InputIcon,
  },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    // Page-level sections — one instance each, so plain booleans.
    const reusableParamsCollapsed = ref(false);
    const reusableResponsesCollapsed = ref(false);

    // The Item Type select below only fires when the user explicitly picks
    // a value; its :modelValue="... || 'string'" fallback is display-only,
    // so switching Type to "array" and never touching Item Type left
    // schema.items entirely unset, exporting an invalid `{type: "array"}`
    // with no items. Seed a default eagerly on Type change instead of
    // relying on the display fallback to double as real state.
    const onReusableParameterTypeChange = (parameter) => {
      const schema = parameter.data.schema;
      if (schema.type === "array" && !schema.items) {
        schema.items = { type: "string" };
      }
    };

    // A plain `props.formData` snapshot only captures whatever the prop was
    // AT MOUNT TIME — it never updates when the parent later swaps in the
    // real spec (loaded asynchronously after this component's first
    // render), permanently freezing the whole schema editor on blank
    // default data (same bug fixed in PathsTab.vue). `computed()` re-reads
    // the prop on every access instead, and gets auto-unwrapped by Vue
    // since it's a top-level key in this returned object.
    return {
      formData: computed(() => props.formData),
      ...props.api,
      onReusableParameterTypeChange,
      reusableParamsCollapsed,
      reusableResponsesCollapsed,
    };
  },
};
</script>
