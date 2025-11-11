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
          <Button label="New" @click="handleNewSpec" severity="info" icon="pi pi-plus" />
          <Button label="Load Template" @click="handleLoadTemplate" icon="pi pi-file" />
          <Button
            label="Save"
            @click="handleSave"
            :loading="loading"
            severity="success"
            icon="pi pi-save"
          />
          <Button
            label="Validate"
            @click="handleValidate"
            :loading="loading"
            severity="help"
            icon="pi pi-check-circle"
          />
          <Button
            v-if="currentSpecId"
            label="View Changes"
            @click="handleViewDiff(currentSpecId)"
            :loading="loading"
            icon="pi pi-history"
          />
          <div class="flex-1"></div>
          <Button
            :label="editorMode === 'json' ? 'Visual Editor' : 'JSON Editor'"
            @click="editorMode = editorMode === 'json' ? 'visual' : 'json'"
            :icon="editorMode === 'json' ? 'pi pi-eye' : 'pi pi-code'"
          />
        </div>
      </div>
    </div>

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

    <!-- Save Spec Dialog -->
    <Dialog
      v-model:visible="showSaveDialog"
      header="Save Specification"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="space-y-4">
        <div>
          <label for="spec-name" class="block text-sm font-medium text-gray-700 mb-2">
            Specification Name <span class="text-red-500">*</span>
          </label>
          <InputText
            id="spec-name"
            v-model="saveSpecName"
            placeholder="Enter specification name"
            class="w-full"
            @keyup.enter="confirmSave"
            autofocus
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showSaveDialog = false" />
        <Button label="Save" @click="confirmSave" severity="success" icon="pi pi-save" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
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

const toast = useToast()
const confirm = useConfirm()
const specs = ref<OpenAPISpec[]>([])
const currentSpec = ref<Record<string, unknown>>(basicTemplate)
const currentSpecId = ref<number | null>(null)
const editorMode = ref<'json' | 'visual'>('json')
const jsonValue = ref(JSON.stringify(basicTemplate, null, 2))
const validationResult = ref<ValidationResponse | null>(null)
const showValidation = ref(false)
const loading = ref(false)
const diffData = ref<DiffData | null>(null)
const showDiff = ref(false)

// Dialog states
const showSaveDialog = ref(false)
const saveSpecName = ref('')

onMounted(() => {
  loadSpecs()
})

const loadSpecs = async () => {
  try {
    const data = await specApi.listSpecs()
    specs.value = data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load specifications',
      life: 5000,
    })
  }
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
  confirm.require({
    message: 'Create a new specification? Unsaved changes will be lost.',
    header: 'Confirm New Specification',
    icon: 'pi pi-exclamation-triangle',
    accept: () => {
      currentSpec.value = emptyTemplate
      jsonValue.value = JSON.stringify(emptyTemplate, null, 2)
      currentSpecId.value = null
      validationResult.value = null
      showValidation.value = false
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'New specification created',
        life: 3000,
      })
    },
  })
}

const handleLoadTemplate = () => {
  currentSpec.value = basicTemplate
  jsonValue.value = JSON.stringify(basicTemplate, null, 2)
  currentSpecId.value = null
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: 'Template loaded',
    life: 3000,
  })
}

const handleSave = () => {
  saveSpecName.value = ''
  showSaveDialog.value = true
}

const confirmSave = async () => {
  if (!saveSpecName.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Warning',
      detail: 'Please enter a name for the specification',
      life: 3000,
    })
    return
  }

  loading.value = true
  showSaveDialog.value = false

  try {
    if (currentSpecId.value) {
      await specApi.updateSpec(currentSpecId.value, { spec_json: currentSpec.value })
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Specification updated successfully',
        life: 3000,
      })
    } else {
      await specApi.createSpec(saveSpecName.value, currentSpec.value)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Specification created successfully',
        life: 3000,
      })
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

    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMsg,
      life: 5000,
    })
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
      toast.add({
        severity: 'success',
        summary: 'Validation Successful',
        detail: 'Specification is valid!',
        life: 3000,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Validation Failed',
        detail: 'Specification has validation errors',
        life: 5000,
      })
    }
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to validate specification',
      life: 5000,
    })
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
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: `Loaded: ${spec.name}`,
    life: 3000,
  })
}

const handleDeleteSpec = (id: number) => {
  confirm.require({
    message: 'Are you sure you want to delete this specification?',
    header: 'Confirm Deletion',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await specApi.deleteSpec(id)
        toast.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Specification deleted',
          life: 3000,
        })
        await loadSpecs()
        if (currentSpecId.value === id) {
          currentSpec.value = emptyTemplate
          jsonValue.value = JSON.stringify(emptyTemplate, null, 2)
          currentSpecId.value = null
          validationResult.value = null
          showValidation.value = false
        }
      } catch {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete specification',
          life: 5000,
        })
      }
    },
  })
}

const handleViewDiff = async (id: number) => {
  loading.value = true
  try {
    const diff = (await specApi.getDiff(id)) as DiffData
    diffData.value = diff
    showDiff.value = true
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load version comparison',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>
