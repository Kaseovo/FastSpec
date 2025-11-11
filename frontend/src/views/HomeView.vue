<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <h1 class="text-3xl font-bold text-gray-900">🧩 FastSpec - OpenAPI Editor</h1>
        <p class="text-gray-600 mt-1">Create, edit, and validate your OpenAPI specifications</p>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex flex-wrap gap-2">
          <Button label="New" @click="handleNewSpec" severity="info" />
          <Button label="Load Template" @click="handleLoadTemplate" />
          <Button label="Save" @click="handleSave" :loading="loading" severity="success" />
          <Button label="Validate" @click="handleValidate" :loading="loading" severity="help" />
          <Button
            v-if="currentSpecId"
            label="View Changes"
            @click="handleViewDiff(currentSpecId)"
            :loading="loading"
          />
          <div class="flex-1"></div>
          <Button
            :label="editorMode === 'json' ? 'Visual Editor' : 'JSON Editor'"
            @click="editorMode = editorMode === 'json' ? 'visual' : 'json'"
          />
        </div>
      </div>
    </div>

    <!-- Message Banner -->
    <Message
      v-if="message"
      :severity="message.type === 'success' ? 'success' : 'error'"
      :closable="true"
      @close="message = null"
      class="mx-auto max-w-7xl"
    >
      {{ message.text }}
    </Message>

    <!-- Validation Results -->
    <div v-if="showValidation && validationResult" class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-lg font-semibold mb-2">
              {{ validationResult.valid ? '✓ Valid Specification' : '✗ Validation Failed' }}
            </h3>
            <div v-if="validationResult.errors.length > 0" class="mb-2">
              <h4 class="font-medium text-red-600 mb-1">Errors:</h4>
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="(err, idx) in validationResult.errors"
                  :key="idx"
                  class="text-sm text-red-700"
                >
                  <strong>{{ err.field }}:</strong> {{ err.message }}
                </li>
              </ul>
            </div>
            <div v-if="validationResult.warnings.length > 0">
              <h4 class="font-medium text-yellow-600 mb-1">Warnings:</h4>
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="(warn, idx) in validationResult.warnings"
                  :key="idx"
                  class="text-sm text-yellow-700"
                >
                  {{ warn }}
                </li>
              </ul>
            </div>
          </div>
          <Button icon="pi pi-times" text rounded @click="showValidation = false" />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Sidebar - Saved Specs -->
        <div class="lg:col-span-1">
          <Panel header="Saved Specs" class="h-full">
            <p v-if="specs.length === 0" class="text-gray-500 text-sm">No saved specifications</p>
            <div v-else class="space-y-2">
              <div
                v-for="spec in specs"
                :key="spec.id"
                :class="[
                  'p-3 rounded-lg border cursor-pointer transition-colors',
                  currentSpecId === spec.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                ]"
                @click="handleLoadSpec(spec)"
              >
                <div class="font-medium text-sm text-gray-900">{{ spec.name }}</div>
                <div class="text-xs text-gray-500 mt-1">{{ spec.title }} v{{ spec.version }}</div>
                <Button
                  label="Delete"
                  text
                  size="small"
                  severity="danger"
                  class="mt-2"
                  @click.stop="handleDeleteSpec(spec.id)"
                />
              </div>
            </div>
          </Panel>
        </div>

        <!-- Main Editor Area -->
        <div class="lg:col-span-3">
          <div v-if="editorMode === 'json'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 class="text-xl font-semibold mb-3 text-gray-800">JSON Editor</h2>
              <JsonEditor v-model="jsonValue" height="600px" />
            </div>
            <div>
              <h2 class="text-xl font-semibold mb-3 text-gray-800">API Documentation Preview</h2>
              <div class="border border-gray-300 rounded-lg overflow-auto" style="height: 600px">
                <SwaggerPreview :spec="currentSpec" />
              </div>
            </div>
          </div>
          <div v-else>
            <VisualEditor :spec="currentSpec" @update="handleVisualChange" />
          </div>
        </div>
      </div>
    </div>

    <!-- Diff Viewer Dialog -->
    <DiffViewer :diff="diffData" :visible="showDiff" @close="showDiff = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import Message from 'primevue/message'
import JsonEditor from '@/components/JsonEditor.vue'
import SwaggerPreview from '@/components/SwaggerPreview.vue'
import VisualEditor from '@/components/VisualEditor.vue'
import DiffViewer from '@/components/DiffViewer.vue'
import { specApi, type OpenAPISpec, type ValidationResponse } from '@/lib/api'
import { basicTemplate, emptyTemplate } from '@/lib/templates'

interface DiffData {
  has_changes: boolean
  message?: string
  [key: string]: unknown
}

const specs = ref<OpenAPISpec[]>([])
const currentSpec = ref<Record<string, unknown>>(basicTemplate)
const currentSpecId = ref<number | null>(null)
const editorMode = ref<'json' | 'visual'>('json')
const jsonValue = ref(JSON.stringify(basicTemplate, null, 2))
const validationResult = ref<ValidationResponse | null>(null)
const showValidation = ref(false)
const loading = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const diffData = ref<DiffData | null>(null)
const showDiff = ref(false)

onMounted(() => {
  loadSpecs()
})

const loadSpecs = async () => {
  try {
    const data = await specApi.listSpecs()
    specs.value = data
  } catch {
    showMessage('error', 'Failed to load specifications')
  }
}

const showMessage = (type: 'success' | 'error', text: string) => {
  message.value = { type, text }
  setTimeout(() => (message.value = null), 5000)
}

watch(jsonValue, (newValue) => {
  try {
    const parsed = JSON.parse(newValue)
    currentSpec.value = parsed
  } catch {
    // Invalid JSON, don't update spec
  }
})

const handleVisualChange = (spec: Record<string, unknown>) => {
  currentSpec.value = spec
  jsonValue.value = JSON.stringify(spec, null, 2)
}

const handleNewSpec = () => {
  if (confirm('Create a new specification? Unsaved changes will be lost.')) {
    currentSpec.value = emptyTemplate
    jsonValue.value = JSON.stringify(emptyTemplate, null, 2)
    currentSpecId.value = null
    validationResult.value = null
    showValidation.value = false
  }
}

const handleLoadTemplate = () => {
  currentSpec.value = basicTemplate
  jsonValue.value = JSON.stringify(basicTemplate, null, 2)
  currentSpecId.value = null
  showMessage('success', 'Template loaded')
}

const handleSave = async () => {
  loading.value = true
  try {
    const name = prompt('Enter a name for this specification:')
    if (!name) {
      loading.value = false
      return
    }

    if (currentSpecId.value) {
      await specApi.updateSpec(currentSpecId.value, { spec_json: currentSpec.value })
      showMessage('success', 'Specification updated successfully')
    } else {
      await specApi.createSpec(name, currentSpec.value)
      showMessage('success', 'Specification created successfully')
    }
    await loadSpecs()
  } catch (error: unknown) {
    const errorResponse = error as {
      response?: { data?: { detail?: { message?: string } | string } }
    }
    const detail = errorResponse?.response?.data?.detail
    let errorMsg = 'Failed to save specification'

    if (typeof detail === 'object' && detail?.message) {
      errorMsg = detail.message
    } else if (typeof detail === 'string') {
      errorMsg = detail
    }

    showMessage('error', errorMsg)
  } finally {
    loading.value = false
  }
}

const handleValidate = async () => {
  loading.value = true
  try {
    const result = await specApi.validateSpec(currentSpec.value)
    validationResult.value = result
    showValidation.value = true
    if (result.valid) {
      showMessage('success', 'Specification is valid!')
    } else {
      showMessage('error', 'Specification has validation errors')
    }
  } catch {
    showMessage('error', 'Failed to validate specification')
  } finally {
    loading.value = false
  }
}

const handleLoadSpec = async (spec: OpenAPISpec) => {
  currentSpec.value = spec.spec_json
  jsonValue.value = JSON.stringify(spec.spec_json, null, 2)
  currentSpecId.value = spec.id
  validationResult.value = null
  showValidation.value = false
  showMessage('success', `Loaded: ${spec.name}`)
}

const handleDeleteSpec = async (id: number) => {
  if (!confirm('Delete this specification?')) return

  try {
    await specApi.deleteSpec(id)
    showMessage('success', 'Specification deleted')
    await loadSpecs()
    if (currentSpecId.value === id) {
      handleNewSpec()
    }
  } catch {
    showMessage('error', 'Failed to delete specification')
  }
}

const handleViewDiff = async (id: number) => {
  loading.value = true
  try {
    const diff = (await specApi.getDiff(id)) as DiffData
    diffData.value = diff
    showDiff.value = true
  } catch {
    showMessage('error', 'Failed to load version comparison')
  } finally {
    loading.value = false
  }
}
</script>
