<template>
  <Dialog
    v-model:visible="isVisible"
    header="Version Comparison"
    :modal="true"
    :closable="true"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    @hide="$emit('close')"
  >
    <div v-if="!diff?.has_changes" class="text-center py-8">
      <p class="text-gray-600 text-lg">
        {{ diff?.message || 'No changes detected between versions' }}
      </p>
    </div>

    <div v-else class="space-y-6">
      <!-- Info Changes -->
      <div
        v-if="diff.info_changes && Object.keys(diff.info_changes).length > 0"
        class="bg-blue-50 border border-blue-200 rounded-lg p-4"
      >
        <h3 class="text-lg font-semibold text-blue-900 mb-3">API Information Changes</h3>
        <div class="space-y-2">
          <div
            v-for="[field, change] in Object.entries(diff.info_changes)"
            :key="field"
            class="flex items-center gap-2"
          >
            <span class="font-medium text-blue-800 capitalize">{{ field }}:</span>
            <span class="line-through text-red-600">{{ String(change.old) }}</span>
            <span class="text-gray-500">→</span>
            <span class="text-green-600 font-medium">{{ String(change.new) }}</span>
          </div>
        </div>
      </div>

      <!-- Added Endpoints -->
      <div
        v-if="diff.added_endpoints && diff.added_endpoints.length > 0"
        class="bg-green-50 border border-green-200 rounded-lg p-4"
      >
        <h3 class="text-lg font-semibold text-green-900 mb-3">✅ Added Endpoints</h3>
        <div class="space-y-2">
          <div
            v-for="(endpoint, idx) in diff.added_endpoints"
            :key="idx"
            class="flex items-center gap-3"
          >
            <Tag :value="endpoint.method.toUpperCase()" :severity="getMethodSeverity(endpoint.method)" />
            <span class="font-medium text-gray-900">{{ endpoint.path }}</span>
            <span v-if="endpoint.summary" class="text-gray-600 text-sm">
              - {{ endpoint.summary }}
            </span>
          </div>
        </div>
      </div>

      <!-- Removed Endpoints -->
      <div
        v-if="diff.removed_endpoints && diff.removed_endpoints.length > 0"
        class="bg-red-50 border border-red-200 rounded-lg p-4"
      >
        <h3 class="text-lg font-semibold text-red-900 mb-3">❌ Removed Endpoints</h3>
        <div class="space-y-2">
          <div
            v-for="(endpoint, idx) in diff.removed_endpoints"
            :key="idx"
            class="flex items-center gap-3"
          >
            <Tag :value="endpoint.method.toUpperCase()" :severity="getMethodSeverity(endpoint.method)" />
            <span class="font-medium text-gray-900 line-through">{{ endpoint.path }}</span>
            <span v-if="endpoint.summary" class="text-gray-600 text-sm">
              - {{ endpoint.summary }}
            </span>
          </div>
        </div>
      </div>

      <!-- Modified Endpoints -->
      <div
        v-if="diff.modified_endpoints && diff.modified_endpoints.length > 0"
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
      >
        <h3 class="text-lg font-semibold text-yellow-900 mb-3">🔄 Modified Endpoints</h3>
        <div class="space-y-4">
          <div
            v-for="(endpoint, idx) in diff.modified_endpoints"
            :key="idx"
            class="bg-white rounded-lg p-4 border border-yellow-300"
          >
            <div class="flex items-center gap-3 mb-3">
              <Tag :value="endpoint.method.toUpperCase()" :severity="getMethodSeverity(endpoint.method)" />
              <span class="font-medium text-gray-900">{{ endpoint.path }}</span>
            </div>

            <div v-if="endpoint.summary_changed" class="mb-3 text-sm">
              <span class="font-medium">Summary: </span>
              <span class="line-through text-red-600">{{ endpoint.summary_old }}</span>
              <span class="text-gray-500 mx-2">→</span>
              <span class="text-green-600">{{ endpoint.summary_new }}</span>
            </div>

            <div v-if="endpoint.request_body_changes?.has_changes" class="mb-3">
              <h4 class="font-semibold text-sm text-gray-700 mb-2">Request Body Changes:</h4>
              <SchemaChanges :changes="endpoint.request_body_changes" />
            </div>

            <div
              v-for="[status, changes] in Object.entries(endpoint.response_changes || {})"
              :key="status"
            >
              <div v-if="(changes as any).has_changes" class="mb-3">
                <h4 class="font-semibold text-sm text-gray-700 mb-2">
                  Response {{ status }} Changes:
                </h4>
                <SchemaChanges :changes="changes" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import SchemaChanges from './SchemaChanges.vue'

interface FieldChange {
  name: string
  type?: string
  required?: boolean
  changes?: Record<string, { old: unknown; new: unknown }>
}

interface SchemaChanges {
  added_fields?: FieldChange[]
  removed_fields?: FieldChange[]
  modified_fields?: FieldChange[]
  has_changes: boolean
}

interface EndpointChange {
  path: string
  method: string
  summary?: string
  summary_changed?: boolean
  summary_old?: string
  summary_new?: string
  request_body_changes?: SchemaChanges
  response_changes?: Record<string, SchemaChanges>
  has_changes?: boolean
}

interface DiffData {
  added_endpoints?: EndpointChange[]
  removed_endpoints?: EndpointChange[]
  modified_endpoints?: EndpointChange[]
  info_changes?: Record<string, { old: unknown; new: unknown }>
  has_changes: boolean
  message?: string
}

interface Props {
  diff: DiffData | null
  visible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isVisible = ref(props.visible)

watch(
  () => props.visible,
  (newValue) => {
    isVisible.value = newValue
  }
)

watch(isVisible, (newValue) => {
  if (!newValue) {
    emit('close')
  }
})

const getMethodSeverity = (method: string) => {
  const severityMap: Record<string, 'info' | 'success' | 'warn' | 'danger'> = {
    get: 'info',
    post: 'success',
    put: 'warn',
    delete: 'danger',
    patch: 'warn'
  }
  return severityMap[method.toLowerCase()] || undefined
}
</script>
