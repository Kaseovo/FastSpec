<template>
  <div class="form-editor">
    <div class="form-header">
      <h3>Form Editor</h3>
      <Button
        icon="pi pi-sync"
        text
        rounded
        v-tooltip.top="'Sync with JSON'"
        @click="syncWithJson"
        :disabled="!hasChanges"
      />
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
                      <span class="path-url">{{ pathItem.path }}</span>
                      <div class="path-methods">
                        <span
                          v-for="method in pathItem.methods"
                          :key="method"
                          :class="[
                            'method-badge',
                            'method-' + method.toLowerCase(),
                          ]"
                        >
                          {{ method.toUpperCase() }}
                        </span>
                      </div>
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        size="small"
                        @click.stop="removePath(pathItem.path)"
                      />
                    </div>
                  </AccordionHeader>
                  <AccordionContent>
                    <div class="path-methods-editor">
                      <div class="method-tabs">
                        <button
                          v-for="(method, methodIndex) in pathItem.methods"
                          :key="method"
                          :class="[
                            'method-tab-button',
                            'method-' + method.toLowerCase(),
                            {
                              active:
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
                          @click="selectPathMethod(pathItem.path, method)"
                        >
                          <i class="pi pi-bars drag-icon"></i>
                          {{ method.toUpperCase() }}
                          <Button
                            icon="pi pi-times"
                            severity="danger"
                            text
                            rounded
                            size="small"
                            class="method-delete-btn"
                            @click.stop="removeMethod(pathItem.path, method)"
                            v-tooltip.top="'Remove method'"
                          />
                        </button>
                        <Button
                          label="Add Method"
                          icon="pi pi-plus"
                          size="small"
                          text
                          @click="showAddMethodDialog(pathItem.path)"
                        />
                      </div>

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
                                <Chips
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
                                      />
                                    </div>
                                    <div
                                      class="form-field"
                                      v-if="param.schema.type === 'array'"
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
                                      <label>Multiple Of</label>
                                      <InputNumber
                                        v-model="param.schema.multipleOf"
                                        placeholder="Multiple of"
                                        :min="0"
                                      />
                                    </div>
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
                                    <Chips
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
                                        ]"
                                        placeholder="Type"
                                      />
                                    </div>
                                  </div>

                                  <div class="form-field">
                                    <label>Description</label>
                                    <InputText
                                      v-model="prop.description"
                                      placeholder="Property description"
                                    />
                                  </div>

                                  <div
                                    v-if="prop.type === 'array'"
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
                                      ]"
                                      placeholder="Items type"
                                    />
                                  </div>

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
                                          'email',
                                          'uri',
                                          'uuid',
                                        ]"
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Pattern</label>
                                      <InputText
                                        v-model="prop.pattern"
                                        placeholder="Regex pattern"
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

                            <div
                              v-if="schema.data.type === 'array'"
                              class="form-field"
                            >
                              <label>Array Items Type</label>
                              <Select
                                v-model="schema.data.items.type"
                                :options="[
                                  'string',
                                  'number',
                                  'integer',
                                  'boolean',
                                  'object',
                                ]"
                                placeholder="Items type"
                              />
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
      v-model:visible="showAddPathDialog"
      header="Add New Path"
      :style="{ width: '500px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label for="new-path">Path *</label>
          <InputText
            id="new-path"
            v-model="newPath"
            placeholder="/users/{id}"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label for="new-method">HTTP Method *</label>
          <div class="method-selector-grid">
            <button
              v-for="method in httpMethods"
              :key="method"
              :class="[
                'method-selector-button',
                'method-' + method.toLowerCase(),
                { selected: newMethod === method },
              ]"
              @click="newMethod = method"
              type="button"
            >
              <span class="method-name">{{ method.toUpperCase() }}</span>
              <span class="method-description">{{
                getMethodDescription(method)
              }}</span>
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddPathDialog = false" />
        <Button
          label="Add"
          @click="addPath"
          :disabled="!newPath || !newMethod"
        />
      </template>
    </Dialog>

    <!-- Add Method Dialog -->
    <Dialog
      v-model:visible="showAddMethodDialogVisible"
      header="Add Method to Path"
      :style="{ width: '500px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label for="add-method">Select HTTP Method *</label>
          <div class="method-selector-grid">
            <button
              v-for="method in availableMethodsForPath"
              :key="method"
              :class="[
                'method-selector-button',
                'method-' + method.toLowerCase(),
                { selected: methodToAdd === method },
              ]"
              @click="methodToAdd = method"
              type="button"
            >
              <span class="method-name">{{ method.toUpperCase() }}</span>
              <span class="method-description">{{
                getMethodDescription(method)
              }}</span>
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancel"
          text
          @click="showAddMethodDialogVisible = false"
        />
        <Button label="Add" @click="addMethodToPath" :disabled="!methodToAdd" />
      </template>
    </Dialog>

    <!-- Add Schema Dialog -->
    <Dialog
      v-model:visible="showAddSchemaDialog"
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
import Chips from "primevue/chips";
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

export default {
  name: "FormEditor",
  components: {
    Button,
    InputText,
    InputNumber,
    Textarea,
    Select,
    Checkbox,
    Chips,
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
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
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

    const httpMethods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ];

    // Initialize form data from prop
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue && Object.keys(newValue).length > 0) {
          formData.value = JSON.parse(JSON.stringify(newValue));
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

    // Watch for form changes
    watch(
      formData,
      () => {
        hasChanges.value = true;
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

    const syncWithJson = () => {
      // Clean up empty fields
      const cleaned = JSON.parse(JSON.stringify(formData.value));

      // Remove empty contact/license
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

      emit("update:modelValue", cleaned);
      hasChanges.value = false;
    };

    const addServer = () => {
      formData.value.servers.push({ url: "", description: "" });
    };

    const removeServer = (index) => {
      formData.value.servers.splice(index, 1);
    };

    const addPath = () => {
      if (!newPath.value || !newMethod.value) return;

      if (!formData.value.paths[newPath.value]) {
        formData.value.paths[newPath.value] = {};
      }

      formData.value.paths[newPath.value][newMethod.value] = {
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

      selectedPath.value = newPath.value;
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
        (name) => `#/components/schemas/${name}`
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
      syncWithJson,
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
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      handlePathDragStart,
      handlePathDrop,
      handleMethodDragStart,
      handleMethodDrop,
    };
  },
};
</script>

<style scoped>
.form-editor {
  background: linear-gradient(to bottom, #ffffff, #f8fafc);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.8);
}

.form-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.form-header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  pointer-events: none;
}

.form-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.form-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.form-content::-webkit-scrollbar {
  width: 8px;
}

.form-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.form-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.form-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.form-section {
  padding: 32px 28px;
}

.form-section h4 {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 24px;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section h4::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f1f5f9;
}

.section-header h4 {
  margin-bottom: 0;
}

.section-header h5 {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h5::before {
  content: "";
  width: 3px;
  height: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
}

.form-field {
  margin-bottom: 24px;
}

.form-field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.01em;
}

.form-field :deep(.p-inputtext),
.form-field :deep(.p-textarea),
.form-field :deep(.p-select),
.form-field :deep(.p-inputnumber-input) {
  width: 100%;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 14px;
  transition: all 0.2s ease;
  background: white;
}

.form-field :deep(.p-inputtext:hover),
.form-field :deep(.p-textarea:hover),
.form-field :deep(.p-select:hover),
.form-field :deep(.p-inputnumber-input:hover) {
  border-color: #cbd5e1;
}

.form-field :deep(.p-inputtext:focus),
.form-field :deep(.p-textarea:focus),
.form-field :deep(.p-select:focus),
.form-field :deep(.p-inputnumber-input:focus) {
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  outline: none;
}

.form-field :deep(.p-chips) {
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px 12px;
  transition: all 0.2s ease;
}

.form-field :deep(.p-chips:hover) {
  border-color: #cbd5e1;
}

.form-field :deep(.p-chips:focus-within) {
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
  border: 2px solid #f1f5f9;
  transition: all 0.2s ease;
}

.checkbox-field:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.checkbox-field label {
  margin-bottom: 0;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
}

:deep(.p-button) {
  border-radius: 10px;
  font-weight: 600;
  padding: 11px 22px;
  transition: all 0.2s ease;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  letter-spacing: 0.01em;
}

:deep(.p-button-primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

:deep(.p-button-primary:hover) {
  background: linear-gradient(135deg, #5568d3 0%, #653a8b 100%);
}

:deep(.p-button:hover:not(:disabled)) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.p-button:active:not(:disabled)) {
  transform: translateY(0);
}

:deep(.p-button-sm) {
  padding: 8px 16px;
  font-size: 13px;
}

:deep(.p-button-danger) {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

:deep(.p-button-danger:hover) {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

:deep(.p-button-secondary) {
  background: #f1f5f9;
  color: #475569;
}

:deep(.p-button-secondary:hover) {
  background: #e2e8f0;
  color: #334155;
}

.list-item {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 2px solid #f1f5f9;
  border-radius: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.list-item:hover {
  border-color: #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.list-item-content {
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #94a3b8;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 16px;
  border: 2px dashed #e2e8f0;
}

.empty-state i {
  font-size: 56px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  opacity: 0.6;
}

.empty-state p {
  font-size: 15px;
  font-weight: 500;
  color: #64748b;
}

.empty-state-small {
  text-align: center;
  padding: 48px 20px;
  color: #94a3b8;
  font-size: 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
  font-weight: 500;
}

.path-header,
.schema-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  cursor: move;
}

.path-header .drag-handle {
  color: #9ca3af;
  cursor: grab;
}

.path-header .drag-handle:hover {
  color: #3b82f6;
}

:deep(.dragging-path) {
  opacity: 0.5;
  background: #eff6ff;
}

:deep(.dragging-path .p-accordionpanel-header) {
  border-color: #3b82f6;
}

.path-url,
.schema-name {
  font-family: "Monaco", "Courier New", monospace;
  font-weight: 700;
  font-size: 14px;
  color: #1e293b;
  flex-shrink: 0;
  letter-spacing: -0.02em;
}

.path-methods {
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}

.method-badge {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border: 2px solid transparent;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

.method-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
}

.method-badge.method-get {
  background: #dbeafe;
  color: #1e40af;
  border-color: #93c5fd;
}

.method-badge.method-post {
  background: #d1fae5;
  color: #065f46;
  border-color: #6ee7b7;
}

.method-badge.method-put {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}

.method-badge.method-patch {
  background: #fed7aa;
  color: #9a3412;
  border-color: #fdba74;
}

.method-badge.method-delete {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.method-badge.method-options,
.method-badge.method-head {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.path-methods-editor {
  padding: 20px;
  background: linear-gradient(135deg, #fafbfc 0%, #f8fafc 100%);
  border-radius: 12px;
  border: 2px solid #f1f5f9;
}

.method-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.method-tab-button {
  padding: 10px 18px;
  border: 2px solid;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: move;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
  outline: none;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.method-tab-button .drag-icon {
  font-size: 10px;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.method-tab-button:hover .drag-icon {
  opacity: 0.8;
}

.method-delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-left: auto;
}

.method-tab-button:hover .method-delete-btn {
  opacity: 1;
}

.method-delete-btn:hover {
  transform: scale(1.1);
}

.method-tab-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.method-tab-button.dragging-method {
  opacity: 0.5;
  transform: scale(0.95);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.method-tab-button.method-get {
  color: #1e40af;
  border-color: #93c5fd;
  background: #eff6ff;
}

.method-tab-button.method-get.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.method-tab-button.method-post {
  color: #065f46;
  border-color: #6ee7b7;
  background: #f0fdfa;
}

.method-tab-button.method-post.active {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.method-tab-button.method-put {
  color: #92400e;
  border-color: #fcd34d;
  background: #fefce8;
}

.method-tab-button.method-put.active {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.method-tab-button.method-patch {
  color: #9a3412;
  border-color: #fdba74;
  background: #fff7ed;
}

.method-tab-button.method-patch.active {
  background: #f97316;
  color: white;
  border-color: #f97316;
}

.method-tab-button.method-delete {
  color: #991b1b;
  border-color: #fca5a5;
  background: #fef2f2;
}

.method-tab-button.method-delete.active {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.method-tab-button.method-options,
.method-tab-button.method-head {
  color: #374151;
  border-color: #d1d5db;
  background: #f9fafb;
}

.method-tab-button.method-options.active,
.method-tab-button.method-head.active {
  background: #6b7280;
  color: white;
  border-color: #6b7280;
}

.method-editor {
  padding-top: 15px;
  border-top: 1px solid #e5e7eb;
}

.section-header h5 {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h5::before {
  content: "";
  width: 3px;
  height: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
}

.empty-state-small {
  text-align: center;
  padding: 48px 20px;
  color: #94a3b8;
  font-size: 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
  font-weight: 500;
}

.param-item,
.property-item {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
  border: 2px solid #f1f5f9;
  border-radius: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: move;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.param-item::before,
.property-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.property-item:hover::before,
.param-item:hover::before {
  opacity: 1;
}

.property-item:hover,
.param-item:hover {
  border-color: #667eea;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.property-item.dragging {
  opacity: 0.6;
  border-color: #667eea;
  background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.25);
  transform: scale(0.98);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #cbd5e1;
  cursor: grab;
  user-select: none;
  transition: all 0.2s ease;
  border-radius: 6px;
  background: transparent;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle:hover {
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
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
  gap: 12px;
}

.schema-selector :deep(.p-select) {
  flex: 1;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.response-header span {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: #475569;
}

.schema-builder {
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  border: 2px solid #e2e8f0;
}

.schema-json-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.json-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.json-editor-header label {
  font-weight: 700;
  font-size: 0.9rem;
  color: #334155;
  margin: 0;
}

.json-editor-actions {
  display: flex;
  gap: 8px;
}

.json-editor-wrapper {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  width: 100%;
}

.json-textarea.monaco-style {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", "Consolas", "source-code-pro",
    monospace;
  font-size: 13px;
  line-height: 1.6;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #e2e8f0;
  padding: 20px;
  border: none;
  border-radius: 10px;
  resize: vertical;
  min-height: 400px;
  width: 100%;
  box-sizing: border-box;
  tab-size: 2;
  -moz-tab-size: 2;
}

.json-textarea.monaco-style:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.json-textarea.monaco-style::selection {
  background: rgba(102, 126, 234, 0.4);
}

.json-textarea {
  font-family: "Monaco", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
}

.dialog-content {
  padding: 20px 0;
}

:deep(.p-dialog) {
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.8);
  overflow: hidden;
}

:deep(.p-dialog-header) {
  padding: 24px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: none;
  position: relative;
}

:deep(.p-dialog-header)::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  pointer-events: none;
}

:deep(.p-dialog-title) {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.02em;
  position: relative;
  z-index: 1;
}

:deep(.p-dialog-header-close) {
  color: white;
  opacity: 0.9;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
  border-radius: 8px;
}

:deep(.p-dialog-header-close:hover) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
}

:deep(.p-dialog-content) {
  padding: 28px;
  background: linear-gradient(to bottom, #ffffff, #f8fafc);
}

:deep(.p-dialog-footer) {
  padding: 20px 28px;
  border-top: 2px solid #f1f5f9;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: #fafbfc;
}

.method-selector-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.method-selector-button {
  padding: 18px;
  border: 2px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
  text-align: left;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.method-selector-button::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.method-selector-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.method-selector-button:hover::before {
  opacity: 0.05;
}

.method-selector-button.selected {
  transform: translateY(-2px);
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2), 0 8px 20px rgba(0, 0, 0, 0.15);
}

.method-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
}

.method-description {
  font-size: 12px;
  opacity: 0.75;
  font-weight: 500;
  line-height: 1.4;
  position: relative;
  z-index: 1;
}

.method-selector-button.method-get {
  color: #1e40af;
  border-color: #93c5fd;
  background: #eff6ff;
}

.method-selector-button.method-get.selected {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.method-selector-button.method-get.selected .method-description {
  opacity: 0.9;
}

.method-selector-button.method-post {
  color: #065f46;
  border-color: #6ee7b7;
  background: #f0fdfa;
}

.method-selector-button.method-post.selected {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.method-selector-button.method-post.selected .method-description {
  opacity: 0.9;
}

.method-selector-button.method-put {
  color: #92400e;
  border-color: #fcd34d;
  background: #fefce8;
}

.method-selector-button.method-put.selected {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.method-selector-button.method-put.selected .method-description {
  opacity: 0.9;
}

.method-selector-button.method-patch {
  color: #9a3412;
  border-color: #fdba74;
  background: #fff7ed;
}

.method-selector-button.method-patch.selected {
  background: #f97316;
  color: white;
  border-color: #f97316;
}

.method-selector-button.method-patch.selected .method-description {
  opacity: 0.9;
}

.method-selector-button.method-delete {
  color: #991b1b;
  border-color: #fca5a5;
  background: #fef2f2;
}

.method-selector-button.method-delete.selected {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.method-selector-button.method-delete.selected .method-description {
  opacity: 0.9;
}

.method-selector-button.method-options,
.method-selector-button.method-head {
  color: #374151;
  border-color: #d1d5db;
  background: #f9fafb;
}

.method-selector-button.method-options.selected,
.method-selector-button.method-head.selected {
  background: #6b7280;
  color: white;
  border-color: #6b7280;
}

.method-selector-button.method-options.selected .method-description,
.method-selector-button.method-head.selected .method-description {
  opacity: 0.9;
}

.w-full {
  width: 100%;
}

:deep(.p-tabs-nav) {
  background: linear-gradient(to bottom, #ffffff, #f8fafc);
  border-bottom: 2px solid #f1f5f9;
  padding: 0 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

:deep(.p-tab) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  font-weight: 600;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s ease;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
}

:deep(.p-tab:hover) {
  color: #475569;
  background: rgba(102, 126, 234, 0.05);
}

:deep(.p-tab[aria-selected="true"]) {
  color: #667eea;
  border-bottom-color: #667eea;
  background: linear-gradient(
    to bottom,
    rgba(102, 126, 234, 0.08),
    transparent
  );
}

:deep(.p-tab i) {
  font-size: 16px;
}

:deep(.p-accordion-panel) {
  margin-bottom: 16px;
  border-radius: 12px;
  border: 2px solid #f1f5f9;
  overflow: hidden;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

:deep(.p-accordion-panel:hover) {
  border-color: #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:deep(.p-accordion-header) {
  padding: 20px;
  background: linear-gradient(to right, #ffffff, #fafbfc);
  transition: all 0.2s ease;
}

:deep(.p-accordion-header:hover) {
  background: linear-gradient(to right, #f8fafc, #f1f5f9);
}

:deep(.p-accordion-panel[data-p-active="true"] .p-accordion-header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
}

:deep(.p-accordion-panel[data-p-active="true"]) {
  border-color: #667eea;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
}

:deep(.p-accordion-panel[data-p-active="true"] .path-url),
:deep(.p-accordion-panel[data-p-active="true"] .schema-name),
:deep(.p-accordion-panel[data-p-active="true"] .drag-handle) {
  color: white !important;
}

:deep(.p-accordion-content) {
  padding: 24px;
  background: #fafbfc;
}

:deep(.p-accordion-header-content) {
  width: 100%;
}

/* Smooth transitions for all interactive elements */
* {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Add subtle entrance animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-section {
  animation: fadeInUp 0.3s ease-out;
}

.list-item,
.param-item,
.property-item {
  animation: fadeInUp 0.2s ease-out;
}

/* Enhanced focus states for accessibility */
:deep(.p-inputtext:focus-visible),
:deep(.p-textarea:focus-visible),
:deep(.p-select:focus-visible),
:deep(.p-button:focus-visible) {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

/* Improved loading states */
:deep(.p-button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* Better chip styling */
:deep(.p-chip) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
}

:deep(.p-chip .p-chip-remove-icon) {
  color: white;
  transition: all 0.2s ease;
}

:deep(.p-chip .p-chip-remove-icon:hover) {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}
</style>
