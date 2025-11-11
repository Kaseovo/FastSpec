<template>
  <div class="mt-3 space-y-3 bg-gray-50 p-3 rounded-lg">
    <h5 class="font-medium text-sm text-gray-700">Constraints</h5>

    <template v-if="field.type === 'string'">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Min Length</label>
          <InputNumber
            :model-value="field.constraints?.minLength"
            @update:model-value="
              $emit('update', fieldName, 'minLength', $event || '')
            "
            :min="0"
            class="w-full"
            placeholder="0"
            :use-grouping="false"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Max Length</label>
          <InputNumber
            :model-value="field.constraints?.maxLength"
            @update:model-value="
              $emit('update', fieldName, 'maxLength', $event || '')
            "
            :min="0"
            class="w-full"
            placeholder="∞"
            :use-grouping="false"
          />
        </div>
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">Pattern (Regex)</label>
        <InputText
          :model-value="field.constraints?.pattern"
          @update:model-value="$emit('update', fieldName, 'pattern', ($event as string) || '')"
          class="w-full"
          placeholder="^[A-Za-z]+$"
        />
      </div>
    </template>

    <template v-if="field.type === 'number' || field.type === 'integer'">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Minimum</label>
          <InputNumber
            :model-value="field.constraints?.minimum"
            @update:model-value="$emit('update', fieldName, 'minimum', $event ?? '')"
            class="w-full"
            placeholder="-∞"
            :use-grouping="false"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Maximum</label>
          <InputNumber
            :model-value="field.constraints?.maximum"
            @update:model-value="$emit('update', fieldName, 'maximum', $event ?? '')"
            class="w-full"
            placeholder="∞"
            :use-grouping="false"
          />
        </div>
      </div>
    </template>

    <template v-if="field.type === 'array'">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Min Items</label>
          <InputNumber
            :model-value="field.constraints?.minItems"
            @update:model-value="
              $emit('update', fieldName, 'minItems', $event || '')
            "
            :min="0"
            class="w-full"
            placeholder="0"
            :use-grouping="false"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Max Items</label>
          <InputNumber
            :model-value="field.constraints?.maxItems"
            @update:model-value="
              $emit('update', fieldName, 'maxItems', $event || '')
            "
            :min="0"
            class="w-full"
            placeholder="∞"
            :use-grouping="false"
          />
        </div>
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">Item Type</label>
        <Select
          :model-value="field.items?.type || 'string'"
          @update:model-value="$emit('update-items', fieldName, ($event as string) || 'string')"
          :options="['string', 'number', 'integer', 'boolean', 'object']"
          class="w-full"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import type { Field } from './FieldEditor.vue'

interface Props {
  fieldName: string
  field: Field
}

interface Emits {
  (e: 'update', fieldName: string, constraint: string, value: string | number): void
  (e: 'update-items', fieldName: string, type: string): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>
