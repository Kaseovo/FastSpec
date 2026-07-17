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
                            { 'dragging-method': draggedMethod === method },
                          ]"
                          draggable="true"
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
                        label="Add Method"
                        size="small"
                        text
                        class="path-add-method-btn"
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
                        v-if="selectedPath === pathItem.path && selectedMethod"
                        class="method-editor"
                      >
                        <div class="method-editor-sections">
                          <!-- Basic Info: flattened into always-visible scrollable
                               sections (used to be nested Tabs) so editing an
                               operation doesn't require clicking between four
                               tabs on top of the path accordion above it. -->
                          <div class="method-editor-section">
                            <div class="section-header">
                              <h5>Basic Info</h5>
                            </div>
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

                              <div class="form-field">
                                <label>Operation ID</label>
                                <InputText
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .operationId
                                  "
                                  placeholder="operationId"
                                />
                              </div>

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

                              <div class="form-field checkbox-field">
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

                          <div class="method-editor-section">
                              <div class="section-header">
                                <h5>Parameters</h5>
                                <Button
                                  label="Add Parameter"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="
                                    addParameter(selectedPath, selectedMethod)
                                  "
                                />
                              </div>

                              <div
                                v-if="
                                  !currentMethodData.parameters ||
                                  currentMethodData.parameters.length === 0
                                "
                                class="empty-state-small"
                              >
                                <p>No parameters defined</p>
                              </div>

                              <div
                                v-for="(
                                  param, pIndex
                                ) in currentMethodData.parameters"
                                :key="pIndex"
                                :class="['param-item', { 'param-item--path': param.in === 'path' }]"
                              >
                                <!-- Path parameter lock banner -->
                                <div v-if="param.in === 'path'" class="path-param-banner">
                                  <i class="pi pi-lock"></i>
                                  <span>Path parameter — edit the path template to rename or remove</span>
                                </div>
                                <div class="param-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label class="required">Name</label>
                                      <InputText
                                        v-model="param.name"
                                        placeholder="id"
                                        :disabled="param.in === 'path'"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label class="required">Location</label>
                                      <Select
                                        v-model="param.in"
                                        :options="[
                                          'query',
                                          'header',
                                          'cookie',
                                        ]"
                                        placeholder="Select location"
                                        :disabled="param.in === 'path'"
                                      />
                                    </div>
                                  </div>
                                  <div class="form-field">
                                    <label>Description</label>
                                    <InputText
                                      v-model="param.description"
                                      placeholder="Parameter description"
                                    />
                                  </div>
                                  <div class="form-field">
                                    <label class="required">Type</label>
                                    <Select
                                      v-model="param.schema.type"
                                      :options="[
                                        'string',
                                        'number',
                                        'integer',
                                        'boolean',
                                        'array',
                                        'object',
                                      ]"
                                      placeholder="Type"
                                      @change="onPropertyTypeChange(param.schema)"
                                    />
                                  </div>
                                  <template v-if="param.schema.type === 'array'">
                                      <div class="form-field">
                                        <label>Items Type(s)</label>
                                        <MultiSelect
                                          :modelValue="param.schema._itemSchemas ? [...new Set(param.schema._itemSchemas.map(s => s.type))] : []"
                                          :options="['string','number','integer','boolean','object']"
                                          placeholder="Select one or more types"
                                          display="chip"
                                          @update:modelValue="onItemTypesChange(param.schema, $event)"
                                        />
                                      </div>
                                      <!-- Per-type schema sections -->
                                      <div v-if="param.schema._itemSchemas && param.schema._itemSchemas.length > 0" class="item-schemas-list">
                                        <div
                                          v-for="(itemSchema, sIdx) in param.schema._itemSchemas"
                                          :key="sIdx"
                                          class="item-schema-entry"
                                        >
                                          <div class="item-schema-entry-header">
                                            <span :class="['type-badge', 'type-badge--' + itemSchema.type]">{{ itemSchema.type }}</span>
                                            <span v-if="itemSchema.type === 'object' && itemSchema.$ref" class="item-schema-ref-label">{{ itemSchema.$ref.split('/').pop() }}</span>
                                            <Button
                                              icon="pi pi-trash"
                                              severity="danger"
                                              text
                                              rounded
                                              size="small"
                                              class="item-schema-remove"
                                              v-tooltip.top="'Remove this type entry'"
                                              @click="param.schema._itemSchemas.splice(sIdx, 1)"
                                            />
                                          </div>
                                          <div class="item-schema-entry-body">
                                            <!-- object: $ref picker + add more objects -->
                                            <template v-if="itemSchema.type === 'object'">
                                              <div class="form-field">
                                                <label>Schema Reference</label>
                                                <div class="schema-selector">
                                                  <Select
                                                    v-model="itemSchema.$ref"
                                                    :options="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value))"
                                                    optionLabel="label"
                                                    optionValue="value"
                                                    :placeholder="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0 ? 'No schemas available' : 'Select schema'"
                                                    :disabled="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0"
                                                  />
                                                  <Button
                                                    label="New Schema"
                                                    icon="pi pi-plus"
                                                    size="small"
                                                    text
                                                    @click="addSchema"
                                                  />
                                                </div>
                                                <small
                                                  v-if="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0"
                                                  class="helper-text"
                                                >{{ availableSchemas.length === 0 ? 'No schemas yet — create one first.' : 'All schemas are already used — create a new one.' }}</small>
                                              </div>
                                              <Button
                                                v-if="sIdx === param.schema._itemSchemas.map((s,i) => s.type === 'object' ? i : -1).filter(i => i >= 0).slice(-1)[0]"
                                                label="Add another object schema"
                                                icon="pi pi-plus"
                                                size="small"
                                                text
                                                class="mt-1"
                                                @click="param.schema._itemSchemas.splice(sIdx + 1, 0, { type: 'object', $ref: '' })"
                                              />
                                            </template>
                                            <!-- string validations -->
                                            <template v-else-if="itemSchema.type === 'string'">
                                              <div class="form-row">
                                                <div class="form-field">
                                                  <label>Format</label>
                                                  <Select v-model="itemSchema.format" :options="['','date','date-time','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" />
                                                </div>
                                                <div class="form-field">
                                                  <label>Pattern</label>
                                                  <InputText v-model="itemSchema.pattern" placeholder="^[a-zA-Z0-9]+$" />
                                                </div>
                                              </div>
                                              <div class="form-row">
                                                <div class="form-field">
                                                  <label>Min Length</label>
                                                  <InputNumber v-model="itemSchema.minLength" placeholder="Min length" :min="0" />
                                                </div>
                                                <div class="form-field">
                                                  <label>Max Length</label>
                                                  <InputNumber v-model="itemSchema.maxLength" placeholder="Max length" :min="0" />
                                                </div>
                                              </div>
                                            </template>
                                            <!-- number / integer validations -->
                                            <template v-else-if="itemSchema.type === 'number' || itemSchema.type === 'integer'">
                                              <div class="form-row">
                                                <div class="form-field">
                                                  <label>Format</label>
                                                  <Select v-model="itemSchema.format" :options="itemSchema.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" />
                                                </div>
                                                <div class="form-field">
                                                  <label>Multiple Of</label>
                                                  <InputNumber v-model="itemSchema.multipleOf" placeholder="Multiple of" :min="0" />
                                                </div>
                                              </div>
                                              <div class="form-row">
                                                <div class="form-field">
                                                  <label>Minimum</label>
                                                  <InputNumber v-model="itemSchema.minimum" placeholder="Min value" />
                                                </div>
                                                <div class="form-field">
                                                  <label>Maximum</label>
                                                  <InputNumber v-model="itemSchema.maximum" placeholder="Max value" />
                                                </div>
                                              </div>
                                              <div class="form-row">
                                                <template v-if="isOpenAPI31">
                                                  <div class="form-field">
                                                    <label :for="'item-excl-min-' + pIndex + '-' + sIdx">Exclusive Minimum</label>
                                                    <InputNumber v-model="itemSchema.exclusiveMinimum" :inputId="'item-excl-min-' + pIndex + '-' + sIdx" placeholder="Exclusive min value" />
                                                  </div>
                                                  <div class="form-field">
                                                    <label :for="'item-excl-max-' + pIndex + '-' + sIdx">Exclusive Maximum</label>
                                                    <InputNumber v-model="itemSchema.exclusiveMaximum" :inputId="'item-excl-max-' + pIndex + '-' + sIdx" placeholder="Exclusive max value" />
                                                  </div>
                                                </template>
                                                <template v-else>
                                                  <div class="form-field checkbox-field">
                                                    <Checkbox v-model="itemSchema.exclusiveMinimum" :inputId="'item-excl-min-' + pIndex + '-' + sIdx" :binary="true" />
                                                    <label :for="'item-excl-min-' + pIndex + '-' + sIdx">Exclusive Minimum</label>
                                                  </div>
                                                  <div class="form-field checkbox-field">
                                                    <Checkbox v-model="itemSchema.exclusiveMaximum" :inputId="'item-excl-max-' + pIndex + '-' + sIdx" :binary="true" />
                                                    <label :for="'item-excl-max-' + pIndex + '-' + sIdx">Exclusive Maximum</label>
                                                  </div>
                                                </template>
                                              </div>
                                            </template>
                                            <!-- boolean: no constraints -->
                                            <template v-else-if="itemSchema.type === 'boolean'">
                                              <p class="helper-text">No additional constraints for boolean.</p>
                                            </template>
                                          </div>
                                        </div>
                                      </div>
                                    </template>

                                  <!-- String validations -->
                                  <div
                                    v-if="param.schema.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="param.schema.format"
                                        :options="[
                                          '',
                                          'date',
                                          'date-time',
                                          'email',
                                          'uri',
                                          'uuid',
                                          'hostname',
                                          'ipv4',
                                          'ipv6',
                                        ]"
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Pattern</label>
                                      <InputText
                                        v-model="param.schema.pattern"
                                        placeholder="^[a-zA-Z0-9]+$"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="param.schema.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Min Length</label>
                                      <InputNumber
                                        v-model="param.schema.minLength"
                                        placeholder="Min length"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Length</label>
                                      <InputNumber
                                        v-model="param.schema.maxLength"
                                        placeholder="Max length"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <!-- Number/Integer validations -->
                                  <div
                                    v-if="
                                      param.schema.type === 'number' ||
                                      param.schema.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Minimum</label>
                                      <InputNumber
                                        v-model="param.schema.minimum"
                                        placeholder="Min value"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Maximum</label>
                                      <InputNumber
                                        v-model="param.schema.maximum"
                                        placeholder="Max value"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      param.schema.type === 'number' ||
                                      param.schema.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="param.schema.format"
                                        :options="
                                          param.schema.type === 'integer'
                                            ? ['', 'int32', 'int64']
                                            : ['', 'float', 'double']
                                        "
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Multiple Of</label>
                                      <InputNumber
                                        v-model="param.schema.multipleOf"
                                        placeholder="Multiple of"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      param.schema.type === 'number' ||
                                      param.schema.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <template v-if="isOpenAPI31">
                                      <div class="form-field">
                                        <label :for="'param-excl-min-' + pIndex">Exclusive Minimum</label>
                                        <InputNumber
                                          v-model="param.schema.exclusiveMinimum"
                                          :inputId="'param-excl-min-' + pIndex"
                                          placeholder="Exclusive min value"
                                        />
                                      </div>
                                      <div class="form-field">
                                        <label :for="'param-excl-max-' + pIndex">Exclusive Maximum</label>
                                        <InputNumber
                                          v-model="param.schema.exclusiveMaximum"
                                          :inputId="'param-excl-max-' + pIndex"
                                          placeholder="Exclusive max value"
                                        />
                                      </div>
                                    </template>
                                    <template v-else>
                                      <div class="form-field checkbox-field">
                                        <Checkbox
                                          v-model="param.schema.exclusiveMinimum"
                                          :inputId="'param-excl-min-' + pIndex"
                                          :binary="true"
                                        />
                                        <label :for="'param-excl-min-' + pIndex"
                                          >Exclusive Minimum</label
                                        >
                                      </div>
                                      <div class="form-field checkbox-field">
                                        <Checkbox
                                          v-model="param.schema.exclusiveMaximum"
                                          :inputId="'param-excl-max-' + pIndex"
                                          :binary="true"
                                        />
                                        <label :for="'param-excl-max-' + pIndex"
                                          >Exclusive Maximum</label
                                        >
                                      </div>
                                    </template>
                                  </div>

                                  <!-- Array validations -->
                                  <div
                                    v-if="param.schema.type === 'array'"
                                    class="form-row"
                                    style="margin-top: 0.75rem;"
                                  >
                                    <div class="form-field">
                                      <label>Min Items</label>
                                      <InputNumber
                                        v-model="param.schema.minItems"
                                        placeholder="Min items"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Items</label>
                                      <InputNumber
                                        v-model="param.schema.maxItems"
                                        placeholder="Max items"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="param.schema.type === 'array'"
                                    class="form-field checkbox-field"
                                  >
                                    <Checkbox
                                      v-model="param.schema.uniqueItems"
                                      :inputId="'param-unique-' + pIndex"
                                      :binary="true"
                                    />
                                    <label :for="'param-unique-' + pIndex"
                                      >Unique Items</label
                                    >
                                  </div>

                                  <!-- Enum values -->
                                  <div
                                    class="form-field"
                                    v-if="param.schema.type !== 'object'"
                                  >
                                    <label>Enum Values (optional)</label>
                                    <AutoComplete
                                      multiple
                                      typeahead
                                      v-model="param.schema.enum"
                                      placeholder="Add enum value and press Enter"
                                      @keydown.enter.prevent="addChipOnEnter($event, param.schema, 'enum')"
                                    />
                                  </div>

                                  <div class="form-field">
                                    <label>Default Value</label>
                                    <InputText
                                      v-model="param.schema.default"
                                      placeholder="Default value"
                                    />
                                  </div>

                                  <div class="form-field">
                                    <label>Example</label>
                                    <InputText
                                      v-model="param.schema.example"
                                      placeholder="Example value"
                                    />
                                  </div>

                                  <div class="form-row">
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        v-model="param.required"
                                        :inputId="'param-required-' + pIndex"
                                        :binary="true"
                                      />
                                      <label :for="'param-required-' + pIndex"
                                        >Required</label
                                      >
                                    </div>
                                    <div class="form-field checkbox-field">
                                      <template v-if="isOpenAPI31">
                                        <Checkbox
                                          :modelValue="Array.isArray(param.schema.type) && param.schema.type.includes('null')"
                                          :inputId="'param-nullable-' + pIndex"
                                          :binary="true"
                                          @update:modelValue="val => {
                                            const base = Array.isArray(param.schema.type) ? param.schema.type.filter(t => t !== 'null') : [param.schema.type || 'string'];
                                            param.schema.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                          }"
                                        />
                                      </template>
                                      <template v-else>
                                        <Checkbox
                                          v-model="param.schema.nullable"
                                          :inputId="'param-nullable-' + pIndex"
                                          :binary="true"
                                        />
                                      </template>
                                      <label :for="'param-nullable-' + pIndex"
                                        >Nullable</label
                                      >
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  v-if="param.in !== 'path'"
                                  icon="pi pi-trash"
                                  severity="danger"
                                  text
                                  rounded
                                  @click="
                                    removeParameter(
                                      selectedPath,
                                      selectedMethod,
                                      pIndex
                                    )
                                  "
                                />
                              </div>
                          </div>

                          <div class="method-editor-section">
                              <div class="section-header">
                                <h5>Request Body</h5>
                                <div class="form-field checkbox-field">
                                  <Checkbox
                                    v-model="
                                      currentMethodData.requestBody.required
                                    "
                                    inputId="body-required"
                                    :binary="true"
                                  />
                                  <label for="body-required">Required</label>
                                </div>
                              </div>

                              <div class="form-field">
                                <label>Description</label>
                                <Textarea
                                  v-model="
                                    currentMethodData.requestBody.description
                                  "
                                  rows="2"
                                  placeholder="Request body description"
                                />
                              </div>

                              <div class="form-field">
                                <label>Content Type</label>
                                <Select
                                  v-model="requestBodyContentType"
                                  :options="[
                                    'application/json',
                                    'application/xml',
                                    'multipart/form-data',
                                    'application/x-www-form-urlencoded',
                                  ]"
                                  placeholder="Select content type"
                                />
                              </div>

                              <div
                                class="form-field"
                                v-if="requestBodyContentType"
                              >
                                <label>Schema</label>
                                <div class="schema-selector">
                                  <Select
                                    v-model="requestBodySchemaType"
                                    :options="['reference', 'inline']"
                                    placeholder="Schema type"
                                  />
                                  <template v-if="requestBodySchemaType === 'reference'">
                                    <Select
                                      v-model="requestBodySchemaRef"
                                      :options="availableSchemas"
                                      optionLabel="label"
                                      optionValue="value"
                                      :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                    />
                                    <Button
                                      label="New Schema"
                                      icon="pi pi-plus"
                                      size="small"
                                      text
                                      @click="addSchema"
                                    />
                                  </template>
                                </div>
                              </div>

                              <!-- Inline schema builder (replaces raw JSON textarea) -->
                              <template v-if="requestBodySchemaType === 'inline' && requestBodyContentType">
                                <div class="form-field">
                                  <label class="required">Type</label>
                                  <Select
                                    v-model="requestBodyInlineSchemaType"
                                    :options="['object', 'array', 'string', 'number', 'integer', 'boolean']"
                                    placeholder="Select type"
                                    @change="onRequestBodyTypeChange"
                                  />
                                </div>

                                <!-- object: property list -->
                                <div v-if="requestBodyInlineSchemaType === 'object'">
                                  <div class="section-header">
                                    <h5>Properties</h5>
                                    <Button
                                      label="Add Property"
                                      icon="pi pi-plus"
                                      size="small"
                                      @click="addRequestBodyProperty"
                                    />
                                  </div>
                                  <div
                                    v-if="!currentRequestBodySchema || !currentRequestBodySchema.properties || Object.keys(currentRequestBodySchema.properties).length === 0"
                                    class="empty-state-small"
                                  >
                                    <p>No properties defined</p>
                                  </div>
                                  <div
                                    v-for="(prop, propName) in currentRequestBodySchema && currentRequestBodySchema.properties"
                                    :key="propName"
                                    class="property-item"
                                  >
                                    <div class="property-content">
                                      <div class="form-row">
                                        <div class="form-field">
                                          <label class="required">Property Name</label>
                                          <InputText
                                            :value="propName"
                                            @input="renameRequestBodyProperty(propName, $event.target.value)"
                                            placeholder="propertyName"
                                          />
                                        </div>
                                        <div class="form-field">
                                          <label class="required">Type</label>
                                          <Select
                                            v-model="prop.type"
                                            :options="['string','number','integer','boolean','array','object','$ref']"
                                            placeholder="Type"
                                            @change="onPropertyTypeChange(prop)"
                                          />
                                        </div>
                                      </div>
                                      <!-- $ref selector -->
                                      <div v-if="prop.type === '$ref'" class="form-field">
                                        <label>Schema Reference</label>
                                        <Select
                                          v-model="prop.$ref"
                                          :options="availableSchemas"
                                          optionLabel="label"
                                          optionValue="value"
                                          :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                        />
                                      </div>
                                      <div class="form-field" v-if="prop.type !== '$ref'">
                                        <label>Description</label>
                                        <InputText v-model="prop.description" placeholder="Property description" />
                                      </div>
                                      <!-- String validations -->
                                      <template v-if="prop.type === 'string'">
                                        <div class="form-row">
                                          <div class="form-field">
                                            <label>Format</label>
                                            <Select v-model="prop.format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" />
                                          </div>
                                          <div class="form-field">
                                            <label>Pattern</label>
                                            <InputText v-model="prop.pattern" placeholder="^[a-zA-Z0-9]+$" />
                                          </div>
                                        </div>
                                        <div class="form-row">
                                          <div class="form-field">
                                            <label>Min Length</label>
                                            <InputNumber v-model="prop.minLength" placeholder="Min length" :min="0" />
                                          </div>
                                          <div class="form-field">
                                            <label>Max Length</label>
                                            <InputNumber v-model="prop.maxLength" placeholder="Max length" :min="0" />
                                          </div>
                                        </div>
                                      </template>
                                      <!-- Number/Integer validations -->
                                      <template v-if="prop.type === 'number' || prop.type === 'integer'">
                                        <div class="form-row">
                                          <div class="form-field">
                                            <label>Format</label>
                                            <Select v-model="prop.format" :options="prop.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" />
                                          </div>
                                          <div class="form-field">
                                            <label>Multiple Of</label>
                                            <InputNumber v-model="prop.multipleOf" placeholder="Multiple of" :min="0" />
                                          </div>
                                        </div>
                                        <div class="form-row">
                                          <div class="form-field">
                                            <label>Minimum</label>
                                            <InputNumber v-model="prop.minimum" placeholder="Min value" />
                                          </div>
                                          <div class="form-field">
                                            <label>Maximum</label>
                                            <InputNumber v-model="prop.maximum" placeholder="Max value" />
                                          </div>
                                        </div>
                                        <div class="form-row">
                                          <template v-if="isOpenAPI31">
                                            <div class="form-field">
                                              <label>Exclusive Minimum</label>
                                              <InputNumber v-model="prop.exclusiveMinimum" placeholder="Exclusive min" />
                                            </div>
                                            <div class="form-field">
                                              <label>Exclusive Maximum</label>
                                              <InputNumber v-model="prop.exclusiveMaximum" placeholder="Exclusive max" />
                                            </div>
                                          </template>
                                          <template v-else>
                                            <div class="form-field checkbox-field">
                                              <Checkbox v-model="prop.exclusiveMinimum" :inputId="'rbprop-excl-min-' + propName" :binary="true" />
                                              <label :for="'rbprop-excl-min-' + propName">Exclusive Minimum</label>
                                            </div>
                                            <div class="form-field checkbox-field">
                                              <Checkbox v-model="prop.exclusiveMaximum" :inputId="'rbprop-excl-max-' + propName" :binary="true" />
                                              <label :for="'rbprop-excl-max-' + propName">Exclusive Maximum</label>
                                            </div>
                                          </template>
                                        </div>
                                      </template>
                                      <!-- Array validations -->
                                      <template v-if="prop.type === 'array'">
                                        <div class="form-field" v-if="prop.items">
                                          <label>Array Items Type</label>
                                          <Select
                                            v-model="prop.items.type"
                                            :options="['string','number','integer','boolean','object','$ref']"
                                            placeholder="Items type"
                                          />
                                        </div>
                                        <div class="form-field" v-if="prop.items && prop.items.type === '$ref'">
                                          <label>Array Items Schema Reference</label>
                                          <Select
                                            v-model="prop.items.$ref"
                                            :options="availableSchemas"
                                            optionLabel="label"
                                            optionValue="value"
                                            :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                          />
                                        </div>
                                        <div class="form-row">
                                          <div class="form-field">
                                            <label>Min Items</label>
                                            <InputNumber v-model="prop.minItems" placeholder="Min items" :min="0" />
                                          </div>
                                          <div class="form-field">
                                            <label>Max Items</label>
                                            <InputNumber v-model="prop.maxItems" placeholder="Max items" :min="0" />
                                          </div>
                                        </div>
                                        <div class="form-field checkbox-field">
                                          <Checkbox v-model="prop.uniqueItems" :inputId="'rbprop-unique-' + propName" :binary="true" />
                                          <label :for="'rbprop-unique-' + propName">Unique Items</label>
                                        </div>
                                      </template>
                                      <!-- Enum / default / example (non-$ref) -->
                                      <template v-if="prop.type !== '$ref'">
                                        <div class="form-field">
                                          <label>Enum Values</label>
                                          <AutoComplete
                                            multiple
                                            typeahead
                                            v-model="prop.enum"
                                            placeholder="Add value and press Enter"
                                            @keydown.enter.prevent="addChipOnEnter($event, prop, 'enum')"
                                          />
                                        </div>
                                        <div class="form-row">
                                          <div class="form-field">
                                            <label>Default Value</label>
                                            <InputText v-model="prop.default" placeholder="Default value" />
                                          </div>
                                          <div class="form-field">
                                            <label>Example</label>
                                            <InputText v-model="prop.example" placeholder="Example value" />
                                          </div>
                                        </div>
                                      </template>
                                      <!-- Required / Nullable -->
                                      <div class="form-row" v-if="prop.type !== '$ref'">
                                        <div class="form-field checkbox-field">
                                          <Checkbox
                                            :checked="currentRequestBodySchema && currentRequestBodySchema.required && currentRequestBodySchema.required.includes(propName)"
                                            :inputId="'rbprop-req-' + propName"
                                            :binary="true"
                                            @change="toggleRequestBodyPropertyRequired(propName, $event.checked)"
                                          />
                                          <label :for="'rbprop-req-' + propName">Required</label>
                                        </div>
                                        <div class="form-field checkbox-field">
                                          <template v-if="isOpenAPI31">
                                            <Checkbox
                                              :modelValue="Array.isArray(prop.type) && prop.type.includes('null')"
                                              :inputId="'rbprop-nullable-' + propName"
                                              :binary="true"
                                              @update:modelValue="val => {
                                                const base = Array.isArray(prop.type) ? prop.type.filter(t => t !== 'null') : [prop.type || 'string'];
                                                prop.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                              }"
                                            />
                                          </template>
                                          <template v-else>
                                            <Checkbox v-model="prop.nullable" :inputId="'rbprop-nullable-' + propName" :binary="true" />
                                          </template>
                                          <label :for="'rbprop-nullable-' + propName">Nullable</label>
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      icon="pi pi-trash"
                                      severity="danger"
                                      text
                                      rounded
                                      @click="removeRequestBodyProperty(propName)"
                                    />
                                  </div>
                                  <!-- object-level constraints -->
                                  <div class="form-row" style="margin-top: 0.75rem;">
                                    <div class="form-field">
                                      <label>Min Properties</label>
                                      <InputNumber v-if="currentRequestBodySchema" v-model="currentRequestBodySchema.minProperties" placeholder="Min properties" :min="0" />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Properties</label>
                                      <InputNumber v-if="currentRequestBodySchema" v-model="currentRequestBodySchema.maxProperties" placeholder="Max properties" :min="0" />
                                    </div>
                                  </div>
                                  <div class="form-field checkbox-field">
                                    <Checkbox
                                      v-if="currentRequestBodySchema"
                                      v-model="currentRequestBodySchema.additionalProperties"
                                      inputId="rb-addl-props"
                                      :binary="true"
                                      :trueValue="true"
                                      :falseValue="false"
                                    />
                                    <label for="rb-addl-props">Allow Additional Properties</label>
                                  </div>
                                </div>

                                <!-- array: item type + constraints -->
                                <template v-if="requestBodyInlineSchemaType === 'array' && currentRequestBodySchema">
                                  <div class="form-field">
                                    <label>Items Type(s)</label>
                                    <MultiSelect
                                      :modelValue="currentRequestBodySchema._itemSchemas ? [...new Set(currentRequestBodySchema._itemSchemas.map(s => s.type))] : []"
                                      :options="['string','number','integer','boolean','object']"
                                      placeholder="Select one or more types"
                                      display="chip"
                                      @update:modelValue="onItemTypesChange(currentRequestBodySchema, $event)"
                                    />
                                  </div>
                                  <div v-if="currentRequestBodySchema._itemSchemas && currentRequestBodySchema._itemSchemas.length > 0" class="item-schemas-list">
                                    <div
                                      v-for="(itemSchema, sIdx) in currentRequestBodySchema._itemSchemas"
                                      :key="sIdx"
                                      class="item-schema-entry"
                                    >
                                      <div class="item-schema-entry-header">
                                        <span :class="['type-badge', 'type-badge--' + itemSchema.type]">{{ itemSchema.type }}</span>
                                        <span v-if="itemSchema.type === 'object' && itemSchema.$ref" class="item-schema-ref-label">{{ itemSchema.$ref.split('/').pop() }}</span>
                                        <Button icon="pi pi-trash" severity="danger" text rounded size="small" class="item-schema-remove" v-tooltip.top="'Remove this type entry'" @click="currentRequestBodySchema._itemSchemas.splice(sIdx, 1)" />
                                      </div>
                                      <div class="item-schema-entry-body">
                                        <template v-if="itemSchema.type === 'object'">
                                          <div class="form-field">
                                            <label>Schema Reference</label>
                                            <div class="schema-selector">
                                              <Select
                                                v-model="itemSchema.$ref"
                                                :options="availableSchemas"
                                                optionLabel="label"
                                                optionValue="value"
                                                :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                              />
                                              <Button label="New Schema" icon="pi pi-plus" size="small" text @click="addSchema" />
                                            </div>
                                          </div>
                                          <Button
                                            v-if="sIdx === currentRequestBodySchema._itemSchemas.map((s,i) => s.type === 'object' ? i : -1).filter(i => i >= 0).slice(-1)[0]"
                                            label="Add another object schema"
                                            icon="pi pi-plus"
                                            size="small"
                                            text
                                            class="mt-1"
                                            @click="currentRequestBodySchema._itemSchemas.splice(sIdx + 1, 0, { type: 'object', $ref: '' })"
                                          />
                                        </template>
                                        <template v-else-if="itemSchema.type === 'string'">
                                          <div class="form-row">
                                            <div class="form-field"><label>Format</label><Select v-model="itemSchema.format" :options="['','date','date-time','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                            <div class="form-field"><label>Pattern</label><InputText v-model="itemSchema.pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Min Length</label><InputNumber v-model="itemSchema.minLength" placeholder="Min length" :min="0" /></div>
                                            <div class="form-field"><label>Max Length</label><InputNumber v-model="itemSchema.maxLength" placeholder="Max length" :min="0" /></div>
                                          </div>
                                        </template>
                                        <template v-else-if="itemSchema.type === 'number' || itemSchema.type === 'integer'">
                                          <div class="form-row">
                                            <div class="form-field"><label>Format</label><Select v-model="itemSchema.format" :options="itemSchema.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" /></div>
                                            <div class="form-field"><label>Multiple Of</label><InputNumber v-model="itemSchema.multipleOf" placeholder="Multiple of" :min="0" /></div>
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Minimum</label><InputNumber v-model="itemSchema.minimum" placeholder="Min value" /></div>
                                            <div class="form-field"><label>Maximum</label><InputNumber v-model="itemSchema.maximum" placeholder="Max value" /></div>
                                          </div>
                                        </template>
                                        <template v-else-if="itemSchema.type === 'boolean'">
                                          <p class="helper-text">No additional constraints for boolean.</p>
                                        </template>
                                      </div>
                                    </div>
                                  </div>
                                  <div class="form-row" style="margin-top: 0.75rem;">
                                    <div class="form-field"><label>Min Items</label><InputNumber v-model="currentRequestBodySchema.minItems" placeholder="Min items" :min="0" /></div>
                                    <div class="form-field"><label>Max Items</label><InputNumber v-model="currentRequestBodySchema.maxItems" placeholder="Max items" :min="0" /></div>
                                  </div>
                                  <div class="form-field checkbox-field">
                                    <Checkbox v-model="currentRequestBodySchema.uniqueItems" inputId="rb-unique-items" :binary="true" />
                                    <label for="rb-unique-items">Unique Items</label>
                                  </div>
                                </template>

                                <!-- string constraints -->
                                <template v-if="requestBodyInlineSchemaType === 'string' && currentRequestBodySchema">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select v-model="currentRequestBodySchema.format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" />
                                    </div>
                                    <div class="form-field">
                                      <label>Pattern</label>
                                      <InputText v-model="currentRequestBodySchema.pattern" placeholder="^[a-zA-Z0-9]+$" />
                                    </div>
                                  </div>
                                  <div class="form-row">
                                    <div class="form-field"><label>Min Length</label><InputNumber v-model="currentRequestBodySchema.minLength" placeholder="Min length" :min="0" /></div>
                                    <div class="form-field"><label>Max Length</label><InputNumber v-model="currentRequestBodySchema.maxLength" placeholder="Max length" :min="0" /></div>
                                  </div>
                                </template>

                                <!-- number / integer constraints -->
                                <template v-if="(requestBodyInlineSchemaType === 'number' || requestBodyInlineSchemaType === 'integer') && currentRequestBodySchema">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select v-model="currentRequestBodySchema.format" :options="requestBodyInlineSchemaType === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" />
                                    </div>
                                    <div class="form-field">
                                      <label>Multiple Of</label>
                                      <InputNumber v-model="currentRequestBodySchema.multipleOf" placeholder="Multiple of" :min="0" />
                                    </div>
                                  </div>
                                  <div class="form-row">
                                    <div class="form-field"><label>Minimum</label><InputNumber v-model="currentRequestBodySchema.minimum" placeholder="Min value" /></div>
                                    <div class="form-field"><label>Maximum</label><InputNumber v-model="currentRequestBodySchema.maximum" placeholder="Max value" /></div>
                                  </div>
                                  <div class="form-row">
                                    <template v-if="isOpenAPI31">
                                      <div class="form-field"><label>Exclusive Minimum</label><InputNumber v-model="currentRequestBodySchema.exclusiveMinimum" placeholder="Exclusive min" /></div>
                                      <div class="form-field"><label>Exclusive Maximum</label><InputNumber v-model="currentRequestBodySchema.exclusiveMaximum" placeholder="Exclusive max" /></div>
                                    </template>
                                    <template v-else>
                                      <div class="form-field checkbox-field">
                                        <Checkbox v-model="currentRequestBodySchema.exclusiveMinimum" inputId="rb-excl-min" :binary="true" />
                                        <label for="rb-excl-min">Exclusive Minimum</label>
                                      </div>
                                      <div class="form-field checkbox-field">
                                        <Checkbox v-model="currentRequestBodySchema.exclusiveMaximum" inputId="rb-excl-max" :binary="true" />
                                        <label for="rb-excl-max">Exclusive Maximum</label>
                                      </div>
                                    </template>
                                  </div>
                                </template>

                                <!-- common: enum / default / example / nullable (non-object, non-array) -->
                                <template v-if="requestBodyInlineSchemaType !== 'object' && currentRequestBodySchema">
                                  <div class="form-field">
                                    <label>Enum Values</label>
                                    <AutoComplete
                                      multiple
                                      typeahead
                                      v-model="currentRequestBodySchema.enum"
                                      placeholder="Add value and press Enter"
                                      @keydown.enter.prevent="addChipOnEnter($event, currentRequestBodySchema, 'enum')"
                                    />
                                  </div>
                                  <div class="form-row">
                                    <div class="form-field"><label>Default Value</label><InputText v-model="currentRequestBodySchema.default" placeholder="Default value" /></div>
                                    <div class="form-field"><label>Example</label><InputText v-model="currentRequestBodySchema.example" placeholder="Example value" /></div>
                                  </div>
                                  <div class="form-field checkbox-field">
                                    <template v-if="isOpenAPI31">
                                      <Checkbox
                                        :modelValue="Array.isArray(currentRequestBodySchema.type) && currentRequestBodySchema.type.includes('null')"
                                        inputId="rb-nullable"
                                        :binary="true"
                                        @update:modelValue="val => {
                                          const base = Array.isArray(currentRequestBodySchema.type) ? currentRequestBodySchema.type.filter(t => t !== 'null') : [currentRequestBodySchema.type || 'string'];
                                          currentRequestBodySchema.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                        }"
                                      />
                                    </template>
                                    <template v-else>
                                      <Checkbox v-model="currentRequestBodySchema.nullable" inputId="rb-nullable" :binary="true" />
                                    </template>
                                    <label for="rb-nullable">Nullable</label>
                                  </div>
                                </template>
                              </template>
                          </div>

                          <div class="method-editor-section">
                              <div class="section-header">
                                <h5>Responses</h5>
                                <Button
                                  label="Add Response"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="openAddResponseDialog"
                                />
                              </div>

                              <div
                                v-if="
                                  !currentMethodData.responses ||
                                  Object.keys(currentMethodData.responses)
                                    .length === 0
                                "
                                class="empty-state-small"
                              >
                                <p>No responses defined</p>
                              </div>

                              <Accordion
                                v-if="
                                  currentMethodData.responses &&
                                  Object.keys(currentMethodData.responses)
                                    .length > 0
                                "
                              >
                                <AccordionPanel
                                  v-for="(
                                    response, statusCode
                                  ) in currentMethodData.responses"
                                  :key="statusCode"
                                  :value="statusCode"
                                >
                                  <AccordionHeader>
                                    <div class="response-header">
                                      <Tag
                                        :value="statusCode + ' ' + (getStatusName(statusCode))"
                                        :severity="getStatusSeverity(statusCode)"
                                      />
                                      <span>{{
                                        response.description || "No description"
                                      }}</span>
                                      <Button
                                        icon="pi pi-pencil"
                                        text
                                        rounded
                                        size="small"
                                        class="response-edit-code-btn"
                                        v-tooltip.top="'Change status code'"
                                        @click.stop="openEditResponseCodeDialog(statusCode)"
                                      />
                                      <Button
                                        icon="pi pi-trash"
                                        severity="danger"
                                        text
                                        rounded
                                        size="small"
                                        @click.stop="
                                          removeResponse(
                                            selectedPath,
                                            selectedMethod,
                                            statusCode
                                          )
                                        "
                                      />
                                    </div>
                                  </AccordionHeader>
                                  <AccordionContent>
                                    <div class="form-field">
                                      <label>Description</label>
                                      <Textarea
                                        v-model="response.description"
                                        rows="2"
                                        placeholder="Response description"
                                      />
                                    </div>

                                    <div class="form-field">
                                      <label>Content Type</label>
                                      <Select
                                        :value="getResponseContentType(response)"
                                        @change="setResponseContentType(response, $event.value)"
                                        :options="['application/json','application/xml','text/plain','text/html']"
                                        placeholder="Select content type"
                                      />
                                    </div>

                                    <template v-if="getResponseContentType(response)">
                                      <div class="form-field">
                                        <label>Schema</label>
                                        <div class="schema-selector">
                                          <Select
                                            :value="getResponseSchemaType(response)"
                                            @change="setResponseSchemaType(response, $event.value)"
                                            :options="['reference', 'inline']"
                                            placeholder="Schema type"
                                          />
                                          <template v-if="getResponseSchemaType(response) === 'reference'">
                                            <Select
                                              :value="getResponseSchemaRef(response)"
                                              @change="setResponseSchemaRef(response, $event.value)"
                                              :options="availableSchemas"
                                              optionLabel="label"
                                              optionValue="value"
                                              :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                            />
                                            <Button
                                              label="New Schema"
                                              icon="pi pi-plus"
                                              size="small"
                                              text
                                              @click="addSchema"
                                            />
                                          </template>
                                        </div>
                                      </div>

                                      <!-- Inline schema builder (mirrors Request Body) -->
                                      <template v-if="getResponseSchemaType(response) === 'inline'">
                                        <div class="form-field">
                                          <label class="required">Type</label>
                                          <Select
                                            :value="getResponseInlineSchemaType(response)"
                                            :options="['object','array','string','number','integer','boolean']"
                                            placeholder="Select type"
                                            @change="setResponseInlineSchemaType(response, $event.value)"
                                          />
                                        </div>

                                        <!-- object: property list -->
                                        <div v-if="getResponseInlineSchemaType(response) === 'object'">
                                          <div class="section-header">
                                            <h5>Properties</h5>
                                            <Button label="Add Property" icon="pi pi-plus" size="small" @click="addResponseProperty(response)" />
                                          </div>
                                          <div v-if="!getResponseInlineSchema(response).properties || Object.keys(getResponseInlineSchema(response).properties).length === 0" class="empty-state-small">
                                            <p>No properties defined</p>
                                          </div>
                                          <div
                                            v-for="(prop, propName) in getResponseInlineSchema(response).properties"
                                            :key="propName"
                                            class="property-item"
                                          >
                                            <div class="property-content">
                                              <div class="form-row">
                                                <div class="form-field">
                                                  <label class="required">Property Name</label>
                                                  <InputText
                                                    :value="propName"
                                                    @input="renameResponseProperty(response, propName, $event.target.value)"
                                                    placeholder="propertyName"
                                                  />
                                                </div>
                                                <div class="form-field">
                                                  <label class="required">Type</label>
                                                  <Select
                                                    v-model="prop.type"
                                                    :options="['string','number','integer','boolean','array','object','$ref']"
                                                    placeholder="Type"
                                                    @change="onPropertyTypeChange(prop)"
                                                  />
                                                </div>
                                              </div>
                                              <div v-if="prop.type === '$ref'" class="form-field">
                                                <label>Schema Reference</label>
                                                <div class="schema-selector">
                                                  <Select
                                                    v-model="prop.$ref"
                                                    :options="availableSchemas"
                                                    optionLabel="label"
                                                    optionValue="value"
                                                    :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                                  />
                                                  <Button label="New Schema" icon="pi pi-plus" size="small" text @click="addSchema" />
                                                </div>
                                              </div>
                                              <div class="form-field" v-if="prop.type !== '$ref'">
                                                <label>Description</label>
                                                <InputText v-model="prop.description" placeholder="Property description" />
                                              </div>
                                              <template v-if="prop.type === 'string'">
                                                <div class="form-row">
                                                  <div class="form-field"><label>Format</label><Select v-model="prop.format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                                  <div class="form-field"><label>Pattern</label><InputText v-model="prop.pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Min Length</label><InputNumber v-model="prop.minLength" placeholder="Min length" :min="0" /></div>
                                                  <div class="form-field"><label>Max Length</label><InputNumber v-model="prop.maxLength" placeholder="Max length" :min="0" /></div>
                                                </div>
                                              </template>
                                              <template v-if="prop.type === 'number' || prop.type === 'integer'">
                                                <div class="form-row">
                                                  <div class="form-field"><label>Format</label><Select v-model="prop.format" :options="prop.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" /></div>
                                                  <div class="form-field"><label>Multiple Of</label><InputNumber v-model="prop.multipleOf" placeholder="Multiple of" :min="0" /></div>
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Minimum</label><InputNumber v-model="prop.minimum" placeholder="Min value" /></div>
                                                  <div class="form-field"><label>Maximum</label><InputNumber v-model="prop.maximum" placeholder="Max value" /></div>
                                                </div>
                                              </template>
                                              <template v-if="prop.type === 'array'">
                                                <div class="form-field" v-if="prop.items">
                                                  <label>Array Items Type</label>
                                                  <Select v-model="prop.items.type" :options="['string','number','integer','boolean','object','$ref']" placeholder="Items type" />
                                                </div>
                                                <div class="form-field" v-if="prop.items && prop.items.type === '$ref'">
                                                  <label>Array Items Schema Reference</label>
                                                  <Select v-model="prop.items.$ref" :options="availableSchemas" optionLabel="label" optionValue="value" :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'" />
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Min Items</label><InputNumber v-model="prop.minItems" placeholder="Min items" :min="0" /></div>
                                                  <div class="form-field"><label>Max Items</label><InputNumber v-model="prop.maxItems" placeholder="Max items" :min="0" /></div>
                                                </div>
                                                <div class="form-field checkbox-field">
                                                  <Checkbox v-model="prop.uniqueItems" :inputId="'resprop-unique-' + propName" :binary="true" />
                                                  <label :for="'resprop-unique-' + propName">Unique Items</label>
                                                </div>
                                              </template>
                                              <template v-if="prop.type !== '$ref'">
                                                <div class="form-field">
                                                  <label>Enum Values</label>
                                                  <AutoComplete multiple typeahead v-model="prop.enum" placeholder="Add value and press Enter" @keydown.enter.prevent="addChipOnEnter($event, prop, 'enum')" />
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Default Value</label><InputText v-model="prop.default" placeholder="Default value" /></div>
                                                  <div class="form-field"><label>Example</label><InputText v-model="prop.example" placeholder="Example value" /></div>
                                                </div>
                                              </template>
                                              <div class="form-row" v-if="prop.type !== '$ref'">
                                                <div class="form-field checkbox-field">
                                                  <Checkbox
                                                    :checked="getResponseInlineSchema(response).required && getResponseInlineSchema(response).required.includes(propName)"
                                                    :inputId="'resprop-req-' + propName"
                                                    :binary="true"
                                                    @change="toggleResponsePropertyRequired(response, propName, $event.checked)"
                                                  />
                                                  <label :for="'resprop-req-' + propName">Required</label>
                                                </div>
                                                <div class="form-field checkbox-field">
                                                  <template v-if="isOpenAPI31">
                                                    <Checkbox
                                                      :modelValue="Array.isArray(prop.type) && prop.type.includes('null')"
                                                      :inputId="'resprop-nullable-' + propName"
                                                      :binary="true"
                                                      @update:modelValue="val => {
                                                        const base = Array.isArray(prop.type) ? prop.type.filter(t => t !== 'null') : [prop.type || 'string'];
                                                        prop.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                                      }"
                                                    />
                                                  </template>
                                                  <template v-else>
                                                    <Checkbox v-model="prop.nullable" :inputId="'resprop-nullable-' + propName" :binary="true" />
                                                  </template>
                                                  <label :for="'resprop-nullable-' + propName">Nullable</label>
                                                </div>
                                              </div>
                                            </div>
                                            <Button icon="pi pi-trash" severity="danger" text rounded @click="removeResponseProperty(response, propName)" />
                                          </div>
                                          <div class="form-row" style="margin-top: 0.75rem;">
                                            <div class="form-field"><label>Min Properties</label><InputNumber v-model="getResponseInlineSchema(response).minProperties" placeholder="Min properties" :min="0" /></div>
                                            <div class="form-field"><label>Max Properties</label><InputNumber v-model="getResponseInlineSchema(response).maxProperties" placeholder="Max properties" :min="0" /></div>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <Checkbox v-model="getResponseInlineSchema(response).additionalProperties" inputId="resp-addl-props" :binary="true" :trueValue="true" :falseValue="false" />
                                            <label for="resp-addl-props">Allow Additional Properties</label>
                                          </div>
                                        </div>

                                        <!-- array: item type + constraints -->
                                        <template v-if="getResponseInlineSchemaType(response) === 'array'">
                                          <div class="form-field">
                                            <label>Items Type(s)</label>
                                            <MultiSelect
                                              :modelValue="getResponseInlineSchema(response)._itemSchemas ? [...new Set(getResponseInlineSchema(response)._itemSchemas.map(s => s.type))] : []"
                                              :options="['string','number','integer','boolean','object']"
                                              placeholder="Select one or more types"
                                              display="chip"
                                              @update:modelValue="onItemTypesChange(getResponseInlineSchema(response), $event)"
                                            />
                                          </div>
                                          <div v-if="getResponseInlineSchema(response)._itemSchemas && getResponseInlineSchema(response)._itemSchemas.length > 0" class="item-schemas-list">
                                            <div
                                              v-for="(itemSchema, sIdx) in getResponseInlineSchema(response)._itemSchemas"
                                              :key="sIdx"
                                              class="item-schema-entry"
                                            >
                                              <div class="item-schema-entry-header">
                                                <span :class="['type-badge', 'type-badge--' + itemSchema.type]">{{ itemSchema.type }}</span>
                                                <span v-if="itemSchema.type === 'object' && itemSchema.$ref" class="item-schema-ref-label">{{ itemSchema.$ref.split('/').pop() }}</span>
                                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" class="item-schema-remove" v-tooltip.top="'Remove this type entry'" @click="getResponseInlineSchema(response)._itemSchemas.splice(sIdx, 1)" />
                                              </div>
                                              <div class="item-schema-entry-body">
                                                <template v-if="itemSchema.type === 'object'">
                                                  <div class="form-field">
                                                    <label>Schema Reference</label>
                                                    <div class="schema-selector">
                                                      <Select v-model="itemSchema.$ref" :options="availableSchemas" optionLabel="label" optionValue="value" :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'" />
                                                      <Button label="New Schema" icon="pi pi-plus" size="small" text @click="addSchema" />
                                                    </div>
                                                  </div>
                                                </template>
                                                <template v-else-if="itemSchema.type === 'string'">
                                                  <div class="form-row">
                                                    <div class="form-field"><label>Format</label><Select v-model="itemSchema.format" :options="['','date','date-time','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                                    <div class="form-field"><label>Pattern</label><InputText v-model="itemSchema.pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                                  </div>
                                                </template>
                                                <template v-else-if="itemSchema.type === 'number' || itemSchema.type === 'integer'">
                                                  <div class="form-row">
                                                    <div class="form-field"><label>Minimum</label><InputNumber v-model="itemSchema.minimum" placeholder="Min value" /></div>
                                                    <div class="form-field"><label>Maximum</label><InputNumber v-model="itemSchema.maximum" placeholder="Max value" /></div>
                                                  </div>
                                                </template>
                                                <template v-else-if="itemSchema.type === 'boolean'">
                                                  <p class="helper-text">No additional constraints for boolean.</p>
                                                </template>
                                              </div>
                                            </div>
                                          </div>
                                          <div class="form-row" style="margin-top: 0.75rem;">
                                            <div class="form-field"><label>Min Items</label><InputNumber v-model="getResponseInlineSchema(response).minItems" placeholder="Min items" :min="0" /></div>
                                            <div class="form-field"><label>Max Items</label><InputNumber v-model="getResponseInlineSchema(response).maxItems" placeholder="Max items" :min="0" /></div>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <Checkbox v-model="getResponseInlineSchema(response).uniqueItems" inputId="resp-unique-items" :binary="true" />
                                            <label for="resp-unique-items">Unique Items</label>
                                          </div>
                                        </template>

                                        <!-- string constraints -->
                                        <template v-if="getResponseInlineSchemaType(response) === 'string'">
                                          <div class="form-row">
                                            <div class="form-field"><label>Format</label><Select v-model="getResponseInlineSchema(response).format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                            <div class="form-field"><label>Pattern</label><InputText v-model="getResponseInlineSchema(response).pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Min Length</label><InputNumber v-model="getResponseInlineSchema(response).minLength" placeholder="Min length" :min="0" /></div>
                                            <div class="form-field"><label>Max Length</label><InputNumber v-model="getResponseInlineSchema(response).maxLength" placeholder="Max length" :min="0" /></div>
                                          </div>
                                        </template>

                                        <!-- number/integer constraints -->
                                        <template v-if="getResponseInlineSchemaType(response) === 'number' || getResponseInlineSchemaType(response) === 'integer'">
                                          <div class="form-row">
                                            <div class="form-field"><label>Format</label><Select v-model="getResponseInlineSchema(response).format" :options="getResponseInlineSchemaType(response) === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" /></div>
                                            <div class="form-field"><label>Multiple Of</label><InputNumber v-model="getResponseInlineSchema(response).multipleOf" placeholder="Multiple of" :min="0" /></div>
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Minimum</label><InputNumber v-model="getResponseInlineSchema(response).minimum" placeholder="Min value" /></div>
                                            <div class="form-field"><label>Maximum</label><InputNumber v-model="getResponseInlineSchema(response).maximum" placeholder="Max value" /></div>
                                          </div>
                                        </template>

                                        <!-- common: enum / default / example (non-object) -->
                                        <template v-if="getResponseInlineSchemaType(response) !== 'object'">
                                          <div class="form-field">
                                            <label>Enum Values</label>
                                            <AutoComplete multiple typeahead v-model="getResponseInlineSchema(response).enum" placeholder="Add value and press Enter" @keydown.enter.prevent="addChipOnEnter($event, getResponseInlineSchema(response), 'enum')" />
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Default Value</label><InputText v-model="getResponseInlineSchema(response).default" placeholder="Default value" /></div>
                                            <div class="form-field"><label>Example</label><InputText v-model="getResponseInlineSchema(response).example" placeholder="Example value" /></div>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <template v-if="isOpenAPI31">
                                              <Checkbox
                                                :modelValue="Array.isArray(getResponseInlineSchema(response).type) && getResponseInlineSchema(response).type.includes('null')"
                                                inputId="resp-nullable"
                                                :binary="true"
                                                @update:modelValue="val => {
                                                  const s = getResponseInlineSchema(response);
                                                  const base = Array.isArray(s.type) ? s.type.filter(t => t !== 'null') : [s.type || 'string'];
                                                  s.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                                }"
                                              />
                                            </template>
                                            <template v-else>
                                              <Checkbox v-model="getResponseInlineSchema(response).nullable" inputId="resp-nullable" :binary="true" />
                                            </template>
                                            <label for="resp-nullable">Nullable</label>
                                          </div>
                                        </template>
                                      </template>
                                    </template>
                                  </AccordionContent>
                                </AccordionPanel>
                              </Accordion>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";
import SelectButton from "primevue/selectbutton";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import SecurityRequirementList from "./SecurityRequirementList.vue";

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
    InputNumber,
    Textarea,
    Select,
    MultiSelect,
    Checkbox,
    AutoComplete,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Tag,
    SelectButton,
    IconField,
    InputIcon,
    SecurityRequirementList,
  },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    return { formData: props.formData, ...props.api };
  },
};
</script>
