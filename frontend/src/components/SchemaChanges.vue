<template>
  <div class="space-y-2 text-sm">
    <div v-if="changes.added_fields && changes.added_fields.length > 0">
      <span class="font-medium text-green-700">Added fields:</span>
      <ul class="list-disc list-inside ml-4 text-green-600">
        <li v-for="(field, idx) in changes.added_fields" :key="idx">
          {{ field.name }} ({{ field.type }}){{ field.required ? ' [required]' : '' }}
        </li>
      </ul>
    </div>

    <div v-if="changes.removed_fields && changes.removed_fields.length > 0">
      <span class="font-medium text-red-700">Removed fields:</span>
      <ul class="list-disc list-inside ml-4 text-red-600">
        <li v-for="(field, idx) in changes.removed_fields" :key="idx">
          {{ field.name }} ({{ field.type }}){{ field.required ? ' [required]' : '' }}
        </li>
      </ul>
    </div>

    <div v-if="changes.modified_fields && changes.modified_fields.length > 0">
      <span class="font-medium text-yellow-700">Modified fields:</span>
      <ul class="list-disc list-inside ml-4">
        <li v-for="(field, idx) in changes.modified_fields" :key="idx" class="text-gray-700">
          <span class="font-medium">{{ field.name }}:</span>
          <div
            v-for="[changeType, change] in Object.entries(field.changes || {})"
            :key="changeType"
            class="ml-4 text-xs"
          >
            {{ changeType }}:
            <span class="line-through text-red-600">{{ String(change.old) }}</span>
            →
            <span class="text-green-600">{{ String(change.new) }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FieldChange {
  name: string
  type?: string
  required?: boolean
  changes?: Record<string, { old: unknown; new: unknown }>
}

interface Props {
  changes: {
    added_fields?: FieldChange[]
    removed_fields?: FieldChange[]
    modified_fields?: FieldChange[]
    has_changes: boolean
  }
}

defineProps<Props>()
</script>
