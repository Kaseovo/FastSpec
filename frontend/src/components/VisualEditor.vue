<template>
  <div class="space-y-6">
    <!-- API Information -->
    <Panel header="API Information" class="mb-4">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            API Title <span class="text-red-500">*</span>
          </label>
          <InputText
            :model-value="apiInfo.title"
            @update:model-value="handleInfoChange('title', ($event as string) || '')"
            placeholder="My API"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Version <span class="text-red-500">*</span>
          </label>
          <InputText
            :model-value="apiInfo.version"
            @update:model-value="handleInfoChange('version', ($event as string) || '')"
            placeholder="1.0.0"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <Textarea
            :model-value="apiInfo.description"
            @update:model-value="handleInfoChange('description', ($event as string) || '')"
            rows="3"
            placeholder="API description"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Base URL</label>
          <InputText
            :model-value="apiInfo.server"
            @update:model-value="handleInfoChange('server', ($event as string) || '')"
            placeholder="https://api.example.com/v1"
            class="w-full"
          />
        </div>
      </div>
    </Panel>

    <!-- Endpoints -->
    <Panel class="mb-4">
      <template #header>
        <div class="flex justify-between items-center w-full">
          <h2 class="text-2xl font-bold text-gray-800">Endpoints</h2>
          <Button label="+ Add Endpoint" @click="addEndpoint" />
        </div>
      </template>

      <p v-if="Object.keys(paths).length === 0" class="text-gray-500 py-4">
        No endpoints yet. Click "Add Endpoint" to create one.
      </p>

      <div v-else class="space-y-3">
        <div v-for="[path, methods] in Object.entries(paths)" :key="path">
          <div
            v-for="[method, operation] in Object.entries(methods as Record<string, unknown>)"
            :key="`${path}-${method}`"
            class="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors mb-3"
          >
            <!-- Endpoint Header -->
            <div class="flex items-center justify-between p-4">
              <div class="flex items-center gap-3 flex-1">
                <Tag :value="method.toUpperCase()" :severity="getMethodSeverity(method)" />
                <div class="flex-1">
                  <div class="font-medium text-gray-900">{{ path }}</div>
                  <div v-if="(operation as any).summary" class="text-sm text-gray-500">
                    {{ (operation as any).summary }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Button
                  :label="expandedEndpoint === `${path}-${method}` ? 'Collapse' : 'Expand'"
                  text
                  size="small"
                  @click="
                    expandedEndpoint =
                      expandedEndpoint === `${path}-${method}` ? null : `${path}-${method}`
                  "
                />
                <Button
                  label="Delete"
                  text
                  severity="danger"
                  size="small"
                  @click="deleteEndpoint(path, method)"
                />
              </div>
            </div>

            <!-- Expanded Section -->
            <div
              v-if="expandedEndpoint === `${path}-${method}`"
              class="border-t border-gray-200 p-4 space-y-6 bg-gray-50"
            >
              <!-- Request Body Section -->
              <div class="bg-white p-4 rounded-lg border border-gray-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-3">Request Body</h4>
                <FieldEditor
                  :fields="getRequestBodyFields(path, method)"
                  @update="(fields) => updateEndpointRequestBody(path, method, fields)"
                  title="Request Fields"
                />
              </div>

              <!-- Response Section -->
              <div class="bg-white p-4 rounded-lg border border-gray-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-3">Response (200)</h4>
                <FieldEditor
                  :fields="getResponseFields(path, method, '200')"
                  @update="(fields) => updateEndpointResponse(path, method, '200', fields)"
                  title="Response Fields"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>

    <!-- Add Endpoint Dialog -->
    <Dialog
      v-model:visible="showAddEndpointDialog"
      header="Add New Endpoint"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="space-y-4">
        <div>
          <label for="endpoint-path" class="block text-sm font-medium text-gray-700 mb-2">
            Endpoint Path <span class="text-red-500">*</span>
          </label>
          <InputText
            id="endpoint-path"
            v-model="newEndpoint.path"
            placeholder="/users/{id}"
            class="w-full"
          />
          <small class="text-gray-500">Must start with /</small>
        </div>

        <div>
          <label for="endpoint-method" class="block text-sm font-medium text-gray-700 mb-2">
            HTTP Method <span class="text-red-500">*</span>
          </label>
          <Select
            id="endpoint-method"
            v-model="newEndpoint.method"
            :options="methodOptions"
            class="w-full"
          />
        </div>

        <div>
          <label for="endpoint-summary" class="block text-sm font-medium text-gray-700 mb-2">
            Summary
          </label>
          <InputText
            id="endpoint-summary"
            v-model="newEndpoint.summary"
            placeholder="Brief description of the endpoint"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddEndpointDialog = false" />
        <Button label="Add" @click="confirmAddEndpoint" severity="success" icon="pi pi-plus" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Panel from 'primevue/panel'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import FieldEditor, { type Field } from './FieldEditor.vue'

interface Props {
  spec: Record<string, unknown>
}

interface Emits {
  (e: 'update', spec: Record<string, unknown>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toast = useToast()
const confirm = useConfirm()

const apiInfo = ref({
  title: '',
  version: '',
  description: '',
  server: '',
})

const expandedEndpoint = ref<string | null>(null)

// Add Endpoint Dialog
const showAddEndpointDialog = ref(false)
const newEndpoint = ref({
  path: '',
  method: 'get',
  summary: '',
})

const methodOptions = ['get', 'post', 'put', 'delete', 'patch']

// Initialize apiInfo from spec
watch(
  () => props.spec,
  (newSpec) => {
    const info = newSpec?.info as
      | { title?: string; version?: string; description?: string }
      | undefined
    const servers = newSpec?.servers as { url?: string }[] | undefined

    apiInfo.value = {
      title: info?.title || '',
      version: info?.version || '',
      description: info?.description || '',
      server: servers?.[0]?.url || '',
    }
  },
  { immediate: true, deep: true },
)

const paths = ref<Record<string, Record<string, unknown>>>(
  (props.spec?.paths || {}) as Record<string, Record<string, unknown>>,
)

watch(
  () => props.spec,
  (newSpec) => {
    paths.value = (newSpec?.paths || {}) as Record<string, Record<string, unknown>>
  },
  { deep: true },
)

const handleInfoChange = (field: string, value: string) => {
  const newInfo = { ...apiInfo.value, [field]: value }
  apiInfo.value = newInfo

  const updatedSpec = {
    ...props.spec,
    info: {
      ...((props.spec.info as Record<string, unknown>) || {}),
      title: newInfo.title,
      version: newInfo.version,
      description: newInfo.description,
    },
    servers: newInfo.server ? [{ url: newInfo.server }] : [],
  }
  emit('update', updatedSpec)
}

const getMethodSeverity = (method: string) => {
  const severityMap: Record<string, 'info' | 'success' | 'warn' | 'danger'> = {
    get: 'info',
    post: 'success',
    put: 'warn',
    delete: 'danger',
    patch: 'warn',
  }
  return severityMap[method.toLowerCase()] || 'secondary'
}

const addEndpoint = () => {
  newEndpoint.value = {
    path: '',
    method: 'get',
    summary: '',
  }
  showAddEndpointDialog.value = true
}

const confirmAddEndpoint = () => {
  const { path, method, summary } = newEndpoint.value

  if (!path) {
    toast.add({
      severity: 'warn',
      summary: 'Warning',
      detail: 'Endpoint path is required',
      life: 3000,
    })
    return
  }

  if (!path.startsWith('/')) {
    toast.add({
      severity: 'warn',
      summary: 'Warning',
      detail: 'Path must start with /',
      life: 3000,
    })
    return
  }

  const updatedSpec = {
    ...props.spec,
    paths: {
      ...((props.spec.paths as Record<string, unknown>) || {}),
      [path]: {
        ...((props.spec.paths as Record<string, Record<string, unknown>>)?.[path] || {}),
        [method]: {
          summary: summary || `${method.toUpperCase()} ${path}`,
          responses: {
            '200': {
              description: 'Successful response',
            },
          },
        },
      },
    },
  }
  emit('update', updatedSpec)
  showAddEndpointDialog.value = false
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: 'Endpoint added successfully',
    life: 3000,
  })
}

const deleteEndpoint = (path: string, method: string) => {
  confirm.require({
    message: `Are you sure you want to delete ${method.toUpperCase()} ${path}?`,
    header: 'Confirm Deletion',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => {
      const updatedPaths = {
        ...((props.spec.paths as Record<string, Record<string, unknown>>) || {}),
      }
      delete updatedPaths[path]?.[method]

      if (Object.keys(updatedPaths[path] || {}).length === 0) {
        delete updatedPaths[path]
      }

      emit('update', { ...props.spec, paths: updatedPaths })
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Endpoint deleted successfully',
        life: 3000,
      })
    },
  })
}

const updateEndpointRequestBody = (path: string, method: string, fields: Record<string, Field>) => {
  const updatedPaths = { ...((props.spec.paths as Record<string, Record<string, unknown>>) || {}) }
  const endpoint = { ...((updatedPaths[path]?.[method] as Record<string, unknown>) || {}) }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  Object.entries(fields).forEach(([fieldName, field]) => {
    const property: Record<string, unknown> = {
      type: field.type,
    }

    if (field.description) {
      property.description = field.description
    }

    if (field.constraints) {
      Object.entries(field.constraints).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          property[key] = value
        }
      })
    }

    if (field.type === 'array' && field.items) {
      property.items = field.items
    }

    properties[fieldName] = property

    if (field.required) {
      required.push(fieldName)
    }
  })

  endpoint.requestBody = {
    required: required.length > 0,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    },
  }

  updatedPaths[path] = {
    ...updatedPaths[path],
    [method]: endpoint,
  }

  emit('update', { ...props.spec, paths: updatedPaths })
}

const updateEndpointResponse = (
  path: string,
  method: string,
  statusCode: string,
  fields: Record<string, Field>,
) => {
  const updatedPaths = { ...((props.spec.paths as Record<string, Record<string, unknown>>) || {}) }
  const endpoint = { ...((updatedPaths[path]?.[method] as Record<string, unknown>) || {}) }
  const responses = { ...((endpoint.responses as Record<string, unknown>) || {}) }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  Object.entries(fields).forEach(([fieldName, field]) => {
    const property: Record<string, unknown> = {
      type: field.type,
    }

    if (field.description) {
      property.description = field.description
    }

    if (field.constraints) {
      Object.entries(field.constraints).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          property[key] = value
        }
      })
    }

    if (field.type === 'array' && field.items) {
      property.items = field.items
    }

    properties[fieldName] = property

    if (field.required) {
      required.push(fieldName)
    }
  })

  responses[statusCode] = {
    description:
      (responses[statusCode] as Record<string, unknown>)?.description || 'Successful response',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    },
  }

  endpoint.responses = responses

  updatedPaths[path] = {
    ...updatedPaths[path],
    [method]: endpoint,
  }

  emit('update', { ...props.spec, paths: updatedPaths })
}

const getRequestBodyFields = (path: string, method: string): Record<string, Field> => {
  const endpoint = (props.spec.paths as Record<string, Record<string, unknown>>)?.[path]?.[
    method
  ] as Record<string, unknown> | undefined
  const requestBody = endpoint?.requestBody as Record<string, unknown> | undefined
  const content = requestBody?.content as Record<string, unknown> | undefined
  const applicationJson = content?.['application/json'] as Record<string, unknown> | undefined
  const schema = applicationJson?.schema as Record<string, unknown> | undefined
  const properties = schema?.properties as Record<string, unknown> | undefined
  const required = (schema?.required as string[]) || []

  if (!properties) return {}

  const fields: Record<string, Field> = {}
  Object.entries(properties).forEach(([fieldName, property]) => {
    const prop = property as Record<string, unknown>
    const field: Field = {
      name: fieldName,
      type: (prop.type as Field['type']) || 'string',
      required: required.includes(fieldName),
      description: prop.description as string | undefined,
      constraints: {},
    }

    ;['maxLength', 'minLength', 'pattern', 'maximum', 'minimum', 'maxItems', 'minItems'].forEach(
      (constraint) => {
        if (prop[constraint] !== undefined) {
          field.constraints = field.constraints || {}
          ;(field.constraints as Record<string, unknown>)[constraint] = prop[constraint]
        }
      },
    )

    if (field.type === 'array' && prop.items) {
      field.items = prop.items as { type: string }
    }

    fields[fieldName] = field
  })

  return fields
}

const getResponseFields = (
  path: string,
  method: string,
  statusCode: string,
): Record<string, Field> => {
  const endpoint = (props.spec.paths as Record<string, Record<string, unknown>>)?.[path]?.[
    method
  ] as Record<string, unknown> | undefined
  const responses = endpoint?.responses as Record<string, unknown> | undefined
  const response = responses?.[statusCode] as Record<string, unknown> | undefined
  const content = response?.content as Record<string, unknown> | undefined
  const applicationJson = content?.['application/json'] as Record<string, unknown> | undefined
  const schema = applicationJson?.schema as Record<string, unknown> | undefined
  const properties = schema?.properties as Record<string, unknown> | undefined
  const required = (schema?.required as string[]) || []

  if (!properties) return {}

  const fields: Record<string, Field> = {}
  Object.entries(properties).forEach(([fieldName, property]) => {
    const prop = property as Record<string, unknown>
    const field: Field = {
      name: fieldName,
      type: (prop.type as Field['type']) || 'string',
      required: required.includes(fieldName),
      description: prop.description as string | undefined,
      constraints: {},
    }

    ;['maxLength', 'minLength', 'pattern', 'maximum', 'minimum', 'maxItems', 'minItems'].forEach(
      (constraint) => {
        if (prop[constraint] !== undefined) {
          field.constraints = field.constraints || {}
          ;(field.constraints as Record<string, unknown>)[constraint] = prop[constraint]
        }
      },
    )

    if (field.type === 'array' && prop.items) {
      field.items = prop.items as { type: string }
    }

    fields[fieldName] = field
  })

  return fields
}
</script>
