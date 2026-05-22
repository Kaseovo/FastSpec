<template>
  <div class="form-editor">
    <div class="form-header">
      <h3>Form Editor</h3>
      <div class="form-header__controls">
        <Button
          :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
          class="preview-toggle-btn"
          size="small"
          text
          @click="$emit('toggle-live-preview')"
        />
      </div>
    </div>

    <div class="form-content">
      <Tabs value="0">
        <TabList>
          <Tab value="0">
            <i class="pi pi-info-circle"></i>
            <span>Info</span>
          </Tab>
          <Tab value="1">
            <i class="pi pi-server"></i>
            <span>Servers</span>
          </Tab>
          <Tab value="2">
            <i class="pi pi-sitemap"></i>
            <span>Paths</span>
          </Tab>
          <Tab value="3">
            <i class="pi pi-box"></i>
            <span>Components</span>
          </Tab>
        </TabList>

        <TabPanels>
          <!-- API Info Tab -->
          <TabPanel value="0">
            <div class="form-section">
              <h4>API Information</h4>

              <div class="form-field">
                <label for="openapi-version">OpenAPI Version *</label>
                <InputText
                  id="openapi-version"
                  v-model="formData.openapi"
                  placeholder="3.0.0"
                />
              </div>

              <div class="form-field">
                <label for="api-title">Title *</label>
                <InputText
                  id="api-title"
                  v-model="formData.info.title"
                  placeholder="My API"
                />
              </div>

              <div class="form-field">
                <label for="api-version">Version *</label>
                <InputText
                  id="api-version"
                  v-model="formData.info.version"
                  placeholder="1.0.0"
                />
              </div>

              <div class="form-field">
                <label for="api-description">Description</label>
                <Textarea
                  id="api-description"
                  v-model="formData.info.description"
                  rows="4"
                  placeholder="API Description"
                />
              </div>

              <div class="form-field">
                <label for="api-contact-name">Contact Name</label>
                <InputText
                  id="api-contact-name"
                  v-model="formData.info.contact.name"
                  placeholder="API Support"
                />
              </div>

              <div class="form-field">
                <label for="api-contact-email">Contact Email</label>
                <InputText
                  id="api-contact-email"
                  v-model="formData.info.contact.email"
                  type="email"
                  placeholder="support@example.com"
                />
              </div>

              <div class="form-field">
                <label for="api-license-name">License Name</label>
                <InputText
                  id="api-license-name"
                  v-model="formData.info.license.name"
                  placeholder="MIT"
                />
              </div>

              <div class="form-field">
                <label for="api-license-url">License URL</label>
                <InputText
                  id="api-license-url"
                  v-model="formData.info.license.url"
                  placeholder="https://opensource.org/licenses/MIT"
                />
              </div>
            </div>
          </TabPanel>

          <!-- Servers Tab -->
          <TabPanel value="1">
            <div class="form-section">
              <div class="section-header">
                <h4>Servers</h4>
                <Button
                  label="Add Server"
                  icon="pi pi-plus"
                  size="small"
                  @click="addServer"
                  :disabled="hasEmptyServerUrl"
                  v-tooltip.left="hasEmptyServerUrl ? 'Please fill in the URL for all existing servers before adding a new one.' : ''"
                />
              </div>

              <div v-if="formData.servers.length === 0" class="empty-state">
                <i class="pi pi-server"></i>
                <p>No servers defined. Add one to get started.</p>
              </div>

              <div
                v-for="(server, index) in formData.servers"
                :key="index"
                class="list-item"
              >
                <div class="list-item-content">
                  <div class="form-field">
                    <label>URL *</label>
                    <InputText
                      v-model="server.url"
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div class="form-field">
                    <label>Description</label>
                    <InputText
                      v-model="server.description"
                      placeholder="Production server"
                    />
                  </div>
                </div>
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  @click="removeServer(index)"
                />
              </div>
            </div>
          </TabPanel>

          <!-- Paths Tab -->
          <TabPanel value="2">
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

              <Accordion v-if="pathsList.length > 0" :multiple="true">
                <AccordionPanel
                  v-for="(pathItem, index) in pathsList"
                  :key="index"
                  :value="index.toString()"
                  draggable="true"
                  @dragstart="handlePathDragStart($event, pathItem.path, index)"
                  @dragover="handleDragOver($event)"
                  @drop="handlePathDrop($event, index)"
                  @dragend="handleDragEnd"
                  :class="{ 'dragging-path': draggedPath === pathItem.path }"
                >
                  <AccordionHeader>
                    <div class="path-header">
                      <div class="drag-handle" title="Drag to reorder">
                        <i class="pi pi-bars"></i>
                      </div>
                      <div class="path-header-chips" @click.stop>
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
                          @click.stop="selectPathMethod(pathItem.path, method)"
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
                      <span class="path-url">{{ pathItem.path }}</span>
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
                    <div class="path-methods-editor">
                      <div
                        v-if="selectedPath === pathItem.path && selectedMethod"
                        class="method-editor"
                      >
                        <Tabs value="0">
                          <TabList>
                            <Tab value="0">Basic Info</Tab>
                            <Tab value="1">Parameters</Tab>
                            <Tab value="2">Request Body</Tab>
                            <Tab value="3">Responses</Tab>
                          </TabList>
                          <TabPanels>
                            <!-- Basic Info -->
                            <TabPanel value="0">
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
                                <AutoComplete multiple typeahead
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .tags
                                  "
                                  placeholder="Add tag and press Enter"
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
                            </TabPanel>

                            <!-- Parameters -->
                            <TabPanel value="1">
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
                                class="param-item"
                              >
                                <div class="param-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Name *</label>
                                      <InputText
                                        v-model="param.name"
                                        placeholder="id"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Location *</label>
                                      <Select
                                        v-model="param.in"
                                        :options="[
                                          'query',
                                          'path',
                                          'header',
                                          'cookie',
                                        ]"
                                        placeholder="Select location"
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
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Type *</label>
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
                                    <div
                                      class="form-field"
                                      v-if="param.schema.type === 'array' && param.schema.items"
                                    >
                                      <label>Items Type</label>
                                      <Select
                                        v-model="param.schema.items.type"
                                        :options="[
                                          'string',
                                          'number',
                                          'integer',
                                          'boolean',
                                        ]"
                                        placeholder="Items type"
                                      />
                                    </div>
                                  </div>

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
                                  </div>

                                  <!-- Array validations -->
                                  <div
                                    v-if="param.schema.type === 'array'"
                                    class="form-row"
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
                                  <div class="form-field">
                                    <label>Enum Values (optional)</label>
                                    <AutoComplete multiple typeahead
                                      v-model="param.schema.enum"
                                      placeholder="Add enum value and press Enter"
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
                                      <Checkbox
                                        v-model="param.schema.nullable"
                                        :inputId="'param-nullable-' + pIndex"
                                        :binary="true"
                                      />
                                      <label :for="'param-nullable-' + pIndex"
                                        >Nullable</label
                                      >
                                    </div>
                                  </div>
                                </div>
                                <Button
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
                            </TabPanel>

                            <!-- Request Body -->
                            <TabPanel value="2">
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
                                  <Select
                                    v-if="requestBodySchemaType === 'reference'"
                                    v-model="requestBodySchemaRef"
                                    :options="availableSchemas"
                                    optionLabel="label"
                                    optionValue="value"
                                    placeholder="Select schema"
                                  />
                                </div>
                              </div>

                              <div
                                v-if="
                                  requestBodySchemaType === 'inline' &&
                                  requestBodyContentType
                                "
                                class="form-field"
                              >
                                <label>Inline Schema (JSON)</label>
                                <Textarea
                                  :value="getRequestBodyInlineSchema()"
                                  @input="
                                    updateRequestBodyInlineSchema(
                                      $event.target.value
                                    )
                                  "
                                  rows="10"
                                  class="json-textarea"
                                />
                              </div>
                            </TabPanel>

                            <!-- Responses -->
                            <TabPanel value="3">
                              <div class="section-header">
                                <h5>Responses</h5>
                                <Button
                                  label="Add Response"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="showAddResponseDialog = true"
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
                                        :value="statusCode"
                                        :severity="
                                          getStatusSeverity(statusCode)
                                        "
                                      />
                                      <span>{{
                                        response.description || "No description"
                                      }}</span>
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
                                        :value="
                                          getResponseContentType(response)
                                        "
                                        @change="
                                          setResponseContentType(
                                            response,
                                            $event.value
                                          )
                                        "
                                        :options="[
                                          'application/json',
                                          'application/xml',
                                          'text/plain',
                                          'text/html',
                                        ]"
                                        placeholder="Select content type"
                                      />
                                    </div>

                                    <div
                                      class="form-field"
                                      v-if="getResponseContentType(response)"
                                    >
                                      <label>Schema</label>
                                      <div class="schema-selector">
                                        <Select
                                          :value="
                                            getResponseSchemaType(response)
                                          "
                                          @change="
                                            setResponseSchemaType(
                                              response,
                                              $event.value
                                            )
                                          "
                                          :options="['reference', 'inline']"
                                          placeholder="Schema type"
                                        />
                                        <Select
                                          v-if="
                                            getResponseSchemaType(response) ===
                                            'reference'
                                          "
                                          :value="
                                            getResponseSchemaRef(response)
                                          "
                                          @change="
                                            setResponseSchemaRef(
                                              response,
                                              $event.value
                                            )
                                          "
                                          :options="availableSchemas"
                                          optionLabel="label"
                                          optionValue="value"
                                          placeholder="Select schema"
                                        />
                                      </div>
                                    </div>

                                    <div
                                      v-if="
                                        getResponseSchemaType(response) ===
                                          'inline' &&
                                        getResponseContentType(response)
                                      "
                                      class="form-field"
                                    >
                                      <label>Inline Schema (JSON)</label>
                                      <Textarea
                                        :value="
                                          getResponseInlineSchema(response)
                                        "
                                        @input="
                                          updateResponseInlineSchema(
                                            response,
                                            $event.target.value
                                          )
                                        "
                                        rows="10"
                                        class="json-textarea"
                                      />
                                    </div>
                                  </AccordionContent>
                                </AccordionPanel>
                              </Accordion>
                            </TabPanel>
                          </TabPanels>
                        </Tabs>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
          </TabPanel>

          <!-- Components Tab -->
          <TabPanel value="3">
            <div class="form-section">
              <div class="section-header">
                <h4>Component Schemas</h4>
                <Button
                  label="Add Schema"
                  icon="pi pi-plus"
                  size="small"
                  @click="showAddSchemaDialog = true"
                />
              </div>

              <div v-if="schemasList.length === 0" class="empty-state">
                <i class="pi pi-box"></i>
                <p>No schemas defined. Add one to get started.</p>
              </div>

              <Accordion v-if="schemasList.length > 0">
                <AccordionPanel
                  v-for="(schema, index) in schemasList"
                  :key="index"
                  :value="index.toString()"
                >
                  <AccordionHeader>
                    <div class="schema-header">
                      <span class="schema-name">{{ schema.name }}</span>
                      <Tag
                        v-if="schema.data.type"
                        :value="schema.data.type"
                        severity="info"
                      />
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        size="small"
                        @click.stop="removeSchema(schema.name)"
                      />
                    </div>
                  </AccordionHeader>
                  <AccordionContent>
                    <Tabs value="0">
                      <TabList>
                        <Tab value="0">Builder</Tab>
                        <Tab value="1">JSON</Tab>
                      </TabList>
                      <TabPanels>
                        <TabPanel value="0">
                          <div class="schema-builder">
                            <div class="form-field">
                              <label>Type *</label>
                              <Select
                                v-model="schema.data.type"
                                :options="[
                                  'object',
                                  'array',
                                  'string',
                                  'number',
                                  'integer',
                                  'boolean',
                                ]"
                                placeholder="Select type"
                                @change="onSchemaTypeChange(schema)"
                              />
                            </div>

                            <div v-if="schema.data.type === 'object'">
                              <div class="section-header">
                                <h5>Properties</h5>
                                <Button
                                  label="Add Property"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="addSchemaProperty(schema.name)"
                                />
                              </div>

                              <div
                                v-if="
                                  !schema.data.properties ||
                                  Object.keys(schema.data.properties).length ===
                                    0
                                "
                                class="empty-state-small"
                              >
                                <p>No properties defined</p>
                              </div>

                              <div
                                v-for="(prop, propName, propIndex) in schema
                                  .data.properties"
                                :key="propName"
                                class="property-item"
                                draggable="true"
                                @dragstart="
                                  handleDragStart(
                                    $event,
                                    schema.name,
                                    propName,
                                    propIndex
                                  )
                                "
                                @dragover="handleDragOver($event)"
                                @drop="
                                  handleDrop($event, schema.name, propIndex)
                                "
                                @dragend="handleDragEnd"
                                :class="{
                                  dragging: draggedProperty === propName,
                                }"
                              >
                                <div
                                  class="drag-handle"
                                  title="Drag to reorder"
                                >
                                  <i class="pi pi-bars"></i>
                                </div>
                                <div class="property-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Property Name *</label>
                                      <InputText
                                        :value="propName"
                                        @input="
                                          renameSchemaProperty(
                                            schema.name,
                                            propName,
                                            $event.target.value
                                          )
                                        "
                                        placeholder="propertyName"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Type *</label>
                                      <Select
                                        v-model="prop.type"
                                        :options="[
                                          'string',
                                          'number',
                                          'integer',
                                          'boolean',
                                          'array',
                                          'object',
                                          '$ref',
                                        ]"
                                        placeholder="Type"
                                        @change="onPropertyTypeChange(prop)"
                                        />
                                    </div>
                                  </div>

                                 <!-- $ref selector when type is $ref -->
                                 <div
                                   v-if="prop.type === '$ref'"
                                   class="form-field"
                                 >
                                   <label>Schema Reference</label>
                                   <Select
                                     v-model="prop.$ref"
                                     :options="availableSchemas"
                                     optionLabel="label"
                                     optionValue="value"
                                     placeholder="Select schema"
                                   />
                                 </div>

                                 <div class="form-field" v-if="prop.type !== '$ref'">
                                    <label>Description</label>
                                    <InputText
                                      v-model="prop.description"
                                      placeholder="Property description"
                                    />
                                  </div>

                                  <!-- String validations -->
                                  <div
                                    v-if="prop.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="prop.format"
                                        :options="[
                                          '',
                                          'date',
                                          'date-time',
                                          'password',
                                          'byte',
                                          'binary',
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
                                        v-model="prop.pattern"
                                        placeholder="^[a-zA-Z0-9]+$"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="prop.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Min Length</label>
                                      <InputNumber
                                        v-model="prop.minLength"
                                        placeholder="Min length"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Length</label>
                                      <InputNumber
                                        v-model="prop.maxLength"
                                        placeholder="Max length"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <!-- Number/Integer validations -->
                                  <div
                                    v-if="
                                      prop.type === 'number' ||
                                      prop.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="prop.format"
                                        :options="
                                          prop.type === 'integer'
                                            ? ['', 'int32', 'int64']
                                            : ['', 'float', 'double']
                                        "
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Multiple Of</label>
                                      <InputNumber
                                        v-model="prop.multipleOf"
                                        placeholder="Multiple of"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      prop.type === 'number' ||
                                      prop.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Minimum</label>
                                      <InputNumber
                                        v-model="prop.minimum"
                                        placeholder="Min value"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Maximum</label>
                                      <InputNumber
                                        v-model="prop.maximum"
                                        placeholder="Max value"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      prop.type === 'number' ||
                                      prop.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        v-model="prop.exclusiveMinimum"
                                        :inputId="'prop-excl-min-' + propName"
                                        :binary="true"
                                      />
                                      <label :for="'prop-excl-min-' + propName"
                                        >Exclusive Minimum</label
                                      >
                                    </div>
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        v-model="prop.exclusiveMaximum"
                                        :inputId="'prop-excl-max-' + propName"
                                        :binary="true"
                                      />
                                      <label :for="'prop-excl-max-' + propName"
                                        >Exclusive Maximum</label
                                      >
                                    </div>
                                  </div>

                                  <!-- Array validations -->
                                  <div
                                    v-if="prop.type === 'array' && prop.items"
                                    class="form-field"
                                  >
                                    <label>Array Items Type</label>
                                    <Select
                                      v-model="prop.items.type"
                                      :options="[
                                        'string',
                                        'number',
                                        'integer',
                                        'boolean',
                                        'object',
                                        '$ref',
                                      ]"
                                      placeholder="Items type"
                                    />
                                  </div>
                                  <div
                                    v-if="prop.type === 'array' && prop.items && prop.items.type === '$ref'"
                                    class="form-field"
                                  >
                                    <label>Array Items Schema Reference</label>
                                    <Select
                                      v-model="prop.items.$ref"
                                      :options="availableSchemas"
                                      optionLabel="label"
                                      optionValue="value"
                                      placeholder="Select schema"
                                    />
                                  </div>

                                  <div
                                    v-if="prop.type === 'array'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Min Items</label>
                                      <InputNumber
                                        v-model="prop.minItems"
                                        placeholder="Min items"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Items</label>
                                      <InputNumber
                                        v-model="prop.maxItems"
                                        placeholder="Max items"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="prop.type === 'array'"
                                    class="form-field checkbox-field"
                                  >
                                    <Checkbox
                                      v-model="prop.uniqueItems"
                                      :inputId="'prop-unique-' + propName"
                                      :binary="true"
                                    />
                                    <label :for="'prop-unique-' + propName"
                                      >Unique Items</label
                                    >
                                  </div>

                                  <!-- Common validations for all types (hidden for $ref) -->
                                  <div class="form-field" v-if="prop.type !== '$ref'">
                                    <label>Enum Values</label>
                                    <AutoComplete multiple typeahead
                                      v-model="prop.enum"
                                      placeholder="Add value and press Enter"
                                    />
                                  </div>

                                  <div class="form-row" v-if="prop.type !== '$ref'">
                                    <div class="form-field">
                                      <label>Default Value</label>
                                      <InputText
                                        v-model="prop.default"
                                        placeholder="Default value"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Example</label>
                                      <InputText
                                        v-model="prop.example"
                                        placeholder="Example value"
                                      />
                                    </div>
                                  </div>

                                  <div class="form-row">
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        :checked="
                                          schema.data.required?.includes(propName)
                                        "
                                        @change="
                                          toggleSchemaPropertyRequired(
                                            schema.name,
                                            propName,
                                            $event.checked
                                          )
                                        "
                                        :inputId="'prop-req-' + propName"
                                        :binary="true"
                                      />
                                      <label :for="'prop-req-' + propName"
                                        >Required</label
                                      >
                                    </div>
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        v-model="prop.nullable"
                                        :inputId="'prop-nullable-' + propName"
                                        :binary="true"
                                      />
                                      <label :for="'prop-nullable-' + propName"
                                        >Nullable</label
                                      >
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  icon="pi pi-trash"
                                  severity="danger"
                                  text
                                  rounded
                                  @click="
                                    removeSchemaProperty(schema.name, propName)
                                  "
                                />
                              </div>
                            </div>

                            <!-- String top-level schema validations -->
                            <div v-if="schema.data.type === 'string'">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Format</label>
                                  <Select
                                    v-model="schema.data.format"
                                    :options="[
                                      '',
                                      'date',
                                      'date-time',
                                      'password',
                                      'byte',
                                      'binary',
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
                                    v-model="schema.data.pattern"
                                    placeholder="^[a-zA-Z0-9]+$"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Min Length</label>
                                  <InputNumber
                                    v-model="schema.data.minLength"
                                    placeholder="Min length"
                                    :min="0"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Max Length</label>
                                  <InputNumber
                                    v-model="schema.data.maxLength"
                                    placeholder="Max length"
                                    :min="0"
                                  />
                                </div>
                              </div>
                            </div>

                            <!-- Number/Integer top-level schema validations -->
                            <div
                              v-if="
                                schema.data.type === 'number' ||
                                schema.data.type === 'integer'
                              "
                            >
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Format</label>
                                  <Select
                                    v-model="schema.data.format"
                                    :options="
                                      schema.data.type === 'integer'
                                        ? ['', 'int32', 'int64']
                                        : ['', 'float', 'double']
                                    "
                                    placeholder="Format"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Multiple Of</label>
                                  <InputNumber
                                    v-model="schema.data.multipleOf"
                                    placeholder="Multiple of"
                                    :min="0"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Minimum</label>
                                  <InputNumber
                                    v-model="schema.data.minimum"
                                    placeholder="Min value"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Maximum</label>
                                  <InputNumber
                                    v-model="schema.data.maximum"
                                    placeholder="Max value"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field checkbox-field">
                                  <Checkbox
                                    v-model="schema.data.exclusiveMinimum"
                                    :inputId="'schema-excl-min-' + schema.name"
                                    :binary="true"
                                  />
                                  <label
                                    :for="'schema-excl-min-' + schema.name"
                                    >Exclusive Minimum</label
                                  >
                                </div>
                                <div class="form-field checkbox-field">
                                  <Checkbox
                                    v-model="schema.data.exclusiveMaximum"
                                    :inputId="'schema-excl-max-' + schema.name"
                                    :binary="true"
                                  />
                                  <label
                                    :for="'schema-excl-max-' + schema.name"
                                    >Exclusive Maximum</label
                                  >
                                </div>
                              </div>
                            </div>

                            <!-- Array top-level schema validations -->
                            <div v-if="schema.data.type === 'array'">
                              <div class="form-field" v-if="schema.data.items">
                                <label>Array Items Type</label>
                                <Select
                                  v-model="schema.data.items.type"
                                  :options="[
                                    'string',
                                    'number',
                                    'integer',
                                    'boolean',
                                    'object',
                                    '$ref',
                                  ]"
                                  placeholder="Items type"
                                />
                              </div>
                              <div
                                class="form-field"
                                v-if="schema.data.items && schema.data.items.type === '$ref'"
                              >
                                <label>Array Items Schema Reference</label>
                                <Select
                                  v-model="schema.data.items.$ref"
                                  :options="availableSchemas"
                                  optionLabel="label"
                                  optionValue="value"
                                  placeholder="Select schema"
                                />
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Min Items</label>
                                  <InputNumber
                                    v-model="schema.data.minItems"
                                    placeholder="Min items"
                                    :min="0"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Max Items</label>
                                  <InputNumber
                                    v-model="schema.data.maxItems"
                                    placeholder="Max items"
                                    :min="0"
                                  />
                                </div>
                              </div>
                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="schema.data.uniqueItems"
                                  :inputId="'schema-unique-' + schema.name"
                                  :binary="true"
                                />
                                <label :for="'schema-unique-' + schema.name"
                                  >Unique Items</label
                                >
                              </div>
                            </div>

                            <!-- Object top-level additional validations -->
                            <div v-if="schema.data.type === 'object'">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Min Properties</label>
                                  <InputNumber
                                    v-model="schema.data.minProperties"
                                    placeholder="Min properties"
                                    :min="0"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Max Properties</label>
                                  <InputNumber
                                    v-model="schema.data.maxProperties"
                                    placeholder="Max properties"
                                    :min="0"
                                  />
                                </div>
                              </div>
                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="schema.data.additionalProperties"
                                  :inputId="
                                    'schema-addl-props-' + schema.name
                                  "
                                  :binary="true"
                                  :trueValue="true"
                                  :falseValue="false"
                                />
                                <label
                                  :for="'schema-addl-props-' + schema.name"
                                  >Allow Additional Properties</label
                                >
                              </div>
                            </div>

                            <!-- Common fields for all non-object types -->
                            <div
                              v-if="schema.data.type !== 'object'"
                            >
                              <div class="form-field">
                                <label>Enum Values</label>
                                <AutoComplete multiple typeahead
                                  v-model="schema.data.enum"
                                  placeholder="Add value and press Enter"
                                />
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Default Value</label>
                                  <InputText
                                    v-model="schema.data.default"
                                    placeholder="Default value"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Example</label>
                                  <InputText
                                    v-model="schema.data.example"
                                    placeholder="Example value"
                                  />
                                </div>
                              </div>
                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="schema.data.nullable"
                                  :inputId="'schema-nullable-' + schema.name"
                                  :binary="true"
                                />
                                <label
                                  :for="'schema-nullable-' + schema.name"
                                  >Nullable</label
                                >
                              </div>
                            </div>
                          </div>
                        </TabPanel>
                        <TabPanel value="1">
                          <div class="schema-json-editor">
                            <div class="json-editor-header">
                              <label>Schema JSON</label>
                              <div class="json-editor-actions">
                                <Button
                                  label="Format"
                                  icon="pi pi-align-left"
                                  size="small"
                                  text
                                  @click="
                                    updateSchema(
                                      schema.name,
                                      JSON.stringify(
                                        JSON.parse(
                                          JSON.stringify(schema.data, null, 2)
                                        ),
                                        null,
                                        2
                                      )
                                    )
                                  "
                                />
                                <Button
                                  label="Copy"
                                  icon="pi pi-copy"
                                  size="small"
                                  text
                                  @click="
                                    navigator.clipboard.writeText(
                                      JSON.stringify(schema.data, null, 2)
                                    )
                                  "
                                />
                              </div>
                            </div>
                            <div class="json-editor-wrapper">
                              <Textarea
                                :value="JSON.stringify(schema.data, null, 2)"
                                @input="
                                  updateSchema(schema.name, $event.target.value)
                                "
                                rows="20"
                                class="json-textarea monaco-style"
                                spellcheck="false"
                              />
                            </div>
                          </div>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <!-- Add Path Dialog -->
    <Dialog
      :visible="showAddPathDialog"
      @update:visible="showAddPathDialog = $event"
      header="Add New Path"
      :style="{ width: '520px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label>HTTP Method</label>
          <SelectButton
            v-model="newMethod"
            :options="httpMethods"
            class="method-select-button"
          >
            <template #option="slotProps">
              <span :class="['method-chip', 'method-' + slotProps.option.toLowerCase()]">
                {{ slotProps.option.toUpperCase() }}
              </span>
            </template>
          </SelectButton>
        </div>
        <div class="form-field">
          <label for="new-path">Path</label>
          <InputGroup>
            <InputGroupAddon class="path-addon">/</InputGroupAddon>
            <InputText
              id="new-path"
              v-model="newPath"
              placeholder="users/{id}"
              @keydown="handlePathKeydown"
            />
          </InputGroup>
          <small class="helper-text">Use {param} for path variables — e.g. users/{id}</small>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddPathDialog = false" />
        <Button
          label="Add Path"
          icon="pi pi-plus"
          @click="addPath"
          :disabled="!newPath || !newMethod"
        />
      </template>
    </Dialog>

    <!-- Add Method Dialog -->
    <Dialog
      :visible="showAddMethodDialogVisible"
      @update:visible="showAddMethodDialogVisible = $event"
      header="Add Method to Path"
      :style="{ width: '520px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label>HTTP Method</label>
          <SelectButton
            v-model="methodToAdd"
            :options="availableMethodsForPath"
            class="method-select-button"
          >
            <template #option="slotProps">
              <span :class="['method-chip', 'method-' + slotProps.option.toLowerCase()]">
                {{ slotProps.option.toUpperCase() }}
              </span>
            </template>
          </SelectButton>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancel"
          text
          @click="showAddMethodDialogVisible = false"
        />
        <Button label="Add Method" icon="pi pi-plus" @click="addMethodToPath" :disabled="!methodToAdd" />
      </template>
    </Dialog>

    <!-- Add Schema Dialog -->
    <Dialog
      :visible="showAddSchemaDialog"
      @update:visible="showAddSchemaDialog = $event"
      header="Add New Schema"
      :style="{ width: '400px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label for="new-schema-name">Schema Name *</label>
          <InputText
            id="new-schema-name"
            v-model="newSchemaName"
            placeholder="User"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddSchemaDialog = false" />
        <Button label="Add" @click="addSchema" :disabled="!newSchemaName" />
      </template>
    </Dialog>
    <ConfirmDialog />
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Dialog from "primevue/dialog";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";
import SelectButton from "primevue/selectbutton";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

export default {
  name: "FormEditor",
  components: {
    Button,
    InputText,
    InputNumber,
    Textarea,
    Select,
    Checkbox,
    AutoComplete,
    Dialog,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Tag,
    SelectButton,
    InputGroup,
    InputGroupAddon,
    ConfirmDialog,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    showLivePreview: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup(props, { emit }) {
    const formData = ref({
      openapi: "3.0.0",
      info: {
        title: "",
        version: "",
        description: "",
        contact: { name: "", email: "" },
        license: { name: "", url: "" },
      },
      servers: [],
      paths: {},
      components: {
        schemas: {},
      },
    });

    const hasChanges = ref(false);
    const showAddPathDialog = ref(false);
    const showAddMethodDialogVisible = ref(false);
    const showAddSchemaDialog = ref(false);
    const showAddResponseDialog = ref(false);
    const newPath = ref("");
    const newMethod = ref("");
    const newSchemaName = ref("");
    const newResponseCode = ref("");
    const methodToAdd = ref("");
    const currentPathForMethod = ref("");
    const selectedPath = ref("");
    const selectedMethod = ref("");
    const requestBodyContentType = ref("application/json");
    const requestBodySchemaType = ref("reference");
    const requestBodySchemaRef = ref("");
    const draggedProperty = ref(null);
    const draggedPropertyIndex = ref(null);
    const draggedSchemaName = ref(null);
    const draggedPath = ref(null);
    const draggedPathIndex = ref(null);
    const draggedMethod = ref(null);
    const draggedMethodIndex = ref(null);
    const draggedMethodPath = ref(null);

    const confirm = useConfirm();
    const toast = useToast();

    const httpMethods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ];

    // Helper: normalize $ref properties on load for form editing
    const normalizeRefsForForm = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      if (obj.components && obj.components.schemas) {
        for (const schemaName of Object.keys(obj.components.schemas)) {
          const schema = obj.components.schemas[schemaName];
          if (schema.properties) {
            for (const propName of Object.keys(schema.properties)) {
              const prop = schema.properties[propName];
              if (prop.$ref && !prop.type) {
                prop.type = '$ref';
              }
              if (prop.type === 'array' && prop.items && prop.items.$ref && !prop.items.type) {
                prop.items.type = '$ref';
              }
            }
          }
          if (schema.type === 'array' && schema.items && schema.items.$ref && !schema.items.type) {
            schema.items.type = '$ref';
          }
        }
      }
      return obj;
    };

    // Helper: clean $ref properties on emit for valid OpenAPI output
    const cleanRefsForOutput = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      if (obj.components && obj.components.schemas) {
        for (const schemaName of Object.keys(obj.components.schemas)) {
          const schema = obj.components.schemas[schemaName];
          if (schema.properties) {
            for (const propName of Object.keys(schema.properties)) {
              const prop = schema.properties[propName];
              if (prop.type === '$ref') {
                const ref = prop.$ref || '';
                schema.properties[propName] = { $ref: ref };
              } else if (prop.type === 'array' && prop.items && prop.items.type === '$ref') {
                const ref = prop.items.$ref || '';
                prop.items = { $ref: ref };
              }
            }
          }
          if (schema.type === 'array' && schema.items && schema.items.type === '$ref') {
            const ref = schema.items.$ref || '';
            schema.items = { $ref: ref };
          }
        }
      }
      return obj;
    };

    // Initialize form data from prop
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue && Object.keys(newValue).length > 0) {
          formData.value = normalizeRefsForForm(JSON.parse(JSON.stringify(newValue)));
          // Ensure nested objects exist
          if (!formData.value.info) formData.value.info = {};
          if (!formData.value.info.contact) formData.value.info.contact = {};
          if (!formData.value.info.license) formData.value.info.license = {};
          if (!formData.value.servers) formData.value.servers = [];
          if (!formData.value.paths) formData.value.paths = {};
          if (!formData.value.components) formData.value.components = {};
          if (!formData.value.components.schemas)
            formData.value.components.schemas = {};
        }
      },
      { immediate: true, deep: true }
    );

    // Watch for form changes and emit updates to parent on every deep change
    watch(
      formData,
      (newVal) => {
        hasChanges.value = true;
        try {
          const cleaned = JSON.parse(JSON.stringify(newVal));
          if (cleaned.info) {
            if (
              cleaned.info.contact &&
              !cleaned.info.contact.name &&
              !cleaned.info.contact.email
            ) {
              delete cleaned.info.contact;
            }
            if (
              cleaned.info.license &&
              !cleaned.info.license.name &&
              !cleaned.info.license.url
            ) {
              delete cleaned.info.license;
            }
          }
          emit("update:modelValue", cleanRefsForOutput(cleaned));
        } catch (e) {
          // Fallback: emit raw value if cloning fails
          emit("update:modelValue", newVal);
        }
      },
      { deep: true }
    );

    const pathsList = computed(() => {
      return Object.keys(formData.value.paths).map((path) => ({
        path,
        methods: Object.keys(formData.value.paths[path]),
      }));
    });

    const schemasList = computed(() => {
      return Object.keys(formData.value.components?.schemas || {}).map(
        (name) => ({
          name,
          data: formData.value.components.schemas[name],
        })
      );
    });

    const availableMethodsForPath = computed(() => {
      if (!currentPathForMethod.value) return httpMethods;
      const existingMethods = Object.keys(
        formData.value.paths[currentPathForMethod.value] || {}
      );
      return httpMethods.filter((m) => !existingMethods.includes(m));
    });

    // syncWithJson removed: deep watcher now emits updates automatically

    const hasEmptyServerUrl = computed(() => {
      return formData.value.servers.some((server) => !server.url || server.url.trim() === "");
    });

    const addServer = () => {
      if (hasEmptyServerUrl.value) {
        toast.add({
          severity: "error",
          summary: "Cannot Add Server",
          detail: "Please fill in the URL for all existing servers first.",
          life: 3000,
        });
        return;
      }
      formData.value.servers.push({ url: "", description: "" });
      toast.add({
        severity: "success",
        summary: "Server Added",
        detail: "A new server entry has been added.",
        life: 3000,
      });
    };

    const removeServer = (index) => {
      confirm.require({
        message: "Are you sure you want to delete this server?",
        header: "Confirm Deletion",
        icon: "pi pi-exclamation-triangle",
        acceptProps: {
            label: "Yes",
            severity: "danger",
        },
        rejectProps: {
            label: "No",
            outlined: true,
        },
        accept: () => {
          formData.value.servers.splice(index, 1);
          toast.add({
            severity: "success",
            summary: "Server Deleted",
            detail: "The server has been removed.",
            life: 3000,
          });
          confirm.close();
        },
        reject: () => {
          confirm.close();
        }
      });
    };

    const addPath = () => {
      if (!newPath.value || !newMethod.value) return;

      const fullPath = newPath.value.startsWith('/') ? newPath.value : '/' + newPath.value;

      if (!formData.value.paths[fullPath]) {
        formData.value.paths[fullPath] = {};
      }

      formData.value.paths[fullPath][newMethod.value] = {
        summary: "",
        description: "",
        operationId: "",
        tags: [],
        deprecated: false,
        responses: {
          200: {
            description: "Successful response",
          },
        },
      };

      selectedPath.value = fullPath;
      selectedMethod.value = newMethod.value;
      newPath.value = "";
      newMethod.value = "";
      showAddPathDialog.value = false;
    };

    const removePath = (path) => {
      delete formData.value.paths[path];
      if (selectedPath.value === path) {
        selectedPath.value = "";
        selectedMethod.value = "";
      }
    };

    const removeMethod = (path, method) => {
      if (!formData.value.paths[path]) return;

      confirm.require({
        message: `Are you sure you want to remove the ${method.toUpperCase()} method from ${path}?`,
        header: "Confirm Deletion",
        icon: "pi pi-exclamation-triangle",
        acceptProps: {
          label: "Yes",
          severity: "danger",
        },
        rejectProps: {
          label: "No",
          outlined: true,
        },
        accept: () => {
          // Delete the method from the path
          delete formData.value.paths[path][method];

          // If this was the selected method, clear the selection
          if (selectedPath.value === path && selectedMethod.value === method) {
            selectedMethod.value = "";
          }

          // If no methods left for this path, remove the path entirely
          const remainingMethods = Object.keys(formData.value.paths[path]).filter(
            (key) =>
              !["summary", "description", "servers", "parameters"].includes(key)
          );

          if (remainingMethods.length === 0) {
            delete formData.value.paths[path];
            selectedPath.value = "";
          }

          toast.add({
            severity: "success",
            summary: "Method Removed",
            detail: `${method.toUpperCase()} removed from ${path}.`,
            life: 3000,
          });
          confirm.close();
        },
        reject: () => {
          confirm.close();
        },
      });
    };

    const showAddMethodDialog = (path) => {
      currentPathForMethod.value = path;
      methodToAdd.value = "";
      showAddMethodDialogVisible.value = true;
    };

    const addMethodToPath = () => {
      if (!methodToAdd.value || !currentPathForMethod.value) return;

      formData.value.paths[currentPathForMethod.value][methodToAdd.value] = {
        summary: "",
        description: "",
        operationId: "",
        tags: [],
        deprecated: false,
        responses: {
          200: {
            description: "Successful response",
          },
        },
      };

      selectedPath.value = currentPathForMethod.value;
      selectedMethod.value = methodToAdd.value;
      showAddMethodDialogVisible.value = false;
    };

    const selectPathMethod = (path, method) => {
      selectedPath.value = path;
      selectedMethod.value = method;
    };

    const addSchema = () => {
      if (!newSchemaName.value) return;

      formData.value.components.schemas[newSchemaName.value] = {
        type: "object",
        properties: {},
      };

      newSchemaName.value = "";
      showAddSchemaDialog.value = false;
    };

    const removeSchema = (name) => {
      delete formData.value.components.schemas[name];
    };

    const updateSchema = (name, jsonString) => {
      try {
        formData.value.components.schemas[name] = JSON.parse(jsonString);
      } catch (e) {
        // Invalid JSON, don't update
      }
    };

    const getMethodSeverity = (method) => {
      const severityMap = {
        get: "info",
        post: "success",
        put: "warn",
        patch: "warn",
        delete: "danger",
        options: "secondary",
        head: "secondary",
      };
      return severityMap[method.toLowerCase()] || "secondary";
    };

    const getMethodDescription = (method) => {
      const descriptions = {
        get: "Retrieve data",
        post: "Create new resource",
        put: "Update entire resource",
        patch: "Partial update",
        delete: "Remove resource",
        options: "Describe options",
        head: "Get headers only",
      };
      return descriptions[method.toLowerCase()] || "";
    };

    const getStatusSeverity = (statusCode) => {
      const code = parseInt(statusCode);
      if (code >= 200 && code < 300) return "success";
      if (code >= 300 && code < 400) return "info";
      if (code >= 400 && code < 500) return "warn";
      if (code >= 500) return "danger";
      return "secondary";
    };

    // Computed properties for current method
    const currentMethodData = computed(() => {
      if (!selectedPath.value || !selectedMethod.value) return {};
      const methodData =
        formData.value.paths[selectedPath.value]?.[selectedMethod.value] || {};

      // Ensure structures exist
      if (!methodData.parameters) methodData.parameters = [];
      if (!methodData.requestBody)
        methodData.requestBody = { required: false, description: "" };
      if (!methodData.responses) methodData.responses = {};

      return methodData;
    });

    const availableSchemas = computed(() => {
      return Object.keys(formData.value.components?.schemas || {}).map(
        (name) => ({ label: name, value: `#/components/schemas/${name}` })
      );
    });

    // Parameter methods
    const addParameter = (path, method) => {
      if (!formData.value.paths[path][method].parameters) {
        formData.value.paths[path][method].parameters = [];
      }
      formData.value.paths[path][method].parameters.push({
        name: "",
        in: "query",
        description: "",
        required: false,
        schema: { type: "string", items: { type: "string" } },
      });
    };

    const removeParameter = (path, method, index) => {
      formData.value.paths[path][method].parameters.splice(index, 1);
    };

    // Request body methods
    const getRequestBodyInlineSchema = () => {
      const content = currentMethodData.value.requestBody?.content;
      if (!content || !requestBodyContentType.value) return "{}";
      const schema = content[requestBodyContentType.value]?.schema;
      return JSON.stringify(schema || {}, null, 2);
    };

    const updateRequestBodyInlineSchema = (jsonString) => {
      try {
        const schema = JSON.parse(jsonString);
        if (!currentMethodData.value.requestBody.content) {
          currentMethodData.value.requestBody.content = {};
        }
        if (
          !currentMethodData.value.requestBody.content[
            requestBodyContentType.value
          ]
        ) {
          currentMethodData.value.requestBody.content[
            requestBodyContentType.value
          ] = {};
        }
        currentMethodData.value.requestBody.content[
          requestBodyContentType.value
        ].schema = schema;
      } catch (e) {
        // Invalid JSON
      }
    };

    // Watch for request body schema type changes
    watch(
      [requestBodySchemaType, requestBodySchemaRef, requestBodyContentType],
      () => {
        if (!selectedPath.value || !selectedMethod.value) return;

        const methodData =
          formData.value.paths[selectedPath.value][selectedMethod.value];
        if (!methodData.requestBody)
          methodData.requestBody = { required: false };
        if (!methodData.requestBody.content)
          methodData.requestBody.content = {};

        if (
          requestBodyContentType.value &&
          requestBodySchemaType.value === "reference" &&
          requestBodySchemaRef.value
        ) {
          methodData.requestBody.content[requestBodyContentType.value] = {
            schema: { $ref: requestBodySchemaRef.value },
          };
        }
      }
    );

    // Response methods
    const addResponse = () => {
      if (!newResponseCode.value) return;

      if (
        !formData.value.paths[selectedPath.value][selectedMethod.value]
          .responses
      ) {
        formData.value.paths[selectedPath.value][
          selectedMethod.value
        ].responses = {};
      }

      formData.value.paths[selectedPath.value][selectedMethod.value].responses[
        newResponseCode.value
      ] = {
        description: "",
        content: {},
      };

      newResponseCode.value = "";
      showAddResponseDialog.value = false;
    };

    const removeResponse = (path, method, statusCode) => {
      delete formData.value.paths[path][method].responses[statusCode];
    };

    const getResponseContentType = (response) => {
      if (!response.content) return "";
      return Object.keys(response.content)[0] || "";
    };

    const setResponseContentType = (response, contentType) => {
      if (!response.content) response.content = {};
      const oldContent = response.content;
      response.content = {};
      if (contentType) {
        response.content[contentType] = oldContent[
          Object.keys(oldContent)[0]
        ] || { schema: {} };
      }
    };

    const getResponseSchemaType = (response) => {
      const contentType = getResponseContentType(response);
      if (!contentType || !response.content[contentType]?.schema)
        return "inline";
      return response.content[contentType].schema.$ref ? "reference" : "inline";
    };

    const setResponseSchemaType = (response, type) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return;

      if (type === "reference") {
        response.content[contentType].schema = { $ref: "" };
      } else {
        response.content[contentType].schema = { type: "object" };
      }
    };

    const getResponseSchemaRef = (response) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return "";
      return response.content[contentType]?.schema?.$ref || "";
    };

    const setResponseSchemaRef = (response, ref) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return;
      response.content[contentType].schema = { $ref: ref };
    };

    const getResponseInlineSchema = (response) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return "{}";
      const schema = response.content[contentType]?.schema;
      if (schema?.$ref) return "{}";
      return JSON.stringify(schema || {}, null, 2);
    };

    const updateResponseInlineSchema = (response, jsonString) => {
      try {
        const schema = JSON.parse(jsonString);
        const contentType = getResponseContentType(response);
        if (contentType) {
          response.content[contentType].schema = schema;
        }
      } catch (e) {
        // Invalid JSON
      }
    };

    // Schema builder methods
    const addSchemaProperty = (schemaName) => {
      const schema = formData.value.components.schemas[schemaName];
      if (!schema.properties) schema.properties = {};

      let propName = "newProperty";
      let counter = 1;
      while (schema.properties[propName]) {
        propName = `newProperty${counter}`;
        counter++;
      }

      schema.properties[propName] = {
        type: "string",
        description: "",
        items: { type: "string" },
      };
    };

    const removeSchemaProperty = (schemaName, propName) => {
      const schema = formData.value.components.schemas[schemaName];
      delete schema.properties[propName];

      // Remove from required array if present
      if (schema.required) {
        schema.required = schema.required.filter((r) => r !== propName);
      }
    };

    const renameSchemaProperty = (schemaName, oldName, newName) => {
      if (oldName === newName || !newName) return;

      const schema = formData.value.components.schemas[schemaName];
      if (!schema.properties) return;

      if (schema.properties[newName]) {
        // New name already exists
        return;
      }

      schema.properties[newName] = schema.properties[oldName];
      delete schema.properties[oldName];

      // Update required array
      if (schema.required) {
        const index = schema.required.indexOf(oldName);
        if (index !== -1) {
          schema.required[index] = newName;
        }
      }
    };

    const toggleSchemaPropertyRequired = (schemaName, propName, isRequired) => {
      const schema = formData.value.components.schemas[schemaName];
      if (!schema.required) schema.required = [];

      if (isRequired) {
        if (!schema.required.includes(propName)) {
          schema.required.push(propName);
        }
      } else {
        schema.required = schema.required.filter((r) => r !== propName);
      }
    };

    // Type change handlers - initialize sub-structures
    const onSchemaTypeChange = (schema) => {
      if (schema.data.type === 'array' && !schema.data.items) {
        schema.data.items = { type: 'string' };
      }
      if (schema.data.type === 'object' && !schema.data.properties) {
        schema.data.properties = {};
      }
    };

    const onPropertyTypeChange = (prop) => {
      if (prop.type === 'array' && !prop.items) {
        prop.items = { type: 'string' };
      }
      if (prop.type === '$ref' && !prop.$ref) {
        prop.$ref = '';
      }
    };

    // Drag and drop handlers
    const handleDragStart = (event, schemaName, propName, index) => {
      draggedProperty.value = propName;
      draggedPropertyIndex.value = index;
      draggedSchemaName.value = schemaName;
      event.target.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/html", event.target.innerHTML);
    };

    const handleDragOver = (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (event, schemaName, dropIndex) => {
      event.preventDefault();
      event.stopPropagation();

      if (draggedSchemaName.value !== schemaName) return;
      if (draggedPropertyIndex.value === dropIndex) return;

      const schema = formData.value.components.schemas[schemaName];
      const properties = schema.properties;

      // Convert properties object to array to reorder
      const propsArray = Object.entries(properties);
      const [movedItem] = propsArray.splice(draggedPropertyIndex.value, 1);
      propsArray.splice(dropIndex, 0, movedItem);

      // Rebuild properties object with new order
      schema.properties = Object.fromEntries(propsArray);
    };

    const handleDragEnd = (event) => {
      event.target.classList.remove("dragging");
      event.target.classList.remove("dragging-method");
      draggedProperty.value = null;
      draggedPropertyIndex.value = null;
      draggedSchemaName.value = null;
      draggedPath.value = null;
      draggedPathIndex.value = null;
      draggedMethod.value = null;
      draggedMethodIndex.value = null;
      draggedMethodPath.value = null;
    };

    // Path drag and drop handlers
    const handlePathDragStart = (event, path, index) => {
      draggedPath.value = path;
      draggedPathIndex.value = index;
      event.target.classList.add("dragging-path");
      event.dataTransfer.effectAllowed = "move";
    };

    const handlePathDrop = (event, dropIndex) => {
      event.preventDefault();
      event.stopPropagation();

      if (draggedPathIndex.value === dropIndex) return;

      // Convert paths object to array to reorder
      const pathsArray = Object.entries(formData.value.paths);
      const [movedItem] = pathsArray.splice(draggedPathIndex.value, 1);
      pathsArray.splice(dropIndex, 0, movedItem);

      // Rebuild paths object with new order
      formData.value.paths = Object.fromEntries(pathsArray);
    };

    // Method drag and drop handlers
    const handleMethodDragStart = (event, path, method, index) => {
      draggedMethod.value = method;
      draggedMethodIndex.value = index;
      draggedMethodPath.value = path;
      event.target.classList.add("dragging-method");
      event.dataTransfer.effectAllowed = "move";
      event.stopPropagation();
    };

    const handleMethodDrop = (event, path, dropIndex) => {
      event.preventDefault();
      event.stopPropagation();

      if (draggedMethodPath.value !== path) return;
      if (draggedMethodIndex.value === dropIndex) return;

      const pathData = formData.value.paths[path];

      // Get the HTTP methods in order
      const methodsArray = Object.keys(pathData);

      // Get the method data before reordering
      const methodDataMap = {};
      methodsArray.forEach((method) => {
        methodDataMap[method] = pathData[method];
      });

      // Reorder methods
      const [movedMethod] = methodsArray.splice(draggedMethodIndex.value, 1);
      methodsArray.splice(dropIndex, 0, movedMethod);

      // Rebuild path object with new method order
      const newPathData = {};
      methodsArray.forEach((method) => {
        newPathData[method] = methodDataMap[method];
      });

      formData.value.paths[path] = newPathData;
    };

    const handlePathKeydown = (event) => {
      if (event.key === '{') {
        event.preventDefault();
        const input = event.target;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const value = input.value;
        const newValue = value.substring(0, start) + '{}' + value.substring(end);
        newPath.value = newValue;
        // Move cursor inside the braces on next tick
        setTimeout(() => {
          input.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
    };

    return {
      formData,
      hasChanges,
      showAddPathDialog,
      showAddMethodDialogVisible,
      showAddSchemaDialog,
      showAddResponseDialog,
      newPath,
      newMethod,
      newSchemaName,
      newResponseCode,
      methodToAdd,
      currentPathForMethod,
      selectedPath,
      selectedMethod,
      requestBodyContentType,
      requestBodySchemaType,
      requestBodySchemaRef,
      draggedProperty,
      draggedPath,
      draggedMethod,
      httpMethods,
      pathsList,
      schemasList,
      availableMethodsForPath,
      availableSchemas,
      currentMethodData,
      addServer,
      removeServer,
      addPath,
      removePath,
      removeMethod,
      showAddMethodDialog,
      addMethodToPath,
      selectPathMethod,
      addSchema,
      removeSchema,
      updateSchema,
      getMethodSeverity,
      getMethodDescription,
      getStatusSeverity,
      addParameter,
      removeParameter,
      getRequestBodyInlineSchema,
      updateRequestBodyInlineSchema,
      addResponse,
      removeResponse,
      getResponseContentType,
      setResponseContentType,
      getResponseSchemaType,
      setResponseSchemaType,
      getResponseSchemaRef,
      setResponseSchemaRef,
      getResponseInlineSchema,
      updateResponseInlineSchema,
      addSchemaProperty,
      removeSchemaProperty,
      renameSchemaProperty,
      toggleSchemaPropertyRequired,
      onSchemaTypeChange,
      onPropertyTypeChange,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      handlePathDragStart,
      handlePathDrop,
      handleMethodDragStart,
      handleMethodDrop,
      handlePathKeydown,
      hasEmptyServerUrl,
    };
  },
};
</script>

<style scoped>
.form-editor {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.form-header {
  padding: 16px 20px;
  background: #1f2937;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.form-header__controls :deep(.p-button) {
  color: rgba(255, 255, 255, 0.85) !important;
  background: transparent;
  border: none;
}

.form-header__controls :deep(.p-button:hover) {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.form-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.form-content::-webkit-scrollbar {
  width: 6px;
}

.form-content::-webkit-scrollbar-track {
  background: transparent;
}

.form-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.form-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.form-section {
  padding: 28px 24px;
}

.form-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.section-header h4 {
  margin-bottom: 0;
}

.section-header h5 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.form-field :deep(.p-inputtext),
.form-field :deep(.p-textarea),
.form-field :deep(.p-select),
.form-field :deep(.p-inputnumber-input) {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 14px;
  transition: border-color 0.15s ease;
  background: #ffffff;
}

.form-field :deep(.p-inputtext:hover),
.form-field :deep(.p-textarea:hover),
.form-field :deep(.p-select:hover),
.form-field :deep(.p-inputnumber-input:hover) {
  border-color: #d1d5db;
}

.form-field :deep(.p-inputtext:focus),
.form-field :deep(.p-textarea:focus),
.form-field :deep(.p-select:focus),
.form-field :deep(.p-inputnumber-input:focus) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  outline: none;
}

.form-field :deep(.p-autocomplete) {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 10px;
  transition: border-color 0.15s ease;
}

.form-field :deep(.p-autocomplete:hover) {
  border-color: #d1d5db;
}

.form-field :deep(.p-autocomplete:focus-within) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #f3f4f6;
}

.checkbox-field:hover {
  background: #f3f4f6;
}

.checkbox-field label {
  margin-bottom: 0;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

:deep(.p-button) {
  border-radius: 6px;
  font-weight: 500;
  padding: 8px 16px;
  transition: background-color 0.15s ease;
  border: none;
  font-size: 13px;
}

:deep(.p-button:hover:not(:disabled)) {
  opacity: 0.9;
  transform: none !important;
}

:deep(.p-button-sm) {
  padding: 6px 12px;
  font-size: 12px;
}

:deep(.p-button-danger) {
  background: #ef4444;
}

:deep(.p-button-danger:hover) {
  background: #dc2626;
}

:deep(.p-button-secondary) {
  background: #f3f4f6;
  color: #374151;
}

:deep(.p-button-secondary:hover) {
  background: #e5e7eb;
}

.list-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 10px;
  align-items: flex-start;
  transition: border-color 0.15s ease;
}

.list-item:hover {
  border-color: #d1d5db;
}

.list-item-content {
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px dashed #e5e7eb;
}

.empty-state i {
  font-size: 40px;
  margin-bottom: 12px;
  color: #d1d5db;
}

.empty-state p {
  font-size: 14px;
  color: #6b7280;
}

.empty-state-small {
  text-align: center;
  padding: 32px 16px;
  color: #9ca3af;
  font-size: 13px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px dashed #e5e7eb;
}

/* ── Path accordion header ── */
.path-header,
.schema-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  cursor: move;
}

.path-header .drag-handle {
  color: #d1d5db;
  cursor: grab;
  flex-shrink: 0;
}

.path-header .drag-handle:hover {
  color: #9ca3af;
}

:deep(.dragging-path) {
  opacity: 0.5;
  background: #f3f4f6;
}

.path-header-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
}

.path-url,
.schema-name {
  font-family: "SF Mono", "Monaco", "Inconsolata", "Courier New", monospace;
  font-weight: 600;
  font-size: 13px;
  color: #111827;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Method pill chips in the accordion header — same design as SelectButton dialog chips ── */
.path-method-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  border-radius: 999px;
  border: 1.5px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  user-select: none;
  box-shadow: none;
}

.path-method-chip:focus {
  box-shadow: none;
}

/* Per-method border + background (mirrors the SelectButton togglebutton rules) */
.path-method-chip:has(.method-chip.method-get)    { border-color: #bfdbfe; background: #eff6ff; }
.path-method-chip:has(.method-chip.method-post)   { border-color: #bbf7d0; background: #f0fdf4; }
.path-method-chip:has(.method-chip.method-put)    { border-color: #fde68a; background: #fffbeb; }
.path-method-chip:has(.method-chip.method-patch)  { border-color: #fed7aa; background: #fff7ed; }
.path-method-chip:has(.method-chip.method-delete) { border-color: #fecaca; background: #fef2f2; }
.path-method-chip:has(.method-chip.method-options),
.path-method-chip:has(.method-chip.method-head)   { border-color: #e5e7eb; background: #f9fafb; }

/* Active state: stronger border, same background (mirrors checked togglebutton rules) */
.path-method-chip.path-method-chip--active:has(.method-chip.method-get)    { border-color: #2563eb; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-post)   { border-color: #16a34a; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-put)    { border-color: #d97706; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-patch)  { border-color: #ea580c; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-delete) { border-color: #dc2626; border-width: 2px; }
.path-method-chip.path-method-chip--active:has(.method-chip.method-options),
.path-method-chip.path-method-chip--active:has(.method-chip.method-head)   { border-color: #4b5563; border-width: 2px; }

.path-method-chip.dragging-method {
  opacity: 0.4;
}

/* Delete ✕ inside chip */
.chip-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-left: 1px;
  cursor: pointer;
  font-size: 9px;
  opacity: 0;
  transition: opacity 0.15s ease;
  color: inherit;
}

.path-method-chip:hover .chip-delete-btn {
  opacity: 0.65;
}

.chip-delete-btn:hover {
  opacity: 1;
}

.path-add-method-btn {
  flex-shrink: 0;
}

.path-delete-btn {
  flex-shrink: 0;
}

/* ── Path methods editor (accordion content) ── */
.path-methods-editor {
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #f3f4f6;
}

.method-editor {
  /* no top border needed — content starts directly */
}

.param-item,
.property-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 10px;
  align-items: flex-start;
  cursor: move;
  transition: border-color 0.15s ease;
}

.property-item:hover,
.param-item:hover {
  border-color: #d1d5db;
}

.property-item.dragging {
  opacity: 0.5;
  border-color: #3b82f6;
  background: #f9fafb;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #d1d5db;
  cursor: grab;
  user-select: none;
  border-radius: 4px;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle:hover {
  color: #9ca3af;
  background: #f3f4f6;
}

.param-content,
.property-content {
  flex: 1;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.schema-selector {
  display: flex;
  gap: 10px;
}

.schema-selector :deep(.p-select) {
  flex: 1;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.response-header span {
  flex: 1;
  font-weight: 500;
  font-size: 13px;
  color: #374151;
}

.schema-builder {
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.schema-json-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.json-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.json-editor-header label {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  margin: 0;
}

.json-editor-actions {
  display: flex;
  gap: 4px;
}

.json-editor-wrapper {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  width: 100%;
}

.json-textarea.monaco-style {
  font-family: "SF Mono", "Monaco", "Inconsolata", "Consolas", monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border: none;
  border-radius: 6px;
  resize: vertical;
  min-height: 300px;
  width: 100%;
  box-sizing: border-box;
  tab-size: 2;
  -moz-tab-size: 2;
}

.json-textarea.monaco-style:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.json-textarea.monaco-style::selection {
  background: rgba(59, 130, 246, 0.3);
}

.json-textarea {
  font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
  font-size: 13px;
  line-height: 1.5;
}

.dialog-content {
  padding: 16px 0;
}

:deep(.p-dialog) {
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

:deep(.p-dialog-header) {
  padding: 16px 20px;
  background: #1f2937;
  color: white;
  border-bottom: none;
}

:deep(.p-dialog-title) {
  font-weight: 600;
  font-size: 15px;
}

:deep(.p-dialog-header-close) {
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.15s ease;
}

:deep(.p-dialog-header-close:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

:deep(.p-dialog-content) {
  padding: 20px;
  background: #ffffff;
}

:deep(.p-dialog-footer) {
  padding: 12px 20px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  background: #ffffff;
}

.method-selector-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.method-selector-button {
  padding: 12px 14px;
  border: 1px solid;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  background: #ffffff;
  text-align: left;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.method-selector-button:hover {
  opacity: 0.85;
}

.method-selector-button.selected {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.method-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.method-description {
  font-size: 11px;
  opacity: 0.65;
  font-weight: 400;
}

.method-selector-button.method-get {
  color: #1d4ed8;
  border-color: #bfdbfe;
  background: #eff6ff;
}

.method-selector-button.method-get.selected {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.method-selector-button.method-post {
  color: #166534;
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.method-selector-button.method-post.selected {
  background: #22c55e;
  color: white;
  border-color: #22c55e;
}

.method-selector-button.method-put {
  color: #92400e;
  border-color: #fde68a;
  background: #fffbeb;
}

.method-selector-button.method-put.selected {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.method-selector-button.method-patch {
  color: #9a3412;
  border-color: #fed7aa;
  background: #fff7ed;
}

.method-selector-button.method-patch.selected {
  background: #f97316;
  color: white;
  border-color: #f97316;
}

.method-selector-button.method-delete {
  color: #991b1b;
  border-color: #fecaca;
  background: #fef2f2;
}

.method-selector-button.method-delete.selected {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.method-selector-button.method-options,
.method-selector-button.method-head {
  color: #4b5563;
  border-color: #e5e7eb;
  background: #f9fafb;
}

.method-selector-button.method-options.selected,
.method-selector-button.method-head.selected {
  background: #6b7280;
  color: white;
  border-color: #6b7280;
}

/* ── New SelectButton method chips ── */
.method-select-button {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

:deep(.method-select-button .p-selectbutton) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 0;
}

:deep(.method-select-button .p-togglebutton) {
  flex: 0 0 auto;
  min-width: 0;
  padding: 4px 10px;
  border-radius: 999px !important;
  border: 1.5px solid #e5e7eb !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: all 0.15s ease;
}

:deep(.method-select-button .p-togglebutton:focus) {
  box-shadow: none !important;
}

.method-chip {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 0;
}

.method-chip.method-get   { color: #1d4ed8; }
.method-chip.method-post  { color: #166534; }
.method-chip.method-put   { color: #92400e; }
.method-chip.method-patch { color: #9a3412; }
.method-chip.method-delete { color: #991b1b; }
.method-chip.method-options,
.method-chip.method-head  { color: #4b5563; }

:deep(.method-select-button .p-togglebutton:has(.method-chip.method-get))    { border-color: #bfdbfe !important; background: #eff6ff !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-post))   { border-color: #bbf7d0 !important; background: #f0fdf4 !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-put))    { border-color: #fde68a !important; background: #fffbeb !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-patch))  { border-color: #fed7aa !important; background: #fff7ed !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-delete)) { border-color: #fecaca !important; background: #fef2f2 !important; }
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-options)),
:deep(.method-select-button .p-togglebutton:has(.method-chip.method-head))   { border-color: #e5e7eb !important; background: #f9fafb !important; }


/* Checked state: stronger border, no background change */
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-get))    { border-color: #2563eb !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-post))   { border-color: #16a34a !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-put))    { border-color: #d97706 !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-patch))  { border-color: #ea580c !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-delete)) { border-color: #dc2626 !important; border-width: 2px !important; }
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-options)),
:deep(.method-select-button .p-togglebutton.p-togglebutton-checked:has(.method-chip.method-head))   { border-color: #4b5563 !important; border-width: 2px !important; }


/* ── Path input helpers ── */
.helper-text {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
  display: block;
}

:deep(.path-addon) {
  font-weight: 600;
  font-size: 15px;
  color: #6b7280;
  min-width: 2rem;
  justify-content: center;
}

.w-full {
  width: 100%;
}

:deep(.p-tabs-nav) {
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 20px;
}

:deep(.p-tab) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  font-weight: 500;
  font-size: 13px;
  color: #6b7280;
  transition: color 0.15s ease;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

:deep(.p-tab:hover) {
  color: #374151;
}

:deep(.p-tab[aria-selected="true"]) {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

:deep(.p-tab i) {
  font-size: 14px;
}

:deep(.p-accordion-panel) {
  margin-bottom: 8px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  background: #ffffff;
  transition: border-color 0.15s ease;
}

:deep(.p-accordion-panel:hover) {
  border-color: #d1d5db;
}

:deep(.p-accordion-header) {
  padding: 14px 16px;
  background: #ffffff;
  transition: background-color 0.15s ease;
}

:deep(.p-accordion-header:hover) {
  background: #f9fafb;
}

:deep(.p-accordion-panel[data-p-active="true"] .p-accordion-header) {
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.p-accordion-panel[data-p-active="true"]) {
  border-color: #d1d5db;
}

:deep(.p-accordion-content) {
  padding: 16px;
  background: #ffffff;
}

:deep(.p-accordion-header-content) {
  width: 100%;
}

/* Focus states for accessibility */
:deep(.p-inputtext:focus-visible),
:deep(.p-textarea:focus-visible),
:deep(.p-select:focus-visible),
:deep(.p-button:focus-visible) {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

:deep(.p-button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.p-chip) {
  background: #3b82f6;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 12px;
}

:deep(.p-chip .p-chip-remove-icon) {
  color: rgba(255, 255, 255, 0.8);
}

:deep(.p-chip .p-chip-remove-icon:hover) {
  color: white;
}
</style>
