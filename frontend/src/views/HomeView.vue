<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <!-- Header -->
    <header
      class="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-10"
    >
      <div class="max-w-6xl mx-auto px-6 py-5">
        <div class="flex items-center gap-3">
          <div>
            <h1
              class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            >
              OpenAPI JSON Editor
            </h1>
            <p class="text-gray-600 text-sm mt-0.5">
              Paste, format, and copy your OpenAPI specifications with ease
            </p>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="max-w-6xl mx-auto px-6 py-8">
      <!-- Tab Navigation -->
      <div class="mb-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-1 inline-flex gap-1">
          <button
            @click="activeTab = 'editor'"
            :class="[
              'px-6 py-2.5 rounded-md font-medium transition-all',
              activeTab === 'editor'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
            ]"
          >
            <i class="pi pi-code mr-2"></i>
            JSON Editor
          </button>
          <button
            @click="activeTab = 'swagger'"
            :class="[
              'px-6 py-2.5 rounded-md font-medium transition-all',
              activeTab === 'swagger'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
            ]"
            :disabled="!isValidJson"
          >
            <i class="pi pi-book mr-2"></i>
            Swagger UI
          </button>
        </div>
        <p v-if="activeTab === 'swagger' && !isValidJson" class="text-sm text-amber-600 mt-2">
          <i class="pi pi-exclamation-triangle mr-1"></i>
          Enter valid OpenAPI JSON in the editor to view Swagger UI
        </p>
      </div>

      <!-- Editor View -->
      <div
        v-show="activeTab === 'editor'"
        class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      >
        <!-- Toolbar -->
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2">
              <i class="pi pi-code text-gray-600"></i>
              <h2 class="text-lg font-semibold text-gray-800">JSON Editor</h2>
            </div>
            <div class="flex gap-2 flex-wrap">
              <Button
                label="Load Sample"
                icon="pi pi-file-import"
                @click="loadSampleSpec"
                severity="secondary"
                size="small"
                outlined
              />
              <Button
                label="Clear"
                icon="pi pi-trash"
                @click="clearJson"
                severity="secondary"
                size="small"
                outlined
                :disabled="!jsonValue"
              />
              <Button
                label="Format"
                icon="pi pi-align-justify"
                @click="formatJson"
                severity="info"
                size="small"
                :disabled="!jsonValue || !isValidJson"
              />
              <Button
                label="Minify"
                icon="pi pi-compress"
                @click="minifyJson"
                severity="help"
                size="small"
                :disabled="!jsonValue || !isValidJson"
              />
              <Button
                :label="copied ? 'Copied!' : 'Copy'"
                :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
                @click="copyToClipboard"
                :severity="copied ? 'success' : 'success'"
                size="small"
                :disabled="!jsonValue"
              />
            </div>
          </div>
        </div>

        <!-- Text Area -->
        <div class="relative">
          <textarea
            v-model="jsonValue"
            class="w-full h-[600px] p-6 bg-gray-50 text-sm font-mono resize-none focus:outline-none focus:bg-white transition-colors"
            :class="[jsonValue && !isValidJson ? 'text-red-600' : 'text-gray-900']"
            placeholder='Paste your OpenAPI JSON here...

Example:
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {}
}'
            spellcheck="false"
          ></textarea>
          <!-- Empty state -->
          <div
            v-if="!jsonValue"
            class="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div class="text-center text-gray-400">
              <i class="pi pi-cloud-upload text-6xl mb-4 opacity-20"></i>
              <p class="text-lg font-medium">Paste your OpenAPI JSON</p>
              <p class="text-sm mt-2">Use Cmd+V (Mac) or Ctrl+V (Windows)</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Swagger UI View -->
      <div
        v-show="activeTab === 'swagger'"
        class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      >
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="pi pi-book text-gray-600"></i>
              <h2 class="text-lg font-semibold text-gray-800">API Documentation</h2>
            </div>
            <Button
              label="Back to Editor"
              icon="pi pi-arrow-left"
              @click="activeTab = 'editor'"
              size="small"
              text
            />
          </div>
        </div>
        <div class="swagger-container">
          <SwaggerUI v-if="isValidJson && parsedSpec" :spec="parsedSpec" />
          <div v-else class="p-12 text-center text-gray-500">
            <i class="pi pi-exclamation-circle text-6xl text-gray-300 mb-4"></i>
            <p class="text-lg font-medium">No valid OpenAPI specification</p>
            <p class="text-sm mt-2">Go to the editor and paste your OpenAPI JSON</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import SwaggerUI from '@/components/SwaggerUI.vue'

const toast = useToast()
const jsonValue = ref('')
const copied = ref(false)
const lastUpdated = ref(new Date().toLocaleTimeString())
const activeTab = ref<'editor' | 'swagger'>('editor')

// Computed properties
const isValidJson = computed(() => {
  if (!jsonValue.value.trim()) return false
  try {
    JSON.parse(jsonValue.value)
    return true
  } catch {
    return false
  }
})

const parsedSpec = computed(() => {
  if (!isValidJson.value) return null
  try {
    return JSON.parse(jsonValue.value)
  } catch {
    return null
  }
})

// Watch for changes to update timestamp
watch(jsonValue, () => {
  lastUpdated.value = new Date().toLocaleTimeString()
  copied.value = false
})

const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonValue.value)
    jsonValue.value = JSON.stringify(parsed, null, 2)
    toast.add({
      severity: 'success',
      summary: 'Formatted!',
      detail: 'JSON formatted with 2-space indentation',
      life: 3000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Invalid JSON',
      detail: 'Please check your JSON syntax',
      life: 5000,
    })
  }
}

const minifyJson = () => {
  try {
    const parsed = JSON.parse(jsonValue.value)
    jsonValue.value = JSON.stringify(parsed)
    toast.add({
      severity: 'success',
      summary: 'Minified!',
      detail: 'JSON compressed to single line',
      life: 3000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Invalid JSON',
      detail: 'Please check your JSON syntax',
      life: 5000,
    })
  }
}

const clearJson = () => {
  jsonValue.value = ''
  toast.add({
    severity: 'info',
    summary: 'Cleared',
    detail: 'Editor content cleared',
    life: 2000,
  })
}

const loadSampleSpec = () => {
  const sampleSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Pet Store API',
      version: '1.0.0',
      description: 'A sample Pet Store API to demonstrate OpenAPI specification',
      contact: {
        name: 'API Support',
        email: 'support@petstore.com',
      },
    },
    servers: [
      {
        url: 'https://api.petstore.com/v1',
        description: 'Production server',
      },
      {
        url: 'https://staging.petstore.com/v1',
        description: 'Staging server',
      },
    ],
    paths: {
      '/pets': {
        get: {
          summary: 'List all pets',
          description: 'Returns a list of all pets in the store',
          operationId: 'listPets',
          tags: ['pets'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Maximum number of pets to return',
              required: false,
              schema: {
                type: 'integer',
                format: 'int32',
                minimum: 1,
                maximum: 100,
                default: 20,
              },
            },
          ],
          responses: {
            '200': {
              description: 'A list of pets',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Pet',
                    },
                  },
                },
              },
            },
            '500': {
              description: 'Internal server error',
            },
          },
        },
        post: {
          summary: 'Create a pet',
          description: 'Creates a new pet in the store',
          operationId: 'createPet',
          tags: ['pets'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/NewPet',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Pet created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Pet',
                  },
                },
              },
            },
            '400': {
              description: 'Invalid input',
            },
          },
        },
      },
      '/pets/{petId}': {
        get: {
          summary: 'Get a pet by ID',
          description: 'Returns a single pet',
          operationId: 'getPetById',
          tags: ['pets'],
          parameters: [
            {
              name: 'petId',
              in: 'path',
              description: 'ID of pet to return',
              required: true,
              schema: {
                type: 'integer',
                format: 'int64',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Successful operation',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Pet',
                  },
                },
              },
            },
            '404': {
              description: 'Pet not found',
            },
          },
        },
        delete: {
          summary: 'Delete a pet',
          description: 'Deletes a pet from the store',
          operationId: 'deletePet',
          tags: ['pets'],
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: {
                type: 'integer',
                format: 'int64',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Pet deleted successfully',
            },
            '404': {
              description: 'Pet not found',
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Pet: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
              description: 'Unique identifier for the pet',
            },
            name: {
              type: 'string',
              description: 'Name of the pet',
              example: 'Fluffy',
            },
            tag: {
              type: 'string',
              description: 'Category tag for the pet',
              example: 'cat',
            },
            age: {
              type: 'integer',
              description: 'Age of the pet in years',
              minimum: 0,
              example: 3,
            },
          },
        },
        NewPet: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Name of the pet',
              minLength: 1,
              maxLength: 100,
            },
            tag: {
              type: 'string',
              description: 'Category tag for the pet',
            },
            age: {
              type: 'integer',
              description: 'Age of the pet in years',
              minimum: 0,
            },
          },
        },
      },
    },
  }

  jsonValue.value = JSON.stringify(sampleSpec, null, 2)
  toast.add({
    severity: 'success',
    summary: 'Sample Loaded',
    detail: 'Pet Store API sample specification loaded',
    life: 3000,
  })
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(jsonValue.value)
    copied.value = true
    toast.add({
      severity: 'success',
      summary: 'Copied!',
      detail: 'OpenAPI JSON copied to clipboard',
      life: 3000,
    })
    setTimeout(() => {
      copied.value = false
    }, 3000)
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to copy to clipboard',
      life: 5000,
    })
  }
}
</script>

<style scoped>
kbd {
  display: inline-block;
  font-family: ui-monospace, monospace;
}

textarea::placeholder {
  color: #9ca3af;
  opacity: 0.6;
}
</style>
