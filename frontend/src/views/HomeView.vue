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
    <div class="max-w-6xl mx-auto px-6">
      <!-- Editor Card -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <!-- Toolbar -->
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2">
              <i class="pi pi-code text-gray-600"></i>
              <h2 class="text-lg font-semibold text-gray-800">JSON Editor</h2>
            </div>
            <div class="flex gap-2 flex-wrap">
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
          <!-- Line numbers overlay (optional enhancement) -->
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'

const toast = useToast()
const jsonValue = ref('')
const copied = ref(false)
const lastUpdated = ref(new Date().toLocaleTimeString())

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
